import { run } from "../shared/runner.js";
import { fileSize, now, readText, writeText } from "./platform.js";

export function main(): void {
  run(now, readText, writeText, fileSize);
}
