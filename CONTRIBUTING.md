# Contributing to Planwerk

Thank you for helping improve Planwerk.

Planwerk is a calm, local-first orientation aid for personal planning. Changes should make the daily planning flow clearer without adding pressure, performance language, unnecessary configuration, or remote dependencies for core functionality. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) before changing product behavior, UX, copy, architecture, or data handling.

## Development setup

1. Use the Node version from `.nvmrc`.
2. Install the locked dependencies with `npm ci`.
3. Start the desktop development app with `npm run electron:dev`.

Older Intel Macs on macOS Catalina can use `.nvmrc.legacy` and `npm run install:legacy`.

## Before opening a pull request

Run:

```sh
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

For source-release changes, also run `npm run release:check`.

Keep pull requests focused. Add regression tests for behavior changes, preserve backwards compatibility for existing `.planwerk` files, and do not commit real workspaces, credentials, private keys, signing certificates, generated builds, or personal working notes.

## Security

Do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](SECURITY.md).
