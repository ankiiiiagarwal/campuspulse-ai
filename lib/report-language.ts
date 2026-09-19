/** Small, explicit Hindi/Hinglish vocabulary. Unknown words remain Unicode text.
 * This is an offline matching aid, not a general-purpose translation model. */
const PHRASES: Array<[RegExp, string]> = [
  [/बिजली नहीं (?:आ रही|है)|बिजली चली गई|बिजली गुल|bijli (?:nahi|nahin|band|chali)/giu, " power outage "],
  [/काम नहीं कर रह[ाीे]|चल नहीं रह[ाीे]|नहीं चल रह[ाीे]|काम नहीं करता|kaam nahi(?:n)?|nahi(?:n)? (?:chal|chalta)/giu, " not working "],
  [/पानी टपक रहा|पानी बह रहा|पानी रिस रहा|pani tapak|paani tapak/giu, " water leaking "],
  [/वाई[ -]?फाई|वाइ[ -]?फाइ|वाइफाई|wi[ -]?fi/giu, " wifi "],
  [/इंटरनेट|नेटवर्क|नेट नहीं/giu, " internet "],
  [/राउटर/gu, " router "], [/प्रोजेक्टर/gu, " projector "],
  [/लाइटें|लाइट|बत्तियाँ|बत्ती|रोशनी/gu, " light "],
  [/पंखा|पंखे/gu, " fan "], [/बिजली|bijli/giu, " power "],
  [/नल|\bnal\b/giu, " tap "], [/पाइप/gu, " pipe "],
  [/रिसाव|लीक|टपक रहा|लीकेज|टपक/gu, " leaking "],
  [/गीला फर्श|फर्श पर पानी|geela farsh/giu, " wet floor "],
  [/सीलन|नम दीवार|गीली दीवार/gu, " damp wall "],
  [/पानी|\b(?:paani|pani)\b/giu, " water "],
  [/पुस्तकालय|लाइब्रेरी/gu, " library "],
  [/दूसरी मंजिल|दूसरे माले|second floor|floor 2|2nd floor/giu, " floor2 "],
  [/पहली मंजिल|पहले माले|first floor|floor 1|1st floor/giu, " floor1 "],
  [/तीसरी मंजिल|third floor|floor 3|3rd floor/giu, " floor3 "],
  [/भूतल|ground floor/giu, " floor0 "],
  [/बंद|खराब|kharab/giu, " down "],
  [/कुर्सी|kursi/giu, " chair "],
];

export function normalizeReportText(text: string): string {
  let result = text.normalize("NFKC").toLowerCase();
  for (const [pattern, replacement] of PHRASES) result = result.replace(pattern, replacement);
  return result.replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

export function floorHint(text: string): string | null {
  return normalizeReportText(text).match(/\bfloor\d+\b/)?.[0] ?? null;
}

export function problemSignature(text: string): string[] {
  const t = normalizeReportText(text);
  const out: string[] = [];
  if (/\b(wifi|internet|router|network|ethernet)\b/.test(t)) out.push("network");
  if (/\b(leak\w*|drip\w*)\b/.test(t)) out.push("leak");
  if (/\b(light\w*|bulb\w*)\b/.test(t)) out.push("light");
  if (/\bprojector\b/.test(t)) out.push("projector");
  if (/\bchair\b/.test(t)) out.push("chair");
  return out;
}
