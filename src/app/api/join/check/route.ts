import { check, HttpError, json } from "@/lib/server/http";
import { verifyJoin } from "@/lib/server/join";
import { db } from "@/lib/server/supabase";

/** Step 1 of joining: verify the passcode and list members nobody has claimed yet. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { passcode?: unknown };
    const user = await verifyJoin(body.passcode);
    const members = check(
      await db().from("members").select("id, name, color").is("auth_user_id", null).eq("archived", false).order("created_at"),
    );
    return json({ members, suggested_name: user.name });
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "Something went wrong." }, 500);
  }
}
