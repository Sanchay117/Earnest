// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev Mock IIdentityRegistry for Earnest unit tests.
contract MockIdentityRegistry {
    mapping(uint256 => address) public owners;
    mapping(uint256 => address) public agentWallets;
    mapping(address => mapping(address => bool)) public approvals;
    mapping(uint256 => address) public approvedForToken; // getApproved

    // --- helpers ---
    function setOwner(uint256 id, address owner) external {
        owners[id] = owner;
    }

    function setAgentWallet(uint256 id, address wallet) external {
        agentWallets[id] = wallet;
    }

    function setApproval(address owner, address operator, bool approved) external {
        approvals[owner][operator] = approved;
    }

    function setApprovedForToken(uint256 tokenId, address approved) external {
        approvedForToken[tokenId] = approved;
    }

    // --- IIdentityRegistry surface ---
    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = owners[tokenId];
        require(o != address(0), "nonexistent agent");
        return o;
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        return agentWallets[agentId];
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return approvals[owner][operator];
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        return approvedForToken[tokenId];
    }
}
