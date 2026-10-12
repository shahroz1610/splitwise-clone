import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Member } from "../types";
import { db } from "./supabase";

export function authEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set.");
  return { url, anonKey };
}

/** Supabase Auth client bound to this request's cookies (holds the Google session). */
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
  /** The group member this Google account is linked to; null until they join with the passcode. */
  member: Member | null;
  /** True when their member was archived: they've been removed and can't rejoin until restored. */
  removed: boolean;
}

/** The signed-in Google user and their linked member, or null when signed out. */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await authClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const u = data.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const user: AuthUser = {
    id: u.id,
    email: u.email ?? "",
    name: String(meta.full_name ?? meta.name ?? u.email?.split("@")[0] ?? "Me"),
    avatar_url: (meta.avatar_url ?? meta.picture ?? null) as string | null,
  };
  const { data: member } = await db().from("members").select("*").eq("auth_user_id", u.id).maybeSingle();
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
