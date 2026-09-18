import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function runCommand(command, args, options = {}) {
  const started = performance.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    timeout: options.timeout ?? 600000,
    killSignal: "SIGKILL",
    maxBuffer: 16 * 1024 * 1024,
  });
  const wallMs = performance.now() - started;
  if (options.log !== undefined) {
    mkdirSync(dirname(options.log), { recursive: true });
    writeFileSync(options.log, `${command} ${args.join(" ")}\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  }
  if (result.error !== undefined || result.status !== 0 || result.signal !== null) {
    throw new Error(`${command} failed (${result.error?.message ?? result.signal ?? result.status}).\n${result.stderr ?? ""}\n${result.stdout ?? ""}`);
  }
  return { stdout: result.stdout, stderr: result.stderr, wallMs };
}
