"use client";

import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { getCategory } from "@/lib/categories";
import { centsToInput, toCents } from "@/lib/money";
import type { Expense } from "@/lib/types";
import { ExpenseForm } from "./ExpenseForm";
import { useGroup, type SettlePrefill } from "./store";
import { Avatar, Button, ErrorText, Field, Input, Modal, Select, formatDate, today } from "./ui";

export function Dialogs() {
  const { dialog, setDialog } = useGroup();
  const close = () => setDialog(null);
  if (!dialog) return null;
  switch (dialog.kind) {
    case "expense":
      return <ExpenseForm expense={dialog.expense} onClose={close} />;
    case "expense-detail":
      return <ExpenseDetail expense={dialog.expense} onClose={close} />;
    case "settle":
      return <SettleForm prefill={dialog.prefill} onClose={close} />;
  }
}

function SettleForm({ prefill, onClose }: { prefill: SettlePrefill; onClose: () => void }) {
  const { activeMembers, meId, api, debts, member, fmt, state } = useGroup();
  const [from, setFrom] = useState(prefill.from ?? meId ?? activeMembers[0]?.id ?? "");
  const [to, setTo] = useState(prefill.to ?? activeMembers.find((m) => m.id !== (prefill.from ?? meId))?.id ?? "");
  const [amount, setAmount] = useState(prefill.amount ? centsToInput(prefill.amount) : "");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Suggested amount for the currently selected pair, if they have an outstanding debt.
  const suggested = debts.find((d) => d.from === from && d.to === to)?.amount;
  const people = [...activeMembers, ...[prefill.from, prefill.to].map((id) => id && member(id)).filter((m) => m && m.archived)] as typeof activeMembers;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = toCents(amount);
    if (from === to) return setError("Choose two different people.");
    if (!(cents > 0)) return setError("Enter an amount greater than zero.");
    setSaving(true);
    try {
      await api("POST", "/api/payments", { from_member: from, to_member: to, amount_cents: cents, payment_date: date, note: note.trim() || null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Settle up"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="settle-form" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Record payment"}
          </Button>
        </>
      }
    >
      <form id="settle-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-center gap-4 py-2">
          <Avatar member={member(from)} size={48} />
          <ArrowRight className="text-muted" />
          <Avatar member={member(to)} size={48} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Who paid">
            <Select value={from} onChange={(e) => setFrom(e.target.value)}>
              {people.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === meId ? `${m.name} (you)` : m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Paid to">
            <Select value={to} onChange={(e) => setTo(e.target.value)}>
              {people.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === meId ? `${m.name} (you)` : m.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label={`Amount (${state?.settings.currency})`}
          hint={
            suggested ? (
              <button type="button" className="underline underline-offset-2 hover:text-fg" onClick={() => setAmount(centsToInput(suggested))}>
                {member(from)?.name} owes {member(to)?.name} {fmt(suggested)} — use this
              </button>
            ) : undefined
          }
        >
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="tabular text-lg" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Bank transfer" />
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  );
}

function ExpenseDetail({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const { member, fmt, meId, api, setDialog } = useGroup();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cat = getCategory(expense.category);
  const Icon = cat.icon;

  async function remove() {
    try {
      await api("DELETE", `/api/expenses/${expense.id}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  const splitLabel = { equal: "split equally", exact: "split by exact amounts", percent: "split by percentage", shares: "split by shares" }[expense.split_type];

  return (
    <Modal
      open
      onClose={onClose}
      title="Expense details"
      footer={
        confirming ? (
          <>
            <span className="mr-auto self-center text-sm text-muted">Delete this expense?</span>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              <Trash2 size={15} /> Delete
            </Button>
            <Button variant="primary" onClick={() => setDialog({ kind: "expense", expense })}>
              <Pencil size={15} /> Edit
            </Button>
          </>
        )
      }
    >
      <div className="flex items-start gap-3">
        <span className="rounded-xl p-2.5" style={{ background: `${cat.color}1f`, color: cat.color }}>
          <Icon size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight">{expense.description}</p>
          <p className="text-2xl font-semibold tabular">{fmt(expense.amount_cents)}</p>
          <p className="mt-1 text-xs text-muted">
            {cat.label} · {formatDate(expense.expense_date)} · {splitLabel}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center gap-2.5 text-sm">
          <Avatar member={member(expense.paid_by)} size={28} />
          <span>
            <b className="font-medium">{expense.paid_by === meId ? "You" : member(expense.paid_by)?.name}</b> paid {fmt(expense.amount_cents)}
          </span>
        </div>
        <ul className="ml-3.5 space-y-2 border-l border-border pl-5">
          {expense.splits.map((s) => (
            <li key={s.member_id} className="flex items-center gap-2.5 text-sm">
              <Avatar member={member(s.member_id)} size={22} />
              <span className="flex-1">
                {s.member_id === meId ? "You" : member(s.member_id)?.name} {s.member_id === meId ? "owe" : "owes"}{" "}
                <span className="tabular">{fmt(s.share_cents)}</span>
              </span>
              {expense.split_type === "percent" && <span className="text-xs text-muted">{s.input_value}%</span>}
              {expense.split_type === "shares" && <span className="text-xs text-muted">{s.input_value} sh</span>}
            </li>
          ))}
        </ul>
      </div>

      {expense.notes && <p className="mt-4 rounded-lg bg-subtle px-3 py-2 text-sm whitespace-pre-wrap">{expense.notes}</p>}
      <p className="mt-4 text-xs text-muted">
        Added {formatDate(expense.created_at, { dateStyle: "medium" } as Intl.DateTimeFormatOptions)}
        {expense.updated_at !== expense.created_at && ` · edited ${formatDate(expense.updated_at, { dateStyle: "medium" } as Intl.DateTimeFormatOptions)}`}
      </p>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  );
}
