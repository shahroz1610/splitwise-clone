import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const PASS_COOKIE = "sw_pass";

export function passcodeRequired(): boolean {
  return Boolean(process.env.GROUP_PASSCODE);
}

/** The cookie holds an HMAC of the passcode, never the passcode itself. */
export function tokenFor(passcode: string): string {
  return createHmac("sha256", "splitwise-clone:v1").update(passcode).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function passcodeMatches(input: string): boolean {
  const expected = process.env.GROUP_PASSCODE;
  if (!expected) return true;
  return safeEqual(tokenFor(input), tokenFor(expected));
}

export async function canEdit(): Promise<boolean> {
  const expected = process.env.GROUP_PASSCODE;
  if (!expected) return true;
  const token = (await cookies()).get(PASS_COOKIE)?.value;
  return Boolean(token) && safeEqual(token!, tokenFor(expected));
}
