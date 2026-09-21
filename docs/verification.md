# Verification and performance

Measured September 21, 2026. All five lanes build and execute correctly against
the source-workspace candidates below. Both C# lanes are NativeAOT executables.
The full matrix and a repeat on identical build artifacts both pass.

## Release boundary

These measurements use explicit local links to the listed compiler and runtime
checkouts, not the committed public npm 0.1.1 installation. Those public pins
lack this work. No npm package is published by this batch. Separate Pudding
gates exercise packed distributions; this benchmark uses the workspace graph.

After merge, publish every affected package through the normal release gate,
update exact benchmark pins and the lockfile, then verify a fresh public-registry
installation. A normal user should not need our source workspace.

| Repository | Measured revision |
| --- | --- |
| tsonic | `0c2e43df0` |
| tsonic-csharp | `844ee138f` |
| tsonic-rust | `0649b03f3` |
| csharp-runtime | `e898865` |
| csharp-js | `c38e9f9` |
| csharp-nodejs | `35f441913` |
| rust-runtime | `c3a13e6` |
| rust-js | `9d12fc2f6` |
| rust-nodejs | `8759e47` |
| realworld-perf source | `20d1382f5` |

Later report-only commits do not change these compiled sources or artifacts.

## What is compared

Node and both compiled Node-API lanes use one authored source tree. C# and Rust
native lanes share one annotated workload/runner tree. Native adapters may use
their target APIs and ownership annotations; they do not change the workload.
Tests compare the workload algorithms after type erasure.

Native counters and divisors use `int32` after input validation. Accumulated
sums remain `number`: the largest admitted prime checksum is 37,550,402,023.
Ordinary `number` is not silently narrowed. The Node-API prime function has an
unknown parameter bound, so the native targets retain floating remainder there;
V8 can make runtime specializations that this static proof does not establish.

The runner selects the complete iteration loop before timing. File adapters bind
their fixed paths/payloads once and expose zero-argument operations. This avoids
benchmark-induced owned String arguments in every Rust iteration. Every timed
iteration still opens/reads, creates/truncates/writes, or queries metadata.
No file handle, metadata, decoded result or output encoding is cached.

The C# native adapter retains a `FileInfo` but calls `Refresh()` for
every query. Path preparation happens during setup; filesystem queries and
numeric conversion remain timed. Its executable regression covers changed
size, replacement, absence, reappearance and per-query managed allocations.
The actual generated adapter passes these controls with zero managed allocations
across 10,000 warmed metadata queries. The query itself is never cached.

The Rust native writer emits this operation inside its retained closure:

```rust
std::fs::write::<&str, &str>(&capture_path, &capture_contents).unwrap();
```

The common loop calls the prepared operation without cloning the payload.
Captured owners are created during setup. This is not a claim that arbitrary
higher-order source signatures can all use a borrowed ABI.

## Correctness gates

| Gate | Result |
| --- | --- |
| Benchmark harness | 13/13 |
| Build matrix | 5/5, including both C# NativeAOT executables |
| Small-input matrix | 50/50: all 25 cells, two rounds |
| Executable numeric boundaries | 35/35: maximum prime input and invalid dimension controls |
| Full-size measurements | 175/175 in each of two runs: all 25 cells, seven rounds; identical build artifacts |
| Full host/C#/runtime/provider bank | 4,906 checks covered by the complete run plus the corrected missing-process test |
| Complete Rust target | 1,386/1,386 pass; zero failures, cancellations, skips or todos |
| Native ownership/allocation regressions | Included in the complete Rust target run, with Release execution and Clippy |
| Rust core / JS / Node runtime banks | 124 / 303 / 185 native/dependency checks; 38 Node-provider checks pass |
| C# Pudding | 25 projects / 48 tasks pass |
| Rust Pudding | 31 projects / 51 tasks pass against the final target revision |
| Tsumo C# | Three builds, 71 compiled tests, 25 application/architecture tests, NativeAOT smoke and output equivalence pass |
| Tsumo Rust | 13 verification-harness tests, 83 compiled tests, 28 application/architecture tests, 11 native platform tests, deterministic double generation, Clippy, release/debug equivalence and immutable lockfiles pass against the final target revision |
| Native C# metadata adapter | Fresh results after mutation/replacement/absence/reappearance; zero per-query managed allocations |

