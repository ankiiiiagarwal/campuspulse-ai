"use client";

import { CampusMap } from "@/components/CampusMap";
import { openHelpChat } from "@/lib/chat-open";
import { reportCoordinates, requestBrowserLocation, stripExif } from "@/lib/client";
import { OUTSIDE_BOUNDARY_MESSAGE, pointInBoundary } from "@/lib/geo";
import { DEPARTMENTS, coerceDepartment } from "@/lib/departments";
import { useLang, speechLang } from "@/lib/i18n";
import { rememberTicket } from "@/lib/saved-tickets";
import { canListen, startListening, type ListenHandle } from "@/lib/voice";
import type { CampusBoundary, ReportLocation } from "@/lib/types";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

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
  const search = useSearchParams();
  const { lang, t } = useLang();
  const listenRef = useRef<ListenHandle | null>(null);
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [qrLocation, setQrLocation] = useState<ReportLocation | null>(null);
  const [savedLocations, setSavedLocations] = useState<ReportLocation[]>([]);
  const [whereDetail, setWhereDetail] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [boundary, setBoundary] = useState<CampusBoundary | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [error, setError] = useState("");
  const [recenter, setRecenter] = useState<{ token: number; lat: number; lng: number } | null>(null);
  const [nearby, setNearby] = useState<NearbyMatch[] | null>(null);
  const [classified, setClassified] = useState<{ category: string; department: string; severity: string; source: string } | null>(
    null,
  );

  const namedPlace = place.trim();
  const detail = whereDetail.trim();
  const placeLabel = detail.toLowerCase().startsWith(`${namedPlace.toLowerCase()},`) ? detail : [namedPlace, detail].filter(Boolean).join(", ");

  useEffect(() => {
    let active = true;
    void fetch("/api/locations", { cache: "no-store" }).then(r => r.ok ? r.json() : { locations: [] }).then(data => { if (active) setSavedLocations(data.locations ?? []); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    fetch("/api/campus", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const next = (data.boundary || null) as CampusBoundary | null;
        setBoundary(next);
        setPin((current) => {
          if (current && next && !pointInBoundary(current, next)) {
            setError(t("outsideBoundary"));
            return null;
          }
          return current;
        });
      })
      .catch(() => {
        setError(t("loadCampusFail"));
      });
    return () => {
      listenRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    const locationId = search.get("location");
    setQrLocation(null);
    if (locationId) {
      void fetch("/api/locations", { cache: "no-store" }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        const location = (data.locations as ReportLocation[]).find(l => l.id === locationId);
        if (!location) throw new Error("This QR location was not found. Choose the place and pin manually.");
        if (!active) return;
        setQrLocation(location); setPlace(location.department); setWhereDetail(location.name);
        setPin({ lat: location.lat, lng: location.lng }); setNearby(null);
      }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load QR location"); });
      return () => { active = false; };
    }
    const raw = search.get("place") || search.get("desk") || "";
    const desk = coerceDepartment(raw);
    if (desk) setPlace(desk);
    const coordinates = reportCoordinates(search);
    if (coordinates) {
      setPin(coordinates);
      setMapOpen(true);
    }
  }, [search]);

  async function locate() {
    setLocBusy(true);
    const res = await requestBrowserLocation({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    setLocBusy(false);
    if (!res.ok) {
      setError(
        res.reason === "denied" ? t("locDenied") : res.reason === "unsupported" ? t("locUnsupported") : t("locFail"),
      );
      return;
    }
    const next = { lat: res.lat, lng: res.lng };
    setUserLocation(next);
    setRecenter({ token: Date.now(), lat: next.lat, lng: next.lng });
    const campus = await fetch("/api/campus", { cache: "no-store" }).then((r) => r.json());
    const live = (campus.boundary as CampusBoundary | null) || boundary;
    if (live && !pointInBoundary(next, live)) {
      setError(t("outsideBoundary"));
      return;
    }
    setPin(next);
    setQrLocation(null);
    setNearby(null);
    setError((e) => (e === OUTSIDE_BOUNDARY_MESSAGE ? "" : e));
  }

  async function openMap() {
    setMapOpen(true);
    if (!userLocation && !pin) await locate();
  }

  function pick(lat: number, lng: number) {
    if (boundary && !pointInBoundary({ lat, lng }, boundary)) {
      setError(t("outsideBoundary"));
      return;
    }
    setPin({ lat, lng });
    setQrLocation(null);
    setNearby(null);
    setError((e) => (e === OUTSIDE_BOUNDARY_MESSAGE || e === t("outsideBoundary") ? "" : e));
  }

  function startVoice() {
    if (listenRef.current) {
      listenRef.current.stop();
      listenRef.current = null;
      setListening(false);
      setInterim("");
      setVoiceNote("");
      return;
    }
    if (!canListen()) {
      setVoiceNote(t("voiceNeedChrome"));
      return;
    }
    const handle = startListening({
      lang: speechLang(lang),
      continuous: true,
      onStart: () => {
        setListening(true);
        setVoiceNote(t("voiceListening"));
      },
      onInterim: (text) => setInterim(text),
      onFinal: (text) => {
        setDescription((d) => (d ? `${d.trim()} ${text}` : text));
        setInterim("");
        setNearby(null);
        setClassified(null);
      },
      onError: (message) => setVoiceNote(message),
      onStatus: (message) => setVoiceNote(message),
      onEnd: () => {
        listenRef.current = null;
        setListening(false);
        setInterim("");
      },
    });
    listenRef.current = handle;
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await stripExif(file));
    } catch {
      setError(t("photoFail"));
    }
  }

  async function lookupNearby(): Promise<NearbyMatch[]> {
    if (!pin || description.trim().length < 4) return [];
    const url = `/api/nearby?lat=${pin.lat}&lng=${pin.lng}&text=${encodeURIComponent(description)}&building=${encodeURIComponent(placeLabel)}${qrLocation ? `&location=${qrLocation.id}` : ""}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return data.matches || [];
  }

  async function submit(forceNew: boolean, mergeClusterId?: string) {
    setError("");
    setBusy(true);
    try {
      if (!pin) throw new Error(t("markMap"));
      if (boundary && !pointInBoundary(pin, boundary)) throw new Error(t("outsideBoundary"));
      if (!namedPlace) throw new Error(t("choosePlace"));
      let photo_url: string | null = null;
      if (photo) {
        const up = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: photo, kind: "report" }),
        });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData.error || t("photoUploadFail"));
        photo_url = upData.url;
      }
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          location_id: qrLocation?.id,
          lat: pin.lat,
          lng: pin.lng,
          building: placeLabel,
          photo_url,
          forceNew,
          mergeClusterId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("fileFail"));
      if (data.classified) setClassified(data.classified);
      rememberTicket(data.issue.ticket_code);
      const merged = Boolean(data.merged);
      router.push(
        `/submitted?code=${encodeURIComponent(data.issue.ticket_code)}${merged ? "&merged=1" : ""}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("submitFail"));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (description.trim().length < 8) {
      setError(t("writeSentence"));
      return;
    }
    if (!pin) {
      setMapOpen(true);
      setError(t("markMap"));
      return;
    }
    if (boundary && !pointInBoundary(pin, boundary)) {
      setError(t("outsideBoundary"));
      return;
    }
    if (!namedPlace) {
      setError(t("choosePlace"));
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
      setError(err instanceof Error ? err.message : t("submitFail"));
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
        body: JSON.stringify({ cluster_id: match.cluster_id }),
      });
      const data = await res.json();
      if (!res.ok && !data.already) throw new Error(data.error || t("meTooFail"));
      rememberTicket(match.ticket_code);
      router.push(`/submitted?code=${encodeURIComponent(match.ticket_code)}&joined=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("meTooFail"));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="pt-3 md:pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">{t("anonymousReport")}</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-navy md:text-5xl">{t("whatBroken")}</h1>
        <p className="mt-2 text-ink/70">{t("reportLead")}</p>
        <button
          type="button"
          onClick={() => openHelpChat(description.trim() || undefined)}
          className="mt-3 text-sm font-semibold text-onit hover:underline"
        >
          {t("askFixFirst")}
        </button>
      </section>

      <form onSubmit={onSubmit} className="space-y-6 rounded-3xl border border-rule bg-white p-5 shadow-card md:p-8" aria-busy={busy}>
        <label className="block">
          <span className="text-sm font-semibold"><span className="cp-step" aria-hidden="true">1</span>{t("whatBroken")}</span>
          <div className="relative mt-1">
            <textarea
              maxLength={4000}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setNearby(null);
                setClassified(null);
              }}
              rows={5}
              required
              placeholder={listening ? t("listening") : t("descPlaceholder")}
              className="w-full rounded-2xl border border-rule bg-paper/40 py-3 pl-3 pr-14 text-base outline-none ring-navy/20 focus:ring-2"
            />
            <button
              type="button"
              onClick={startVoice}
              aria-label={listening ? t("stopListening") : t("dictate")}
              title={listening ? t("stopListening") : t("dictate")}
              className={`absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full transition ${
                listening ? "bg-critical text-white shadow-card" : "bg-navy text-paper"
              }`}
            >
              <MicIcon pulse={listening} />
            </button>
          </div>
          {interim ? (
            <p className="mt-2 text-sm text-onit">
              {t("hearing")}: {interim}
            </p>
          ) : null}
          {voiceNote ? <p className="mt-2 text-sm text-ink/65">{voiceNote}</p> : null}
        </label>

        <div className="border-t border-rule pt-5">
          <p className="mb-3 text-sm font-semibold"><span className="cp-step" aria-hidden="true">2</span>{lang === "hi" ? "कहाँ है समस्या?" : "Where is the issue?"}</p>
          {savedLocations.length > 0 && <label className="mb-4 block text-sm text-ink/70">{lang === "hi" ? "कैंपस की जगह चुनें" : "Quick pick a campus spot"}<select value={qrLocation?.id ?? ""} onChange={e => {
            const location = savedLocations.find(l => l.id === e.target.value);
            if (!location) { setQrLocation(null); setNearby(null); return; }
            setQrLocation(location); setPlace(location.department); setWhereDetail(location.name); setPin({lat:location.lat,lng:location.lng}); setNearby(null); setError("");
          }} className="mt-1 w-full rounded-xl border border-rule bg-paper/50 p-3"><option value="">{lang === "hi" ? "या नीचे जगह भरें" : "Choose a spot, or enter below"}</option>{savedLocations.map(l => <option key={l.id} value={l.id}>{l.department} · {l.name}</option>)}</select></label>}
        <label className="block">
          <span className="text-sm font-semibold">{t("place")}</span>
          <select
            value={place}
            required
            onChange={(e) => { setPlace(e.target.value); setQrLocation(null); setNearby(null); }}
            className="mt-1 w-full rounded-2xl border border-rule bg-paper/40 px-3 py-2.5 outline-none ring-navy/20 focus:ring-2"
          >
            <option value="" disabled>
              {t("selectPlace")}
            </option>
            {DEPARTMENTS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        </div>

        <div>
          <div className="mt-1 flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="text-sm font-semibold">{t("where")}</span>
              <input
                maxLength={120}
                value={whereDetail}
                onChange={(e) => { setWhereDetail(e.target.value); setQrLocation(null); setNearby(null); }}
                placeholder={t("wherePlaceholder")}
                className="mt-1 w-full rounded-2xl border border-rule bg-paper/40 px-3 py-2.5 outline-none ring-navy/20 focus:ring-2"
              />
            </label>
            <button
              type="button"
              onClick={() => void openMap()}
              className="shrink-0 rounded-2xl bg-navy px-3 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {pin ? t("adjustLocation") : t("markLocation")}
            </button>
          </div>
          {mapOpen ? (
            <div className="relative mt-3">
              <CampusMap
                clusters={[]}
                pick={pin}
                onPick={pick}
                interactivePick
                constrainPick={Boolean(boundary)}
                onOutsidePick={() => setError(t("outsideBoundary"))}
                boundary={boundary}
                userLocation={userLocation}
                recenter={recenter}
                youLabel={t("you")}
                banner={null}
                heightClass="h-[320px] md:h-[400px]"
                lockToCampus={Boolean(boundary)}
              />
              <button
                type="button"
                disabled={locBusy}
                onClick={() => void locate()}
                aria-label={t("recalibrate")}
                title={t("recalibrate")}
                className="absolute bottom-14 right-3 z-[1000] flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-navy shadow-card disabled:opacity-60"
              >
                <LocateIcon spinning={locBusy} />
              </button>
            </div>
          ) : null}
          {qrLocation && <p role="status" className="mt-3 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">QR location loaded: {qrLocation.department}, {qrLocation.name}. Changing the place or map pin switches to a manual report.</p>}
          {pin ? (
            <p className="mt-2 text-xs text-ink/50">
              {t("pinSelected")} · {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-semibold">
            <span className="cp-step" aria-hidden="true">3</span>{t("addPhotos")} <span className="font-normal text-ink/50">({t("optional")})</span>
          </p>
          <label className="mt-2 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-rule bg-paper/50 px-4 py-6 text-sm font-semibold text-ink/70 hover:border-navy/40">
            {photo ? t("replacePhoto") : t("attachPhoto")}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
          </label>
          {photo ? (
            <img src={photo} alt="" className="mt-3 max-h-44 w-full rounded-2xl border border-rule object-cover" />
          ) : null}
        </div>

        {nearby && nearby.length > 0 ? (
          <div className="rounded-2xl border-2 border-amberpin bg-white p-4 shadow-card">
            <p className="font-serif text-xl text-navy">{t("alreadyExists")}</p>
            {nearby.map((m) => (
              <div key={m.cluster_id} className="mt-3 rounded-xl bg-paper/70 p-3">
                <p className="font-semibold">{m.title}</p>
                <p className="text-sm text-ink/60">
                  {m.building} · {m.meters} {t("metersAway")} · {m.report_count + m.me_too_count} {t("affected")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void acceptMeToo(m)}
                    className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-paper"
                  >
                    {t("meToo")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submit(false, m.cluster_id)}
                    className="rounded-full border border-navy px-4 py-2 text-sm font-semibold"
                  >
                    {t("joinExisting")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submit(true)}
                    className="rounded-full border border-rule px-4 py-2 text-sm font-semibold"
                  >
                    {t("reportAnyway")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {classified ? (
          <p className="text-sm text-ink/65">
            {t("classifiedAs")} {classified.category} → {classified.department} ({classified.severity}, {classified.source})
          </p>
        ) : null}
        {error ? <p role="alert" className="rounded-xl bg-critical/5 p-3 text-sm text-critical">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-navy py-3 text-lg font-semibold text-paper disabled:opacity-60"
        >
          {busy ? t("filing") : nearby ? t("joinExisting") : t("submitIssue")}
        </button>
        <p className="text-center text-xs text-ink/50">
          {t("alreadyTicket")}{" "}
          <Link href="/" className="underline">
            {t("trackFromMap")}
          </Link>
        </p>
      </form>
    </div>
  );
}

function MicIcon({ pulse }: { pulse?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${pulse ? "animate-pulse" : ""}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-2.08A7 7 0 0 0 19 11h-2Z" />
    </svg>
  );
}

function LocateIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" />
    </svg>
  );
}

function ReportFallback() {
  const { t } = useLang();
  return <p className="text-ink/60">{t("loadingReport")}</p>;
}

export default function ReportPage() {
  return (
    <Suspense fallback={<ReportFallback />}>
      <ReportForm />
    </Suspense>
  );
}
