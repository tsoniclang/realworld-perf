# realworld-perf

Run the same TypeScript workloads on plain Node.js and on Tsonic's C# and Rust
targets. Each report includes Node timings, not just native-to-native ratios.

## The comparisons

| Lane | Source | Execution |
| --- | --- | --- |
| Node.js | `src/node` + `src/shared` | TypeScript compiled to ordinary JavaScript; Node/V8 |
| C# Node APIs | Exactly the same source as Node | Generated C#, .NET Release build, C# Node runtime |
| Rust Node APIs | Exactly the same source as Node | Generated Rust, Cargo release build, Rust Node runtime |
| C# native APIs | `src/csharp` + the same `src/shared` | `System.IO` and `Stopwatch`, .NET Release build |
| Rust native APIs | `src/rust` + the same `src/shared` | `std::fs` and `Instant`, Cargo release build |

All five lanes use the same arithmetic, CSV algorithm and benchmark driver.
Native variants change only filesystem and clock adapters. They still select
the JavaScript source profile for the shared language operations; this is not
a claim that the entire application avoids JS-semantic runtime types. Neither
compiled Node lane embeds Node/V8. These are native implementations of Node APIs.

| Workload | One iteration | Checked result |
| --- | --- | --- |
| Prime summation | Trial-divide integers through 10,000 | Sum, checked against an independent sieve |
| CSV aggregation | Split and sum 2,000 three-column records | Amount sum computed while generating the input |
| File read | Read and UTF-8-decode a roughly 64 KiB text fixture | UTF-16 string length |
| File write | Create/truncate and UTF-8-write the same fixture | Length and exact written bytes |
| File metadata | Obtain fixture length from filesystem metadata | Exact UTF-8 byte length |

Fixtures contain accented text and emoji so byte counts cannot accidentally be
substituted for string lengths. The filesystem examples use a warm OS cache.
Writes are buffered, without fsync; they do not measure durable storage latency.

## Install

The guarded runner currently requires **Linux with a systemd user session**.
Install Node.js 22.18 or later, the .NET 10 SDK, and Rust through rustup. Install
the system C/C++ linker toolchain as well (`build-essential` on Debian/Ubuntu).

```sh
rustup component add rust-src rustfmt
npm ci
npm test
npm run bench
```

Only public npm packages are used. No sibling Tsonic checkout, global Tsonic or
local package link is needed. The npm lockfile pins the installed compiler and
runtime packages. Native crate versions are recorded in the generated Cargo
lockfiles and build artifact hashes; native toolchains are reported, not silently
installed or changed. C# uses net10.0 in `config/csharp-*.json`.

`npm test` runs harness tests, compiles all five lanes, then checks all 25 cells
twice with small inputs. It collects failures rather than dropping failed lanes.
`npm run bench` uses that exact build and runs five measured rounds with two
warm-up batches per process. To rebuild explicitly, use `npm run build`.

```sh
npm run bench -- --samples 10 --warmup 3
```

Each round rotates lane order. Each process receives identical inputs and
iteration counts for that workload. Every timed invocation must pass its
checksum; a failed lane prevents publishing a successful comparison report.

## Read the results

Markdown and JSON reports are written under `results/`. The table shows median
milliseconds per workload iteration and elapsed-time ratios relative to Node.
For example, `0.80×` means 80% of Node's elapsed time, not an 80% speedup. Raw
samples, min/max, payload hashes, tool versions and build fingerprints are retained.

- The monotonic timer runs inside the executable, around only the measured loop.
- Input setup, warm-up, result serialization and correctness checks are outside it.
- Both measured and warm-up checksums are consumed and checked. Results cannot
  be removed as unused computation.
- Adapter calls and shared workload dispatch are included. They are identical
  in structure, but their target representations need not have identical costs.
- Compilation is reported separately. Process wall time includes startup, setup,
  warm-up, the workload and shutdown; it is not presented as pure startup time.
- C# is a managed Release/JIT comparison, not NativeAOT. Node uses its normal V8
  JIT. Warm-up is finite, so this is not a guarantee that every tier has stabilized.
- Numbers from one machine are observations, not universal speed claims. Run on
  an otherwise idle machine and examine sample spread before drawing conclusions.

The guard limits the process group to 12 GiB RAM, no swap, 1,024 tasks and one
hour. Child commands also have finite time/output limits. Lanes run serially;
there is no parallel-agent or concurrent benchmarking machinery.

## Inspect the programs

Source: `src/shared`, `src/node`, `src/csharp`, `src/rust`.
Generated JavaScript: `out/node`. Generated C#/Rust: `out/<lane>/<target>`.
Build logs and individual execution evidence: `.temp/`. Generated programs,
binaries, caches and local measurement reports are not committed.

The input fingerprint rejects stale builds after source, configuration, harness
or npm lockfile edits. Artifact hashes reject modified compiled outputs. Tests
do not assert a minimum speedup or turn slow results into skipped lanes.
