# Local validation — 19 September 2026

The refreshed CampusPulse build passed the checks below. This is evidence for the tested workflows, not a guarantee that every device, network condition, or external provider will behave perfectly.

## Follow-up: the actual localhost server

The initial isolated tests did not catch a failure on the pre-existing server shown to the user.
That server returned HTML successfully but returned 404 for its JavaScript chunks; the map, buttons,
and dashboard therefore never initialized. Multiple Next servers shared `.next`. Development,
demo, and production now have separate build directories. The replacement demo runs on the actual
`localhost:3000` URL with its own persistent `.data-demo` store and a visible sample-data banner.

The populated demo starts with 33 fictional reports, three QR locations, two incident suggestions,
and one confirmed investigation. Its browser check verified loaded map tiles/markers, map zoom and
pin selection, report submission, staff login/assignment, worker/ETA entry, resolution, logout, and
student confirmation. Chatbot replies and a real Groq incident advisory also succeeded. A Windows file-sharing error during
simultaneous initial dashboard reads was reproduced and fixed with bounded atomic-rename retries.

Real Groq transcription was also exercised through `/api/transcribe` using a locally synthesized
English WAV clip. It returned the spoken sentence correctly. This verifies the live transcription
service, not the user's microphone hardware. Voice input now prefers configured transcription over
an exposed but nonfunctional embedded-browser Web Speech service. The updated unit suite passed
95 tests across 18 files, including demo isolation, provider fallback, and voice selection/cancellation regressions.
The smoke suite now also checks that the home page's JavaScript files actually load.
The final updated production build and 77 HTTP checks passed in `D:\.campuspulse-http-xx566v`.
After that build, all eight JavaScript assets served by the running demo returned 200 with the
correct content type, and its API returned 34 reports (33 initial samples plus the browser test report).

## Results

| Check | Result |
| --- | --- |
| Vitest | 95 tests passed in 18 files |
| Production build | Passed in a disposable source copy |
| Production HTTP smoke suite | 77 checks passed |
| TypeScript | Passed |
| Git whitespace check | Passed |
| Responsive browser review | 320 px, 390 px, tablet 768 px, and desktop layouts inspected |
| Exports | Downloaded CSV parsed successfully; downloaded PDF rendered and visually inspected, including Hindi |

Run `npm test`, `npm run typecheck`, and `npm run test:smoke` to repeat the automated checks. The smoke script builds an isolated source copy with temporary credentials and test data; it does not use the real local store, environment file, or hosted database. The final smoke run's evidence is in `D:\.campuspulse-http-GgdH6Y`.

## Coverage

- **Students:** submit and track a report, campus boundary validation, exact QR location enforcement, manual map placement, photo upload and production retrieval, bilingual classification and duplicate matching, support an existing report, duplicate-vote rejection, repair confirmation, and disputes/reopening.
- **Staff:** admin and department login, role and department restrictions, assignment, named worker and ETA, resolution with repair evidence, audit log, department configuration, password rotation, session revocation, and login throttling.
- **Incident Detective:** power/network/water candidates, exclusion of unrelated reports, staff confirmation or separation, persistent decisions, public privacy, and completion only after every member repair is independently verified. Optional AI review validation and unavailable-provider behavior were tested.
- **Help:** offline chatbot answers, malformed request handling, service failures, language selection, starter prompts, report links, and keyboard dismissal. Speech/transcription unavailable-provider responses were tested.
- **Persistence:** local store workflows and embedded PostgreSQL transaction, rollback, conflict, pagination, and migration checks. These are local SQL tests, not hosted Supabase tests.
- **Pages:** production HTTP rendering for home, reporting, ticket, submission, incidents, scoreboard, posters, both staff desks, and admin configuration/review pages.

The real browser walkthrough submitted a report, assigned it to Library, started work with a worker and ETA, resolved it, signed staff out, and recorded a student confirmation. It also exercised report location controls, chatbot starter replies, language switching, staff search, and CSV/PDF download. All public and admin page layouts in the narrow-screen audit fit a 320 px viewport without horizontal page overflow; representative report/chat screens were also inspected at 390 px, with tablet and desktop checks.

