# Security

## Reporting a problem

Please report vulnerabilities privately: **Security → Report a vulnerability** on
<https://github.com/niko-ua-designer/hudini/security/advisories/new>. Do not open a public issue for them.
You will get an answer within a few days; a fix goes into the next release candidate.

## What Hudini protects, and how

| What could go wrong | Protection |
|---|---|
| Someone else puts things on the stream | Every change is encrypted (AES-256-GCM) and signed with the moderator key (ECDSA P-256). The widget ignores unsigned, foreign or out-of-date messages. |
| Someone reads what is going to the stream | Content and files are encrypted end to end; Hudini Host, the tunnel and the public broker see only ciphertext. Keys travel in the part of the link after `#`, which is never sent to a server. |
| A website in the streamer's browser talks to Hudini Host | The management page and `/api` live on `http://127.0.0.1:<port>` with Host and Origin checks; the OBS widget lives on `http://localhost:<port>` and cannot read settings or the moderators password; the local MQTT WebSocket accepts only the widget origin. |
| Someone on the internet reaches the tunnel | Only `/mqtt` and `/files` are exposed, both behind a random 144-bit password with per-address back-off. Moderators may publish only the screen state and effects; game data and the address announcement come only from Hudini Host. |
| A forged update installs malware | Releases carry `SHA256SUMS.txt.sig`, an Ed25519 signature over the version and the checksums. Hudini Host installs nothing without a valid signature from the key built into it; the private key lives only in the GitHub `release` environment, which needs the owner's approval. |
| A malicious update archive writes outside the app folder | Unpacking rejects absolute paths, `..`, symlinks that point outside, NTFS streams and oversized archives. |
| Viewer chat is used to inject code | Chat text, names and emotes are rendered as text only; scenarios have a minimum cooldown and a rate limit. |
| A compromised dependency | Dependencies are pinned by lock files and GitHub Actions by commit SHA; Dependabot, CodeQL and secret scanning run on the repository. |

## Known limits

- Whoever has the OBS link (or is a moderator) holds the room key: treat the OBS link like a password.
- The moderator panel keeps room keys in the browser's storage on `niko-ua-designer.github.io`; set a vault password in the panel to encrypt them.
- Release binaries are not code-signed with Authenticode or Apple notarization yet: download them only from the GitHub release page.
