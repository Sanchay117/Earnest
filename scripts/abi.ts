// Human-readable ABIs for Earnest and the ERC-8004 registries it uses (selectors checked against Arc mainnet).
import { parseAbi } from "viem";

export const earnestAbi = parseAbi([
  "struct Job { uint256 id; address client; address provider; address evaluator; string description; uint256 budget; uint256 expiredAt; uint8 status; address hook; }",
  "function createJob(address provider, address evaluator, uint256 expiredAt, string description, address hook) returns (uint256)",
  "function createAgentJob(uint256 agentId, address evaluator, uint256 expiredAt, string description, uint256 budget) returns (uint256)",
  "function setProvider(uint256 jobId, address provider)",
  "function setBudget(uint256 jobId, uint256 amount, bytes optParams)",
  "function fund(uint256 jobId, bytes optParams)",
  "function submit(uint256 jobId, bytes32 deliverable, bytes optParams)",
  "function complete(uint256 jobId, bytes32 reason, bytes optParams)",
  "function reject(uint256 jobId, bytes32 reason, bytes optParams)",
  "function claimRefund(uint256 jobId)",
  "function getJob(uint256 jobId) view returns (Job)",
  "function jobCounter() view returns (uint256)",
  "function agentOf(uint256 jobId) view returns (uint256 agentId, bool isAgentJob)",
  "function paidVolume(uint256 agentId) view returns (uint256)",
  "function reviewCount(uint256 agentId) view returns (uint256)",
  "function blockedReviews(uint256 agentId) view returns (uint256)",
  "function deliverables(uint256 jobId) view returns (bytes32)",
  "error SelfReview()",
  "error BadRating()",
  "error WrongStatus()",
  "error NotExpired()",
  "error Unauthorized()",
  "event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, address evaluator, uint256 expiredAt, address hook)",
  "event Reviewed(uint256 indexed jobId, uint256 indexed agentId, address indexed client, uint8 rating, uint256 budget, uint64 feedbackIndex)",
  "event ReviewBlocked(uint256 indexed jobId, uint256 indexed agentId, address indexed client, uint8 rating, uint256 budget)",
  "event JobFunded(uint256 indexed jobId, address indexed client, uint256 amount)",
  "event JobSubmitted(uint256 indexed jobId, address indexed provider, bytes32 deliverable)",
  "event JobCompleted(uint256 indexed jobId, address indexed evaluator, bytes32 reason)",
  "event JobRejected(uint256 indexed jobId, address indexed rejector, bytes32 reason)",
  "event JobExpired(uint256 indexed jobId)",
  "event PaymentReleased(uint256 indexed jobId, address indexed provider, uint256 amount)",
  "event Refunded(uint256 indexed jobId, address indexed client, uint256 amount)",
]);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
]);

export const identityAbi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function ownerOf(uint256 agentId) view returns (address)",
  "function tokenURI(uint256 agentId) view returns (string)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function setAgentURI(uint256 agentId, string newURI)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

export const reputationAbi = parseAbi([
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function getClients(uint256 agentId) view returns (address[])",
  "function getLastIndex(uint256 agentId, address clientAddress) view returns (uint64)",
  "function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex) view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)",
]);

export const STATUS = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"] as const;
