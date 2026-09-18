# Agent notes

Read and follow `../tsonic/docs/architecture/workspace-agent-policy.md` before
work in this workspace. That file owns the common engineering policy.

## Benchmark contract

- Plain Node.js is a measured baseline, not merely a test oracle.
- Preserve identical workloads, inputs, iteration counts and checked outputs
  across lanes. Native API adapters may differ; do not quietly change algorithms.
- Keep compilation and process-wall measurements separate from workload timing.
- Never present Node-compatible APIs as an embedded JavaScript engine, or a
  native API lane as a promise that all source representations are native.
- Record versions, raw samples, input digests and correctness checks with results.
- Run `npm test`, then `npm run bench`. Both use the resource guard. Keep
  generated programs, binaries, dependency caches and local results untracked.
- Maintain `.analysis/benchmark-suite-20260918/necessity-ledger.md`.
