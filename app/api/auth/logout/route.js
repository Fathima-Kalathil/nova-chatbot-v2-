import { clearSession, getSessionUser, revokeSessions } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (user) await revokeSessions(user.id); // old copies of the session cookie stop working
  } catch (err) {
    console.error("Logout error:", err?.message);
  }
  await clearSession();
  return Response.json({ ok: true });
}
