# Verification

September 20, 2026. All five packed-candidate lanes build and execute correctly.
Both C# lanes are NativeAOT, not managed DLLs. Compiler, runtime, provider,
Pudding and Tsumo regression gates pass for both targets.

**Release boundary:** these results use exact candidate npm tarballs. The
committed public 0.1.1 pins do not contain these changes; the published Rust
target also lacks the earlier native-import fix. A release and subsequent
public-pin update remain necessary. No npm publication is included here.

## Two separate changes

Ordinary TypeScript keeps its `number` contract. The compiler can select integer
remainder only when it proves both operands are non-negative signed-32-bit
integers and the divisor is positive. Unknown bounds, fractions, negative zero,
NaN, overflow and uncertain mutation retain floating-point arithmetic.

```ts
function residues(): number {
  let total = 0;
  for (let value = 0; value < 100; value++) total += value % 7;
  return total;
}
```

Here only the remainder changes representation. The public result and loop
variable remain `number`. The targets emit an integer remainder and convert its
exact result back to `double`/`f64`; they do not add a speculative fast path.

The native benchmark lanes instead explicitly annotate counters and divisors
with `int32`. Input dimensions are validated before narrowing. Accumulated sums
and checksums stay `number`: primes through one million sum to 37,550,402,023,
which does not fit int32. The algorithms are unchanged after type erasure.

Node and both Node-compatible lanes retain the same unmodified authored source.
Their prime function accepts an unknown `number` parameter; this implementation
does not infer its bounds from another function's validation. Its remainder
therefore remains floating-point. Native source annotations and automatic
proof-based selection are not interchangeable claims.

## Verified revisions and packages

| Repository | Tested revision |
| --- | --- |
| Tsonic shared target API | `9efc705a` |
| C# target | `bb0c93ba` |
| Rust target | `cbbf793` |
| Benchmark implementation | `c586979` |

Subsequent report edits change documentation only. A clean benchmark archive
installs these three compiler packages through explicit tarball dependencies;
all other first-party dependencies remain public npm 0.1.1. There are no workspace
links, edited package internals or hand-patched generated programs. The installed
graph has one shared target API and TSTS implementation.

| Candidate package | SHA-256 |
| --- | --- |
| `@tsonic/target-api` | `6d7fb59eb97892b4a89b2d8f10ebed98667279224763b3941fa5326948fe62bf` |
| `@tsonic/target-csharp` | `6e566a171d1954567508fbcbda99509046591194d9e85bb083160aac05438992` |
| `@tsonic/target-rust` | `7143bd1d00cddc19afb6827269ab7c8046f408adaae21454c008dbb3eafa5f51` |

## Correctness gates

| Gate | Result |
| --- | --- |
| Shared integer range/domain tests | 6/6; includes 28 unsafe source bodies and atomic proof-budget exhaustion |
| Matching C#/Rust native proofs | 37 source cases and 44 Node-derived checks per target, plus explicit typed-zero checks |
| Benchmark harness | 11/11 |
| Packed build matrix | 5/5, including both C# NativeAOT executables |
| Small-input correctness matrix | 50/50: all 25 cells, two rounds |
| Executable numeric boundaries | 35/35: maximum prime input and six invalid dimension cases in each lane |
| Full-size measurements | 125/125: all 25 cells, five rounds |
| Full host/C#/runtime/provider suite | 308/308 tasks, 4,820/4,820 tests |
| Full Rust target | 1,362/1,362 tests |
| Rust core / JS / Node | 122 / 286 / 180 native checks plus 38 Node-provider checks pass |
| C# Pudding | 25 projects / 48 tasks pass |
| Rust Pudding | 31 projects / 51 tasks pass |
| Tsumo C# | Three builds, 71 compiled tests, 25 application/architecture tests, NativeAOT smoke and output equivalence pass |
| Tsumo Rust | Deterministic double generation, Cargo tests, 74 compiled tests, 28 application/architecture tests, Clippy, release/debug equivalence and lockfile immutability pass |

Rust JS retains one existing ignored upstream doctest for a nightly-only
`pattern` feature. No new skip or weakened assertion was introduced. TSTS itself
was not changed; this is not a new standalone TSTS certification claim.

The first C# Tsumo application run could not locate .NET because the shell lacked
`DOTNET_ROOT`. The complete gate passed after pointing it at the already-installed
runtime. No SDK upgrade, global setup change or application workaround was made.

Native safety proofs also exposed an existing C# `-0` literal bug. The fix emits
signed floating zero in its selected type, while an explicitly integer zero stays
integer. It does not cast ordinary negations or change their contextual types.

## Full-size timings

Median microseconds per workload iteration; lower is better. Five samples per
cell, two warm-up batches per process. Compilation and certification finished
before measurement; the preceding samples showed 99% CPU idle.

