# SmartPantry AI

An AI-powered kitchen companion built around reducing food waste.

**Scan** a food item with your camera → a vision model reads its name, category and
expiry date → it lands in a **pantry inventory sorted by what expires first** → an LLM
turns that inventory into **recipe suggestions**, a **7-day meal plan**, and a
**shopping list of only what you're missing**.

Everything is personalised: allergies, cooking skill, spice tolerance, diet, cuisine,
household size and cooking style all feed into the prompts.

## Features

- **Smart scanner** — camera or photo upload; identifies the item and reads the expiry date
- **Pantry** — sorted by expiry, with "Eat Me First" surfacing on the dashboard
- **Chef** — AI recipes from what you actually own, with generated food photography,
  Have/Missing ingredient status, a servings scaler, per-step cooking timers, and a
  matching YouTube cooking video pinned to each recipe
- **Meal planner** — a 7-day plan, with "How to make it" on every meal
- **Shopping list** — add missing ingredients from a recipe or a whole week's plan
- **Allergy filtering** — a ~40-allergen keyword engine that hides unsafe recipes
- **Favourites, Saved for Later and Recently Viewed** — stored in full, so a saved
  recipe reopens exactly as you saved it
- **Google sign-in**, guest mode, PIN lock and biometric (WebAuthn) unlock
- Dark mode, five accent themes, metric/imperial units, browser notifications

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript, Vite, React Router (HashRouter) |
| Styling | Tailwind (CDN) with a hand-written animation layer in `index.html` |
| Backend | Express 5 + TypeScript |
| Database | SQLite via Drizzle ORM (`local.db`) |
| AI | OpenAI `gpt-4o-mini` (text + vision) |
| Auth | Google Identity Services + SQLite-backed sessions |

App data (pantry, shopping list, meal plan, profile, favourites) lives in the browser's
`localStorage`. The database holds users and sessions only — so data is per-browser and
does not sync across devices.

## Running locally

**Prerequisites:** Node.js 20+

```bash
npm install
```

Create a `.env` in the project root:

```bash
OPENAI_API_KEY=sk-...            # required — https://platform.openai.com/api-keys
SESSION_SECRET=any-long-random-string
DATABASE_URL=./local.db

GOOGLE_CLIENT_ID=                # optional — see "Google sign-in" below
SKIP_AUTH=true                   # dev bypass: auto sign-in, skips the login screen
```

Run the API and the client in two terminals:

```bash
npm run dev          # Express API on http://localhost:5000
npm run dev:client   # Vite client on http://localhost:5173
```

Open **http://localhost:5173**. The client proxies `/api` to port 5000.

For a production-style run, `npm run build` then `npm start` serves everything from
port 5000 on its own.

> `.env` is read once at startup — restart the server after editing it.

## Google sign-in

Optional. With `GOOGLE_CLIENT_ID` unset the login screen says so and guest mode still works.

1. Create a project — https://console.cloud.google.com/projectcreate
2. Configure the consent screen (**External**) — https://console.cloud.google.com/auth/overview
3. **Audience → Test users** → add the Google account you'll sign in with
   *(required while the app is unpublished, or Google blocks your own login)*
4. **Clients → Create client** — https://console.cloud.google.com/apis/credentials
   - Application type: **Web application**
   - Authorized **JavaScript origins**: `http://localhost:5173` and `http://localhost:5000`
   - Authorized **redirect URIs**: leave empty — this flow doesn't redirect
5. Put the Client ID in `.env` as `GOOGLE_CLIENT_ID`, set `SKIP_AUTH=false`, restart

The browser receives a Google ID token and posts it to `/api/auth/google`, which verifies
it was issued for this client ID, is unexpired, and has a verified email — then creates a
session. No client secret is involved.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | API server (tsx, port 5000) |
| `npm run dev:client` | Vite dev server (port 5173) |
| `npm run build` | Build the client into `dist/` |
| `npm start` | Serve the built app from the API server |
| `npm run db:push` | Push the Drizzle schema to SQLite |
| `npm run db:studio` | Drizzle Studio |
| `npx tsc --noEmit` | Typecheck |

## Project layout

```
pages/        screens (Dashboard, Scanner, Pantry, Chef, Planner, Settings, …)
components/   reusable UI (NavBar, VideoPlayer, CookingTimer, LockScreen, …)
contexts/     React context providers (allergies, favourites, theme, walkthrough, …)
services/     browser-side services (storage, AI client, notifications, PIN, …)
hooks/        shared hooks
server/       Express API, auth, AI routes, SQLite session store
shared/       Drizzle schema shared by client and server
```

## Notes and limitations

- **Nutrition figures are model estimates**, not database lookups — treat them as
  approximate.
- **Notifications only fire while the app is open.** Real background delivery needs a
  service worker and a push server; neither exists here.
- **Nothing syncs.** Signing in identifies you, but pantry data stays in that browser.
- **Cooking videos** are resolved by reading YouTube's public search page (no API key).
  It's pinned to each recipe at generation time so it never changes underneath you, but
  it depends on markup Google could change.
