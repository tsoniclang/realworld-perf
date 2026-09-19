# Verification

September 19, 2026. All five lanes build and execute correctly with the packed
Rust target fix. Both C# lanes are NativeAOT, not managed DLLs.

**Release boundary:** published `@tsonic/target-rust@0.1.1` does not contain the
fix. The committed public-package installation still needs a new Rust target
release and an updated exact pin/lockfile. The results below are prepublication
verification, not a claim that the existing public package works.

## Verified code and packages

- Benchmark implementation: `1afdf46`; later report edits change documentation only.
- Rust target: `b201a4e`, based on `3beb6db`.
- All other first-party compiler/runtime dependencies: public npm 0.1.1.
- A fresh benchmark archive installs the fixed target through an explicit npm
  tarball dependency. No package internals, generated source or benchmark
  workload is patched. There are no workspace links.
- The authored `src/` tree is byte-identical to the earlier benchmark at
  `4436185`. Node-compatible lanes still use the same source directory.

Candidate tarball SHA-256:

```text
a8034199100aa5f37b80e4d3600875da515c46e09d405bf989ddf0e1fb7fd77c
```

## Correctness gates

| Gate | Result |
| --- | --- |
| Benchmark harness | 9/9 pass |
| Build matrix | 5/5 pass, including both C# NativeAOT executables |
| Small-input correctness matrix | 50/50 pass: all 25 cells, two rounds |
| Full-size measurements | 125/125 pass: all 25 cells, five rounds |
| Complete Rust target suite | 1,361/1,361 pass; no skips or TODOs |
| Rust Pudding | 31/31 projects; 51/51 total tasks pass |
| Tsumo-Rust | Complete gate passes: deterministic double generation, native tests, 74 compiled tests, 28 application/architecture tests, Clippy, release/debug output equivalence and lockfile immutability |

Both C# publish logs contain `Generating native code`; both outputs are native
ELF executables. The harness executes those files directly. NativeAOT uses
Release, the current runtime identifier and `IlcOptimizationPreference=Speed`.
No JIT mode or fallback build exists in this harness.

The first Rust full-suite run exposed a discarded-conversion warning in a newly
added regression. The compiler fix preserves evaluation with `let _ = ...`;
no warning suppression was added. The entire final suite was rerun and passed.

## Full-size timings

Median microseconds per workload iteration; lower is better. Five samples per
cell, two warm-up batches per process. All compilation and verification jobs
finished before measurement; the pre-run observation showed 98–99% CPU idle.

| Workload | Node.js | C# AOT, Node APIs | Rust, Node APIs | C# AOT, native APIs | Rust, native APIs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Primes through 10,000 | 160.907 | 472.773 | 1,215.100 | 469.666 | 1,232.986 |
| CSV, 2,000 rows | 342.957 | 330.248 | 442.111 | 329.473 | 457.282 |
| Read UTF-8 file | 64.192 | 142.607 | 109.931 | 145.107 | 104.592 |
| Write UTF-8 file | 112.234 | 150.081 | 140.901 | 147.510 | 127.646 |
| File metadata | 1.394 | 7.218 | 2.325 | 3.209 | 2.372 |

The text fixture contains 65,536 UTF-16 code units and 90,112 UTF-8 bytes
(88 KiB). Reads include decoding and the source string-length result. Writes
are buffered without fsync. Write samples are noisy: Node spans 102–388 µs,
Rust Node 122–406 µs and Rust native 120–292 µs. Do not interpret the write
medians as stable storage-throughput rankings.

NativeAOT slightly beats Node on this CSV workload, but does not win every row.
These are generated programs with the same TypeScript algorithms, not handwritten
native benchmarks. The emitted prime loops use `double`/`f64`; CSV retains
JS array/string operations. Those are observed representation choices, not a
profiler-proven explanation of every timing difference. This work fixes
compilation and measurement, not every possible runtime optimization.

## Rust fixes

The unchanged native adapter now compiles:

```ts
read_to_string<string>(path).unwrap();
write<string, string>(path, contents).unwrap();
Number(metadata<string>(path).unwrap().len());
```

The target recognizes the exact native String/str `AsRef` contracts instead of
rejecting valid generic calls. Explicit numeric conversion uses a native cast:
the final expression emits `.len() as f64`, without BigInt allocation or a
conversion helper. Tests cover inferred/explicit generics, UTF-8, errors, reused
values, all scalar numeric widths, rounding, side effects and invalid contracts.

## Remaining C# warning

Public C# target 0.1.1 emits CS8600 for a nullable `JSON.stringify` result
assigned to a non-nullable generated local. The authored code checks for
`undefined` before printing. Both NativeAOT programs execute correctly, but the
builds are not warning-free. No warning suppression or source workaround was
added. This separate C# issue is not part of the Rust fix.

## Environment and evidence

AMD Ryzen 9 5900X, Linux x64; Node 26.8.1 / V8 14.6.202.34; TypeScript 7.0.2;
.NET SDK 11.0.100-rc.1.26425.128 targeting net10.0; Rust/Cargo 1.98.1.

The benchmark guard is 12 GiB, no swap, 1,024 tasks and one hour. Rust target
verification used three workers, a final 16 GiB guard and no swap. Pudding and
Tsumo used their bounded verification paths. No OOM was recorded.

Local logs and raw reports are ignored, not committed:

- `.temp/candidate-20260919/candidate-final-test.log`
- `.temp/candidate-20260919/candidate-final-bench.log`
- `.temp/candidate-20260919/idle-before-benchmark.log`
- `.temp/candidate-20260919/workspace/results/2026-09-19T16-14-31.153Z-verify.json`
- `.temp/candidate-20260919/workspace/results/2026-09-19T16-46-03.134Z-bench.json`
  and its adjacent Markdown report.

The raw JSON retains every sample, range, checksum, fixture hash, tool version,
artifact hash and build timing. Its input fingerprint is
`c1fd29b87be33ae9b8bf0fb3cf9231360ecf94d8604eb730619be95842a2fa30`.
Build timings were collected during verification and are not uncontended compiler
benchmarks. Process wall time includes setup, warm-up and shutdown, not just
startup.

Next: merge and publish the Rust target fix, update the benchmark's public pin
and lockfile, then repeat `npm ci`, `npm test` and `npm run bench` with only
registry packages. No npm publication is included in these PRs.
