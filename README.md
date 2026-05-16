# AI Crypto Advisor

A personalized crypto investor dashboard built as a full-stack MVP.

## Overview

Users sign up, complete a short onboarding quiz to declare their crypto interests and investor type, and then see a personalized daily dashboard with:
- **Live coin prices** (CoinGecko)
- **7-day price charts** (CoinGecko historical)
- **Curated market news** (NewsData.io / fallback)
- **AI-generated insights** (OpenRouter free tier)
- **Crypto culture memes** (Meme API / fallback)
- **Feedback voting** (thumbs up/down stored in DB)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, React Router, CSS Variables (dark theme) |
| Backend | Node.js + Express |
| Database | Supabase PostgreSQL with Prisma |
| Auth | JWT + bcrypt |

## Features

### ✅ Authentication
JWT-based signup and login. Tokens stored in `localStorage`.

### ✅ Onboarding Quiz
Collects the user's tracked assets, investor type (HODLer, Day Trader, NFT Collector, DeFi Explorer, Beginner), and content preferences. Saved to DB.

### ✅ Personalized Dashboard

#### Coin Prices — CoinGecko API
- Fetches live prices for user-selected assets
- 60-second in-memory cache to avoid hammering the free tier
- Falls back to mock prices if CoinGecko is unreachable
- Shows badge: `Live prices` / `Cached live prices` / `Fallback demo prices`
- Add / remove tracked coins without re-doing onboarding

#### Market Charts — CoinGecko Historical Data
- Fetches 7-day historical price data from CoinGecko's market chart endpoint
- Interactive line chart powered by Recharts with responsive layout
- Asset dropdown — switch between tracked coins without reloading the dashboard
- 5-minute in-memory cache keyed by asset name — avoids excessive API calls
- Falls back to realistic demo chart data if CoinGecko is unreachable or rate-limited
- Shows badge: `Live chart` / `Cached chart` / `Fallback demo chart`
- Dedicated lightweight endpoint `GET /api/dashboard/chart?asset=Bitcoin`:
  - Requires JWT auth
  - Validates the requested asset is tracked by the logged-in user
  - Returns only chart payload (does not reload prices, news, AI, or memes)
  - Same cache and fallback logic as main dashboard

