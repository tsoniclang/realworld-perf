using System;
using System.IO;
using Bench.Native;

var stat = Csharp_platform.createStat("fixture.txt");
ExpectMissing(stat);
File.WriteAllText("fixture.txt", "abc");
ExpectSize(stat, 3);
File.AppendAllText("fixture.txt", "de");
ExpectSize(stat, 5);
File.WriteAllText("replacement.txt", "replacement");
File.Move("replacement.txt", "fixture.txt", true);
ExpectSize(stat, 11);
File.Move("fixture.txt", "moved.txt");
ExpectMissing(stat);
File.WriteAllText("fixture.txt", "again");
ExpectSize(stat, 5);
double total = 0;
for (var index = 0; index < 10000; index++) total += stat();
var before = GC.GetAllocatedBytesForCurrentThread();
for (var index = 0; index < 10000; index++) total += stat();
var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
if (total != 100000 || allocated != 0) throw new Exception($"Metadata allocation or checksum: {allocated}, {total}");
Console.WriteLine("Fresh metadata: mutation, replacement, absence, reappearance; zero per-query allocations.");

static void ExpectSize(Func<double> stat, double size)
{
    if (stat() != size) throw new Exception("Stale metadata");
}

static void ExpectMissing(Func<double> stat)
{
    try { stat(); }
    catch (FileNotFoundException) { return; }
    throw new Exception("Missing file was not rejected");
}
