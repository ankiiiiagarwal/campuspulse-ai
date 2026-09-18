# CampusPulse AI

**Smart campus issue desk — hackathon MVP, ₹0 stack**

A lightweight, anonymous, location-tagged reporting system that turns scattered complaints into a structured, prioritized, trackable pipeline. Students get a frictionless way to report issues. Administrators get real-time visibility into what needs attention first.

No paid APIs required for the core demo.

---

## The problem

Every day, students encounter small but frustrating infrastructure issues on campus — a leaking tap in the hostel washroom, a flickering tube light in a lecture hall, a Wi‑Fi dead zone in the library, a broken chair, an unsafe dark pathway at night. Individually these seem minor, but collectively they erode the quality of campus life.

The core inefficiency is a **communication breakdown** between students and facilities management. Right now, these issues get reported (if at all) through scattered, informal channels — a WhatsApp message to a hostel warden, a verbal complaint to a staff member, a note left at the admin office.

That creates several problems:

**No accountability** — once reported, students have no way to track whether the issue is being worked on or has been forgotten.

**No prioritization** — maintenance staff have no visibility into which problems affect the most people or are most urgent, so a broken lock might get fixed before an electrical hazard.

**Duplicate effort and reporting fatigue** — multiple students notice the same issue but each has to report it separately (or more often, nobody bothers because “someone else probably already did”).

**No data trail** — there is no historical record of what breaks often, where, and how fast it gets fixed — so campus administration cannot identify patterns (e.g. a building whose Wi‑Fi router fails every semester) or measure their own responsiveness.

**Fear of friction discourages reporting** — students often do not report issues because it feels like a hassle, or they worry about being identified for “complaining.”

The result: small problems pile up, response times are inconsistent, and there is no shared visibility between the people experiencing the problems (students) and the people responsible for fixing them (campus facilities / admin).

---

## What we are solving

A lightweight, **anonymous**, **location-tagged** reporting system that turns scattered complaints into a structured, prioritized, trackable pipeline — giving students a frictionless way to report issues and giving administrators real-time visibility into what needs attention first.

---

## Solution

One free web app:

1. Student drops a pin, writes or speaks a complaint, optionally adds a photo. No name, email, or phone.
2. If a nearby open issue looks the same, the app asks **“This already exists — Me too?”** before creating a new ticket.
3. Or they tap an existing pin and hit **Me too** — no second essay.
4. AI returns category, severity, and department.
5. Similar reports merge into one cluster and raise impact.
6. A fixed formula ranks the queue (safety beats a broken lock).
7. The issue appears on a public campus map with live status and a **building health** number.
8. Admin assigns, can set **On it + ETA**, then resolves (optional after-photo). Response times are recorded.
9. Campus Health Score and repair-time stats update.

---

## Who uses it

| Role | Login | What they do |
|---|---|---|
| Student | None | Report anonymously, tap **Me too**, track status by ticket ID, see the public map |
| Admin | One seeded Supabase Auth account | Queue, assign, resolve, view health score, response trail, hotspots |

---

## Anonymous reporting (locked rules)

The report form collects **only**:

- description (text or voice)
- map pin / building
- optional photo

It must **not** collect name, email, phone, student ID, or hostel room number.

On-screen copy: **“No account. No name. Just the issue.”**

Photos can still identify a person, so this is **identity-light**, not perfect anonymity. Strip EXIF on upload. Never show reporter identity in the admin UI — there is none to show.

---

## Final MVP features

### Student

- Anonymous report: text + optional photo + map pin. No identity fields
- Optional voice input via browser **Web Speech API** (no Whisper server)
- Automatic / tapped location on the campus map
- **Me too** on an existing open pin — one tap, increments affected count, no new form
- **Nearby-issue prompt** before submit: “Looks like Library Wi‑Fi — Me too instead?”
- Ticket ID to check status later (`open` / `assigned` / `on it` / `resolved`)
- Public campus map of open / critical / resolved pins (shared visibility)
- **Building health** on each main building (same formula as campus score, scoped to that building)

### AI (one text model + embeddings)

- Category, severity, department from the report text
- Duplicate detection: embed the text, merge nearby similar reports
- Cluster “affected students” count goes up on merge **or** Me too

### Operations

- Priority score (fixed formula, not a black-box model)
- Admin queue sorted by priority
- Department suggestion + manual assign / **On it (ETA)** / resolve
- Campus Health Score (0–100) + per-building health
- Recurring hotspot flag: same building + category ≥ 3 times in 14 days
- **Admin response trail:** avg time to assign, avg time to resolve, per-issue timestamps, simple history list of resolved jobs
- Optional **resolve proof photo** (after shot) so students see it was actually fixed

### Worth adding if the core loop is done (still free)

Do these in this order. Stop when time runs out.

| Extra | Why judges care | Effort |
|---|---|---|
| **Building QR / deep link** | Poster in hostel washroom opens the form already pinned to that building | Small |
| **Hindi + English reports** | Groq already classifies either; one language toggle on the form | Small |
| **Public “Fixed this week” strip** | Accountability students can see without logging in | Small |
| Photo caption via Gemini Flash / Groq vision | One wow on the image; app must work if the call fails | Medium |

