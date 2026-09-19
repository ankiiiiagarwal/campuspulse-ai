# CampusPulse AI

Anonymous campus issue desk. Students drop a real GPS/map pin. AI classifies and merges duplicates. Admins work a safety-first queue. Cost to run the demo on free tiers: Rs 0.

Locked product spec: [CampusPulse_AI_Final_Project.md](CampusPulse_AI_Final_Project.md)

## Stack

Next.js + TypeScript + Tailwind · Supabase Postgres/Auth/Storage · Gemini 2.5 Flash (Groq fallback) · Leaflet + OpenStreetMap · Web Speech API

No FastAPI, no YOLO, no Whisper server, no student login. No paid map APIs.

Students can open **Ask how to fix** on any public page. The assistant gives safe first steps (Wi-Fi, lights, leaks, washrooms, furniture) and tells them when to file a report. It uses Gemini 2.5 Flash (then 2.5 Flash-Lite) when `GEMINI_API_KEY` is set, Groq if Gemini does not respond, otherwise the same keyword guides. No name is asked. Staff desks (`/admin`, `/dept`) do not show the chat. Chrome/Edge can dictate on Report and in the chat. Chat answers are read aloud only if the student taps **Read aloud**.

## Run locally

```bash
npm install
copy .env.local.example .env.local
npm run dev
```

Open http://localhost:3000

The live app starts **empty**. Seeded demo tickets are not auto-loaded into `.data/store.json`.

For local development without Supabase or Groq keys, the app still runs: issues and the campus boundary are stored in `.data/store.json`, and classify uses keyword rules.

### Campus area (optional)

1. Sign in at `/admin` as super-admin (`admin@campus.local` / `campuspulse` by default).
2. Open **Set campus area** (`/admin/campus`). Department accounts cannot change the fence.
3. Draw a rectangle (two opposite corners) or a polygon (three or more vertices) on the real OpenStreetMap.
4. Save. Students then use browser GPS (or tap/drag the pin) **inside** that shape.

### Staff accounts

Configure `ADMIN_PASSWORD`, `DEPT_PASSWORD`, and a random `ADMIN_SESSION_SECRET` before deployment. Sample passwords are for local development only. Vercel requires Supabase and never stores complaints on its temporary filesystem.

| Role | Email | After login |
|---|---|---|
| Super-admin | `admin@campus.local` | `/admin` — all issues, health, campus fence |
| IT | `it@campus.local` | `/dept` — Wi-Fi / network |
| Hostel | `hostel@campus.local` | `/dept` — Hostel |
| Mess | `mess@campus.local` | `/dept` — Mess |
| Campus | `campus@campus.local` | `/dept` — campus-wide facilities |
| Library | `library@campus.local` | `/dept` — Library |

Department users who open `/admin` are sent to `/dept`. Super-admin who opens `/dept` is sent to `/admin`. The API rejects a department session reading or patching another department's issue (403). Students stay anonymous and do not log in.

The same five desks appear everywhere: student report place, admin assign, admin queue filter, and department login. Super-admin can open **Departments** (`/admin/departments`) to set a hashed password per desk. That desk must sign in again. **Activity log** (`/admin/logs`) is append-only and hash-chained — there is no edit or delete API.

If Supabase Auth is configured, create the same emails there. Local cookie login still works when Auth is unset or the password matches `.env.local`.

Until a boundary is saved, anyone can report from anywhere. Once saved, the server and form reject new report pins outside it. Removing the area opens reporting worldwide again.

### Location rules

- The public map is real OSM. Pan and zoom anywhere.
- Center: user GPS if allowed, otherwise India, then fit the campus boundary once it exists.
- New issues whose lat/lng sit outside the boundary are rejected by the API and the UI.
- Existing issues stay visible if an admin later redraws the fence.

### Required env (for live backends)

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Live database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Admin Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server writes |
| `GEMINI_API_KEY` | LLM classify + chat first (`gemini-2.5-flash`, then `gemini-2.5-flash-lite`) |
| `GROQ_API_KEY` | LLM fallback if Gemini does not respond |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Super-admin fallback (`admin@campus.local` / `campuspulse`) |
| `DEPT_*_EMAIL` / `DEPT_PASSWORD` | Department desks (`it@campus.local`, `hostel@campus.local`, `mess@campus.local`, `campus@campus.local`, `library@campus.local`) |
| `ADMIN_SESSION_SECRET` | Signed staff cookie |
| `LOAD_SEED=1` | Development only: optional sample data; ignored in production |

Never commit `.env.local`.

### Supabase setup

1. Create a free project.
2. Run `supabase/schema.sql` (includes `campus_boundary`).
3. Do **not** run `supabase/seed.sql` for a live empty campus. That file is optional demo data only.
4. Create Auth users for `admin@campus.local` and each department email if you want Supabase login.
5. Storage buckets `report-photos` and `resolve-photos` are created by the schema.

## Scripts

- `npm run dev` — local server
- `npm run demo` — local server with fictional reports, QR places, and demo accounts; uses `.data-demo`, preserving `.data` and `.env.local`
- `npm run build` / `npm start` — production
- `npm test` — unit, security, workflow, pagination, and local PostgreSQL tests
- `npm run typecheck` — TypeScript validation
- `npm run test:smoke` — build a disposable source copy and run HTTP checks (no live database or AI calls)

## Local repair and deployment notes

