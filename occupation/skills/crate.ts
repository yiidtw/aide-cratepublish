// crate — publish or update a Rust crate on crates.io
// usage: crate publish <path>     — publish crate at path
//        crate check <path>       — dry-run, verify publishable
//        crate info <name>        — check crate info on crates.io
//        crate verify <name>      — verify crate is live on crates.io after publish

const cmd = process.argv[2] || "help";
const arg = process.argv[3];

if (cmd === "help") {
  console.log(`Usage:
  crate publish <path>   — publish to crates.io
  crate check <path>     — dry-run verification
  crate info <name>      — check existing crate
  crate verify <name>    — verify crate is live on crates.io after publish`);
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

if (cmd === "verify") {
  if (!arg) { console.error("Usage: crate verify <name>"); process.exit(1); }
  console.log(`Verifying ${arg} on crates.io...`);
  const resp = await fetch(`https://crates.io/api/v1/crates/${arg}`, {
    headers: { "User-Agent": "aide-cratepublish" },
  });
  if (!resp.ok) {
    console.error(`✗ Crate '${arg}' not found on crates.io`);
    process.exit(1);
  }
  const data = (await resp.json()) as any;
  const c = data.crate;
  console.log(`✓ Found: ${c.name} v${c.max_version} (${c.downloads} downloads)`);

  // Try dry-run install in a temp dir
  const tmpDir = await import("os").then(os => os.tmpdir());
  const installDir = `${tmpDir}/aide-crate-verify-${Date.now()}`;
  await import("fs/promises").then(fs => fs.mkdir(installDir, { recursive: true }));
  console.log(`Checking install-ability (dry-run)...`);
  const installProc = Bun.spawnSync(
    ["cargo", "install", arg, "--root", installDir, "--dry-run"],
    { stdout: "inherit", stderr: "inherit" },
  );
  if (installProc.exitCode === 0) {
    console.log(`✓ Installable via cargo install ${arg}`);
  } else {
    console.log(`⚠ cargo install dry-run failed (may be a library crate)`);
  }
  // Cleanup
  await import("fs/promises").then(fs => fs.rm(installDir, { recursive: true, force: true }));
  process.exit(0);
}

if (cmd === "publish") {
  if (!arg) { console.error("Usage: crate publish <path>"); process.exit(1); }
  const token = process.env.CRATES_IO_TOKEN;
  if (!token) {
    console.error("CRATES_IO_TOKEN not set. Run: aide vault set CRATES_IO_TOKEN");
    process.exit(1);
  }
  // Read crate name from Cargo.toml
  const cargoToml = await Bun.file(`${arg}/Cargo.toml`).text();
  const nameMatch = cargoToml.match(/^name\s*=\s*"([^"]+)"/m);
  const crateName = nameMatch?.[1] || "unknown";

  console.log(`Publishing ${crateName} from ${arg} to crates.io...`);
  const proc = Bun.spawnSync(["cargo", "publish", "--token", token], {
    cwd: arg, stdout: "inherit", stderr: "inherit",
  });
  if (proc.exitCode === 0) {
    console.log("✓ Published to crates.io");
    console.log("Verifying...");
    // Wait a few seconds for crates.io to index
    await Bun.sleep(5000);
    // Check it's live
    const verifyResp = await fetch(`https://crates.io/api/v1/crates/${crateName}`, {
      headers: { "User-Agent": "aide-cratepublish" },
    });
    if (verifyResp.ok) {
      const data = (await verifyResp.json()) as any;
      console.log(`✓ Verified: ${data.crate.name} v${data.crate.max_version} (${data.crate.downloads} downloads)`);
    }
  }
  process.exit(proc.exitCode ?? 1);
}

console.error(`Unknown command: ${cmd}`);
process.exit(1);
