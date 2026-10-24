#!/usr/bin/env bash
# Runs the whole Earnest demo on Arc mainnet in one go. Every step sends real USDC transactions.
# It stops at the first failure, and finished steps are remembered, so running it again continues where it stopped.
# Usage (from any folder): bash ~/Desktop/Hackathons/Arc_Studio/earnest/scripts/mainnet-run.sh
set -euo pipefail
cd "$(dirname "$0")/.."

NODE=${NODE:-node}
RUN_DIR=${RUN_DIR:-logs/mainnet-run}
REFUND_DELAY=${REFUND_DELAY:-400} # seconds after hiring job 2 (its deadline is 6 minutes, plus margin)
NET=(--network mainnet --yes)
mkdir -p "$RUN_DIR"
touch "$RUN_DIR/done"

# step NAME CMD...: runs CMD once. A step that already finished on an earlier run is skipped.
step() {
  local name=$1
  shift
  if grep -qx "$name" "$RUN_DIR/done"; then
    echo "== $name: already done, skipping"
    return
  fi
  echo
  echo "== $name"
  if ! "$@"; then
    echo
    echo "!! $name failed, so nothing after it was sent. Run this script again to retry from this step."
    exit 1
  fi
  echo "$name" >>"$RUN_DIR/done"
}

demo() { "$NODE" scripts/demo.ts "$@" "${NET[@]}"; }

# hire JOB ARGS...: hires the agent and checks the new job got the number the later steps use.
hire() {
  local job=$1
  shift
  demo hire "$@" | tee "$RUN_DIR/hire.out" || return 1
  if ! grep -qx "job $job funded" "$RUN_DIR/hire.out"; then
    echo
    echo "!! expected this to be job $job, so the job numbers are off. Stopped before anything else was sent."
    echo "!! Do not re-run yet: check 'node scripts/demo.ts status --network mainnet' first."
    exit 1
  fi
}

hire_job_2() {
  hire 2 --budget 0.25 --minutes 6 || return 1
  date +%s >"$RUN_DIR/job2.hired"
}

refund_job_2() {
  local ready now
  ready=$(($(cat "$RUN_DIR/job2.hired") + REFUND_DELAY))
  now=$(date +%s)
  if ((now < ready)); then
    echo "waiting $((ready - now))s for job 2's deadline to pass"
    sleep $((ready - now))
  fi
  demo refund --job 2
}

step deploy "$NODE" scripts/deploy.ts "${NET[@]}"
step fund demo fund
step register demo register

step hire-job-1 hire 1 --budget 0.50
step work-job-1 demo work --job 1
step evaluate-job-1 demo evaluate --job 1

step hire-job-2 hire_job_2

step hire-job-3 hire 3 --budget 0.25
step work-job-3 demo work --job 3 --sabotage
step evaluate-job-3 demo evaluate --job 3

step hire-job-4 hire 4 --budget 0.10 --evaluator agent --minutes 10080
step work-job-4 demo work --job 4
step self-review-job-4 demo self-review --job 4

step fake-review-1 demo fake-review
step fake-review-2 demo fake-review
step fake-review-3 demo fake-review

step refund-job-2 refund_job_2

echo
echo "== evidence"
"$NODE" scripts/evidence.ts
echo
echo "== status"
"$NODE" scripts/demo.ts status --network mainnet
echo
echo "Mainnet run complete."
