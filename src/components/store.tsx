"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { groupDebts, type Debt, type MemberStats } from "@/lib/balances";
import { formatMoney } from "@/lib/money";
import type { Expense, GroupState, Member } from "@/lib/types";

const ME_KEY = "split:viewing-as";

export interface SettlePrefill {
  from?: string;
  to?: string;
  amount?: number;
}

type Dialog =
  | { kind: "expense"; expense: Expense | null }
  | { kind: "expense-detail"; expense: Expense }
  | { kind: "settle"; prefill: SettlePrefill }
  | { kind: "unlock" }
  | null;

interface Store {
  state: GroupState | null;
  loadError: string | null;
  reload: () => Promise<void>;
  api: <T = unknown>(method: string, path: string, body?: Record<string, unknown>) => Promise<T>;
  meId: string | null;
  setMeId: (id: string | null) => void;
  me: Member | null;
  fmt: (cents: number) => string;
  member: (id: string) => Member | undefined;
  activeMembers: Member[];
  stats: Map<string, MemberStats>;
  debts: Debt[];
  dialog: Dialog;
  setDialog: (d: Dialog) => void;
  /** Run `fn` if this browser can edit; otherwise ask for the passcode first. */
  requireEdit: (fn: () => void) => void;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  // Only read after mount-time render; the first paint is a loading state, so there's no hydration mismatch.
  const [meId, setMeIdRaw] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(ME_KEY);
    } catch {
      return null;
    }
  });
  const [dialog, setDialog] = useState<Dialog>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the group.");
      setState(data);
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

  const setMeId = useCallback((id: string | null) => {
    setMeIdRaw(id);
    try {
      if (id) localStorage.setItem(ME_KEY, id);
      else localStorage.removeItem(ME_KEY);
    } catch {}
  }, []);

  const api = useCallback(
    async <T,>(method: string, path: string, body?: Record<string, unknown>): Promise<T> => {
      const res = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, actor: meId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setState((s) => (s ? { ...s, canEdit: false } : s));
        setDialog({ kind: "unlock" });
      }
      if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong.");
      await reload();
      return data as T;
    },
    [meId, reload],
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
    const me = meId ? (byId.get(meId) ?? null) : null;
    return {
      state,
      loadError,
      reload,
      api,
      meId: me?.id ?? null,
      setMeId,
      me,
      fmt: (c: number) => formatMoney(c, currency),
      member: (id: string) => byId.get(id),
      activeMembers: members.filter((m) => !m.archived),
      stats,
      debts,
      dialog,
      setDialog,
      requireEdit: (fn) => {
        if (state?.canEdit) fn();
        else setDialog({ kind: "unlock" });
      },
    };
  }, [state, loadError, reload, api, meId, setMeId, dialog]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGroup(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useGroup must be used inside GroupProvider");
  return s;
}
