import { currency, memberMap } from "@/lib/server/expense";
import { check, HttpError, logActivity, mutation } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { formatMoney } from "@/lib/money";

type Ctx = RouteContext<"/api/payments/[id]">;

export const DELETE = mutation<Ctx>(async (body, ctx) => {
  const { id } = await ctx.params;
  const row = check(
    await db().from("payments").select("from_member, to_member, amount_cents").eq("id", id).maybeSingle(),
  ) as { from_member: string; to_member: string; amount_cents: number } | null;
  if (!row) throw new HttpError(404, "Payment not found.");
  check(await db().from("payments").delete().eq("id", id));

  const members = await memberMap();
  await logActivity({
    kind: "payment_deleted",
    message: `Deleted payment: ${members.get(row.from_member)?.name ?? "?"} → ${members.get(row.to_member)?.name ?? "?"} ${formatMoney(Number(row.amount_cents), await currency())}`,
    actor: body.actor,
    amount_cents: Number(row.amount_cents),
  });
});
