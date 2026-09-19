import Link from "next/link";
export default function NotFound() {
  return <section className="cp-card mx-auto max-w-lg p-8 text-center"><p className="cp-kicker">404 · Off the map</p><h1 className="mt-3 font-serif text-3xl text-navy">This page isn’t here.</h1><p className="mt-3 text-ink/65">Check the address or head back to your campus dashboard.</p><Link href="/" className="mt-6 inline-flex rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white">Back to campus</Link></section>;
}
