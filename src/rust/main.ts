import { run } from "../native/runner.js";
import { createReader, createStat, createWriter, now, readText } from "./platform.js";

export function main(): void {
  run(now, readText, createReader, createWriter, createStat);
}
