import { memberStats } from "@/lib/balances";
import { check, HttpError, logActivity, mutation, str } from "@/lib/server/http";
import { loadGroup } from "@/lib/server/state";
import { db } from "@/lib/server/supabase";

type Ctx = RouteContext<"/api/members/[id]">;

async function balanceOf(id: string) {
  const g = await loadGroup();
  const member = g.members.find((m) => m.id === id);
  if (!member) throw new HttpError(404, "Person not found.");
  const stats = memberStats([id], g.expenses, g.payments).get(id)!;
  const referenced =
    g.expenses.some((e) => e.paid_by === id || e.splits.some((s) => s.member_id === id)) ||
    g.payments.some((p) => p.from_member === id || p.to_member === id);
  return { member, net: stats.net, referenced };
}

export const PATCH = mutation<Ctx>(async (body, ctx) => {
  const { id } = await ctx.params;
  const { member, net } = await balanceOf(id);
  const update: Record<string, unknown> = {};
  const messages: string[] = [];

  if (body.name !== undefined) {
    const name = str(body.name, "Name", { max: 60 });
    if (name !== member.name) {
      const others = check(await db().from("members").select("id, name")) as { id: string; name: string }[];
      if (others.some((m) => m.id !== id && m.name.toLowerCase() === name.toLowerCase())) {
        throw new HttpError(409, `${name} is already in the group.`);
      }
      update.name = name;
      messages.push(`Renamed ${member.name} to ${name}`);
    }
  }
  if (typeof body.archived === "boolean" && body.archived !== member.archived) {
    if (body.archived && id === body.actor) throw new HttpError(409, "You can't remove yourself from the group.");
    if (body.archived && net !== 0) throw new HttpError(409, `${member.name} needs to be settled up before being removed.`);
    update.archived = body.archived;
    messages.push(body.archived ? `Removed ${member.name} from the group` : `Restored ${member.name} to the group`);
  }
  if (Object.keys(update).length === 0) return { ok: true };

  check(await db().from("members").update(update).eq("id", id));
  for (const message of messages) await logActivity({ kind: "member_updated", message, actor: body.actor });
});

/** Hard delete only works for people with no history; others should be archived instead. */
export const DELETE = mutation<Ctx>(async (body, ctx) => {
  const { id } = await ctx.params;
  const { member, referenced } = await balanceOf(id);
  if (id === body.actor) throw new HttpError(409, "You can't remove yourself from the group.");
  if (referenced) throw new HttpError(409, `${member.name} has expenses or payments, so they can only be archived.`);
  check(await db().from("members").delete().eq("id", id));
  await logActivity({ kind: "member_removed", message: `Removed ${member.name} from the group`, actor: body.actor });
});
