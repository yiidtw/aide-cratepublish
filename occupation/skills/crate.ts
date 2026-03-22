// crate — publish or update a Rust crate on crates.io
// usage: crate publish <path>     — publish crate at path
//        crate check <path>       — dry-run, verify publishable
//        crate info <name>        — check crate info on crates.io

const cmd = process.argv[2] || "help";
const arg = process.argv[3];

if (cmd === "help") {
  console.log(`Usage:
  crate publish <path>   — publish to crates.io
  crate check <path>     — dry-run verification
  crate info <name>      — check existing crate`);
  process.exit(0);
}

if (cmd === "info") {
  if (!arg) { console.error("Usage: crate info <name>"); process.exit(1); }
  const resp = await fetch(`https://crates.io/api/v1/crates/${arg}`, {
    headers: { "User-Agent": "aide-cratepublish" },
  });
  if (!resp.ok) {
    console.log(`Crate '${arg}' not found on crates.io`);
    process.exit(1);
  }
  const data = (await resp.json()) as any;
  const c = data.crate;
  console.log(`${c.name} v${c.max_version}`);
  console.log(`  downloads: ${c.downloads}`);
  console.log(`  description: ${c.description}`);
  console.log(`  repository: ${c.repository || "none"}`);
  process.exit(0);
}

if (cmd === "check") {
  if (!arg) { console.error("Usage: crate check <path>"); process.exit(1); }
  console.log(`Checking ${arg}...`);
  const proc = Bun.spawnSync(["cargo", "publish", "--dry-run"], {
    cwd: arg, stdout: "inherit", stderr: "inherit",
  });
  process.exit(proc.exitCode ?? 1);
}

if (cmd === "publish") {
  if (!arg) { console.error("Usage: crate publish <path>"); process.exit(1); }
  const token = process.env.CRATES_IO_TOKEN;
  if (!token) {
    console.error("CRATES_IO_TOKEN not set. Run: aide vault set CRATES_IO_TOKEN");
    process.exit(1);
  }
  console.log(`Publishing ${arg} to crates.io...`);
  const proc = Bun.spawnSync(["cargo", "publish", "--token", token], {
    cwd: arg, stdout: "inherit", stderr: "inherit",
  });
  if (proc.exitCode === 0) {
    console.log("✓ Published to crates.io");
  }
  process.exit(proc.exitCode ?? 1);
}

console.error(`Unknown command: ${cmd}`);
process.exit(1);
