// Makes the text safe to use inside an ILIKE pattern: % and _ are wildcards, \ is the escape.
export function likePattern(q) {
  return "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
}

// A short piece of a message around the first match, for showing under a search result.
export function makeSnippet(text, q, before = 30, after = 60) {
  if (!text) return null;
  const flat = String(text).replace(/\s+/g, " ").trim();
  const i = flat.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return flat.slice(0, before + after) + (flat.length > before + after ? "..." : "");
  const start = Math.max(0, i - before);
  const end = Math.min(flat.length, i + q.length + after);
  return (start > 0 ? "..." : "") + flat.slice(start, end) + (end < flat.length ? "..." : "");
}
