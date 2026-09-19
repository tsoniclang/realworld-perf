import { Stopwatch } from "@tsonic/dotnet/System.Diagnostics.js";
import { File, FileInfo } from "@tsonic/dotnet/System.IO.js";

export function now(): number {
  return Number(Stopwatch.GetTimestamp()) * 1000 / Number(Stopwatch.Frequency);
}

export function readText(path: string): string {
  return File.ReadAllText(path);
}

export function writeText(path: string, contents: string): void {
  File.WriteAllText(path, contents);
}

export function fileSize(path: string): number {
  return Number(new FileInfo(path).Length);
}
