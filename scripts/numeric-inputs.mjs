import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createFixture, lanes } from "./catalog.mjs";
import { executionCommand } from "./benchmark.mjs";
import { root, runCommand } from "./process.mjs";
import { validateResult } from "./results.mjs";

export function verifyNumericInputs() {
  mkdirSync(resolve(root, ".temp/runs"), { recursive: true });
  const directory = mkdtempSync(resolve(root, ".temp/runs/numeric-inputs-"));
  const fixture = createFixture({ id: "primes", size: 1000000, iterations: 1 });
  const invalid = [
    [0, 1, 0], [1000001, 1, 0], [2147483648, 1, 0],
    [1, 2147483648, 0], [1, 1, 101], [1, 1, -1],
  ];
  let checked = 0;
  for (const lane of lanes) {
    const cwd = resolve(directory, lane.id);
    mkdirSync(cwd);
    const { command, args } = executionCommand(lane);
    writeFileSync(resolve(cwd, "fixture.txt"), fixture.payload);
    writeFileSync(resolve(cwd, "input.txt"), "primes\n1000000\n1\n0");
    const valid = runCommand(command, args, { cwd, timeout: 60000, log: resolve(cwd, "maximum.log") });
    assert.equal(valid.stderr, "");
    validateResult(JSON.parse(valid.stdout), { benchmark: "primes", iterations: 1, warmup: 0 }, fixture.expected);
    checked++;
    for (const [index, dimensions] of invalid.entries()) {
      writeFileSync(resolve(cwd, "input.txt"), ["primes", ...dimensions].join("\n"));
      assert.throws(() => runCommand(command, args, { cwd, timeout: 10000, log: resolve(cwd, `invalid-${index}.log`) }), /Invalid benchmark dimensions/u);
      checked++;
    }
  }
  console.log(`${checked}/${lanes.length * (invalid.length + 1)} numeric boundary checks pass; maximum prime checksum ${fixture.expected}.`);
}
