"use client";

import { ArrowRight, PartyPopper, Sparkles } from "lucide-react";
import { useState } from "react";
import { pairwiseDebts } from "@/lib/balances";
import { useGroup } from "../store";
import { Avatar, Button, Card, cx, Empty, Toggle } from "../ui";

export function BalancesTab() {
  const { state, members, stats, debts, fmt, member, meId, api, requireEdit, setDialog } = useBalances();
  const [busy, setBusy] = useState(false);
  const simplify = state.settings.simplify_debts;
  const unsimplifiedCount = pairwiseDebts(state.expenses, state.payments).length;
  const maxAbs = Math.max(1, ...members.map((m) => Math.abs(stats.get(m.id)?.net ?? 0)));

  async function toggleSimplify(v: boolean) {
    requireEdit(async () => {
      setBusy(true);
      try {
        await api("PATCH", "/api/settings", { simplify_debts: v });
      } finally {
        setBusy(false);
      }
    });
  }

  const sortedDebts = meId ? [...debts].sort((a, b) => Number(b.from === meId || b.to === meId) - Number(a.from === meId || a.to === meId)) : debts;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        <Card className="flex items-start gap-3 p-4">
          <span className="rounded-lg bg-subtle p-2 text-fg">
            <Sparkles size={18} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">Simplify debts</p>
            <p className="text-xs text-muted">
              Combines debts so everyone settles with the fewest payments. Nobody ends up paying more in total.
              {simplify && unsimplifiedCount > debts.length && (
                <> Currently saving {unsimplifiedCount - debts.length} payment{unsimplifiedCount - debts.length === 1 ? "" : "s"}.</>
              )}
            </p>
          </div>
          <div className={cx(busy && "opacity-50")}>
            <Toggle checked={simplify} onChange={toggleSimplify} label="Simplify debts" />
          </div>
        </Card>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Who owes whom</h3>
          <Card className="divide-y divide-border">
            {sortedDebts.length === 0 ? (
              <Empty icon={<PartyPopper size={22} />} title="Everyone is settled up" />
            ) : (
              sortedDebts.map((d) => {
                const mine = d.from === meId || d.to === meId;
                return (
                  <div key={`${d.from}-${d.to}`} className={cx("flex items-center gap-3 px-4 py-3", meId && !mine && "opacity-60")}>
                    <Avatar member={member(d.from)} size={30} />
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{d.from === meId ? "You" : member(d.from)?.name}</span>
                      <span className="text-muted"> {d.from === meId ? "owe" : "owes"} </span>
                      <span className="font-medium">{d.to === meId ? "you" : member(d.to)?.name}</span>
                      <p className="text-base font-semibold text-owe tabular">{fmt(d.amount)}</p>
                    </div>
                    <ArrowRight size={16} className="hidden text-muted sm:block" />
                    <Avatar member={member(d.to)} size={30} />
                    <Button
                      size="sm"
                      className="ml-1"
                      onClick={() => requireEdit(() => setDialog({ kind: "settle", prefill: { from: d.from, to: d.to, amount: d.amount } }))}
                    >
                      Settle
                    </Button>
                  </div>
                );
              })
            )}
          </Card>
        </section>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Total balances</h3>
        <Card className="divide-y divide-border">
          {members.map((m) => {
            const net = stats.get(m.id)?.net ?? 0;
            return (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar member={m} size={26} />
                  <span className="flex-1 truncate text-sm">
                    {m.name}
                    {m.id === meId && <span className="text-muted"> (you)</span>}
                  </span>
                  <span className={cx("text-sm font-medium tabular", net > 0 ? "text-owed" : net < 0 ? "text-owe" : "text-muted")}>
                    {net === 0 ? "settled" : `${net > 0 ? "gets back" : "owes"} ${fmt(Math.abs(net))}`}
                  </span>
                </div>
                <div className="relative mt-2 h-1.5 rounded-full bg-subtle">
                  <div className="absolute top-0 left-1/2 h-full w-px bg-border" />
                  {net !== 0 && (
                    <div
                      className={cx("absolute top-0 h-full rounded-full", net > 0 ? "left-1/2 bg-owed" : "right-1/2 bg-owe")}
                      style={{ width: `${(Math.abs(net) / maxAbs) * 50}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      </section>
    </div>
  );
}

function useBalances() {
  const g = useGroup();
  // Show active people plus archived people who still have a non-zero balance (shouldn't happen, but be safe).
  const members = g.state!.members.filter((m) => !m.archived || (g.stats.get(m.id)?.net ?? 0) !== 0);
  return { ...g, state: g.state!, members };
}