| Workload | Node.js | C# AOT, Node APIs | Rust, Node APIs | C# AOT, native APIs | Rust, native APIs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Primes through 10,000 | 160.225 | 467.573 | 1,234.424 | 166.072 | 160.931 |
| CSV, 2,000 rows | 344.821 | 326.974 | 463.551 | 294.235 | 445.923 |
| Read UTF-8 file | 62.975 | 140.124 | 106.180 | 142.612 | 124.973 |
| Write UTF-8 file | 107.734 | 146.343 | 124.885 | 147.751 | 127.587 |
| File metadata | 1.385 | 7.169 | 2.336 | 3.229 | 2.323 |

The native prime lanes are now close to Node, rather than approximately 3× and
8× slower. The generated C# and Rust use `int`/`i32` counters and integer remainder;
the totals remain `double`/`f64`. This does not mean all native-lane operations
are optimal: strings, arrays, callbacks and output still use the selected source
profile. This change does not optimize those runtimes or I/O.

The file fixture contains 65,536 UTF-16 code units and 90,112 UTF-8 bytes. Reads
include decoding and the source string-length result. Writes are buffered without
fsync. These are not raw storage-throughput measurements.

### Automatic-selection measurement

A separate ignored project compares the same prime algorithm using either an
unknown parameter bound or a local constant bound. Both use ordinary `number`,
the same callback shape and checked sums; no integer annotations are used.
Five rounds each run 1,000 iterations after warm-up, alternating order.

| Target | Unknown bound, floating remainder | Proven bound, integer remainder |
| --- | ---: | ---: |
| C# NativeAOT | 462.305 µs | 204.784 µs |
| Rust release | 1,196 µs | 186 µs |

All checksums pass. Generated source retains floating declarations and public
results. Native disassembly confirms floating remainder in the control and
integer division/remainder in the proven variant. The measured improvement is
about 2.26× and 6.43× for these programs, not a universal speedup promise.

### Performance qualification

The default Rust native file-read row regresses relative to the previous build.
A same-CPU alternating comparison, using identical input and six samples per
binary, measures 104.0–108.5 µs before and 124.6–125.9 µs now.

The generated I/O adapter, runtime source and dependency graph are unchanged.
The UTF-16 length routine has identical instructions but a different address.
An isolated rebuild changing only LLVM function alignment returns the new binary
to 103.7–107.3 µs. This demonstrates code-placement sensitivity; it
does not prove which individual instruction or cache effect causes the difference.
The alignment experiment is not the default build and is not substituted into
the table. No alignment flags, padding tricks or runtime changes are shipped.

Consequently, correctness certification passes, but this report does **not** claim
that every workload is performance-neutral or faster. Resolving the remaining
string/I/O cost needs separately scoped profiling, not a hidden benchmark change.

## Existing C# warning

Both benchmark C# builds still emit CS8600 for a nullable `JSON.stringify`
result assigned to a non-nullable generated local. The authored code checks
`undefined` before printing. This predates the numeric changes; it is neither
suppressed nor presented as warning-free certification.

## Environment and evidence

AMD Ryzen 9 5900X, Linux x64; Node 26.8.1 / V8 14.6.202.34-node.28;
TypeScript 7.0.2; installed .NET SDK 11.0.100-rc.1.26425.128 targeting net10.0;
Rust/Cargo 1.98.1. The compiler/downstream repositories separately use their
committed SDK 10.0.400 selection. No installed toolchain was upgraded.

The benchmark guard is 12 GiB, no swap, 1,024 tasks and one hour. Compiler
certification used at most 16 GiB and no swap; Rust target's sampled group peak
was 14.0 GiB. No OOM or new memory-ceiling event was recorded.

Local evidence is ignored, not committed:

- `.temp/candidate-20260920/candidate-final-test.log`
- `.temp/candidate-20260920/candidate-final-bench.log`
- `.temp/candidate-20260920/workspace/results/2026-09-19T22-09-59.030Z-verify.json`
- `.temp/candidate-20260920/workspace/results/2026-09-19T22-12-25.875Z-bench.json`
- `.temp/candidate-20260920/automatic-proof-{csharp,rust}.log`
- `.temp/candidate-20260920/read-comparison.json`
- `.temp/candidate-20260920/read-alignment-comparison.json`
- `../tsonic/.analysis/proven-integer-benchmarks-20260920/certification.md`

The raw reports retain samples, ranges, checked results, fixture hashes, tool
versions, artifact hashes and build timings. Input fingerprint:
`3d0f3d5fab14d32400d051f9e13a4f6c19ac1e1a98038f37ce76232fb3dea857`.
The full-size JSON SHA-256 is
`18a48817d4eaef4f3576b270cda46c17ddb96d57a495ff28f88a721f0bdbb1d7`.

Next release steps: merge the compiler and benchmark changes, publish affected
packages through the normal release gate, update exact benchmark pins and the
lockfile, then repeat a fresh public-registry install and verification. Publication
and unrelated performance fixes are not part of this batch.
