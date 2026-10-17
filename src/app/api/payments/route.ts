import { cents, check, date, HttpError, logActivity, mutation, str } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { formatMoney } from "@/lib/money";

export const POST = mutation(async (body, _ctx, { group }) => {
  const from = str(body.from_member, "Payer");
  const to = str(body.to_member, "Recipient");
  if (from === to) throw new HttpError(400, "Payer and recipient must be different people.");
  const amount = cents(body.amount_cents, "Amount");
  const paymentDate = date(body.payment_date, "Date");
  const note = str(body.note, "Note", { max: 300, optional: true }) || null;

  const { members, currency: cur } = group;
  if (!members.has(from) || !members.has(to)) throw new HttpError(400, "One of the selected people no longer exists.");

  const row = check(
    await db()
      .from("payments")
      .insert({ from_member: from, to_member: to, amount_cents: amount, payment_date: paymentDate, note })
      .select("id")
      .single(),
  ) as { id: string };

  await logActivity({
    kind: "payment_added",
    message: `${members.get(from)!.name} paid ${members.get(to)!.name} ${formatMoney(amount, cur)}`,
    actor: body.actor,
    actorName: body.actor_name,
    amount_cents: amount,
  });
  return row;
});
