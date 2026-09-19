# Campus Incident Detective demo

The feature is implemented locally. Nothing has been deployed, pushed, or applied to a hosted database.

## Start

Run the app in local JSON mode (`USE_LOCAL_DB=1`) with your existing development credentials.
Use `npm run dev` for HTTP localhost. Do not run multiple local-mode servers against the same data file.
For a fresh Supabase installation, use `supabase/schema.sql`. For an existing installation, the required
migrations are `202609190001_atomic_writes.sql` followed by `202609190002_incident_detective.sql`.
The SQL files are prepared only; applying them is a separate deployment step.

## Three-minute walkthrough

1. Sign in at `/admin`. Open **QR locations** and register `Second floor reading room` under Library,
   with a pin inside your campus boundary. Open its report link or print the QR poster.
2. Through that exact QR location, submit `लाइट बंद है`, then `Projector not working`, then
   `Wi-Fi is down`. Submit each as a new issue if the duplicate prompt appears. Also submit
   `Chair has a broken leg` to demonstrate an unrelated problem.
3. Open **Incident Detective**. It should suggest **Possible power disruption**, show the three
   original reports, and keep the chair separate. The page refreshes every 15 seconds.
4. Read the original evidence. **Ask AI to review** adds a Gemini advisory if your existing
   `GEMINI_API_KEY` is configured. Without it, the app says AI is unavailable and the offline
   analysis still works. The pattern suggestion itself does not require an AI API call.
5. Select **Confirm investigation**. Open `/incidents` to show the public investigation and its
   individual ticket links. Confirmation means the reports deserve a shared investigation;
   it does not establish the root cause or close any tickets.
6. Resolve one ticket in its department desk. The investigation remains open while other tickets
   are open. Once every ticket is resolved, it waits for student confirmation. It becomes
   **Community-confirmed** only when every member's fix is verified by the existing student loop.
   Student rejection still reopens the individual ticket and returns the incident to investigating.

Optional second scenarios: two network-failure reports at a different registered room suggest a network
outage; `पानी टपक रहा है` and `Wet floor near the washroom` at another room suggest water leakage.
Use **Keep separate** to demonstrate that staff can reject a correlation.

## What to say accurately

“CampusPulse connects symptoms across reports, helps staff investigate a shared cause, and lets students
check each repair. The chair remains a separate job even when the lights, projector, and Wi-Fi fail together.”

The detector uses conservative, explainable rules: at least two open reports created in the past six
hours, the same registered place (or an identical specific manual place), within 60 metres and a pairwise
30-minute window. A department name alone is insufficient. Power suggestions require different equipment
signals. Hindi/Hinglish support is an explicit vocabulary for common facility problems, not complete translation.
Unknown or unsupported problems stay in the ordinary queue. Reports are anonymous and are not independent,
identity-verified witnesses. Suggestions have no fabricated confidence score or claimed impact savings.

Staff decisions persist. Confirmed members are not reassigned to new suggestions; rejected members are
not proposed again for the same incident kind. This MVP does not automatically expand an existing incident
or offer a decision reversal screen. Investigations have no bulk resolve action.

## Demo reliability

- QR links use the page's origin. A phone cannot reach a laptop's `localhost`; open the app through a
  reachable LAN hostname/address before generating phone-test posters. Check that access before presenting.
- Map tiles and live AI need internet; text reporting and incident patterns work without an AI key.
- Use a separate test dataset for practice. The implementation does not seed or alter your real reports.
- `npm test` covers matching, exclusions, staff decisions, individual verification, and local PostgreSQL.
  `npm run test:smoke` builds a disposable source copy and exercises the HTTP flow without live credentials.
