"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section role="alert" className="cp-card mx-auto max-w-lg p-8 text-center"><p className="cp-kicker">A small interruption</p><h1 className="mt-3 font-serif text-3xl text-navy">We couldn’t load this page.</h1><p className="mt-3 text-ink/65">Please try again, or return to the campus dashboard.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={reset} className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white">Try again</button><Link href="/" className="rounded-full border border-rule px-5 py-3 text-sm font-semibold">Back to campus</Link></div></section>;
}
