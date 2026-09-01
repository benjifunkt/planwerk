# Security Policy

## Supported versions

Security fixes are applied to the latest released version of Planwerk.

## Reporting a vulnerability

Please use GitHub Private Vulnerability Reporting for this repository. Do not include vulnerability details, access tokens, private `.planwerk` data, or proof-of-concept files in a public issue.

Include the affected version, the security boundary involved, reproduction conditions, observed impact, and any suggested remediation. Reports will be reviewed before public disclosure.

## Security model

Planwerk is local-first. Production builds use bundled assets and do not require a remote service for core planning. `.planwerk` packages are user-controlled input and are validated before use. Local MCP access is disabled by default, fixed to IPv4 loopback, and protected by Host, Origin, and bearer-token checks.
