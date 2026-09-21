import { Stopwatch } from "@tsonic/dotnet/System.Diagnostics.js";
import { File, FileInfo } from "@tsonic/dotnet/System.IO.js";

export function now(): number {
  return Number(Stopwatch.GetTimestamp()) * 1000 / Number(Stopwatch.Frequency);
}

export function readText(path: string): string {
  return File.ReadAllText(path);
}

export function createReader(path: string): () => string {
  return (): string => File.ReadAllText(path);
}

export function createWriter(path: string, contents: string): () => void {
  return (): void => { File.WriteAllText(path, contents); };
}

export function createStat(path: string): () => number {
  const info = new FileInfo(path);
  return (): number => {
    info.Refresh();
    return Number(info.Length);
  };
}
