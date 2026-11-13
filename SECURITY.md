# Security

## Reporting a problem

Report vulnerabilities privately: **Security → Report a vulnerability** on
<https://github.com/niko-ua-designer/hudini/security/advisories/new> (GitHub private vulnerability reporting).
Do not open a public issue for them. Non-sensitive problems can go to
[issues](https://github.com/niko-ua-designer/hudini/issues). Never post a room code (`hudini1:...`) or logs that contain one.

## Model

Hudini has no server of its own and does not use Cloudflare or any other relay. The streamer's PC is the only server;
the moderator connects to it directly over a network both share (VPN, Porthole, port forwarding).

| What could go wrong | Protection |
|---|---|
| Someone on the network reads or alters moderator traffic | The moderator port (TCP 7778) speaks TLS (1.2 or newer). The certificate is self-signed and created on the streamer's PC; the moderator's relay accepts only a certificate whose SHA-256 fingerprint equals the one in the room code. Name, expiry and chain are not trusted, so a foreign certificate is rejected. |
| A stranger joins as a moderator | The room code `hudini1:` is base64url JSON: room, password, certificate fingerprint, addresses and the room keys. The password is random (18 bytes) and is checked in constant time. After 5 wrong tries from one address the server pauses that address (1 min, doubling up to 30 min). Through Porthole all guests come from 127.0.0.1, so there the limit is 5 wrong tries per minute. The streamer can pause or switch off moderators. |
| A moderator changes what they should not | Moderators may publish only the screen state and effects. Game data (CS2), the host announcement and settings come only from the streamer's app. Room messages are AES-256-GCM encrypted and signed (ECDSA P-256); the widget ignores unsigned or foreign messages. |
| A web page or another program controls the streamer's app | The management page and `/api/*` are served on `127.0.0.1` only and need the `hudini_admin` cookie (HttpOnly, SameSite=Strict, set by a one-time `/auth?t=` token) or the `X-Hudini-Token` header, with a Host check. The OBS widget is served from `localhost`, a different origin, and cannot read settings. The moderator port serves only `/ping`, `/files` and the room WebSocket, never `/api`. |
| A forged update | Releases carry `SHA256SUMS.txt.sig`, an Ed25519 signature over the version and the checksums. The app installs nothing without a valid signature from the key built into it. |
| Chat is used to inject code | Chat text, names and emotes are rendered as text only. |

## Where data lives

- Everything of the moderator stays on the moderator's PC in `data/store.json` next to the app: saved streamers (room codes with keys), scenes, library, settings. The file is plain JSON and is not encrypted; protect the folder like a password store.
- The streamer's settings, TLS key (`data/tls/`, mode 0600) and logs (`data/logs/`) stay on the streamer's PC.
- A backup made with the old panel (library, animations, scenes, scenarios) is a file protected with a password you choose; it contains the room keys.
- Nothing is sent to us. The app only asks GitHub Releases for updates.

## Support relay

The website's "Report a problem" page sends reports to a small Cloudflare Worker (`support/worker/`) that forwards them to the developer's Telegram bot. It is separate from the stream data path: no room codes, keys or stream data go through it, and the app does not talk to it. It stores the report text, the optional contact the author typed, version and system, the conversation, and hashes of the ticket secret (never the secret). IP addresses are not stored or logged. Tickets expire after 30 days without activity. Do not paste room codes into a report. Details: [docs/SUPPORT.md](docs/SUPPORT.md) and [docs/SUPPORT-THREAT-MODEL.md](docs/SUPPORT-THREAT-MODEL.md).

## Known limits

- Anyone with a room code is a moderator, and the code holds the room keys: send it only to people you trust, and do not share logs with it.
- Port 7778 is reachable by everyone on the shared network. In a Porthole lobby, invite only your moderator.
- If the streamer's certificate is regenerated (the old one is replaced about 30 days before it expires, or `data/tls/` is deleted), old codes stop working and the moderator needs a new code.
- Release binaries are not code-signed with Authenticode or Apple notarization yet: download them only from the GitHub release page.
