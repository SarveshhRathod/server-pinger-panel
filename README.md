# Server Pinger Panel

A simple Cloudflare Pages frontend and Cloudflare Worker backend to manage website/server monitors.

Features:
- Add pinger
- Edit pinger
- Delete pinger
- Save pingers in D1 database
- Run checks every minute with Cloudflare cron
- Send Discord alerts on failures

## Project structure

- `index.html` — frontend pinger panel
- `src/index.js` — Cloudflare Worker API and cron logic
- `wrangler.toml` — Worker configuration
- `schema.sql` — D1 database schema

## Setup

1. Create a Cloudflare D1 database:
   ```bash
   npx wrangler d1 create pinger-db
   ```

2. Update the database ID in `wrangler.toml`.

3. Run the SQL schema:
   ```bash
   npx wrangler d1 execute pinger-db --local --file=./schema.sql
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Update the Worker URL in `index.html`.

6. Deploy the Worker:
   ```bash
   npm run deploy:worker
   ```

7. Deploy the frontend on Cloudflare Pages using the repo root.

## Worker notes

The worker runs every minute via cron:

```toml
[[triggers]]
crons = ["*/1 * * * *"]
```

This checks each active URL. If a request fails, it posts a message to the Discord webhook.

## Example alert

Your Worker will send a message like:

```text
🚨 Pinger failed
Name: My API
URL: https://example.com/health
Reason: fetch failed
```

## Important

The frontend uses a hardcoded Worker URL in the page script:

```js
const WORKER_URL = "https://your-worker-domain.workers.dev";
```

Replace it with your real Cloudflare Worker URL before using the app.
