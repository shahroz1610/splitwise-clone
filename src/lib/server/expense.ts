import "server-only";
import { CATEGORY_IDS } from "../categories";
import { formatMoney } from "../money";
import { computeSplits } from "../splits";
import type { SplitType } from "../types";
import { cents, check, date, HttpError, logActivity, str } from "./http";
import { db } from "./supabase";

const SPLIT_TYPES: SplitType[] = ["equal", "exact", "percent", "shares"];

async function memberMap() {
  const rows = check(await db().from("members").select("id, name, archived")) as { id: string; name: string; archived: boolean }[];
  return new Map(rows.map((m) => [m.id, m]));
}

async function currency() {
  const row = check(await db().from("settings").select("currency").eq("id", 1).maybeSingle()) as { currency: string } | null;
  return row?.currency ?? "USD";
}

/** Validate an expense payload, compute shares, save it atomically and log the activity. */
export async function saveExpense(id: string | null, body: Record<string, unknown>) {
  const description = str(body.description, "Description", { max: 120 });
  const amount = cents(body.amount_cents, "Amount");
  const paidBy = str(body.paid_by, "Paid by");
  const category = typeof body.category === "string" && CATEGORY_IDS.has(body.category) ? body.category : "general";
  const splitType = body.split_type as SplitType;
  if (!SPLIT_TYPES.includes(splitType)) throw new HttpError(400, "Choose how to split the expense.");
  const expenseDate = date(body.expense_date, "Date");
  const notes = str(body.notes, "Notes", { max: 1000, optional: true }) || null;

  if (!Array.isArray(body.entries)) throw new HttpError(400, "Choose who the expense is split with.");
  const entries = body.entries.map((e: { member_id?: unknown; value?: unknown }) => ({
    member_id: String(e?.member_id ?? ""),
    value: Number(e?.value ?? 0),
  }));

  const members = await memberMap();
  for (const mid of [paidBy, ...entries.map((e) => e.member_id)]) {
    if (!members.has(mid)) throw new HttpError(400, "One of the selected people no longer exists.");
  }

  const split = computeSplits(amount, splitType, entries);
  if (!split.ok) throw new HttpError(400, split.error);

  const { data, error } = await db().rpc("save_expense", {
    p_id: id,
    p_description: description,
    p_amount_cents: amount,
    p_paid_by: paidBy,
    p_category: category,
    p_split_type: splitType,
    p_expense_date: expenseDate,
    p_notes: notes,
    p_splits: split.shares,
  });
  if (error) throw new HttpError(error.message.includes("not found") ? 404 : 500, error.message);

  const cur = await currency();
  await logActivity({
    kind: id ? "expense_updated" : "expense_added",
    message: `${id ? "Updated" : "Added"} “${description}” — ${formatMoney(amount, cur)} paid by ${members.get(paidBy)!.name}`,
    actor: body.actor,
    amount_cents: amount,
  });
  return { id: data as string };
}

export async function deleteExpense(id: string, actor: unknown) {
  const row = check(
    await db().from("expenses").select("description, amount_cents").eq("id", id).maybeSingle(),
  ) as { description: string; amount_cents: number } | null;
  if (!row) throw new HttpError(404, "Expense not found.");
  check(await db().from("expenses").delete().eq("id", id));
  await logActivity({
    kind: "expense_deleted",
    message: `Deleted “${row.description}” — ${formatMoney(Number(row.amount_cents), await currency())}`,
    actor,
    amount_cents: Number(row.amount_cents),
  });
}

export { memberMap, currency };
