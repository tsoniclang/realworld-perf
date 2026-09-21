import { metadata, read_to_string, write } from "@tsonic/rust/std/fs.js";
import { Instant } from "@tsonic/rust/std/time.js";
import { ref } from "@tsonic/rust/lang.js";
import type { Ref } from "@tsonic/rust/types.js";

const origin = Instant.now();

export function now(): number {
  return origin.elapsed().as_secs_f64() * 1000;
}

export function readText(path: string): string {
  return read_to_string<Ref<string>>(ref(path)).unwrap();
}

export function createReader(path: string): () => string {
  return (): string => read_to_string<Ref<string>>(ref(path)).unwrap();
}

export function createWriter(path: string, contents: string): () => void {
  return (): void => { write<Ref<string>, Ref<string>>(ref(path), ref(contents)).unwrap(); };
}

export function createStat(path: string): () => number {
  return (): number => Number(metadata<Ref<string>>(ref(path)).unwrap().len());
}
