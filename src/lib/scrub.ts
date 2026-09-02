/**
 * Strips machine-identifying absolute paths from anything committed under
 * results/. The lab's own repo root becomes `<lab>`; any remaining
 * `/Users/<name>` or `/home/<name>` prefix becomes a generic placeholder.
 */
const REPO_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RULES: [RegExp, string][] = [
  [new RegExp(escapeRegExp(REPO_ROOT), "g"), "<lab>"],
  [new RegExp(escapeRegExp(REPO_ROOT.toLowerCase()), "g"), "<lab>"],
  [/\/altro\/proget[a-z]*/gi, "/projects"],
  [/\/(Users|home|users)\/[^/"\s\\]+/g, "/$1/user"],
];

export function scrub(text: string): string {
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}
