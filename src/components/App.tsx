"use client";

import { Activity, BarChart3, LogOut, Plus, Receipt, Scale, Settings, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialogs } from "./Dialogs";
import { GroupProvider, useGroup } from "./store";
import { ActivityTab } from "./tabs/ActivityTab";
import { BalancesTab } from "./tabs/BalancesTab";
import { ExpensesTab } from "./tabs/ExpensesTab";
import { InsightsTab } from "./tabs/InsightsTab";
import { PeopleTab } from "./tabs/PeopleTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { AuthScreen } from "./AuthScreen";
import { Avatar, Button, Card, cx } from "./ui";

const TABS = [
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "balances", label: "Balances", icon: Scale },
  { id: "people", label: "People", icon: Users },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function App() {
  return (
    <GroupProvider>
      <Shell />
      <Dialogs />
    </GroupProvider>
  );
}

function useHashTab(): [TabId, (t: TabId) => void] {
  const [tab, setTab] = useState<TabId>("expenses");
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as TabId;
      setTab(TABS.some((t) => t.id === h) ? h : "expenses");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return [tab, (t) => (window.location.hash = t)];
}

function Shell() {
  const { state, gate, loadError, reload, setDialog, activeMembers } = useGroup();
  const [tab, setTab] = useHashTab();

  if (gate) return <AuthScreen gate={gate} />;

  if (!state) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        {loadError ? (
          <Card className="max-w-md p-6 text-center">
            <p className="font-medium">Couldn&apos;t load the group</p>
            <p className="mt-1 text-sm text-muted">{loadError}</p>
            <Button className="mt-4" onClick={reload}>
              Try again
            </Button>
          </Card>
        ) : (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-fg" aria-label="Loading" />
        )}
      </div>
    );
  }

  const addExpense = () =>
    (activeMembers.length ? setDialog({ kind: "expense", expense: null }) : setTab("people"));
  const settleUp = () => setDialog({ kind: "settle", prefill: {} });

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 sm:px-6 sm:pb-12">
      <Header onAdd={addExpense} onSettle={settleUp} />
      <Summary />

      <nav className="-mx-4 mb-5 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                tab === t.id ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {tab === "expenses" && <ExpensesTab onAdd={addExpense} />}
      {tab === "balances" && <BalancesTab />}
      {tab === "people" && <PeopleTab />}
      {tab === "activity" && <ActivityTab />}
      {tab === "insights" && <InsightsTab />}
      {tab === "settings" && <SettingsTab />}

      {/* Mobile quick actions */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border bg-surface/90 p-3 backdrop-blur sm:hidden">
        <Button className="flex-1" onClick={settleUp}>
          Settle up
        </Button>
        <Button className="flex-1" variant="primary" onClick={addExpense}>
          <Plus size={16} /> Add expense
        </Button>
      </div>
    </div>
  );
}

function Header({ onAdd, onSettle }: { onAdd: () => void; onSettle: () => void }) {
  const { state, activeMembers, me, signOut } = useGroup();
  const s = state!;

  return (
    <header className="flex flex-wrap items-center gap-3 py-5 sm:py-7">
      <div className="mr-auto min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{s.settings.group_name}</h1>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {activeMembers.slice(0, 6).map((m) => (
              <span key={m.id} className="rounded-full ring-2 ring-bg">
                <Avatar member={m} size={22} />
              </span>
            ))}
          </div>
          <span className="text-xs text-muted">
            {activeMembers.length} {activeMembers.length === 1 ? "person" : "people"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pr-1 pl-1">
          <Avatar member={me} size={28} />
          <span className="hidden max-w-32 truncate text-[13px] font-medium md:inline">{me?.name}</span>
          <button onClick={signOut} className="rounded-full p-1.5 text-muted hover:bg-subtle hover:text-fg" title={`Sign out ${s.viewer.email}`} aria-label="Sign out">
            <LogOut size={15} />
          </button>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Button onClick={onSettle}>Settle up</Button>
          <Button variant="primary" onClick={onAdd}>
            <Plus size={16} /> Add expense
          </Button>
        </div>
      </div>
    </header>
  );
}

function Summary() {
  const { state, me, stats, debts, fmt } = useGroup();
  const s = state!;
  const total = s.expenses.reduce((a, e) => a + e.amount_cents, 0);

  if (me) {
    const net = stats.get(me.id)?.net ?? 0;
    const owe = debts.filter((d) => d.from === me.id).reduce((a, d) => a + d.amount, 0);
    const owed = debts.filter((d) => d.to === me.id).reduce((a, d) => a + d.amount, 0);
    return (
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Your balance" value={net === 0 ? "Settled up" : `${net > 0 ? "+" : "−"}${fmt(Math.abs(net))}`} tone={net > 0 ? "owed" : net < 0 ? "owe" : undefined} />
        <Stat label="You owe" value={fmt(owe)} tone={owe ? "owe" : undefined} />
        <Stat label="You are owed" value={fmt(owed)} tone={owed ? "owed" : undefined} />
        <Stat label="Your total share" value={fmt(stats.get(me.id)?.share ?? 0)} sub={`of ${fmt(total)} group spend`} />
      </div>
    );
  }

  const outstanding = debts.reduce((a, d) => a + d.amount, 0);
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Total group spend" value={fmt(total)} />
      <Stat label="Expenses" value={String(s.expenses.length)} />
      <Stat label="Outstanding" value={fmt(outstanding)} tone={outstanding ? "owe" : undefined} />
      <Stat label="Payments to settle" value={String(debts.length)} sub={s.settings.simplify_debts ? "debts simplified" : "not simplified"} />
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "owe" | "owed"; sub?: string }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cx("mt-0.5 truncate text-lg font-semibold tabular", tone === "owe" && "text-owe", tone === "owed" && "text-owed")}>{value}</p>
      {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
    </Card>
  );
}