Do **not** add: student chat, comments, login for students, push/SMS, email alerts, IoT, payments, a second backend.

### Out of MVP (do not build during the hackathon)

- YOLOv8 / custom image detectors
- Whisper hosting
- Random Forest / trained predictive maintenance
- Separate FastAPI + Render service
- Heatmaps, IoT, energy, smart buildings
- Semester-scale trend charts (say it in the pitch; seed hotspots for the demo)

**Stretch only if the MVP loop is done:** one free vision API call to caption the photo (Gemini Flash or Groq vision). The app must still work if that call fails.

---

## How each problem is solved

| Problem | Product answer |
|---|---|
| No accountability | Ticket ID + public status on the map + On it/ETA + resolve proof + “Fixed this week” |
| No prioritization | Safety-weighted priority; electrical hazard outranks a broken lock |
| Duplicate effort / fatigue | Nearby-issue prompt + auto-merge + **Me too** on an existing pin |
| No data trail / responsiveness | Timestamps; admin avg assign/resolve time; hotspots; building health |
| Fear of friction / being identified | No login, no name/email/phone, voice + pin, one-tap Me too, optional QR |
| No shared visibility | Public student map + building health + admin queue on the same data |

---

## Categories and routing

| Category | Department | Default safety |
|---|---|---|
| Electrical / lights | Electrical | 4–5 |
| Water / leakage | Plumbing | 3–5 (5 if near wiring) |
| Wi‑Fi / network | IT | 2–3 |
| Furniture | Estate | 2 |
| Washroom | Housekeeping | 3–4 |
| Hostel | Hostel warden | 3 |
| Mess | Mess committee | 3 |
| Road / path / safety | Security + estate | 5 |
| Other | Estate | 2 |

Examples in seed data: leaking hostel tap, flickering lecture-hall light, library Wi‑Fi dead zone, broken chair, dark pathway at night.

---

## Scoring (locked)

### Priority (0–100)

```
priority = 100 * (
  0.40 * safety/5 +
  0.25 * affected/5 +
  0.20 * age/5 +
  0.15 * location/5
)
```

| Signal | Scale | How it is set |
|---|---|---|
| Safety | 1–5 | AI + category defaults (dark path, electrical, water + wiring = 5) |
| Affected | 1–5 | `min(5, 1 + extra_reports_in_cluster + me_too_count)` |
| Age | 1–5 | Grows over 72 hours, then caps |
| Location | 1–5 | Hostel / mess / main road / lab / library = 5; garden / parking = 2 |

### Campus Health Score (0–100)

```
health = clamp(0, 100,
  100
  - 6 * critical_open
  - 3 * high_open
  - 1 * medium_open
  - 4 * overdue
  - 5 * recurring_hotspots
)
```

### Admin response trail

```
time_to_assign   = assigned_at  - created_at
time_to_resolve  = resolved_at  - created_at
avg_assign_hrs   = mean(time_to_assign)  for assigned or resolved issues
avg_resolve_hrs  = mean(time_to_resolve) for resolved issues
overdue          = open or assigned longer than 72 hours
```

Show on the admin home: campus health, **per-building health**, open counts, **avg assign time**, **avg resolve time**, recent resolved list.

**Building health** uses the same formula, counted only on issues in that building.

Seed **20–30 demo issues** (mix of open / assigned / on it / resolved, including the everyday examples above) so the map, score, and trail look alive before the live report.

---

## Data model

### `issues`

- `id`, `ticket_code`
- `description`
- `category`, `severity`, `department`, `status`
- `safety`, `location_weight`, `priority`
- `lat`, `lng`, `building`
- `photo_url` (Supabase Storage, optional before shot)
- `resolve_photo_url` (optional after shot)
- `eta_at` (optional, when admin marks On it)
- `embedding` (MiniLM vector, stored as JSON or `pgvector` if enabled)
- `cluster_id`
- `created_at`, `assigned_at`, `resolved_at`
- no reporter name, email, or phone columns

### `issue_clusters`

- `id`, `title`, `category`, `building`
- `report_count`, `me_too_count`, `priority`
- `is_recurring`

### `issue_confirmations` (Me too)

- `id`, `cluster_id`
- `created_at`
- optional `client_hash` (anonymous browser fingerprint or localStorage id) so one device cannot spam Me too

### `admins`

- Supabase Auth users only (demo: `admin@campus.local`)

Statuses: `open` → `assigned` → `on_it` → `resolved`.

**Building QR / deep link (stretch):** `/report?building=hostel-b-washroom` pre-fills the pin. Print one QR for the demo poster.

---

## Architecture

```
Student browser (Next.js)
    → Vercel API routes
        → Groq (or Gemini Flash) for classify
        → MiniLM embed for duplicates
        → Supabase Postgres + Storage
    → Leaflet + OpenStreetMap (client map)
    → Me too + nearby-issue prompt (no LLM needed)

Admin browser
    → same app, Supabase Auth
    → queue + map + health score + response trail
```

No FastAPI. No Render. No GPU.

---

