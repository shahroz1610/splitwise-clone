import { MEMBER_COLORS } from "@/lib/categories";
import { check, HttpError, logActivity, mutation, str } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";

export const POST = mutation(async (body) => {
  const name = str(body.name, "Name", { max: 60 });
  const existing = check(await db().from("members").select("name, color")) as { name: string; color: string }[];
  if (existing.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(409, `${name} is already in the group.`);
  }
  const used = new Set(existing.map((m) => m.color));
  const color = MEMBER_COLORS.find((c) => !used.has(c)) ?? MEMBER_COLORS[existing.length % MEMBER_COLORS.length];

  const row = check(await db().from("members").insert({ name, color }).select("*").single());
  await logActivity({ kind: "member_added", message: `Added ${name} to the group`, actor: body.actor });
  return row;
});