## Improvements made during testing

- Fixed newly uploaded local photos returning 404 in production.
- Fixed the mobile map collapsing in height and prevented wheel scrolling from unexpectedly zooming the map.
- Fixed narrow header overflow and added usable mobile staff cards and scrollable action dialogs.
- Fixed Hindi PDF rendering and table widths; hardened CSV cells against spreadsheet formulas.
- Removed an incorrect timeline date that treated the future ETA as the work-start timestamp. Historical tickets now explicitly state when a start time was not recorded.
- Added bounded service requests, friendly failure states, chat draft recovery, and Hindi-aware transcription requests.

## Motion and accessibility

The green-and-white theme uses short page, chat, message, and hover transitions. Entry motion uses transform and opacity. Reduced-motion CSS disables transitions and animation, and map/chat scrolling respects the browser preference. Focus indicators, a skip link, labelled controls, larger mobile targets, safe-area spacing, and 16 px mobile form text are included. Reduced-motion handling was reviewed in code; an operating-system preference change and a formal screen-reader audit were not performed.

## Remaining environment checks

- Follow-up live checks confirmed Groq transcription, chatbot responses, and Groq incident review. Gemini was unavailable with the current configuration; incident review now falls back to Groq. Cloud speech output and physical microphone capture still need a device check. Offline behavior and mocked response/error handling passed.
- Hosted Supabase Auth, Storage, and realtime/network behavior still need a staging check. The two SQL migrations are prepared locally and were not applied to a hosted database.
- Physical GPS, microphone input, audible speech, and QR scanning with a phone camera need a device check. Responsive browser viewports are not equivalent to testing Safari on an actual iPhone.
- Map tiles and browser speech availability depend on connectivity and browser support.
- Hindi/non-Latin text in PDF table cells is rendered as shaped images for correct appearance, so those cells are not selectable text.

All implementation changes remain local. No commit, push, deployment, or hosted database migration was performed. Existing project data and environment credentials were preserved.


## Production preparation — 19 September 2026

- 98 tests passed across 19 files; two additional geofence/privacy regressions passed in the focused 14-test run.
- Isolated production build and all 79 HTTP workflow checks passed (stage: `.campuspulse-http-HsJDah`).
- Hosted Supabase schema upgraded transactionally; service-role reads verified and raw anonymous table reads denied.
- Previous application data backed up locally, then cleared at the owner's request. No boundary configured; reporting is unrestricted until an admin saves an area.
- Vercel uses real Supabase and configured AI credentials. Local/demo storage is blocked on Vercel; optional seeds cannot load in production.
- Physical microphone and GPS permission behavior depends on the visitor's browser/device; automated tests do not assert physical-device access.


## Hosted production verification

- Vercel production build completed and the public HTTPS alias was checked.
- 27 live checks passed: empty database, worldwide reporting, page and JavaScript delivery, disabled demo page, admin and department login, Supabase photo upload/download, real Postgres persistence, optional area save/enforcement/removal, assignment, seven-day ETA, resolution, ticket tracking, chatbot and transcription configuration.
- Live Groq transcription also returned the correct sentence from a synthesized WAV file. This is a service check, not a hardware microphone test.
- Postgres normalizes timestamps to `+00:00`; verification compares instants instead of requiring the same ISO string suffix as JavaScript's `Z`.
- Next.js streamed not-found pages can return HTTP 200: the production demo test verifies not-found/noindex content and absence of demo account content.
- All temporary reports, clusters, uploads and test audit entries were removed. Final complaint, incident, location and boundary counts were zero.
- GitHub push confirmed by matching remote branch SHA. Deployment was performed using the authenticated Vercel CLI. Automatic GitHub-to-Vercel linking was not established: Vercel rejected repository access; future updates can still be deployed with the CLI.
- Live credentials are saved locally in ignored `.data/live-access.json`; no credentials were committed.
