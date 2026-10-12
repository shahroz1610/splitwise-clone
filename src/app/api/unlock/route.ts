import { cookies } from "next/headers";
import { PASS_COOKIE, passcodeMatches, passcodeRequired, tokenFor } from "@/lib/server/auth";
import { json } from "@/lib/server/http";

export async function POST(req: Request) {
  if (!passcodeRequired()) return json({ ok: true });
  const body = (await req.json().catch(() => ({}))) as { passcode?: unknown };
  const passcode = typeof body.passcode === "string" ? body.passcode : "";
  if (!passcodeMatches(passcode)) {
    // Slow down brute-force guessing a little.
    await new Promise((r) => setTimeout(r, 600));
    return json({ error: "That passcode isn't right." }, 401);
  }
  (await cookies()).set(PASS_COOKIE, tokenFor(passcode), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(PASS_COOKIE);
  return json({ ok: true });
}
