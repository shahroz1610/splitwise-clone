import "server-only";
import { getViewer, type Viewer } from "./auth";
import { db } from "./supabase";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

/** Signed-in user who has joined the group, or an HttpError explaining what's missing. */
export async function requireMember(): Promise<Viewer & { member: NonNullable<Viewer["member"]> }> {
  const viewer = await getViewer();
  if (!viewer) throw new HttpError(401, "Sign in to continue.");
  if (!viewer.member) throw new HttpError(403, "Join the group with the passcode first.");
  return viewer as Viewer & { member: NonNullable<Viewer["member"]> };
}

/**
 * Wrap a mutating route handler: require a joined member, parse JSON, and map errors to responses.
 * `body.actor` is always overwritten with the signed-in member's id, so activity can't be spoofed.
 */
export function mutation<Ctx>(handler: (body: Record<string, unknown>, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const viewer = await requireMember();
      let body: Record<string, unknown> = {};
      if (req.headers.get("content-type")?.includes("application/json")) {
        body = (await req.json().catch(() => ({}))) ?? {};
      }
      body.actor = viewer.member.id;
      const result = await handler(body, ctx);
      return json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      const message = err instanceof Error ? err.message : "Something went wrong.";
      return json({ error: message }, 500);
    }
  };
}

export async function logActivity(entry: {
  kind: string;
  message: string;
  actor: unknown;
  amount_cents?: number | null;
}) {
  let actorName: string | null = null;
  if (typeof entry.actor === "string" && entry.actor) {
    const { data } = await db().from("members").select("name").eq("id", entry.actor).maybeSingle();
    actorName = data?.name ?? null;
  }
  const { error } = await db()
    .from("activity")
    .insert({ kind: entry.kind, message: entry.message, actor_name: actorName, amount_cents: entry.amount_cents ?? null });
  if (error) console.error("activity log failed", error);
}

export function str(v: unknown, field: string, { max = 200, optional = false } = {}): string {
  if (v == null || v === "") {
    if (optional) return "";
    throw new HttpError(400, `${field} is required.`);
  }
  if (typeof v !== "string") throw new HttpError(400, `${field} must be text.`);
  const s = v.trim();
  if (!s && !optional) throw new HttpError(400, `${field} is required.`);
  if (s.length > max) throw new HttpError(400, `${field} is too long.`);
  return s;
}

export function cents(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) throw new HttpError(400, `${field} must be greater than zero.`);
  if (v > 1e13) throw new HttpError(400, `${field} is too large.`);
  return v;
}

export function date(v: unknown, field: string): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    throw new HttpError(400, `${field} must be a valid date.`);
  }
  return v;
}

export function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new HttpError(500, result.error.message);
  return result.data;
}
