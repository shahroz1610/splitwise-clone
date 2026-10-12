"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { centsToInput, toCents } from "@/lib/money";
import { computeSplits } from "@/lib/splits";
import type { Expense, ExpenseInput, SplitType } from "@/lib/types";
import { useGroup } from "./store";
import { Avatar, Button, cx, ErrorText, Field, Input, inputClass, Modal, Select, today } from "./ui";

const SPLIT_TABS: { id: SplitType; label: string; hint: string }[] = [
  { id: "equal", label: "Equally", hint: "Split evenly between the selected people." },
  { id: "exact", label: "Exact", hint: "Enter how much each person owes." },
  { id: "percent", label: "Percent", hint: "Enter each person's percentage." },
  { id: "shares", label: "Shares", hint: "e.g. 2 shares for a couple, 1 for a single." },
];

export function ExpenseForm({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const { activeMembers, state, member, meId, api, fmt } = useGroup();
  const currency = state?.settings.currency ?? "USD";

  // People shown in the form: everyone active, plus archived people already on this expense.
  const people = useMemo(() => {
    const ids = new Set(activeMembers.map((m) => m.id));
    const extra = (expense?.splits.map((s) => s.member_id) ?? [])
      .concat(expense ? [expense.paid_by] : [])
      .filter((id) => !ids.has(id))
      .map((id) => member(id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
    return [...activeMembers, ...extra.filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i)];
  }, [activeMembers, expense, member]);

  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? centsToInput(expense.amount_cents) : "");
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? meId ?? activeMembers[0]?.id ?? "");
  const [category, setCategory] = useState(expense?.category ?? "general");
  const [date, setDate] = useState(expense?.expense_date ?? today());
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [splitType, setSplitType] = useState<SplitType>(expense?.split_type ?? "equal");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(expense ? expense.splits.map((s) => s.member_id) : activeMembers.map((m) => m.id)),
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!expense || expense.split_type === "equal") return {};
    return Object.fromEntries(expense.splits.map((s) => [s.member_id, s.input_value == null ? "" : String(s.input_value)]));
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amountCents = toCents(amount);

  const entries = useMemo(() => {
    if (splitType === "equal") return people.filter((p) => selected.has(p.id)).map((p) => ({ member_id: p.id, value: 0 }));
    return people
      .map((p) => ({ member_id: p.id, value: Number(values[p.id] || 0) }))
      .filter((e) => Number.isFinite(e.value) && e.value > 0);
  }, [splitType, people, selected, values]);

  const preview = useMemo(
    () => (amountCents > 0 ? computeSplits(amountCents, splitType, entries) : null),
    [amountCents, splitType, entries],
  );
  const shareOf = (id: string) => (preview?.ok ? preview.shares.find((s) => s.member_id === id)?.share_cents : undefined);

  function changeType(t: SplitType) {
    setSplitType(t);
    if (t === "shares") {
      setValues(Object.fromEntries(people.map((p) => [p.id, selected.has(p.id) ? "1" : ""])));
    } else if (t === "exact" || t === "percent") {
      setValues({});
    }
  }

  const remaining = (() => {
    const sum = entries.reduce((a, e) => a + e.value, 0);
    if (splitType === "exact" && amountCents > 0) {
      const left = amountCents - Math.round(sum * 100);
      return left === 0 ? null : `${fmt(Math.abs(left))} ${left > 0 ? "left" : "over"}`;
    }
    if (splitType === "percent") {
      const left = Math.round((100 - sum) * 100) / 100;
      return left === 0 ? null : `${Math.abs(left)}% ${left > 0 ? "left" : "over"}`;
    }
    return null;
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim()) return setError("Add a description.");
    if (!(amountCents > 0)) return setError("Enter an amount greater than zero.");
    if (!paidBy) return setError("Choose who paid.");
    if (preview && !preview.ok) return setError(preview.error);

    const payload: ExpenseInput = {
      description: description.trim(),
      amount_cents: amountCents,
      paid_by: paidBy,
      category,
      split_type: splitType,
      expense_date: date,
      notes: notes.trim() || null,
      entries,
    };
    setSaving(true);
    try {
      await api(expense ? "PUT" : "POST", expense ? `/api/expenses/${expense.id}` : "/api/expenses", { ...payload });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={expense ? "Edit expense" : "Add an expense"}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[1fr_9rem] gap-3">
          <Field label="Description">
            <Input autoFocus value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Dinner, groceries, rent…" maxLength={120} />
          </Field>
          <Field label={`Amount (${currency})`}>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="tabular text-right" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Paid by">
            <Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === meId ? `${p.name} (you)` : p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <div className="col-span-2 sm:col-span-1">
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-muted">Split</span>
            {remaining && <span className="text-xs font-medium text-owe">{remaining}</span>}
          </div>
          <div className="mb-2 grid grid-cols-4 rounded-lg bg-subtle p-1 text-[13px]">
            {SPLIT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => changeType(t.id)}
                className={cx(
                  "rounded-md py-1.5 font-medium transition-colors",
                  splitType === t.id ? "bg-surface shadow-sm" : "text-muted hover:text-fg",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mb-2 text-xs text-muted">{SPLIT_TABS.find((t) => t.id === splitType)!.hint}</p>

          <ul className="divide-y divide-border rounded-lg border border-border">
            {people.map((p) => {
              const share = shareOf(p.id);
              const isIn = splitType === "equal" ? selected.has(p.id) : Number(values[p.id] || 0) > 0;
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  {splitType === "equal" ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          if (n.has(p.id)) n.delete(p.id);
                          else n.add(p.id);
                          return n;
                        })
                      }
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={cx(
                          "flex h-5 w-5 items-center justify-center rounded-md border",
                          isIn ? "border-fg bg-fg text-bg" : "border-border",
                        )}
                      >
                        {isIn && <Check size={13} strokeWidth={3} />}
                      </span>
                      <Avatar member={p} size={26} />
                      <span className="text-sm">{p.name}</span>
                    </button>
                  ) : (
                    <>
                      <Avatar member={p} size={26} />
                      <span className={cx("flex-1 text-sm", !isIn && "text-muted")}>{p.name}</span>
                      <div className="relative w-28">
                        <input
                          inputMode="decimal"
                          value={values[p.id] ?? ""}
                          onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                          placeholder="0"
                          className={cx(inputClass, "h-8 pr-8 text-right tabular")}
                          aria-label={`${p.name} ${splitType}`}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted">
                          {splitType === "percent" ? "%" : splitType === "shares" ? "sh" : currency}
                        </span>
                      </div>
                    </>
                  )}
                  <span className={cx("w-20 text-right text-sm tabular", isIn ? "" : "text-muted")}>
                    {share !== undefined && isIn ? fmt(share) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            className={cx(inputClass, "h-auto py-2")}
            placeholder="Anything worth remembering"
          />
        </Field>

        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  );
}