## Final technology stack (all free)

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js + TypeScript + Tailwind CSS** | One codebase, free Vercel host |
| Hosting | **Vercel** (Hobby) | Free for the Next.js app + API routes |
| Database | **Supabase Postgres** (Free) | Issues, clusters, Me too, tickets |
| Files | **Supabase Storage** (Free) | Report photos |
| Admin login | **Supabase Auth** (Free) | One demo admin |
| Map | **Leaflet + OpenStreetMap** | Free, no Mapbox/Google key |
| Text AI | **Groq free Llama** (primary) | Category, severity, department, safety hint |
| Text AI fallback | Keyword rules + category table | Demo still works if Groq is down |
| Embeddings | **`all-MiniLM-L6-v2`** via Transformers.js in the API/browser, or a tiny embed call | Duplicate merge |
| Voice | **Web Speech API** | Free, in-browser, no Whisper |
| Hotspots | **Count rule**, not sklearn | Honest pattern flag without fake training data |
| Image (stretch) | **Gemini Flash free** or skip | Caption only; not required |

**Cost: ₹0** on free tiers. Stay under Supabase/Vercel/Groq quotas. Do not host YOLOv8 or Whisper.

If Groq is unavailable, swap the classify call for **Gemini Flash** (free tier) or the keyword fallback. Do not add a second backend.

---

## AI behavior (honest)

**Classify** (one LLM call, JSON out):

- `category`, `severity` (`low` / `medium` / `high` / `critical`)
- `department`, `safety` (1–5)
- `building` if mentioned

**Nearby-issue prompt (before submit):** same match as duplicate, but shown as a card: existing title, distance, **Me too** / **Report anyway**.

**Duplicate:** cosine similarity of MiniLM embeddings **and** pins within ~40 m. Above threshold → merge into the same cluster, increment `report_count`, recompute priority.

**Me too:** student taps an existing cluster (or accepts the prompt). Increment `me_too_count`, recompute priority. No new issue row unless they choose “Report something else.”

**Hotspot:** same `building` + `category` ≥ 3 reports in 14 days → `is_recurring`. Pitch this as the start of a data trail (what breaks often, where).

Photos are stored for the admin. Image models are stretch, not the demo dependency.

---

## Hackathon demo (90 seconds)

1. Map already shows seeded issues (leak, light, library Wi‑Fi, chair, dark path). Campus health ~**72**, library health lower. Admin home already shows avg assign/resolve time.
2. Student opens the library Wi‑Fi pin and taps **Me too**. Affected count and priority jump. No form.
3. Another student starts a hostel B Wi‑Fi report. Prompt: **“Looks like Hostel B Wi‑Fi — Me too?”** They still submit a new line if you want the merge beat, or accept Me too.
4. AI returns `Wi‑Fi / network`, IT, severity high, in ~2 seconds.
5. Admin marks **On it** (ETA 2 hours), then resolved + optional after-photo. Response trail updates. Health score ticks up.
6. If you printed a QR: scan it last — form opens already pinned to hostel washroom.

Backup if the LLM fails: keyword fallback still creates the ticket and shows it on the map. Me too never depends on the LLM.

---

## Innovation (what to say)

This is not a Google Form.

- Shared campus view, not a dump of WhatsApp complaints
- Duplicate clustering, nearby-issue prompt, **and** one-tap Me too so one leak is one job
- Transparent priority (safety first — the electrical hazard beats the lock)
- Response trail so admin can measure how fast they actually fix things
- Building health + campus health on the same map
- Recurring hotspots from real repeats, not a pretend trained model
- Anonymous on purpose: no account, no name, just the issue
- Optional hostel QR: report in one scan, no hunting on the map

---

## Future (one slide, after the demo)

- Longer history (“this router fails every semester”)
- IoT sensors
- University-wide campuses
- Optional trained vision later, when labeled photos exist

---

## Build order

1. Supabase tables + seeded issues + Leaflet map
2. Anonymous report form (no identity fields) → insert row → pin appears
3. Ticket status + public map statuses
4. Classify API + fallback
5. Embeddings + merge
6. **Me too** + nearby-issue prompt
7. Priority + admin queue + campus / building health
8. Admin response trail (avg assign/resolve + history)
9. On it + ETA + optional resolve photo
10. Web Speech on the form
11. Building QR deep link, Hindi/English toggle, “Fixed this week” strip
12. Stretch vision only if time remains

---

## Stop adding features

The product is complete enough to win on execution. Do not add chat, comments, student login, notifications, IoT, or another model.

Leftover time goes to **ship quality**, not scope:

| Do this | Why |
|---|---|
| Real campus building names and 25 seeded issues | Empty map looks like a toy |
| Phone-sized student report (one screen, big pin, big submit) | Judges will tap it on a phone |
| Keyword fallback if Groq/Gemini is down | Demo cannot die on Wi‑Fi |
| Pin colors: critical red, open amber, on-it blue, resolved green | Readable from 2 meters |
| One printed QR + one admin login written on paper | Live demo backup |
| 90-second script rehearsed twice | Talking is what they score |

Abuse / spam: one Me too per browser (`client_hash`) is enough. Full moderation is not a hackathon feature.
