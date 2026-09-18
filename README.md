# CampusPulse AI

Anonymous campus issue desk. Students drop a pin. AI classifies and merges duplicates. Admins work a safety-first queue. Cost to run the demo on free tiers: Rs 0.

Locked product spec: [CampusPulse_AI_Final_Project.md](CampusPulse_AI_Final_Project.md)

## Stack

Next.js + TypeScript + Tailwind · Supabase Postgres/Auth/Storage · Groq Llama (keyword fallback) · Leaflet + OpenStreetMap · Web Speech API

No FastAPI, no YOLO, no Whisper server, no student login.

## Run locally

```bash
npm install
copy .env.local.example .env.local
npm run dev
```

Open http://localhost:3000

Without Supabase or Groq keys the app still runs: issues are stored in `.data/store.json` (seeded with 25 tickets so campus health sits at **72**), and classify uses keyword rules.

### Required env (for live backends)

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Live database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Admin Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server writes |
| `GROQ_API_KEY` | LLM classify (optional) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Local admin fallback (`admin@campus.local` / `campuspulse`) |
| `ADMIN_SESSION_SECRET` | Signed admin cookie |

Never commit `.env.local`.

### Supabase setup

1. Create a free project.
2. Run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Create Auth user `admin@campus.local`.
4. Storage buckets `report-photos` and `resolve-photos` are created by the schema.

## Demo loop (90 seconds)

1. Map already shows leak, lights, library Wi-Fi, chair, dark path. Campus health ~72. Library is the weakest building.
2. Open the Library Wi-Fi pin → **Me too**.
3. `/report` a Hostel B Wi-Fi issue → nearby prompt, or submit a new line.
4. Classify returns Wi-Fi / IT (Groq or keywords).
5. Admin → **On it** (ETA 2h) → resolve (+ optional after photo). Health ticks up when a high open issue closes.

Pin colors: critical red · open amber · on it blue · resolved green.

## Scripts

- `npm run dev` — local server
- `npm run build` / `npm start` — production
