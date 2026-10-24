// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Earnest, JobStatus, Job, IERC20, IIdentityRegistry, IReputationRegistry} from "../Earnest.sol";
import {MockUSDC} from "../test-helpers/MockUSDC.sol";
import {MockIdentityRegistry} from "../test-helpers/MockIdentityRegistry.sol";
import {MockReputationRegistry} from "../test-helpers/MockReputationRegistry.sol";

contract EarnestTest is Test {
    // -------------------------------------------------------------------------
    // Actors
    // -------------------------------------------------------------------------
    address internal alice = makeAddr("alice");   // client
    address internal bob   = makeAddr("bob");     // agent owner
    address internal carol = makeAddr("carol");   // evaluator
    address internal dave  = makeAddr("dave");    // agent wallet / provider

    // -------------------------------------------------------------------------
    // Contracts
    // -------------------------------------------------------------------------
    MockUSDC               internal usdc;
    MockIdentityRegistry   internal identity;
    MockReputationRegistry internal reputation;
    Earnest                internal earnest;

    uint256 internal constant AGENT_ID = 1;
    uint256 internal constant BUDGET   = 1_000_000; // 1 USDC (6 dec)

    // -------------------------------------------------------------------------
    // setUp
    // -------------------------------------------------------------------------
    function setUp() public {
        usdc       = new MockUSDC();
        identity   = new MockIdentityRegistry();
        reputation = new MockReputationRegistry();
        earnest    = new Earnest(
            IERC20(address(usdc)),
            IIdentityRegistry(address(identity)),
            IReputationRegistry(address(reputation)),
            makeAddr("treasury"),
            100  // 1 %  => feeBps = 100, fee = budget * 100 / 10_000
        );

        // Agent 1: owner = bob, wallet = dave
        identity.setOwner(AGENT_ID, bob);
        identity.setAgentWallet(AGENT_ID, dave);
        reputation.setAgentOwner(AGENT_ID, bob);

        // Fund alice and approve earnest
        usdc.mint(alice, 10_000_000);
        vm.prank(alice);
        usdc.approve(address(earnest), type(uint256).max);
    }

    // =========================================================================
    // Test 1 — Happy path: createAgentJob → fund → submit → complete(rating=90)
    // =========================================================================
    function test_HappyPath_AgentJobCompleteWithRating() public {
        // Create job
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );

        // Verify initial state
        Job memory j = earnest.getJob(jobId);
        assertEq(j.provider, dave,  "provider should be dave (agent wallet)");
        assertTrue(earnest.isAgentJob(jobId), "should be agent job");

        // Fund
        vm.prank(alice);
        earnest.fund(jobId, "");

        // Submit
        vm.prank(dave);
        earnest.submit(jobId, keccak256("work"), "");

        // Complete with rating 90
        address treasury = makeAddr("treasury");
        vm.prank(carol);
        earnest.complete(jobId, "", abi.encode(uint8(90)));

        // --- fee math: fee = 1_000_000 * 100 / 10_000 = 10_000 ---
        uint256 expectedFee      = BUDGET * 100 / 10_000; // 10_000
        uint256 expectedProvider = BUDGET - expectedFee;   // 990_000

        assertEq(uint256(earnest.getJob(jobId).status), uint256(JobStatus.Completed), "status");
        assertEq(usdc.balanceOf(dave),     expectedProvider, "provider balance");
        assertEq(usdc.balanceOf(treasury), expectedFee,      "treasury balance");
        assertEq(expectedProvider + expectedFee, BUDGET,     "sum == budget");

        // Reputation
        assertEq(
            reputation.feedbackCount(AGENT_ID, address(earnest)),
            1,
            "feedbackCount"
        );
        (int128 val, string memory tag1,) = reputation.getLastFeedback(AGENT_ID, address(earnest));
        assertEq(int256(val),  int256(90),   "feedback value");
        assertEq(tag1, "earnest",            "feedback tag1");

        assertEq(earnest.paidVolume(AGENT_ID),  BUDGET, "paidVolume");
        assertEq(earnest.reviewCount(AGENT_ID), 1,      "reviewCount");
    }

    // =========================================================================
    // Test 2 — Complete without rating: payment released, no review
    // =========================================================================
    function test_CompleteWithoutRating_NoReview() public {
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );

        vm.prank(alice);  earnest.fund(jobId, "");
        vm.prank(dave);   earnest.submit(jobId, keccak256("work"), "");
        vm.prank(carol);  earnest.complete(jobId, "", "");

        assertEq(uint256(earnest.getJob(jobId).status), uint256(JobStatus.Completed), "status");
        assertTrue(usdc.balanceOf(dave) > 0, "provider should have been paid");
        assertEq(
            reputation.feedbackCount(AGENT_ID, address(earnest)),
            0,
            "no feedback without rating"
        );
    }

    // =========================================================================
    // Test 3 — Expiry: warp past expiredAt → claimRefund succeeds
    // =========================================================================
    function test_ClaimRefund_AfterExpiry() public {
        uint256 expiredAt = block.timestamp + 5 minutes + 1;

        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, expiredAt, "desc", BUDGET
        );

        vm.prank(alice);
        earnest.fund(jobId, "");

        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.warp(expiredAt + 1);
        earnest.claimRefund(jobId);

        assertEq(uint256(earnest.getJob(jobId).status), uint256(JobStatus.Expired), "status");
        assertEq(usdc.balanceOf(alice), balanceBefore + BUDGET, "full refund");
    }

    // =========================================================================
    // Test 4 — claimRefund before expiry reverts NotExpired
    // =========================================================================
    function test_ClaimRefund_BeforeExpiry_RevertsNotExpired() public {
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );

        vm.prank(alice);
        earnest.fund(jobId, "");

        vm.expectRevert(Earnest.NotExpired.selector);
        earnest.claimRefund(jobId);
    }

    // =========================================================================
    // Test 5 — Evaluator rejects: full refund, no payment to provider
    // =========================================================================
    function test_Reject_FullRefundToClient() public {
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );

        vm.prank(alice);  earnest.fund(jobId, "");
        vm.prank(dave);   earnest.submit(jobId, keccak256("work"), "");

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(carol);
        earnest.reject(jobId, "", "");

        assertEq(uint256(earnest.getJob(jobId).status), uint256(JobStatus.Rejected), "status");
        assertEq(usdc.balanceOf(alice), aliceBefore + BUDGET, "full refund to client");
        assertEq(usdc.balanceOf(dave),  0,                    "no payment to provider");
    }

    // =========================================================================
    // Test 6a — SelfReview: client == agent owner (bob) reverts
    // =========================================================================
    function test_SelfReview_ClientIsOwner_Reverts() public {
        // bob is agent owner → bob as client triggers SelfReview
        vm.prank(bob);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );

        usdc.mint(bob, BUDGET);
        vm.prank(bob);
        usdc.approve(address(earnest), type(uint256).max);

        vm.prank(bob);  earnest.fund(jobId, "");
        vm.prank(dave); earnest.submit(jobId, keccak256("work"), "");

        vm.prank(carol);
        vm.expectRevert(Earnest.SelfReview.selector);
        earnest.complete(jobId, "", abi.encode(uint8(90)));
    }

    // =========================================================================
    // Test 6b — SelfReview: evaluator == agent owner (bob) reverts
    // =========================================================================
    function test_SelfReview_EvaluatorIsOwner_Reverts() public {
        // evaluator = bob (agent owner) → SelfReview on complete with rating
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, bob, block.timestamp + 1 hours, "desc", BUDGET
        );

        vm.prank(alice); earnest.fund(jobId, "");
        vm.prank(dave);  earnest.submit(jobId, keccak256("work"), "");

        vm.prank(bob);
        vm.expectRevert(Earnest.SelfReview.selector);
        earnest.complete(jobId, "", abi.encode(uint8(90)));
    }

    // =========================================================================
    // Test 7 — Rating > 100 reverts BadRating
    // =========================================================================
    function test_BadRating_101_Reverts() public {
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );

        vm.prank(alice); earnest.fund(jobId, "");
        vm.prank(dave);  earnest.submit(jobId, keccak256("work"), "");

        // abi.encode(uint8(101)) — but uint8 max is 255; decode to uint8 gives 101
        vm.prank(carol);
        vm.expectRevert(Earnest.BadRating.selector);
        earnest.complete(jobId, "", abi.encode(uint8(101)));
    }

    // =========================================================================
    // Test 8a — Non-evaluator complete reverts Unauthorized
    // =========================================================================
    function test_NonEvaluator_Complete_Reverts() public {
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );

        vm.prank(alice); earnest.fund(jobId, "");
        vm.prank(dave);  earnest.submit(jobId, keccak256("work"), "");

        vm.prank(alice);
        vm.expectRevert(Earnest.Unauthorized.selector);
        earnest.complete(jobId, "", "");
    }

    // =========================================================================
    // Test 8b — Non-provider submit reverts Unauthorized
    // =========================================================================
    function test_NonProvider_Submit_Reverts() public {
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );

        vm.prank(alice); earnest.fund(jobId, "");

        vm.prank(alice);
        vm.expectRevert(Earnest.Unauthorized.selector);
        earnest.submit(jobId, keccak256("work"), "");
    }

    // =========================================================================
    // Test 9 — fund with stale expectedBudget reverts BudgetChanged
    // =========================================================================
    function test_Fund_StaleBudget_RevertsBudgetChanged() public {
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );

        vm.prank(alice);
        vm.expectRevert(Earnest.BudgetChanged.selector);
        earnest.fund(jobId, abi.encode(uint256(999_000)));
    }

    // =========================================================================
    // Test 10 — Double complete reverts WrongStatus
    // =========================================================================
    function test_DoubleComplete_RevertsWrongStatus() public {
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );

        vm.prank(alice); earnest.fund(jobId, "");
        vm.prank(dave);  earnest.submit(jobId, keccak256("work"), "");
        vm.prank(carol); earnest.complete(jobId, "", "");

        // status is now Completed; submit again would hit WrongStatus but
        // the test spec asks us to call complete again.
        vm.prank(carol);
        vm.expectRevert(Earnest.WrongStatus.selector);
        earnest.complete(jobId, "", "");
    }

    // =========================================================================
    // Test 11 — createJob with non-zero hook reverts HookNotSupported
    // =========================================================================
    function test_CreateJob_NonZeroHook_RevertsHookNotSupported() public {
        vm.prank(alice);
        vm.expectRevert(Earnest.HookNotSupported.selector);
        earnest.createJob(dave, carol, block.timestamp + 1 hours, "desc", address(0x1));
    }

    // =========================================================================
    // Test 13 — client == evaluator: rejects a Submitted job → full refund
    // =========================================================================
    function test_ClientEqualsEvaluator_RejectsSubmitted_FullRefund() public {
        // alice is both client and evaluator
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, alice, block.timestamp + 1 hours, "desc", BUDGET
        );

        vm.prank(alice);
        earnest.fund(jobId, "");

        vm.prank(dave); // provider
        earnest.submit(jobId, keccak256("work"), "");

        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice); // alice is evaluator, so evaluator branch fires
        earnest.reject(jobId, "", "");

        assertEq(uint256(earnest.getJob(jobId).status), uint256(JobStatus.Rejected), "status Rejected");
        assertEq(usdc.balanceOf(alice), balanceBefore + BUDGET, "full refund");
    }

    // =========================================================================
    // Test 14 — ReviewBlocked when reputation registry rejects giveFeedback
    //            AND owner has authorized Earnest (isApprovedForAll)
    // =========================================================================
    function test_ReviewBlocked_OnRegistryReject() public {
        // Block Earnest's calls for AGENT_ID in the reputation registry
        reputation.setBlockedCaller(AGENT_ID, address(earnest), true);

        // Owner (bob) has authorized Earnest as operator → catch treats it as
        // an intentional owner-block, not an unexpected failure.
        vm.prank(bob);
        identity.setApproval(bob, address(earnest), true);

        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );
        vm.prank(alice);
        earnest.fund(jobId, "");
        vm.prank(dave);
        earnest.submit(jobId, keccak256("work"), "");

        // complete() should succeed (payment released), review blocked
        vm.prank(carol);
        earnest.complete(jobId, "", abi.encode(uint8(75)));

        // Payment was released despite blocked review
        assertEq(uint256(earnest.getJob(jobId).status), uint256(JobStatus.Completed), "status Completed");
        assertGt(usdc.balanceOf(dave), 0, "provider paid");
        // Review not counted — contract un-did the accounting in the catch block
        assertEq(earnest.paidVolume(AGENT_ID),   0, "paidVolume 0");
        assertEq(earnest.reviewCount(AGENT_ID),  0, "reviewCount 0");
        assertEq(earnest.blockedReviews(AGENT_ID), 1, "blockedReviews 1");
    }

    // =========================================================================
    // Test 15 — SelfReview via getApproved reverts
    // =========================================================================
    function test_SelfReview_ViaGetApproved_Reverts() public {
        // Set carol as the token-approved address for AGENT_ID
        identity.setApprovedForToken(AGENT_ID, carol);

        // carol is the evaluator → _checkSelfReview detects getApproved == evaluator
        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );
        vm.prank(alice);
        earnest.fund(jobId, "");
        vm.prank(dave);
        earnest.submit(jobId, keccak256("work"), "");

        vm.prank(carol);
        vm.expectRevert(Earnest.SelfReview.selector);
        earnest.complete(jobId, "", abi.encode(uint8(80)));
    }

    // =========================================================================
    // Test 16 — setProvider with zero address reverts ZeroAddress
    // =========================================================================
    function test_SetProvider_ZeroAddress_Reverts() public {
        // createJob with address(0) provider is valid (no provider yet)
        vm.prank(alice);
        uint256 jobId = earnest.createJob(
            address(0), carol, block.timestamp + 1 hours, "desc", address(0)
        );

        vm.prank(alice);
        vm.expectRevert(Earnest.ZeroAddress.selector);
        earnest.setProvider(jobId, address(0));
    }

    // =========================================================================
    // Test 17 — Invariant: USDC balance == sum of Funded+Submitted budgets
    // =========================================================================
    function test_Invariant_USDCBalanceEqualsActiveBudgets() public {
        // Job 1: will be completed
        vm.prank(alice);
        uint256 j1 = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 2 hours, "j1", BUDGET
        );
        vm.prank(alice);
        earnest.fund(j1, "");
        // After funding j1: contract holds BUDGET
        assertEq(usdc.balanceOf(address(earnest)), BUDGET, "after fund j1");

        // Job 2: will stay funded then be rejected
        usdc.mint(alice, BUDGET);
        vm.prank(alice);
        uint256 j2 = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 2 hours, "j2", BUDGET
        );
        vm.prank(alice);
        earnest.fund(j2, "");
        // After funding j2: contract holds 2*BUDGET
        assertEq(usdc.balanceOf(address(earnest)), 2 * BUDGET, "after fund j2");

        // Submit j1
        vm.prank(dave);
        earnest.submit(j1, keccak256("work1"), "");
        // Contract still holds 2*BUDGET (submit doesn't change balance)
        assertEq(usdc.balanceOf(address(earnest)), 2 * BUDGET, "after submit j1");

        // Complete j1 (no rating to avoid reputation-registry interactions)
        vm.prank(carol);
        earnest.complete(j1, "", "");
        // After complete: j1 budget paid out, only j2 remains
        assertEq(usdc.balanceOf(address(earnest)), BUDGET, "after complete j1");

        // Reject j2 via evaluator (j2 is Funded; new reject() requires evaluator for Funded)
        vm.prank(carol);
        earnest.reject(j2, "", "");
        // After reject: j2 refunded, contract holds 0
        assertEq(usdc.balanceOf(address(earnest)), 0, "after reject j2");
    }

    // =========================================================================
    // Test 18 — registry failure WITHOUT owner approval bubbles up
    // =========================================================================
    function test_RegistryFailure_WithoutOwnerApproval_RevertsComplete() public {
        // Block Earnest in the reputation registry
        reputation.setBlockedCaller(AGENT_ID, address(earnest), true);
        // Do NOT set identity approval — owner did NOT authorize Earnest

        vm.prank(alice);
        uint256 jobId = earnest.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "desc", BUDGET
        );
        vm.prank(alice);
        earnest.fund(jobId, "");
        vm.prank(dave);
        earnest.submit(jobId, keccak256("work"), "");

        // complete() must revert because the registry rejected but owner didn't
        // authorize Earnest → _handleReviewCatch bubbles up the original revert.
        vm.prank(carol);
        vm.expectRevert(); // any revert — the bubbled-up "blocked" from MockReputationRegistry
        earnest.complete(jobId, "", abi.encode(uint8(75)));

        // All state changes from complete() rolled back — job still Submitted
        assertEq(
            uint256(earnest.getJob(jobId).status),
            uint256(JobStatus.Submitted),
            "status still Submitted after revert"
        );
        // No funds leaked — full budget still held by earnest
        assertEq(usdc.balanceOf(address(earnest)), BUDGET, "earnest still holds full budget");
    }

    // =========================================================================
    // Test 12 — Fuzz: fee arithmetic invariants
    // =========================================================================
    function testFuzz_FeeArithmetic(uint64 budget, uint16 feeBps) public {
        vm.assume(budget > 0);
        vm.assume(feeBps <= 1000);

        // Fresh earnest with given feeBps
        Earnest e = new Earnest(
            IERC20(address(usdc)),
            IIdentityRegistry(address(identity)),
            IReputationRegistry(address(reputation)),
            makeAddr("treasury2"),
            feeBps
        );

        // Mint extra budget for alice and approve new earnest
        usdc.mint(alice, budget);
        vm.prank(alice);
        usdc.approve(address(e), type(uint256).max);

        // Create agent job
        vm.prank(alice);
        uint256 jobId = e.createAgentJob(
            AGENT_ID, carol, block.timestamp + 1 hours, "fuzz", budget
        );

        // Fund
        vm.prank(alice);
        e.fund(jobId, "");

        // Contract holds exactly budget
        assertEq(usdc.balanceOf(address(e)), budget, "contract holds budget");

        // Submit
        vm.prank(dave);
        e.submit(jobId, keccak256("work"), "");

        // Complete — measure flows
        uint256 daveBefore     = usdc.balanceOf(dave);
        uint256 treasury2Before = usdc.balanceOf(makeAddr("treasury2"));

        vm.prank(carol);
        e.complete(jobId, "", "");

        uint256 providerGot  = usdc.balanceOf(dave)                - daveBefore;
        uint256 treasuryGot  = usdc.balanceOf(makeAddr("treasury2")) - treasury2Before;

        // Invariant: provider + treasury == budget
        assertEq(providerGot + treasuryGot, budget, "provider + fee == budget");
        // Contract drained
        assertEq(usdc.balanceOf(address(e)), 0, "contract drained");
    }
}
