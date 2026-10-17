import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Member } from "../types";
import { check } from "./check";
import { timed } from "./http-timing";
import { db } from "./supabase";

export function authEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set.");
  return { url, anonKey };
}

/** Supabase Auth client bound to this request's cookies (Google or email session). */
export async function authClient() {
  const { url, anonKey } = authEnv();
  const store = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a context that can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

export interface Viewer {
  user: AuthUser;
  /** The group member this account is linked to; null until they join with the passcode. */
  member: Member | null;
  /** True when their member was archived: they've been removed and can't rejoin until restored. */
  removed: boolean;
  /** Present when requested: all members and the currency, fetched in the same round trip as the viewer's own member. */
  group?: GroupContext;
}

export interface GroupContext {
  members: Map<string, Member>;
  currency: string;
}

/** The signed-in user and their linked member, or null when signed out. */
export async function getViewer({ withGroup = false } = {}): Promise<Viewer | null> {
  const supabase = await authClient();
  // getClaims verifies the JWT signature locally (cached JWKS) instead of calling the Auth server.
  const { data, error } = await timed("auth getClaims", supabase.auth.getClaims());
  const c = data?.claims;
  if (error || !c?.sub) return null;
  const meta = (c.user_metadata ?? {}) as Record<string, unknown>;
  const email = typeof c.email === "string" ? c.email : "";
  const user: AuthUser = {
    id: c.sub,
    email,
    name: String(meta.full_name ?? meta.name ?? email.split("@")[0] ?? "Me"),
    avatar_url: (meta.avatar_url ?? meta.picture ?? null) as string | null,
  };
  if (withGroup) {
    // One wave: every member (the viewer is among them) plus the currency, so mutations need no further lookups.
    const [membersRes, settingsRes] = await timed(
      "viewer members+currency",
      Promise.all([db().from("members").select("*"), db().from("settings").select("currency").eq("id", 1).maybeSingle()]),
    );
    const rows = check(membersRes) as (Member & { auth_user_id: string | null })[];
    const member = rows.find((m) => m.auth_user_id === user.id) ?? null;
    const currency = (check(settingsRes) as { currency: string } | null)?.currency ?? "USD";
    return {
      user,
      member: member && !member.archived ? member : null,
      removed: Boolean(member?.archived),
      group: { members: new Map(rows.map((m) => [m.id, m])), currency },
    };
  }
  const { data: member } = await timed("viewer member lookup", db().from("members").select("*").eq("auth_user_id", user.id).maybeSingle());
  // Archived members have been removed from the group and lose access.
  return { user, member: member && !member.archived ? (member as Member) : null, removed: Boolean(member?.archived) };
}

function digest(s: string) {
  return createHmac("sha256", "splitwise-clone:v1").update(s).digest();
}

/** Check the one-time join passcode. Joining is disabled entirely if GROUP_PASSCODE isn't configured. */
export function passcodeMatches(input: string): boolean {
  const expected = process.env.GROUP_PASSCODE;
  if (!expected) return false;
  return timingSafeEqual(digest(input), digest(expected));
}
