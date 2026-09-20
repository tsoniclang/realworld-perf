import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildAll } from "./build.mjs";
import { benchmark } from "./benchmark.mjs";
import { root, runCommand } from "./process.mjs";
import { verifyNumericInputs } from "./numeric-inputs.mjs";

const tests = readdirSync(resolve(root, "test")).filter((name) => name.endsWith(".test.mjs")).sort();
console.log(runCommand(process.execPath, ["--test", ...tests.map((name) => `test/${name}`)]).stdout);
buildAll();
benchmark({ samples: 2, warmup: 1, verification: true });
verifyNumericInputs();
