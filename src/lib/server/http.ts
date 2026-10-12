import "server-only";
import { canEdit } from "./auth";
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

/** Wrap a mutating route handler: enforce the passcode, parse JSON, and map errors to responses. */
export function mutation<Ctx>(handler: (body: Record<string, unknown>, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      if (!(await canEdit())) throw new HttpError(401, "Enter the group passcode to make changes.");
      let body: Record<string, unknown> = {};
      if (req.headers.get("content-type")?.includes("application/json")) {
        body = (await req.json().catch(() => ({}))) ?? {};
      }
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
