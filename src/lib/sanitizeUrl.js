// Shared by every place react-markdown renders untrusted/model-produced text
// (ChatMessageList.jsx's main reply, ChatToolLogDetail.jsx's natural-language
// plan reasoning) — react-markdown's own default already allows only a safe
// set of protocols, but this pins the allowed schemes explicitly so a
// malicious link injected via prompt indirection (a database field, or the
// model's own output) is stripped to "#" before it ever reaches a clickable
// anchor, rather than relying on the library's default staying safe forever.
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#|[^:/?#]*($|[#?]))/i;
export function sanitizeUrl(url) {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (SAFE_URL.test(trimmed)) return url;
  return "";
}
