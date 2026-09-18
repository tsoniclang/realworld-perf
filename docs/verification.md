# Verification status

Recorded September 18, 2026. This is a checkpoint, not a passing certification.

## Results

| Gate | Result |
| --- | --- |
| Fresh locked public-package install | Pass: 18 packages, empty install root and npm cache, no sibling source links |
| Harness tests | 7/7 pass; no skips |
| Node build | Pass |
| C# Node and native builds | Pass, with the nullable-local warning described below |
| Rust Node build | Pass |
| Rust native build | Fails during target analysis |
| Runtime checks of the four built lanes | 20/20 workload cells pass |
| Complete `npm test` | Fails; the five-lane execution matrix has not passed |
| Full benchmark measurements | Not run; no successful comparison report |

The 20 runtime checks used three iterations and one warm-up batch per workload.
They checked checksums, Unicode string lengths, UTF-8 metadata byte counts and
exact bytes after writes. They are diagnostic evidence, not a substitute for
the normal two-round, 25-cell gate. The complete gate still requires all five
lanes and does not omit the native Rust failures.

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

After the compiler defects are fixed and published, update exact package pins
and the lockfile, run `npm test`, then `npm run bench`. Inspect the emitted source
and recorded timing spread before drawing performance conclusions.