The completed host run executed all 310 tasks: 309 passed. Its only failing test
assumed PID 999999 did not exist and attempted to terminate it. The corrected
fixture first proves absence through the native Process API and then uses a
non-killing signal-zero probe. Both exact ESRCH assertions and the separate
owned-child termination test remain intact. The owning test assembly was rebuilt;
the corrected test passed 1/1. No product code changed after the complete run.
The maintainer explicitly requested this focused rerun, not another full suite.
The original full-run failure remains recorded rather than relabeled a clean run.

Runtime counts include dependency/doc-test banks and must not be added together
as unique tests. Rust JS retains one existing ignored upstream `regress` doctest
requiring nightly `pattern`; no new skip was added. TSTS is unchanged, so this is
not a new standalone TSTS certification. Neither Tsumo source was edited.

## Full-size timings

Median microseconds per iteration; lower is better. Seven samples per cell,
three warm-up batches per process. The machine was 98% idle in the three samples
before measurement. No compiler or certification suite ran concurrently. This
table is the complete first matrix, not the best cell selected from multiple runs.

| Workload | Node | C# AOT, Node APIs | Rust, Node APIs | C# AOT, native APIs | Rust, native APIs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Primes through 10,000 | 160.743 | 473.115 | 1,252.900 | 160.730 | 162.103 |
| CSV, 2,000 rows | 348.335 | 253.479 | 265.198 | 236.783 | 266.161 |
| Read UTF-8 file | 65.051 | 146.636 | 48.321 | 148.146 | 51.972 |
| Write UTF-8 file | 116.749 | 172.999 | 93.165 | 174.004 | 91.291 |
| File metadata | 1.331 | 3.138 | 1.000 | 1.879 | 0.943 |

The fixture is 90,112 UTF-8 bytes / 65,536 UTF-16 units. Rust checks its native
byte length; C# and Node check native UTF-16 length. Exact bytes are identical.
The OS cache is warm and writes do not call fsync. These are not durable-storage
throughput measurements. Generation and native build time remain separate.

Compared with the preceding September 20 candidate, Rust Node CSV drops from
320.073 to 265.198 microseconds and Rust native CSV from 295.448 to 266.161:
17.1% and 9.9% lower medians. Native C# metadata drops from 2.951 to 1.879
microseconds, a 36.3% reduction. Against the original pre-batch matrix, all four
compiled CSV lanes improve by approximately 20–31%. These are whole-batch
measurements, not isolated attribution to one change.

The repeat uses exactly the same binaries and build fingerprint. Its Rust CSV
medians are 266.472/264.479 microseconds and native C# metadata is 1.824.
Write timings vary more: native C# changes from 174.004 to 163.057 and Node from
116.749 to 110.131 without rebuilding anything. Both complete raw matrices are
retained. Several cells are higher than the September 20 readings; these runs
do not prove a universal zero-regression claim or identify every source of timing
variation. Native allocation and exact-output controls provide separate evidence
for the removed copies and allocations.

The Node-API prime lanes still use the declared floating-point number carrier;
the native lanes use explicit integer annotations. The native BCL read/write
implementation is unchanged. Its remaining I/O cost is also present with direct
BCL calls; custom alternatives that added allocations or small-file latency
were rejected, not shipped as another path.

## Native costs and retained boundaries

