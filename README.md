# aide-cratepublish

Publish and update Rust crates on crates.io + academic releases on Zenodo.

An [aide.sh](https://aide.sh) agent. `soul.prefer = none` — no LLM required.

## Skills

- `crate publish <path>` — publish to crates.io
- `crate check <path>` — dry-run verification
- `crate info <name>` — check crate on crates.io
- `crate verify <name>` — post-publish verification
- `zenodo publish <title>` — create Zenodo deposit
- `zenodo upload <id> <file>` — upload file
- `zenodo finalize <id>` — publish and get DOI

## Usage

```bash
aide pull yiidtw/cratepublish
aide run yiidtw/cratepublish
aide vault set CRATES_IO_TOKEN
aide exec cratepublish.yiidtw crate publish ./my-crate
```

Powered by [aide.sh](https://aide.sh) — Deploy AI agents, just like Docker.
