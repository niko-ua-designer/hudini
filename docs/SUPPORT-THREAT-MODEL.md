# Support relay: threat model

Scope: `support/worker/src/worker.js` and `web/site/support.{html,js}`. Test names are the `step` names in `tests/support.test.js`.

| Threat | Mitigation | Test |
| --- | --- | --- |
| KV key injection through ids (`:`, `/`, unicode, `%00`) | Every id is matched against a strict regex before it builds a key; Telegram message ids must be positive safe integers | relay: KV keys are validated |
| Someone pretends to be the owner (spoofed fields, groups, forwarded buttons) | Owner actions need `from.id` AND `chat.id` equal to `OWNER_CHAT_ID` in a private chat, taken from the verified update, never from button data or text | relay: the owner replies; routing and impostors; relay: close / reopen buttons |
| Fake webhook calls | Secret path AND `X-Telegram-Bot-Api-Secret-Token`, constant-time compare, identical 404 for every failure; fails closed if secrets are missing or short | relay: webhook authentication |
| Replayed webhook | `update_id` must be higher than the last processed one | relay: replayed updates |
| Guessing or leaking ticket secrets | 192-bit secret from `crypto.getRandomValues`; only SHA-256 stored; constant-time compare; unknown id, wrong secret and no secret give the same 404; secret only in a header or the URL fragment, never the query | relay: polling with the secret; relay: creating a ticket |
| Telegram deep link exposes the secret | Separate 128-bit single-use link token, only its hash is stored | relay: Telegram author: /start link |
| Stored XSS on the ticket page | All ticket text is inserted with `textContent`, no linkifying; strict CSP (`script-src 'self'`) | page: ticket view, secret handling, polling, follow-up, text safety |
| Injection into Telegram messages | No `parse_mode`: plain text only; control, zero-width and bidi characters stripped; lengths capped | relay: output safety, privacy, no SSRF, no logs |
| Spam and floods | Honeypot; per-client (hashed IP) 30 requests/min and 5 tickets/hour; per-Telegram-chat limits; 30 author messages per ticket; global daily cap (`DAILY_CAP`) with one owner notice | relay: honeypot; relay: rate limits and Telegram failure; relay: daily cap |
| Oversized or odd bodies | 32 KB limit enforced on the stream, JSON only, strict field validation | relay: validation; relay: body size limit on the real stream |
| Cross-site use from other pages | CORS only for `SITE_ORIGIN`, requests without that `Origin` are refused (CORS is not authentication: a script outside a browser can forge `Origin`, the real controls are the limits above) | relay: CORS and headers |
| Open relay / SSRF | The only outgoing request goes to a constant `api.telegram.org` URL; no user URL is ever fetched | relay: output safety, privacy, no SSRF, no logs |
| Privacy leaks | No raw IPs, secrets, tokens or ticket text in KV keys or logs (error logs carry only the error name); 30-day TTL; `/delete` removes ticket, mappings, chat link | relay: output safety...; relay: owner commands; relay: creating a ticket |
| Browser-side leaks | Secret removed from the address bar after load (`history.replaceState`), `Referrer-Policy: no-referrer`, `rel=noopener`, CSP `connect-src` is exactly the relay, no third-party scripts, fonts or analytics | page: CSP and static safety; page: ticket view... |
| Response sniffing and caching | `nosniff`, `Cache-Control: no-store`, `no-referrer`, restrictive CSP on every worker response | relay: CORS and headers |

## Residual risks

- **KV is eventually consistent.** Rate limits, the daily cap, the replay counter and the single-use link token are best effort: a fast burst from several edge locations can slip a few requests past a limit, or replay an update once.
- **Rate limits are per hashed IP.** Many clients behind one address share a bucket; an attacker with many addresses can still fill the daily cap (the cap protects the owner, at the price of refusing real people for the day).
- **Anyone with a ticket link can read and write that ticket**, and "My reports" keeps the links in the browser's localStorage.
- **Telegram sees all tickets**, and Cloudflare sees all traffic. Tickets are not end-to-end encrypted.
- **Text-only defence for the owner:** Telegram clients may auto-link URLs in a ticket; the owner should treat links in tickets as untrusted.
- A leaked `BOT_TOKEN` gives full bot control; rotate it in @BotFather (see SUPPORT.md).
