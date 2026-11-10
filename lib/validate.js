export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// bcrypt only uses the first 72 bytes, so longer passwords would be silently cut.
export function passwordError(pw) {
  if (typeof pw !== "string" || pw.length < 8 || Buffer.byteLength(pw, "utf8") > 72) {
    return "Password must be between 8 and 72 characters.";
  }
  return null;
}

export function cleanName(v) {
  return String(v || "").trim().slice(0, 60);
}
