# Support tickets: setup

People report problems on the website (`support.html`) without a GitHub account. The report arrives in the owner's Telegram bot. The owner answers with Telegram's reply; the author sees the answer on a private ticket page and can continue in Telegram.

The relay is a small Cloudflare Worker (`support/worker/`, free tier) with one KV namespace. It is separate from the stream data path: it never touches rooms, codes or the Hudini Host. Threats and tests: [SUPPORT-THREAT-MODEL.md](SUPPORT-THREAT-MODEL.md).

## One-time setup

1. **Bot.** In Telegram open @BotFather, `/newbot`, choose a name and a username (it must end in `bot`). Keep the token (`123456:ABC...`) secret.
2. **Your chat id.** Send any message to the new bot, then open `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` and read `message.chat.id` (a positive number). Or ask @userinfobot. This is `OWNER_CHAT_ID`; only this account can use owner commands.
3. **Wrangler.** `npm i -g wrangler` (or use `npx wrangler`), then `wrangler login`.
4. **KV.** In `support/worker/`: `wrangler kv namespace create TICKETS`. Put the printed `id` into `wrangler.toml` (`[[kv_namespaces]]`).
5. **Variables** in `wrangler.toml` (not secret): `SITE_ORIGIN` (`https://niko-ua-designer.github.io`, no path, no trailing slash), `BOT_USERNAME` (without `@`), `DAILY_CAP` (new tickets per day, default 500).
6. **Secrets** (each command asks for the value; use long random values, 32+ characters, for the two webhook ones: `openssl rand -base64 32 | tr -d '/+=' `):
   ```
   wrangler secret put BOT_TOKEN
   wrangler secret put OWNER_CHAT_ID
   wrangler secret put WEBHOOK_SECRET        # sent by Telegram in a header
   wrangler secret put WEBHOOK_PATH_SECRET   # part of the webhook URL
   ```
7. **Deploy:** `wrangler deploy`. It prints the worker URL, for example `https://hudini-support.<account>.workers.dev`.
8. **Webhook.** Tell Telegram where to send updates (replace the placeholders; the two secrets are the ones from step 6):
   ```
   curl -sS "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
     -d "url=https://hudini-support.<account>.workers.dev/tg/<WEBHOOK_PATH_SECRET>" \
     -d "secret_token=<WEBHOOK_SECRET>" \
     -d 'allowed_updates=["message","callback_query"]'
   ```
   The answer must be `{"ok":true,...}`. Check with `getWebhookInfo`. Keep the command out of shell history and the repository.
9. **Website.** In `web/site/support.js` set the one constant `const SUPPORT_API = 'https://hudini-support.<account>.workers.dev';`. Then `sh tools/build-site.sh`: the build copies that origin into the page's Content-Security-Policy (`connect-src`), so the constant is the only place to edit. (`SUPPORT_API=https://... sh tools/build-site.sh` overrides it for one build.) Commit and publish the site.

## Using it

- A new ticket arrives as a message with the text, kind, version, system and buttons "Закрыть" / "Открыть". The log, if any, comes as a second message.
- **Answer:** use Telegram's reply on the ticket message (or on a forwarded follow-up). If the author linked Telegram, the answer is sent there; otherwise it appears on their ticket page.
- Commands (only from your chat): `/tickets` (open ones, newest first), `/t <id>`, `/close <id>`, `/open <id>`, `/delete <id>`, `/help`.
- People can also write to the bot directly; that opens a ticket of kind "other".

## Test

1. Open the site's `support.html`, send a report, check that it arrives in Telegram.
2. Reply to it; reload the ticket link: your answer is there.
3. On the success screen press "Continue in Telegram" and Start; write a line; it comes to you as a reply to the ticket.
4. `/close <id>` and check the page shows "Closed".
5. Automated tests: `cd tests && node support.test.js` (a fake KV and a mocked Telegram; no network, no Host).

## Privacy

Stored in KV per ticket: kind, text, optional contact, version, system, role, connection, language, the messages, status, a SHA-256 hash of the ticket secret (never the secret), a hash of the Telegram link token until it is used, and the Telegram chat id of an author who linked. The attached log is only forwarded to you; it is not stored. IP addresses are never stored or logged: rate limits use a hash of the IP with a secret and the date. Everything about a ticket expires 30 days after its last activity (KV TTL). Cloudflare and Telegram process the traffic as usual; Telegram sees the ticket texts. The ticket link contains the secret in the URL fragment, so it does not reach any server log; the page keeps `id + secret` of the author's own reports in the browser's localStorage so "My reports" works. That is a convenience trade-off: someone with access to that browser profile can read the author's tickets (not anyone else's).

## Deleting and rotating

- Delete one ticket: `/delete <id>` removes the ticket, its message mappings and the author's chat link. Deleting everything: delete the KV namespace in the Cloudflare dashboard.
- Rotate `BOT_TOKEN`: new token in @BotFather (`/revoke`), then `wrangler secret put BOT_TOKEN`.
- Rotate the webhook secrets: `wrangler secret put WEBHOOK_SECRET` and `WEBHOOK_PATH_SECRET`, then run the `setWebhook` command again with the new values.
- Changing the relay address: edit `SUPPORT_API`, rebuild the site.
