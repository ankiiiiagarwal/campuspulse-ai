"use client";

import { CampusMap } from "@/components/CampusMap";
import { BUILDINGS, buildingById, CAMPUS } from "@/lib/campus";
import { getClientHash, stripExif } from "@/lib/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

interface NearbyMatch {
  cluster_id: string;
  issue_id: string;
  ticket_code: string;
  title: string;
  building: string;
  category: string;
  status: string;
  meters: number;
  report_count: number;
  me_too_count: number;
}

function ReportForm() {
  const router = useRouter();
  const params = useSearchParams();
  const preset = buildingById(params.get("building") || "");
  const [description, setDescription] = useState("");
  const [building, setBuilding] = useState(preset?.name || "");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    preset ? { lat: preset.lat, lng: preset.lng } : { lat: CAMPUS.center.lat, lng: CAMPUS.center.lng },
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nearby, setNearby] = useState<NearbyMatch[] | null>(null);
  const [classified, setClassified] = useState<{ category: string; department: string; severity: string; source: string } | null>(
    null,
  );
  const speechOk = useMemo(() => typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window), []);

  function pick(lat: number, lng: number) {
    setPin({ lat, lng });
    setNearby(null);
  }

  function startVoice() {
    const SR = (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition
      || (window as Window & { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const text = ev.results[0]?.[0]?.transcript || "";
      setDescription((d) => (d ? `${d.trim()} ${text}` : text));
    };
    rec.start();
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await stripExif(file));
    } catch {
      setError("Could not read that photo.");
    }
  }

  async function lookupNearby(): Promise<NearbyMatch[]> {
    if (!pin || description.trim().length < 4) return [];
    const url = `/api/nearby?lat=${pin.lat}&lng=${pin.lng}&text=${encodeURIComponent(description)}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return data.matches || [];
  }

  async function submit(forceNew: boolean) {
    setError("");
    setBusy(true);
    try {
      if (!pin) throw new Error("Drop a pin first.");
      let photo_url: string | null = null;
      if (photo) {
        const up = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: photo, kind: "report" }),
        });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData.error || "Photo upload failed");
        photo_url = upData.url;
      }
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          lat: pin.lat,
          lng: pin.lng,
          building: building || undefined,
          photo_url,
          forceNew,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not file the report");
      if (data.classified) setClassified(data.classified);
      router.push(`/ticket/${data.issue.ticket_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (description.trim().length < 8) {
      setError("Write a sentence about what is broken.");
      return;
    }
    setBusy(true);
    try {
      const matches = await lookupNearby();
      if (matches.length && nearby === null) {
        setNearby(matches);
        setBusy(false);
        return;
      }
      await submit(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      setBusy(false);
    }
  }

  async function acceptMeToo(match: NearbyMatch) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/issues/${match.issue_id}/me-too`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_hash: getClientHash(), cluster_id: match.cluster_id }),
      });
      const data = await res.json();
      if (!res.ok && !data.already) throw new Error(data.error || "Me too failed");
      router.push(`/ticket/${match.ticket_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Me too failed");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 md:max-w-none">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Anonymous report</p>
        <h1 className="font-serif text-4xl font-semibold text-navy">No account. No name. Just the issue.</h1>
        <p className="mt-2 text-ink/70">Text or speak. Drop a pin. Optional photo. We never ask who you are.</p>
      </section>

      <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">What is broken?</span>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setNearby(null);
                setClassified(null);
              }}
              rows={5}
              required
              placeholder="Hostel B Wi-Fi is dead on the second floor…"
              className="mt-1 w-full rounded-2xl border border-rule bg-white/80 px-3 py-3 text-base outline-none ring-navy/20 focus:ring-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {speechOk ? (
              <button
                type="button"
                onClick={startVoice}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${listening ? "bg-critical text-white" : "bg-navy text-paper"}`}
              >
                {listening ? "Listening…" : "Speak"}
              </button>
            ) : (
              <p className="text-xs text-ink/50">Voice works in Chrome / Edge on this device.</p>
            )}
            <label className="cursor-pointer rounded-full border border-rule bg-white px-4 py-2 text-sm font-semibold">
              {photo ? "Photo attached" : "Add photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
            </label>
          </div>
          {photo ? <img src={photo} alt="Report preview" className="max-h-40 rounded-xl border border-rule object-cover" /> : null}

          <label className="block">
            <span className="text-sm font-semibold">Building</span>
            <select
              value={building}
              onChange={(e) => {
                const name = e.target.value;
                setBuilding(name);
                const b = BUILDINGS.find((x) => x.name === name);
                if (b) setPin({ lat: b.lat, lng: b.lng });
              }}
              className="mt-1 w-full rounded-2xl border border-rule bg-white/80 px-3 py-2 outline-none"
            >
              <option value="">Nearest to pin</option>
              {BUILDINGS.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          {nearby && nearby.length > 0 ? (
            <div className="rounded-2xl border-2 border-amberpin bg-white p-4 shadow-card">
              <p className="font-serif text-xl text-navy">Looks like this already exists</p>
              {nearby.map((m) => (
                <div key={m.cluster_id} className="mt-3 rounded-xl bg-paper/70 p-3">
                  <p className="font-semibold">{m.title}</p>
                  <p className="text-sm text-ink/60">
                    {m.building} · {m.meters} m away · {m.report_count + m.me_too_count} affected
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => void acceptMeToo(m)} className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-paper">
                      Me too
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void submit(false)}
                      className="rounded-full border border-rule px-4 py-2 text-sm font-semibold"
                    >
                      Report anyway
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {classified ? (
            <p className="text-sm text-ink/65">
              Classified as {classified.category} → {classified.department} ({classified.severity}, {classified.source})
            </p>
          ) : null}
          {error ? <p className="text-sm text-critical">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-navy py-3 text-lg font-semibold text-paper disabled:opacity-60"
          >
            {busy ? "Filing…" : nearby ? "Continue" : "Submit issue"}
          </button>
          <p className="text-center text-xs text-ink/50">
            Already have a ticket? <Link href="/" className="underline">Track it from the map</Link>
          </p>
        </div>
        <CampusMap clusters={[]} pick={pin} onPick={pick} interactivePick />
      </form>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<p className="text-ink/60">Loading report…</p>}>
      <ReportForm />
    </Suspense>
  );
}

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  onstart: () => void;
  onend: () => void;
  onerror: () => void;
  onresult: (ev: SpeechRecognitionEvent) => void;
  start: () => void;
};

type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
