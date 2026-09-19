# Verification status

Updated September 19, 2026. This is a checkpoint, not a passing certification.

## Results

| Gate | Result |
| --- | --- |
| Fresh locked public-package install | Pass: 18 packages, empty install root and npm cache, no sibling source links |
| Harness tests | 8/8 pass; no skips |
| Node build | Pass |
| C# Node and native builds | Pass, with the nullable-local warning described below |
| Rust Node build | Pass |
| Rust native build | Fails during target analysis |
| Runtime checks of the four built lanes | 40/40 invocations pass: 20 workload cells, two rounds |
| Complete `npm test` | Fails; the five-lane execution matrix has not passed |
| Full-size benchmark measurements | 100/100 working-lane invocations pass; native Rust remains failed, and `npm run bench` returns nonzero |

The 40 runtime checks used three iterations and one warm-up batch per workload.
They checked checksums, Unicode string lengths, UTF-8 metadata byte counts and
exact bytes after writes. They are evidence for the four working lanes, not a
substitute for the complete two-round, 25-cell gate. That gate requires all five
lanes and does not omit the native Rust failures.

The full-sized run used five samples per working cell and two warm-up batches
per process. All checksums and file-write byte checks passed. The saved report
contains Node, both C# variants and Rust's Node-API timings, plus an explicitly
failed native Rust column. The report is incomplete, not a successful five-lane
certification. Both test and measurement commands return nonzero for that build
failure; neither loses the measurements of unrelated successful lanes.

The workloads and source adapters did not change for this run. The new report
test covers missing sample rounds, missing Node baseline, failed builds and
failed execution; these must not produce a fabricated timing or speed ratio.

## Native Rust blocker

The adapter contains ordinary native API calls:

```ts
read_to_string<string>(path).unwrap();
write<string, string>(path, contents).unwrap();
Number(metadata<string>(path).unwrap().len());
```

`@tsonic/target-rust` 0.1.1 rejects the filesystem calls with
`RUST_PROVIDER_TYPE_INSTANTIATION_NOT_PROVEN`. The selected `uint64` input to
`Number` also receives `RUST_SELECTED_OPERATION_UNSUPPORTED`. There are five
diagnostics, including a downstream `unwrap` diagnostic; this does not establish
five independent defects.

A separate minimal filesystem program reproduces the generic-call rejection
without the benchmark driver, JSON or numeric conversion. Explicit type arguments
do not resolve it. The rejection point is established; the underlying compiler
fix has not been implemented or certified.

No generated Rust was edited, no compiler package was patched locally, and no
Node API was relabeled as a native API. Fixing these compiler contracts needs a
separate approved compiler change and a consumable package version before the
public-package benchmark can pass normally.

## C# warning

The checked source guards `JSON.stringify` returning `undefined`:

```ts
const output = JSON.stringify(result);
if (output === undefined) throw new Error("Could not serialize benchmark result");
console.log(output);
```

The emitted local uses non-nullable `string` for the nullable runtime result,
so both C# builds report CS8600. The runtime checks pass, but these are not
warning-free builds. No warning suppression or assertion weakening was added.

## Benchmark-owned fixes

- Configurations reside beside `package.json`, where installed plugins can be
  discovered. There are no duplicate dependency manifests.
- Node and C# execute a top-level call in `start.ts`. Rust selects the exported
  `main` entry instead. Emitted entrypoints were inspected and all four built
  lanes execute the workload once.
- The control input has four validated text fields, identically across lanes.
  It does not need an open-ended JSON-to-object assertion.
- CSV integer fields use `parseInt(field, 10)` in the one shared implementation.
- Completed build scopes are stopped; .NET builds disable shared build servers.

## Environment and resource limits

- Node 26.8.1, npm 11.19.0, TypeScript 7.0.2.
- Tsonic compiler/target/runtime packages: 0.1.1, from public npm.
- .NET SDK 11.0.100-rc.1.26425.128; emitted applications target net10.0.
- Rust/Cargo 1.98.1.
- Linux user-systemd guard: 12 GiB RAM, no swap, 1,024 tasks, one hour.
- Node heap limit: 2 GiB; Cargo build jobs: two. Builds and executions are serial.

The initial npm lock preparation admitted only the already-certified first-party
0.1.1 packages past this machine's release-age cutoff. The subsequent fresh
`npm ci` used the normal policy without those exceptions and passed.

Local evidence is ignored rather than committed:

- `.temp/verification/full-6.log`: complete test attempt, including all build lanes.
- `.temp/builds/1789755030496-843916/`: per-lane compiler and native build logs.
- `.temp/verification/native-probe.log`: isolated native filesystem rejection.
- `.temp/verification/built-lane-diagnostic-2.log`: 20 diagnostic runtime checks.
- `.temp/verification/fresh-npm-ci.log`: fresh public install.
- `.temp/verification/full-20260919.log`: current complete test attempt,
  including 8 harness tests and 40 correctness executions.
- `.temp/builds/1789829556694-22481/`: current five-lane build attempt.
- `.temp/verification/performance-20260919.log`: all 100 full-sized measurements.
- `results/2026-09-19T14-53-27.870Z-bench.md` and its adjacent JSON file:
  medians, ranges, raw samples, checksums, fixture hashes, build timings and failures.

After the compiler defects are fixed and published, update exact package pins
and the lockfile, run `npm test`, then `npm run bench` to obtain a complete
five-lane result. These measurements describe one machine and finite warm-up;
they do not establish universal performance or a compiler regression cause.