| Probe | Observed result |
| --- | --- |
| Rust owned scalar location | One 32-byte allocation; handle clone allocates zero |
| Rust inline state within an owned object | Zero additional allocations |
| Rust dense three-element array | Buffer plus one shared owner; no eager identity allocation |
| Borrowed 1,024-byte String array read | Zero allocations; a retained owned result still copies its bytes |
| Small Rust `parseInt` | Zero allocations; large integers still promote exactly |
| Rust ten-string join | One 329-byte allocation, equal to native slice join; previously five / 992 bytes |
| Rust owned UTF-8 decode | Reuses its input Vec; allocation count equals native conversion |
| Rust terminal capture of a 65,536-byte String | One callable allocation, with the same byte count as handwritten construction; no String copy |
| Rust 10,000 proved readonly indexed parses | Zero allocations/bytes; mutation and retention controls keep owned values |
| C# three-element literal, NativeAOT | 80 bytes versus List's 72; no temporary element array |
| C# ten-string join, NativeAOT | 680 bytes, equal to native String.Join; previously 2,136 bytes |
| C# text-I/O wrappers | Same allocated bytes as direct BCL calls at 0, 64, 4,096, 90,112 and 1,048,576 input characters |
| C# selected native numeric Number conversion | Native casts across 17 carrier families; zero Int64 conversion allocations |
| C# prepared native metadata adapter | Zero managed allocations across 10,000 fresh queries |

The C# literal's remaining eight bytes are the numeric-property storage slot in
the declared JS-array object, not another allocation. Source aliasing, identity,
mutable captures and reentrant sort snapshots still require their owners.
Interface-valued C# objects cannot simply become structs without possible boxing
and changed aliasing. Ordinary Rust strings stay UTF-8; no UTF-16 scan is added.

Regenerated Tsumo Rust now stores PipelineParser, TemplateParser and TomlValueReader
as ordinary value structs with mutable receivers. There are eight ObjectHandle
construction sites in the engine instead of eleven. This is a source-site count,
not a measured reduction in total site-generation allocations. Neither Tsumo's
authored source changed; aliases and cross-function transport still retain owners.

Syscall tracing verifies one metadata query per timed regular-file stat in every
lane. The C# text APIs use BCL chunking: 23 reads and eight writes for this fixture,
versus two reads/one write in Rust and four reads/one write in Node. These native
library costs help explain the remaining C# I/O delta. Tsonic does not rewrite
arbitrary authored BCL calls or add a second buffering implementation.

## Qualifications

- Both benchmark C# builds retain the pre-existing CS8600 at the generated
  nullable `JSON.stringify` local before its authored undefined check. It is
  neither suppressed nor described as warning-free.
- The previously reported shared-reference redundant reborrow is fixed and
  covered by native execution and Clippy, with mutable-reference controls.
- The harness's type-erasure equivalence test prints Node's existing
  stripTypeScriptTypes experimental warning. No diagnostic is suppressed.
- No universal zero-overhead or all-platform claim follows from these probes.
  Owned opaque callable signatures and source-retained values keep their
  declared contracts. No unsafe lifetime erasure, numeric speculation or
  application-specific compiler path is introduced.

## Environment and evidence

AMD Ryzen 9 5900X, Linux x64; Node 26.8.1 / V8 14.6.202.34-node.28; TypeScript
7.0.2; .NET SDK 11.0.100-rc.1.26425.128 targeting net10.0; Rust/Cargo 1.98.1.
The compiler/downstream repositories use committed SDK 10.0.400. No toolchain
was upgraded. Gates use finite timeouts, bounded workers, at most 12 GiB per
process group and no swap.

Local ignored evidence:

- `results/2026-09-21T08-54-55.835Z-verify.json`
- Primary: `results/2026-09-21T08-56-26.755Z-bench.json`
- Repeat: `results/2026-09-21T08-58-06.129Z-bench.json`
- Pre-follow-up: `results/2026-09-20T21-59-30.352Z-bench.json`
- Pre-batch: `results/2026-09-20T11-46-46.235Z-bench.json`
- `../tsonic/.temp/native-allocation-performance-20260920/`
- `../tsonic/.analysis/native-allocation-performance-20260920-140707/`

The JSON retains every raw sample, range, input hash, checked result, tool version
and build artifact hash. Input fingerprint:
`6200608a3ff91311775baeb1914a5d89d74998793c4f9e4a2bc1214fefcd86b9`.
The primary full-size JSON SHA-256 is
`005af5057667420b6cd0f72c5a57932555175da765accdc9cee2c3dd383ecdd6`.
The repeat SHA-256 is
`41ae1ecec7a1bf7ad925f6b7b4c80e5d1c6d15df86947c1d58c92074ce8cd6df`.
