import { getSessionUser, revokeSessions, clearSession } from "@/lib/auth";

// "Log out of all devices": every login token made before now stops working, including this browser's.
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Please log in again." }, { status: 401 });
  try {
    await revokeSessions(user.id);
    await clearSession();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Logout all error:", err?.message);
    return Response.json({ error: "Could not log out of all devices." }, { status: 500 });
  }
}
