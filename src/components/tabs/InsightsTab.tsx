"use client";

import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORIES } from "@/lib/categories";
import { useGroup } from "../store";
import { Card, cx, Empty, formatDate } from "../ui";

const RANGES = [
  { id: "all", label: "All time" },
  { id: "12m", label: "12 months" },
  { id: "3m", label: "3 months" },
  { id: "1m", label: "This month" },
] as const;

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--fg)",
};

export function InsightsTab() {
  const { state, fmt, meId } = useGroup();
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("all");
  const [scope, setScope] = useState<"group" | "me">("group");
  const mine = scope === "me" && meId;

  const expenses = useMemo(() => {
    const now = new Date();
    const cutoff =
      range === "all"
        ? ""
        : range === "1m"
          ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
          : (() => {
              const d = new Date(now.getFullYear(), now.getMonth() - (range === "12m" ? 11 : 2), 1);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
            })();
    return state!.expenses.filter((e) => e.expense_date >= cutoff);
  }, [state, range]);

  // When looking at "me", count only my share of each expense.
  const amountOf = (e: (typeof expenses)[number]) => (mine ? (e.splits.find((s) => s.member_id === meId)?.share_cents ?? 0) : e.amount_cents);

  const byCategory = CATEGORIES.map((c) => ({
    name: c.label,
    color: c.color,
    value: expenses.filter((e) => e.category === c.id).reduce((a, e) => a + amountOf(e), 0),
  }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = byCategory.reduce((a, c) => a + c.value, 0);

  const byMonth = (() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.expense_date.slice(0, 7), (map.get(e.expense_date.slice(0, 7)) ?? 0) + amountOf(e));
    return [...map]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([m, v]) => ({ month: formatDate(`${m}-01`, { month: "short", year: "2-digit" }), value: v / 100 }));
  })();

  const byPerson = state!.members
    .map((m) => ({
      name: m.name,
      paid: expenses.filter((e) => e.paid_by === m.id).reduce((a, e) => a + e.amount_cents, 0) / 100,
      share: expenses.reduce((a, e) => a + (e.splits.find((s) => s.member_id === m.id)?.share_cents ?? 0), 0) / 100,
    }))
    .filter((p) => p.paid || p.share);

  if (state!.expenses.length === 0) {
    return (
      <Card>
        <Empty icon={<BarChart3 size={22} />} title="Nothing to chart yet">
          Add a few expenses to see where the money goes.
        </Empty>
      </Card>
    );
  }

  const money = (v: number) => fmt(Math.round(v * 100));

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-2 md:flex-row md:flex-wrap">
        <Segmented options={RANGES.map((r) => ({ id: r.id, label: r.label }))} value={range} onChange={(v) => setRange(v as typeof range)} />
        {meId && (
          <Segmented
            options={[
              { id: "group", label: "Whole group" },
              { id: "me", label: "My share" },
            ]}
            value={scope}
            onChange={(v) => setScope(v as typeof scope)}
          />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="min-w-0 p-4">
          <h3 className="text-sm font-medium">Spending by category</h3>
          <p className="text-xs text-muted">{fmt(total)} total</p>
          {total === 0 ? (
            <p className="py-16 text-center text-sm text-muted">No spending in this range.</p>
          ) : (
            <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={1.5} stroke="var(--surface)" animationDuration={500}>
                      {byCategory.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-1.5 text-sm">
                {byCategory.map((c) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted">{Math.round((c.value / total) * 100)}%</span>
                    <span className="w-20 text-right tabular">{fmt(c.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="min-w-0 overflow-hidden p-4">
          <h3 className="text-sm font-medium">Monthly spending</h3>
          <p className="text-xs text-muted">{mine ? "Your share per month" : "Group total per month"}</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer>
              <BarChart data={byMonth} margin={{ left: -10, right: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted)" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted)" width={56} tickFormatter={(v) => compact(v)} />
                <Tooltip formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: "var(--subtle)" }} />
                <Bar dataKey="value" name="Spent" fill="var(--fg)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden p-4">
        <h3 className="text-sm font-medium">Paid vs. share, per person</h3>
        <p className="text-xs text-muted">People who paid more than their share are owed the difference.</p>
        <div className="mt-3" style={{ height: Math.max(160, byPerson.length * 52) }}>
          <ResponsiveContainer>
            <BarChart data={byPerson} layout="vertical" margin={{ left: 0, right: 12 }} barGap={2}>
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted)" tickFormatter={(v) => compact(v)} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted)" width={80} />
              <Tooltip formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: "var(--subtle)" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="paid" name="Paid" fill="var(--owed)" radius={[0, 4, 4, 0]} maxBarSize={16} />
              <Bar dataKey="share" name="Share" fill="var(--muted)" radius={[0, 4, 4, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function compact(v: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

function Segmented({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex shrink-0 rounded-lg bg-subtle p-1 text-[13px]">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cx("min-h-9 rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition-colors", value === o.id ? "bg-surface shadow-sm" : "text-muted hover:text-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
