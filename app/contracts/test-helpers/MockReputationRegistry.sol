// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev Mock IReputationRegistry for Earnest unit tests.
contract MockReputationRegistry {
    struct FeedbackEntry {
        int128 value;
        string tag1;
        bytes32 feedbackHash;
    }

    // agentId => clientAddress => entries
    mapping(uint256 => mapping(address => FeedbackEntry[])) private _feedback;

    // Public counter so tests can read it directly.
    mapping(uint256 => mapping(address => uint256)) public feedbackCount;

    // agentId => owner (for self-review guard)
    mapping(uint256 => address) public agentOwners;

    // agentId => caller => blocked flag (simulates registry rejecting certain callers)
    mapping(uint256 => mapping(address => bool)) public blockedCallers;

    // --- helpers ---
    function setAgentOwner(uint256 agentId, address owner) external {
        agentOwners[agentId] = owner;
    }

    function setBlockedCaller(uint256 agentId, address caller, bool blocked) external {
        blockedCallers[agentId][caller] = blocked;
    }

    // --- IReputationRegistry surface ---
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 /* valueDecimals */,
        string calldata tag1,
        string calldata /* tag2 */,
        string calldata /* endpoint */,
        string calldata /* feedbackURI */,
        bytes32 feedbackHash
    ) external {
        // Reject if caller is the agent owner (self-review guard on registry side)
        if (msg.sender == agentOwners[agentId]) revert("self review");
        // Reject if caller has been explicitly blocked (simulates operator / approval checks)
        if (blockedCallers[agentId][msg.sender]) revert("blocked");

        _feedback[agentId][msg.sender].push(FeedbackEntry({value: value, tag1: tag1, feedbackHash: feedbackHash}));
        feedbackCount[agentId][msg.sender] += 1;
    }

    /// @dev Returns the index of the last entry, or 0 if none.
    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64) {
        uint256 count = feedbackCount[agentId][clientAddress];
        if (count == 0) return 0;
        return uint64(count - 1);
    }

    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata /* tag1 */,
        string calldata /* tag2 */
    ) external view returns (uint64 count, int128 average, uint8 averageDecimals) {
        uint256 total;
        int128 sum;
        for (uint256 i; i < clientAddresses.length; i++) {
            FeedbackEntry[] storage entries = _feedback[agentId][clientAddresses[i]];
            for (uint256 j; j < entries.length; j++) {
                sum += entries[j].value;
                total++;
            }
        }
        count = uint64(total);
        average = total == 0 ? int128(0) : sum / int128(int256(total));
        averageDecimals = 0;
    }

    function getClients(uint256 /* agentId */) external pure returns (address[] memory) {
        return new address[](0);
    }

    // --- test helpers for assertions ---
    function getLastFeedback(uint256 agentId, address clientAddress)
        external
        view
        returns (int128 value, string memory tag1, bytes32 feedbackHash)
    {
        uint256 count = feedbackCount[agentId][clientAddress];
        require(count > 0, "no feedback");
        FeedbackEntry storage e = _feedback[agentId][clientAddress][count - 1];
        return (e.value, e.tag1, e.feedbackHash);
    }
}
