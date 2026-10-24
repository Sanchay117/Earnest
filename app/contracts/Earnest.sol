// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function getApproved(uint256 tokenId) external view returns (address);
    function getAgentWallet(uint256 agentId) external view returns (address);
}

interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 average, uint8 averageDecimals);

    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64);
    function getClients(uint256 agentId) external view returns (address[] memory);
}

enum JobStatus {
    Open,
    Funded,
    Submitted,
    Completed,
    Rejected,
    Expired
}

struct Job {
    uint256 id;
    address client;
    address provider;
    address evaluator;
    string description;
    uint256 budget;
    uint256 expiredAt;
    JobStatus status;
    address hook;
}

contract Earnest is ReentrancyGuard {
    error InvalidJob();
    error WrongStatus();
    error Unauthorized();
    error ZeroAddress();
    error ExpiryTooShort();
    error ZeroBudget();
    error ProviderNotSet();
    error BudgetNotSet();
    error BudgetChanged();
    error NotExpired();
    error Expired();
    error HookNotSupported();
    error UnknownAgent();
    error BadRating();
    error SelfReview();
    error FeeTooHigh();

    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        address indexed provider,
        address evaluator,
        uint256 expiredAt,
        address hook
    );
    event JobDescription(uint256 indexed jobId, string description);
    event ProviderSet(uint256 indexed jobId, address provider);
    event BudgetSet(uint256 indexed jobId, uint256 amount);
    event JobFunded(uint256 indexed jobId, address indexed client, uint256 amount);
    event JobSubmitted(uint256 indexed jobId, address indexed provider, bytes32 deliverable);
    event JobCompleted(uint256 indexed jobId, address indexed evaluator, bytes32 reason);
    event JobRejected(uint256 indexed jobId, address indexed caller, bytes32 reason);
    event JobExpired(uint256 indexed jobId);
    event PaymentReleased(uint256 indexed jobId, address indexed provider, uint256 amount);
    event Refunded(uint256 indexed jobId, address indexed client, uint256 amount);
    event Reviewed(
        uint256 indexed jobId,
        uint256 indexed agentId,
        address indexed client,
        uint8 rating,
        uint256 budget,
        uint64 feedbackIndex
    );
    event ReviewBlocked(uint256 indexed jobId, uint256 indexed agentId, address indexed client, uint8 rating, uint256 budget);

    IERC20 public immutable usdc;
    IIdentityRegistry public immutable identity;
    IReputationRegistry public immutable reputation;
    address public immutable treasury;
    uint16 public immutable feeBps;

    uint256 private _jobCounter;
    mapping(uint256 => Job) private _jobs;

    mapping(uint256 jobId => uint256 agentId) public jobAgentId;
    mapping(uint256 jobId => bool) public isAgentJob;
    mapping(uint256 agentId => uint256) public paidVolume;
    mapping(uint256 agentId => uint256) public reviewCount;
    mapping(uint256 agentId => uint256) public blockedReviews;
    mapping(uint256 jobId => bytes32) public deliverables;

    constructor(
        IERC20 usdc_,
        IIdentityRegistry identity_,
        IReputationRegistry reputation_,
        address treasury_,
        uint16 feeBps_
    ) {
        if (treasury_ == address(0)) revert ZeroAddress();
        if (feeBps_ > 1000) revert FeeTooHigh();

        usdc = usdc_;
        identity = identity_;
        reputation = reputation_;
        treasury = treasury_;
        feeBps = feeBps_;
    }

    function createJob(
        address provider,
        address evaluator,
        uint256 expiredAt,
        string calldata description,
        address hook
    ) external returns (uint256) {
        if (hook != address(0)) revert HookNotSupported();
        return _createJob(provider, evaluator, expiredAt, description);
    }

    function createAgentJob(
        uint256 agentId,
        address evaluator,
        uint256 expiredAt,
        string calldata description,
        uint256 budget
    ) external returns (uint256 jobId) {
        address owner;
        try identity.ownerOf(agentId) returns (address owner_) {
            owner = owner_;
        } catch {
            revert UnknownAgent();
        }

        if (owner == address(0)) revert UnknownAgent();

        address provider = identity.getAgentWallet(agentId);
        if (provider == address(0)) {
            provider = owner;
        }

        jobId = _createJob(provider, evaluator, expiredAt, description);

        if (budget > 0) {
            _jobs[jobId].budget = budget;
            emit BudgetSet(jobId, budget);
        }

        jobAgentId[jobId] = agentId;
        isAgentJob[jobId] = true;
    }

    function setProvider(uint256 jobId, address provider) external {
        _requireValidJob(jobId);
        Job storage job = _jobs[jobId];

        if (msg.sender != job.client) revert Unauthorized();
        if (job.status != JobStatus.Open) revert WrongStatus();
        if (job.provider != address(0)) revert WrongStatus();
        if (provider == address(0)) revert ZeroAddress();

        job.provider = provider;
        emit ProviderSet(jobId, provider);
    }

    function setBudget(uint256 jobId, uint256 amount, bytes calldata /* optParams */ ) external {
        _requireValidJob(jobId);
        Job storage job = _jobs[jobId];

        if (job.status != JobStatus.Open) revert WrongStatus();
        if (msg.sender != job.client && msg.sender != job.provider) revert Unauthorized();
        if (amount == 0) revert ZeroBudget();

        job.budget = amount;
        emit BudgetSet(jobId, amount);
    }

    function fund(uint256 jobId, bytes calldata optParams) external nonReentrant {
        _requireValidJob(jobId);
        Job storage job = _jobs[jobId];

        if (msg.sender != job.client) revert Unauthorized();
        if (job.status != JobStatus.Open) revert WrongStatus();
        if (job.provider == address(0)) revert ProviderNotSet();
        if (job.budget == 0) revert BudgetNotSet();
        if (block.timestamp >= job.expiredAt) revert Expired();

        if (optParams.length == 32) {
            uint256 expectedBudget = abi.decode(optParams, (uint256));
            if (expectedBudget != job.budget) revert BudgetChanged();
        }

        uint256 amount = job.budget;
        job.status = JobStatus.Funded;

        if (!usdc.transferFrom(msg.sender, address(this), amount)) {
            revert();
        }

        emit JobFunded(jobId, msg.sender, amount);
    }

    function submit(uint256 jobId, bytes32 deliverable, bytes calldata /* optParams */ ) external {
        _requireValidJob(jobId);
        Job storage job = _jobs[jobId];

        if (msg.sender != job.provider) revert Unauthorized();
        if (job.status != JobStatus.Funded) revert WrongStatus();

        deliverables[jobId] = deliverable;
        job.status = JobStatus.Submitted;

        emit JobSubmitted(jobId, msg.sender, deliverable);
    }

    function complete(uint256 jobId, bytes32 reason, bytes calldata optParams) external nonReentrant {
        _requireValidJob(jobId);
        Job storage job = _jobs[jobId];

        if (msg.sender != job.evaluator) revert Unauthorized();
        if (job.status != JobStatus.Submitted) revert WrongStatus();

        uint256 budget = job.budget;
        uint256 fee = (budget * feeBps) / 10_000;
        uint256 providerAmount = budget - fee;
        address provider = job.provider;
        address client = job.client;
        address evaluator = job.evaluator;

        job.status = JobStatus.Completed;

        if (!usdc.transfer(provider, providerAmount)) revert();
        if (!usdc.transfer(treasury, fee)) revert();

        emit JobCompleted(jobId, evaluator, reason);
        emit PaymentReleased(jobId, provider, providerAmount);

        if (isAgentJob[jobId]) {
            _handleReview(jobId, budget, client, evaluator, optParams);
        }
    }

    function _handleReview(
        uint256 jobId,
        uint256 budget,
        address client,
        address evaluator,
        bytes calldata optParams
    ) internal {
        if (optParams.length == 0) return;
        if (optParams.length != 32) revert BadRating();

        uint8 rating = abi.decode(optParams, (uint8));
        if (rating > 100) revert BadRating();

        uint256 agentId = jobAgentId[jobId];
        _checkSelfReview(agentId, client, evaluator);

        bytes32 deliverable = deliverables[jobId];
        bytes32 feedbackHash = keccak256(abi.encode(block.chainid, address(this), jobId, budget, deliverable));

        try reputation.giveFeedback(
            agentId,
            int128(uint128(rating)),
            0,
            "earnest",
            "",
            "",
            "",
            feedbackHash
        ) {
            // Accounting updated only on confirmed registry write
            paidVolume[agentId] += budget;
            reviewCount[agentId] += 1;
            uint64 feedbackIndex = reputation.getLastIndex(agentId, address(this));
            emit Reviewed(jobId, agentId, client, rating, budget, feedbackIndex);
        } catch (bytes memory err) {
            _handleReviewCatch(jobId, agentId, client, rating, budget, err);
        }
    }

    /// @dev Separated to avoid stack-too-deep in _handleReview.
    function _handleReviewCatch(
        uint256 jobId,
        uint256 agentId,
        address client,
        uint8 rating,
        uint256 budget,
        bytes memory err
    ) internal {
        // Distinguish a deliberate owner-block from an OOG gas-grief.
        // The owner blocks Earnest by granting it approval; any other failure bubbles up.
        address owner = identity.ownerOf(agentId);
        bool ownerBlockedEarnest =
            identity.isApprovedForAll(owner, address(this)) ||
            identity.getApproved(agentId) == address(this);

        if (ownerBlockedEarnest) {
            blockedReviews[agentId] += 1;
            emit ReviewBlocked(jobId, agentId, client, rating, budget);
        } else {
            assembly {
                revert(add(err, 32), mload(err))
            }
        }
    }

    function _checkSelfReview(uint256 agentId, address client, address evaluator) internal view {
        address owner = identity.ownerOf(agentId);
        address agentWallet = identity.getAgentWallet(agentId);

        if (client == owner || evaluator == owner) revert SelfReview();
        if (agentWallet != address(0) && (client == agentWallet || evaluator == agentWallet)) revert SelfReview();
        if (identity.isApprovedForAll(owner, client) || identity.isApprovedForAll(owner, evaluator)) revert SelfReview();
        address approved = identity.getApproved(agentId);
        if (approved != address(0) && (client == approved || evaluator == approved)) revert SelfReview();
    }

    function reject(uint256 jobId, bytes32 reason, bytes calldata /* optParams */ ) external nonReentrant {
        _requireValidJob(jobId);
        Job storage job = _jobs[jobId];

        if (job.status == JobStatus.Open) {
            if (msg.sender != job.client) revert Unauthorized();
            job.status = JobStatus.Rejected;
            emit JobRejected(jobId, msg.sender, reason);
            return;
        }

        if (job.status == JobStatus.Funded || job.status == JobStatus.Submitted) {
            if (msg.sender != job.evaluator) revert Unauthorized();
            uint256 budget = job.budget;
            address client = job.client;
            job.status = JobStatus.Rejected;
            if (!usdc.transfer(client, budget)) revert();
            emit JobRejected(jobId, msg.sender, reason);
            emit Refunded(jobId, client, budget);
            return;
        }

        revert WrongStatus();
    }

    function claimRefund(uint256 jobId) external nonReentrant {
        _requireValidJob(jobId);
        Job storage job = _jobs[jobId];

        if (job.status != JobStatus.Funded && job.status != JobStatus.Submitted) {
            revert WrongStatus();
        }
        if (block.timestamp < job.expiredAt) revert NotExpired();

        uint256 budget = job.budget;
        job.status = JobStatus.Expired;

        if (!usdc.transfer(job.client, budget)) {
            revert();
        }

        emit JobExpired(jobId);
        emit Refunded(jobId, job.client, budget);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        _requireValidJob(jobId);
        return _jobs[jobId];
    }

    function agentOf(uint256 jobId) external view returns (uint256 agentId, bool isAgentJobFlag) {
        return (jobAgentId[jobId], isAgentJob[jobId]);
    }

    function jobCounter() external view returns (uint256) {
        return _jobCounter;
    }

    function _createJob(
        address provider,
        address evaluator,
        uint256 expiredAt,
        string calldata description
    ) internal returns (uint256 jobId) {
        if (evaluator == address(0)) revert ZeroAddress();
        if (expiredAt < block.timestamp + 5 minutes) revert ExpiryTooShort();

        jobId = ++_jobCounter;

        _jobs[jobId] = Job({
            id: jobId,
            client: msg.sender,
            provider: provider,
            evaluator: evaluator,
            description: description,
            budget: 0,
            expiredAt: expiredAt,
            status: JobStatus.Open,
            hook: address(0)
        });

        emit JobCreated(jobId, msg.sender, provider, evaluator, expiredAt, address(0));
        emit JobDescription(jobId, description);
    }

    function _requireValidJob(uint256 jobId) internal view {
        if (jobId == 0 || jobId > _jobCounter) revert InvalidJob();
    }
}