#### Market News — NewsData.io
- Fetches live crypto news from [NewsData.io](https://newsdata.io) (free tier, API key required)
- Set `NEWSDATA_API_KEY` in `server/.env` to enable live news
- **Personalised query** — builds a crypto-specific search query from the user's tracked assets:
  - e.g. `['Bitcoin', 'Ethereum']` → `bitcoin OR ethereum OR crypto`
  - falls back to `crypto OR cryptocurrency OR blockchain` if no known assets match
- Returns up to 5 recent articles normalised to `{ title, summary, source, url, time, tags }`
- 5-minute in-memory cache keyed on sorted asset list — avoids hitting the API on every refresh
- If key is missing, API fails, or returns 0 results → static demo news shown, `newsSource: "fallback"`
- Shows badge: `Live news` / `Cached live news` / `Fallback demo news`

> **Note on CryptoPanic:** The CryptoPanic service (`server/src/services/cryptoPanic.service.js`) is preserved in the codebase but is **not used by default** because live API access requires a paid plan.

#### AI Insight of the Day — OpenRouter
- Calls OpenRouter's chat completions API with a personalized prompt
- Prompt includes: investor type, tracked assets, content preferences, current coin prices, and recent news headlines
- Tone is adapted per investor type (HODLer → long-term, Day Trader → volatility, etc.)
- **Always uses an explicit free model** (`:free` suffix on OpenRouter = $0 cost)
- Default model: `deepseek/deepseek-v4-flash:free`
- Configurable via `OPENROUTER_MODEL` in `.env` — override to any `:free` model you prefer
- **Does NOT fall back to `openrouter/auto` or any paid model** if the free model fails
- If the free model is unavailable, rate-limited, or fails for any reason → static demo insight is shown, `aiSource: "fallback"`
- 6-hour in-memory cache; cache key includes assets, investor type, content types, and BTC price bucket
- Shows badge: `Live AI insight` / `Cached AI insight` / `Fallback demo insight`
- Educational disclaimer always shown: *"This dashboard is for educational purposes only and is not financial advice."*

#### Crypto Culture Meme — Meme API (meme-api.com)
- Fetches a real crypto meme from the community — no API key required, completely free
- Tries these crypto-specific subreddits in order:
  1. `r/cryptocurrencymemes` (primary)
  2. `r/Bitcoin` (fallback #1)
  3. `r/ethereum` (fallback #2)
- **Never uses a general meme subreddit** — all content comes from crypto-dedicated communities
- Validates every post: skips nsfw, spoilers, posts without a valid image URL
- 60-second in-memory cache; cache key is per-process (one meme slot)
- If all crypto meme endpoints fail or return unusable content → static demo crypto meme is shown, `memeSource: "fallback"`
- Shows badge: `Live crypto meme` / `Cached crypto meme` / `Fallback demo crypto meme`

### ✅ Feedback Voting
Thumbs up/down on each dashboard section is stored in the `Feedback` DB table for future model improvement.

### ✅ Add / Remove Tracked Coins
Users can add or remove coins from the Market Overview without re-onboarding. Changes are persisted to the DB.

## How the Feedback System Will Work (Bonus)

The upvote/downvote feedback collected here is saved to the `Feedback` table with `section`, `itemId`, and `vote` fields. In future iterations, this data could be used to:
1. **Fine-tune prompts** — include highly-voted insight types in future prompts
2. **Filter content** — suppress news categories consistently downvoted by the user
3. **Personalize meme style** — track which meme formats resonate with each investor type
4. **Build a training dataset** — aggregate voted insights across users for future model fine-tuning

## Environment Variables

Copy `server/.env.example` to `server/.env` and fill in your values:

```env
# Database — Supabase PostgreSQL
DATABASE_URL="postgresql://postgres.[ref]:***@pooler:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:***@pooler:5432/postgres"

JWT_SECRET="replace-with-your-secret"
PORT=5001
CLIENT_URL="http://localhost:5173"   # Frontend origin for CORS (production: your deployed URL)
NEWSDATA_API_KEY=""            # Required for live news (NewsData.io free tier)
CRYPTOPANIC_API_KEY=""         # Optional: legacy provider, not used by default (paid plan)
OPENROUTER_API_KEY=""          # Required for live AI insights
OPENROUTER_MODEL="deepseek/deepseek-v4-flash:free"  # Always use a :free model
```

> ⚠️ `server/.env` is gitignored and must never be committed. Never use `openrouter/auto` as the model — it may route to paid models.

Copy `client/.env.example` to `client/.env` for local development:

```env
VITE_API_URL=http://localhost:5001
```

## Graceful Degradation

The app is designed to work even when external APIs are unavailable:

| Service | Live | Fallback behavior |
|---|---|---|
| CoinGecko (prices) | Free, no key | Mock prices shown, `priceSource: "fallback"` |
| CoinGecko (charts) | Free, no key | Demo chart shown, `chartSource: "fallback"` |
| NewsData.io (news) | Free key required | Demo news shown, `newsSource: "fallback"` |
| OpenRouter (AI) | Free key + free model | Demo insight shown, `aiSource: "fallback"` |
| Meme API (memes) | Free, no key | Static crypto demo meme shown, `memeSource: "fallback"` |
| CryptoPanic (news) | Paid key required | Not used by default — service file preserved for reference |

The app **never automatically switches to a paid AI model**. If the free model fails, the static insight is used.

## Deployment

Deploy the **backend first**, then the **frontend**. Never commit `.env` files or real secrets.

### Backend deployment

1. Deploy the Node.js server (e.g. Railway, Render, Fly.io).
2. Set these environment variables on the host:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string |
| `DIRECT_URL` | Yes | Supabase direct connection (Prisma migrations / `db push`) |
| `JWT_SECRET` | Yes | Strong random secret for JWT signing |
| `PORT` | Yes | Host port (e.g. `5001`; many platforms set this automatically) |
| `CLIENT_URL` | Yes | Deployed frontend origin for CORS — must match exactly (no trailing slash) |
| `OPENROUTER_API_KEY` | For live AI | Falls back to demo insight if missing |
| `OPENROUTER_MODEL` | Recommended | Use a `:free` model, e.g. `deepseek/deepseek-v4-flash:free` |
| `NEWSDATA_API_KEY` | For live news | Falls back to demo news if missing |
| `CRYPTOPANIC_API_KEY` | No | Optional / leave empty — not used by default |

3. **Database:** Supabase PostgreSQL is the production database.
4. **`postinstall`** runs `prisma generate` automatically after `npm install`.
5. **Schema sync (MVP):** run once against production (or from CI) before starting the server:

```bash
cd server
npx prisma db push
```

### Frontend deployment

1. Deploy the Vite app (e.g. Vercel, Netlify, Cloudflare Pages) **after** the backend is live.
2. Set the build-time environment variable:

```env
VITE_API_URL=https://your-backend-url/api
```

Vite embeds `VITE_API_URL` at **build time**, so configure it in your hosting dashboard **before** running `npm run build`.

3. Set `CLIENT_URL` on the backend to the deployed frontend origin, for example:

```env
CLIENT_URL=https://your-app.vercel.app
```

`CLIENT_URL` must **exactly** match the browser origin (scheme + host + port). Avoid trailing-slash mismatches (use `https://your-app.vercel.app`, not `https://your-app.vercel.app/`).

4. Build command (typical):

```bash
cd client
npm install
npm run build
```

Serve the `client/dist` output with your static host.

## How to Run Locally

### Prerequisites
- Node.js (v18+)

### Backend
```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev
```
Server starts on `http://localhost:5001`.

### Frontend
```bash
cd client
npm install
npm run dev
```
Frontend starts on `http://localhost:5173`.

### Run API Tests
With the backend running:
```bash
node server/test-api.js
```
Tests cover: signup, login, onboarding, dashboard (live + cache), feedback, update assets, and Database verification.

## Database Management (Supabase)

The project originally used SQLite during early development, but now uses Supabase PostgreSQL. Existing SQLite data is not automatically migrated.

To inspect or manage data:
- **Supabase Dashboard**: Use the Supabase Table Editor online.
- **Prisma Studio**: View data locally by running:
  ```bash
  cd server
  npx prisma studio
  ```
