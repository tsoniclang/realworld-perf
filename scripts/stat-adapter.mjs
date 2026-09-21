import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { csharpPublishArguments } from "./build.mjs";
import { root, runCommand } from "./process.mjs";

export function verifyStatAdapter() {
  const config = JSON.parse(readFileSync(resolve(root, "tsonic.csharp-native.json"), "utf8"));
  const generated = resolve(root, config.outDir, "csharp/src/csharp/Csharp_platform.cs");
  const source = readFileSync(generated, "utf8");
  assert.doesNotMatch(source, /Globals\.Number/u);
  assert.match(source, /\.Refresh\(\)/u);
  mkdirSync(resolve(root, ".temp/runs"), { recursive: true });
  const directory = mkdtempSync(resolve(root, ".temp/runs/stat-adapter-"));
  copyFileSync(generated, resolve(directory, "Platform.cs"));
  copyFileSync(resolve(root, "test/fixtures/stat-adapter/Program.cs"), resolve(directory, "Program.cs"));
  const project = resolve(directory, "StatAdapter.csproj");
  writeFileSync(project, `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>
<OutputType>Exe</OutputType><TargetFramework>${config.targets[0].options.targetFramework}</TargetFramework>
<PublishAot>true</PublishAot><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors>
</PropertyGroup></Project>`);
  const output = resolve(directory, "published");
  runCommand("dotnet", csharpPublishArguments(project, output), { log: resolve(directory, "build.log") });
  const result = runCommand(resolve(output, "StatAdapter"), [], { cwd: directory, log: resolve(directory, "run.log") });
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.trim(), "Fresh metadata: mutation, replacement, absence, reappearance; zero per-query allocations.");
  console.log(result.stdout.trim());
}
