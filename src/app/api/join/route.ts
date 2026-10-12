import { MEMBER_COLORS } from "@/lib/categories";
import { check, HttpError, json, logActivity, str } from "@/lib/server/http";
import { verifyJoin } from "@/lib/server/join";
import { db } from "@/lib/server/supabase";

/**
 * Step 2 of joining: link this account to an existing unclaimed member
 * (`member_id`) or create a new member (`name`). Only ever needed once per account.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { passcode?: unknown; member_id?: unknown; name?: unknown };
    const user = await verifyJoin(body.passcode);
    const profile = { auth_user_id: user.id, email: user.email, avatar_url: user.avatar_url };

    let memberId: string;
    let memberName: string;
    if (typeof body.member_id === "string" && body.member_id) {
      const { data, error } = await db()
        .from("members")
        .update(profile)
        .eq("id", body.member_id)
        .is("auth_user_id", null)
        .eq("archived", false)
        .select("id, name")
        .maybeSingle();
      if (error) throw new HttpError(error.code === "23505" ? 409 : 500, error.code === "23505" ? "You've already joined this group." : error.message);
      if (!data) throw new HttpError(409, "Someone else has already claimed that person. Pick another or join as new.");
      memberId = data.id;
      memberName = data.name;
    } else {
      const name = str(body.name, "Name", { max: 60 });
      const existing = check(await db().from("members").select("name, color")) as { name: string; color: string }[];
      if (existing.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
        throw new HttpError(409, `${name} is already in the group — pick them from the list, or use a different name.`);
      }
      const used = new Set(existing.map((m) => m.color));
      const color = MEMBER_COLORS.find((c) => !used.has(c)) ?? MEMBER_COLORS[existing.length % MEMBER_COLORS.length];
      const { data, error } = await db().from("members").insert({ name, color, ...profile }).select("id, name").single();
      if (error) throw new HttpError(error.code === "23505" ? 409 : 500, error.code === "23505" ? "You've already joined this group." : error.message);
      memberId = data.id;
      memberName = data.name;
    }

    await logActivity({ kind: "member_added", message: `${memberName} joined the group (${user.email})`, actor: memberId });
    return json({ member_id: memberId });
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "Something went wrong." }, 500);
  }
}