The security/reliability repair is local code only. No hosted database is migrated by these scripts.
For older projects missing base tables, run the full idempotent `supabase/schema.sql` in a transaction. For an **existing Supabase project** with the base tables, apply `supabase/migrations/202609190001_atomic_writes.sql`
then `supabase/migrations/202609190002_incident_detective.sql` before deploying this version.
Fresh installations can run the complete `supabase/schema.sql`.
The migration adds atomic ticket writes, a shared rate limiter, and atomic department password
rotation, and removes direct browser uploads. Missing migration functions fail closed.

Staff authentication accepts only the configured admin and department addresses. A department
password set in the admin desk supersedes both its environment password and its Supabase password;
existing sessions are invalidated. Password/epoch reads do not fall back to stale local values when
Supabase is unavailable.

Production on **any host** requires a random `ADMIN_SESSION_SECRET` of at least 24 characters and
a non-default `ADMIN_PASSWORD`. Staff and visitor cookies are Secure in production; serve production
over HTTPS. Use `npm run dev` for ordinary HTTP localhost development. Keep `.env.local` private.

With Supabase configured, rate-limit counters are shared across server instances. On a self-hosted
reverse proxy, set `TRUST_PROXY_HEADERS=1` only when the proxy replaces incoming `X-Forwarded-For`
and `X-Real-IP` headers. Otherwise requests share a conservative local bucket. Vercel uses its proxy
headers. The JSON store and in-memory limiter are for one local server process; use Supabase for
multiple processes/replicas. Local writes are serialized and files replaced atomically. Corrupt or
unwritable data is reported instead of silently replacing it with an empty store.

Photos must go through `/api/upload`. The server decodes JPEG/PNG/WebP, strips metadata, bounds image
dimensions and size, and stores a normalized JPEG. Reports and fix disputes accept only existing
uploads in this app's storage. Arbitrary URLs, data URLs, missing files, and fake photos are rejected.
Vercel photo uploads require Supabase storage. This verifies an image exists, not whether its contents
prove a repair; anonymous browser checks remain a community signal, not identity verification.

The test suite runs SQL against embedded PostgreSQL (PGlite) with local stand-ins for Supabase's
storage/auth schemas. It checks application workflows and transaction rollback/conflicts without
contacting a hosted Supabase project. `test:smoke` builds and starts a disposable copy of the source,
uses isolated files and credentials, and prints its temporary directory for inspection.

## Incident Detective MVP

Admin → **Incident Detective** suggests shared power, network, or water investigations from original
reports at the same place and time. Admins confirm an investigation or keep reports separate. `/incidents`
shows confirmed investigations with each original ticket and its student verification state. Confirmation
never changes ticket status; every repair must still pass its own verification loop.

Admin → **QR locations** creates exact room/floor posters, also available at `/posters`. The report form
prefills the registered place and pin, and the server enforces their canonical values. Editing the place
or pin switches to a manual report. Hindi/Hinglish keyword normalization supports common facility reports
and bilingual duplicate matching. Incident analysis works offline; the optional **Ask AI to review** button
uses Gemini with a Groq fallback and clearly reports unavailable or invalid model responses.

See [HACKATHON_DEMO.md](HACKATHON_DEMO.md) for the walkthrough, matching boundaries, and demo setup.

## Interface and validation

The interface uses a green-and-white, map-first layout with short transitions, reduced-motion support,
mobile staff cards, a simpler report form, and a compact bilingual help panel. Reports can use an exact
registered campus spot or an adjustable map pin. CSV and PDF queue exports support safer spreadsheet
cells and visually correct Hindi text.

See [TEST_REPORT.md](TEST_REPORT.md) for the automated results, browser workflows, responsive checks,
and remaining real-device/provider validation. All recorded checks used local test data; hosted services
were not changed.

## Try the populated demo

Stop an existing server on port 3000, then run `npm run demo` and open `http://localhost:3000/demo`.
The page lists accounts and a complete report-to-repair walkthrough. The demo starts with 33 sample
reports, three QR locations, power/water incident suggestions, and a confirmed network investigation.
Admin is `admin@campus.local`; department emails are `it@campus.local`, `library@campus.local`,
`campus@campus.local`, `hostel@campus.local`, and `mess@campus.local`. All use `campuspulse-demo`.
Those credentials belong only to the development demo process. Demo mode cannot activate in production.

Changes persist in `.data-demo`; your real `.data` store and environment file are unchanged. To start a
fresh demo later, stop its server and **rename** `.data-demo` to a backup directory before restarting.
The normal dev server, demo server, and production build use separate build directories (`.next-dev`,
`.next-demo`, and `.next`) to prevent missing JavaScript chunks caused by competing build processes.
Do not run two demo servers against the same directory.

Voice typing prefers Groq transcription when `GROQ_API_KEY` is configured, and otherwise uses available
browser speech recognition. Tap the microphone, allow access, speak, then tap stop to transcribe.
Recording stops automatically after one minute. Chrome/Edge is recommended when an embedded browser
does not allow microphone access. No mock transcript is substituted for actual audio.


## Production

- Live site: https://campuspulse-ai-eight.vercel.app
- Repository: https://github.com/ankiiiiagarwal/campuspulse-ai
- Real database and photo storage: Supabase (server service-role access only).
- No mock complaints or invented campus coordinates in production. Optional fixtures run only in explicit local development mode.
- Reporting is open worldwide until an admin saves an area at `/admin/campus`. Removing it reopens worldwide reporting. Pin validation runs on the server; this checks the submitted location, not physical presence.
- Set Groq credentials for speech transcription and AI fallback. Browser GPS and microphone require the visitor's permission and HTTPS.
- Keep `.env.local`, `.data`, `.vercel`, and Supabase CLI caches private. They are excluded from Git and deployment uploads.
