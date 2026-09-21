# Verification and performance

Measured September 20, 2026. All five lanes build and execute correctly against
the source-workspace candidates below. Both C# lanes are NativeAOT executables.
This replaces the earlier numeric-only, packed-candidate measurement.

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
| tsonic | `e0e4413e` |
| tsonic-csharp | `4ec8d7f9` |
| tsonic-rust | `be715e4` |
| csharp-runtime | `e898865` |
| csharp-js | `c38e9f9` |
| csharp-nodejs | `21d9be7` |
| rust-runtime | `c3a13e6` |
| rust-js | `c863ae5` |
| rust-nodejs | `8759e47` |
| realworld-perf source | `c41adef` |

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

The follow-up C# native adapter retains a `FileInfo` but calls `Refresh()` for
every query. Path preparation happens during setup; filesystem queries and
numeric conversion remain timed. Its new executable regression covers changed
size, replacement, absence, reappearance and per-query managed allocations.
Updated performance results for this follow-up are pending below; the existing
table remains the measured September 20 baseline, not a claim about new code.

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
| Full-size measurements | 175/175: all 25 cells, seven rounds |
| Full host/C#/runtime/provider bank | 4,860 checks covered by the complete run plus corrected focused visibility expectations |
| Complete Rust target | 1,381/1,381 pass; zero failures, cancellations, skips or todos |
| Final focused Rust allocation/lifetime/Intl bank | 20/20, including native execution and Clippy |
| Rust core / JS / Node runtime banks | 124 / 302 / 185 native/dependency checks; 38 Node-provider checks pass |
| C# Pudding | 25 projects / 48 tasks pass |
| Rust Pudding | 31 projects / 51 tasks pass against the final target revision |
| Tsumo C# | Three builds, 71 compiled tests, 25 application/architecture tests, NativeAOT smoke and output equivalence pass |
| Tsumo Rust | 83 compiled tests, 28 application/architecture tests, 11 native platform tests, deterministic double generation, Clippy, release/debug equivalence and immutable lockfiles pass against the final target revision |

The completed host run executed all 309 tasks: one task failed only two stale
`private` versus `internal` helper expectations. The sole following C# edit
changed those two expected modifiers; its complete three-case owning file
passed. No product, fixture-input, configuration or assertion scope changed.
The workspace's expectation-only rule avoids repeating the entire bank.

Runtime counts include dependency/doc-test banks and must not be added together
as unique tests. Rust JS retains one existing ignored upstream `regress` doctest
requiring nightly `pattern`; no new skip was added. TSTS is unchanged, so this is
not a new standalone TSTS certification. Neither Tsumo source was edited.

## Full-size timings

Median microseconds per iteration; lower is better. Seven samples per cell,
three warm-up batches per process. The machine was 99% idle in the three samples
before measurement. No compiler or certification suite ran concurrently.

| Workload | Node | C# AOT, Node APIs | Rust, Node APIs | C# AOT, native APIs | Rust, native APIs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Primes through 10,000 | 159.915 | 464.786 | 1,236.909 | 159.288 | 158.220 |
| CSV, 2,000 rows | 342.068 | 246.830 | 320.073 | 226.825 | 295.448 |
| Read UTF-8 file | 62.998 | 142.878 | 46.896 | 144.189 | 51.273 |
| Write UTF-8 file | 106.758 | 148.492 | 86.050 | 144.685 | 86.835 |
| File metadata | 1.269 | 3.057 | 1.011 | 2.951 | 0.914 |

The fixture is 90,112 UTF-8 bytes / 65,536 UTF-16 units. Rust checks its native
byte length; C# and Node check native UTF-16 length. Exact bytes are identical.
The OS cache is warm and writes do not call fsync. These are not durable-storage
throughput measurements. Generation and native build time remain separate.

Compared with the same-machine pre-batch matrix, CSV medians improve by about
22%/17%/26%/13% in C# Node/Rust Node/C# native/Rust native. Rust file reads improve
by about 37%/28%. C# Node metadata drops from 6.076 to 3.057 microseconds; Rust
metadata drops from 2.333/2.308 to 1.011/0.914 microseconds. The batch changes both
compiler/runtime behavior and harness dispatch, so these are combined results,
not isolated attribution to one optimization.

Not every cell improves: Rust Node primes measure 0.8% higher and C# native reads
2.7% higher than the earlier medians. Their sample ranges overlap. This proves
neither zero regression nor a stable causal slowdown. The native BCL read/write
implementation is unchanged; custom alternatives that added allocations or
small-file latency were rejected, not shipped as another path.

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
| C# three-element literal, NativeAOT | 80 bytes versus List's 72; no temporary element array |
| C# ten-string join, NativeAOT | 680 bytes, equal to native String.Join; previously 2,136 bytes |
| C# text-I/O wrappers | Same allocated bytes as direct BCL calls at 0, 64, 4,096, 90,112 and 1,048,576 input characters |

The C# literal's remaining eight bytes are the numeric-property storage slot in
the declared JS-array object, not another allocation. Source aliasing, identity,
mutable captures and reentrant sort snapshots still require their owners.
Interface-valued C# objects cannot simply become structs without possible boxing
and changed aliasing. Ordinary Rust strings stay UTF-8; no UTF-16 scan is added.

Syscall tracing verifies one metadata query per timed regular-file stat in every
lane. The C# text APIs use BCL chunking: 23 reads and eight writes for this fixture,
versus two reads/one write in Rust and four reads/one write in Node. These native
library costs help explain the remaining C# I/O delta. Tsonic does not rewrite
arbitrary authored BCL calls or add a second buffering implementation.

## Qualifications

- Both benchmark C# builds retain the pre-existing CS8600 at the generated
  nullable `JSON.stringify` local before its authored undefined check. It is
  neither suppressed nor described as warning-free.
- A separate newly observed `load(Ref<string>).length` form emits `&*value`,
  accepted by rustc but rejected by Clippy's redundant-reborrow lint. It is not
  used by these benchmarks or applications and is recorded for follow-up, not
  hidden by weakening a gate. The native captured-reference regression uses the
  actual std::fs consumer and retains exact no-copy output assertions.
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

- `results/2026-09-20T21-58-09.481Z-verify.json`
- `results/2026-09-20T21-59-30.352Z-bench.json`
- Pre-batch: `results/2026-09-20T11-46-46.235Z-bench.json`
- `../tsonic/.temp/native-allocation-performance-20260920/`
- `../tsonic/.analysis/native-allocation-performance-20260920-140707/`

The JSON retains every raw sample, range, input hash, checked result, tool version
and build artifact hash. Input fingerprint:
`6769ade6a901f066ec5ae1e4c8a07301e89a9100c0228b89b2858082ba0de4b9`.
The full-size JSON SHA-256 is
`f2d6268ad2b4ea5b4423c203c6ec2cd7a1d2a2f02025e923f4a79b383714ee76`.
