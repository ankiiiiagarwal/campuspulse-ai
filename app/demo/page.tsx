import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/local-mode";
export const dynamic = "force-dynamic";

export default function DemoPage() {
  if (!isDemoMode()) notFound();
  return <div className="mx-auto max-w-3xl space-y-6">
    <p className="cp-kicker">Local demo · fictional campus reports</p>
    <h1 className="font-serif text-4xl text-navy">Try the whole repair journey.</h1>
    <p>Your demo changes persist separately from real project data. The map starts at a sample campus with open jobs, work in progress, and repairs awaiting student checks.</p>
    <section className="cp-card p-6 space-y-3">
      <h2 className="font-serif text-2xl">Demo staff accounts</h2>
      <p>Password for every demo account: <code className="font-bold">campuspulse-demo</code></p>
      <p>Admin: <code>admin@campus.local</code></p>
      <p>Departments: <code>it@campus.local</code>, <code>campus@campus.local</code>, <code>library@campus.local</code>, <code>hostel@campus.local</code>, <code>mess@campus.local</code>.</p>
      <div className="flex gap-3"><Link className="underline" href="/admin">Open admin desk →</Link><Link className="underline" href="/dept">Open department desk →</Link></div>
    </section>
    <ol className="list-decimal space-y-4 pl-6">
      <li><Link href="/report?location=demo-library" className="underline">Report a problem</Link>. Select a campus spot, adjust its map pin, type or dictate a description, and submit. Save the ticket number.</li>
      <li>Sign in as admin. Search for your report and assign it to Library.</li>
      <li>Sign in at the department desk as Library. Start work, set a worker and ETA, then resolve the report.</li>
      <li>Sign out and open the ticket as a student. Confirm the repair or report it still broken. Two independent student browsers are needed for full confirmation.</li>
      <li><Link className="underline" href="/admin/incidents">Open Incident Detective</Link> as admin: review the sample power and water reports. The lab network investigation is already confirmed on the public incidents page.</li>
      <li><Link className="underline" href="/posters">Open QR posters</Link>, try the scoreboard, and download the staff queue as PDF or CSV.</li>
    </ol>
    <section className="cp-card p-6 space-y-2"><h2 className="font-serif text-2xl">Voice and maps</h2>
      <p>For microphone input, allow microphone access when you tap the mic. Chrome or Edge is recommended if an embedded browser blocks recording. Configured cloud transcription handles English and Hindi; the app checks availability before recording.</p>
      <p>Map pins and campus locations are sample data; base-map tiles require internet. The map can be panned, zoomed, and used to place a report.</p>
    </section>
  </div>;
}
