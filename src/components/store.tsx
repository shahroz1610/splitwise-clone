"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { groupDebts, type Debt, type MemberStats } from "@/lib/balances";
import { formatMoney } from "@/lib/money";
import type { AuthGate, Expense, GroupState, Member } from "@/lib/types";

export interface SettlePrefill {
  from?: string;
  to?: string;
  amount?: number;
}

type Dialog =
  | { kind: "expense"; expense: Expense | null }
  | { kind: "expense-detail"; expense: Expense }
  | { kind: "settle"; prefill: SettlePrefill }
  | null;

interface Store {
  state: GroupState | null;
  /** Set when the user is signed out or hasn't joined the group yet. */
  gate: AuthGate | null;
  loadError: string | null;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  api: <T = unknown>(method: string, path: string, body?: Record<string, unknown>) => Promise<T>;
  /** The signed-in user's member id. */
  meId: string | null;
  me: Member | null;
  fmt: (cents: number) => string;
  member: (id: string) => Member | undefined;
  activeMembers: Member[];
  stats: Map<string, MemberStats>;
  debts: Debt[];
  dialog: Dialog;
  setDialog: (d: Dialog) => void;
}

const Ctx = createContext<Store | null>(null);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function GroupProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GroupState | null>(null);
  const [gate, setGate] = useState<AuthGate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        setGate(data as AuthGate);
        setState(null);
        setDialog(null);
        setLoadError(null);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not load the group.");
      setState(data);
      setGate(null);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load the group.");
    }
  }, []);

  useEffect(() => {
    // reload() only sets state after the fetch resolves, so this doesn't cascade renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    // Pick up changes made by other people when the tab regains focus.
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  const signOut = useCallback(async () => {
    await fetch("/auth/signout", { method: "POST" });
    await reload();
  }, [reload]);

  const api = useCallback(
    async <T,>(method: string, path: string, body?: Record<string, unknown>): Promise<T> => {
      const started = performance.now();
      const res = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      // Session expired, or this member was removed from the group: re-check access.
      if (res.status === 401 || res.status === 403) await reload();
      if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong.");
      console.log(`[timing] ${method} ${path} ${(performance.now() - started).toFixed(0)}ms`);
      // Refresh in the background so the dialog closes as soon as the save lands.
      void reload();
      return data as T;
    },
    [reload],
  );

  const value = useMemo<Store>(() => {
    const members = state?.members ?? [];
    const byId = new Map(members.map((m) => [m.id, m]));
    const currency = state?.settings.currency ?? "USD";
    const { stats, debts } = groupDebts(
      members.map((m) => m.id),
      state?.expenses ?? [],
      state?.payments ?? [],
      state?.settings.simplify_debts ?? true,
    );
    const meId = state?.viewer.member_id ?? null;
    return {
      state,
      gate,
      loadError,
      reload,
      signOut,
      api,
      meId,
      me: meId ? (byId.get(meId) ?? null) : null,
      fmt: (c: number) => formatMoney(c, currency),
      member: (id: string) => byId.get(id),
      activeMembers: members.filter((m) => !m.archived),
      stats,
      debts,
      dialog,
      setDialog,
    };
  }, [state, gate, loadError, reload, signOut, api, dialog]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGroup(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useGroup must be used inside GroupProvider");
  return s;
}
