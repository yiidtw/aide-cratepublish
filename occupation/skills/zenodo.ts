// zenodo — publish academic releases on Zenodo (anonymous)
// usage: zenodo publish <title> <description>   — create new deposit
//        zenodo upload <deposit_id> <file>       — upload file to deposit
//        zenodo finalize <deposit_id>            — publish the deposit (get DOI)
//        zenodo list                             — list your deposits
//
// Identity is read from cognition/memory/identity.md
// ZENODO_TOKEN must be in vault

const ZENODO_API = "https://zenodo.org/api";
const cmd = process.argv[2] || "help";

const token = process.env.ZENODO_TOKEN;
if (!token && cmd !== "help") {
  console.error("ZENODO_TOKEN not set. Run: aide vault set ZENODO_TOKEN");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

if (cmd === "help") {
  console.log(`Usage:
  zenodo publish <title> <description>   — create deposit
  zenodo upload <deposit_id> <file>      — upload file
  zenodo finalize <deposit_id>           — publish (get DOI)
  zenodo list                            — list deposits`);
  process.exit(0);
}

if (cmd === "list") {
  const resp = await fetch(`${ZENODO_API}/deposit/depositions`, { headers });
  if (!resp.ok) { console.error(`Error: ${resp.status}`); process.exit(1); }
  const deps = (await resp.json()) as any[];
  if (deps.length === 0) { console.log("No deposits."); process.exit(0); }
  for (const d of deps) {
    const doi = d.doi || "(draft)";
    console.log(`  ${d.id}  ${d.title || "untitled"}  ${doi}  ${d.state}`);
  }
  process.exit(0);
}

if (cmd === "publish") {
  const title = process.argv[3];
  const description = process.argv.slice(4).join(" ");
  if (!title) { console.error("Usage: zenodo publish <title> <description>"); process.exit(1); }

  // Create empty deposit — ANONYMOUS (no creators name)
  const resp = await fetch(`${ZENODO_API}/deposit/depositions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      metadata: {
        title,
        description: description || title,
        upload_type: "software",
        creators: [{ name: "Anonymous" }],  // cognition says: anonymous
        license: "MIT",
      },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Error creating deposit: ${resp.status} ${err}`);
    process.exit(1);
  }

  const dep = (await resp.json()) as any;
  console.log(`✓ Created deposit: ${dep.id}`);
  console.log(`  Upload files: zenodo upload ${dep.id} <file>`);
  console.log(`  Then publish: zenodo finalize ${dep.id}`);
  process.exit(0);
}

if (cmd === "upload") {
  const depId = process.argv[3];
  const filePath = process.argv[4];
  if (!depId || !filePath) { console.error("Usage: zenodo upload <deposit_id> <file>"); process.exit(1); }

  // Get bucket URL
  const depResp = await fetch(`${ZENODO_API}/deposit/depositions/${depId}`, { headers });
  if (!depResp.ok) { console.error(`Deposit ${depId} not found`); process.exit(1); }
  const dep = (await depResp.json()) as any;
  const bucketUrl = dep.links.bucket;

  const fileName = filePath.split("/").pop() || "file";
  const fileData = await Bun.file(filePath).arrayBuffer();

  const uploadResp = await fetch(`${bucketUrl}/${fileName}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
    body: fileData,
  });

  if (uploadResp.ok) {
    console.log(`✓ Uploaded ${fileName} to deposit ${depId}`);
  } else {
    console.error(`Upload failed: ${uploadResp.status}`);
    process.exit(1);
  }
}

if (cmd === "finalize") {
  const depId = process.argv[3];
  if (!depId) { console.error("Usage: zenodo finalize <deposit_id>"); process.exit(1); }

  const resp = await fetch(`${ZENODO_API}/deposit/depositions/${depId}/actions/publish`, {
    method: "POST",
    headers,
  });

  if (resp.ok) {
    const dep = (await resp.json()) as any;
    console.log(`✓ Published!`);
    console.log(`  DOI: ${dep.doi}`);
    console.log(`  URL: ${dep.doi_url}`);
    console.log(`\nCitation:`);
    console.log(`  aide.sh (${new Date().getFullYear()}). ${dep.title}. Zenodo. https://doi.org/${dep.doi}`);
  } else {
    const err = await resp.text();
    console.error(`Publish failed: ${resp.status} ${err}`);
    process.exit(1);
  }
}
