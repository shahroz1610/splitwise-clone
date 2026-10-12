import "server-only";
import type { Activity, Expense, Member, Payment, Settings } from "../types";
import { check } from "./http";
import { db } from "./supabase";

type ExpenseRow = Omit<Expense, "splits"> & { expense_splits: Expense["splits"] };

export async function loadGroup() {
  const [settings, members, expenses, payments, activity] = await Promise.all([
    db().from("settings").select("group_name, currency, simplify_debts").eq("id", 1).maybeSingle(),
    db().from("members").select("*").order("created_at"),
    db()
      .from("expenses")
      .select("*, expense_splits(member_id, share_cents, input_value)")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }),
    db().from("payments").select("*").order("payment_date", { ascending: false }).order("created_at", { ascending: false }),
    db().from("activity").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const expenseRows = (check(expenses) ?? []) as ExpenseRow[];
  return {
    settings: (check(settings) as Settings | null) ?? { group_name: "Our Group", currency: "USD", simplify_debts: true },
    // Don't send auth user ids to the browser; the client only needs to know who has joined.
    members: ((check(members) ?? []) as (Member & { auth_user_id: string | null })[]).map(({ auth_user_id, ...m }) => ({
      ...m,
      linked: Boolean(auth_user_id),
    })),
    expenses: expenseRows.map(({ expense_splits, ...e }) => ({
      ...e,
      amount_cents: Number(e.amount_cents),
      splits: expense_splits.map((s) => ({
        ...s,
        share_cents: Number(s.share_cents),
        input_value: s.input_value == null ? null : Number(s.input_value),
      })),
    })) as Expense[],
    payments: ((check(payments) ?? []) as Payment[]).map((p) => ({ ...p, amount_cents: Number(p.amount_cents) })),
    activity: ((check(activity) ?? []) as Activity[]).map((a) => ({
      ...a,
      amount_cents: a.amount_cents == null ? null : Number(a.amount_cents),
    })),
  };
}
