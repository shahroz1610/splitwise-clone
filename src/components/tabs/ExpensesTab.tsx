"use client";

import { Banknote, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORIES, getCategory } from "@/lib/categories";
import type { Expense, Payment } from "@/lib/types";
import { useGroup } from "../store";
import { Button, Card, cx, Empty, Input, Select, formatDate } from "../ui";

type Row = { kind: "expense"; date: string; created: string; item: Expense } | { kind: "payment"; date: string; created: string; item: Payment };

export function ExpensesTab({ onAdd }: { onAdd: () => void }) {
  const { state, member } = useGroup();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [personId, setPersonId] = useState("all");

  const months = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows: Row[] = [
      ...state!.expenses.map((e) => ({ kind: "expense" as const, date: e.expense_date, created: e.created_at, item: e })),
      ...(category === "all" ? state!.payments.map((p) => ({ kind: "payment" as const, date: p.payment_date, created: p.created_at, item: p })) : []),
    ]
      .filter((r) => {
        if (r.kind === "expense") {
          const e = r.item;
          if (category !== "all" && e.category !== category) return false;
          if (personId !== "all" && e.paid_by !== personId && !e.splits.some((s) => s.member_id === personId)) return false;
          if (q && !e.description.toLowerCase().includes(q) && !(e.notes ?? "").toLowerCase().includes(q)) return false;
        } else {
          const p = r.item;
          if (personId !== "all" && p.from_member !== personId && p.to_member !== personId) return false;
          if (q) {
            const text = `${member(p.from_member)?.name} ${member(p.to_member)?.name} ${p.note ?? ""} payment settle`.toLowerCase();
            if (!text.includes(q)) return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created));

    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.date.slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return [...groups];
  }, [state, query, category, personId, member]);

  const hasAny = state!.expenses.length + state!.payments.length > 0;

  if (!hasAny) {
    return (
      <Card>
        <Empty icon={<Receipt size={22} />} title="No expenses yet">
          {state!.members.length === 0 ? "Start by adding people in the People tab." : "Add the first shared expense to start tracking balances."}
          <div className="mt-4">
            <Button variant="primary" onClick={onAdd}>
              <Plus size={16} /> Add expense
            </Button>
          </div>
        </Empty>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_11rem_11rem]">
        <div className="relative col-span-2 sm:col-span-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search expenses" className="pl-9" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label="Filter by person">
          <option value="all">Everyone</option>
          {state!.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>

      {months.length === 0 && <p className="py-10 text-center text-sm text-muted">Nothing matches those filters.</p>}

      {months.map(([month, rows]) => (
        <section key={month}>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            {formatDate(`${month}-01`, { month: "long", year: "numeric" })}
          </h3>
          <Card className="divide-y divide-border overflow-hidden">
            {rows.map((r) => (r.kind === "expense" ? <ExpenseRow key={r.item.id} e={r.item} /> : <PaymentRow key={r.item.id} p={r.item} />))}
          </Card>
        </section>
      ))}
    </div>
  );
}

function DateBadge({ date }: { date: string }) {
  return (
    <div className="w-9 shrink-0 text-center leading-none text-muted">
      <div className="text-[10px] uppercase">{formatDate(date, { month: "short" })}</div>
      <div className="mt-0.5 text-base font-medium text-fg tabular">{formatDate(date, { day: "numeric" })}</div>
    </div>
  );
}

function ExpenseRow({ e }: { e: Expense }) {
  const { member, meId, fmt, setDialog } = useGroup();
  const cat = getCategory(e.category);
  const Icon = cat.icon;
  const payer = member(e.paid_by);

  // How this expense affects the person we're viewing as.
  let right: { label: string; amount?: number; tone?: "owe" | "owed" } = { label: "" };
  if (meId) {
    const myShare = e.splits.find((s) => s.member_id === meId)?.share_cents ?? 0;
    if (e.paid_by === meId) {
      const lent = e.amount_cents - myShare;
      right = lent > 0 ? { label: "you lent", amount: lent, tone: "owed" } : { label: "just you" };
    } else if (myShare > 0) {
      right = { label: `you borrowed`, amount: myShare, tone: "owe" };
    } else {
      right = { label: "not involved" };
    }
  }

  return (
    <button onClick={() => setDialog({ kind: "expense-detail", expense: e })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle/60">
      <DateBadge date={e.expense_date} />
      <span className="rounded-lg p-2" style={{ background: `${cat.color}1f`, color: cat.color }}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{e.description}</p>
        <p className="truncate text-xs text-muted">
          {e.paid_by === meId ? "You" : payer?.name} paid <span className="tabular">{fmt(e.amount_cents)}</span>
        </p>
      </div>
      {meId ? (
        <div className="shrink-0 text-right">
          <p className={cx("text-[11px]", right.tone === "owe" ? "text-owe" : right.tone === "owed" ? "text-owed" : "text-muted")}>{right.label}</p>
          {right.amount !== undefined && (
            <p className={cx("text-sm font-medium tabular", right.tone === "owe" ? "text-owe" : "text-owed")}>{fmt(right.amount)}</p>
          )}
        </div>
      ) : (
        <p className="shrink-0 text-sm font-medium tabular">{fmt(e.amount_cents)}</p>
      )}
    </button>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  const { member, meId, fmt, api } = useGroup();
  const [confirm, setConfirm] = useState(false);
  const name = (id: string) => (id === meId ? "You" : member(id)?.name ?? "?");
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <DateBadge date={p.payment_date} />
      <span className="rounded-lg bg-owed-soft p-2 text-owed">
        <Banknote size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <b className="font-medium">{name(p.from_member)}</b> paid <b className="font-medium">{name(p.to_member) === "You" ? "you" : name(p.to_member)}</b>{" "}
          <span className="tabular">{fmt(p.amount_cents)}</span>
        </p>
        {p.note && <p className="truncate text-xs text-muted">{p.note}</p>}
      </div>
      {confirm ? (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            Keep
          </Button>
          <Button size="sm" variant="danger" onClick={() => api("DELETE", `/api/payments/${p.id}`).catch(() => {})}>
            Delete
          </Button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-danger" aria-label="Delete payment">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
