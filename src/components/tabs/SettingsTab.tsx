"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { CURRENCIES } from "@/lib/money";
import { useGroup } from "../store";
import { Avatar, Button, Card, ErrorText, Field, Input, Select, Toggle } from "../ui";

export function SettingsTab() {
  const { state, api, me, signOut } = useGroup();
  const s = state!.settings;
  const [name, setName] = useState(s.group_name);
  const [currency, setCurrency] = useState(s.currency);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const dirty = name.trim() !== s.group_name || currency !== s.currency;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const patch: Record<string, unknown> = {};
      if (name.trim() !== s.group_name) patch.group_name = name.trim();
      if (currency !== s.currency) patch.currency = currency;
      await api("PATCH", "/api/settings", patch);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-5">
      <Card className="p-5">
        <form onSubmit={save} className="space-y-4">
          <Field label="Group name">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Currency" hint="Changing the currency only changes how amounts are shown — it doesn't convert them.">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex items-center justify-end gap-3">
            {saved && !dirty && <span className="text-sm text-owed">Saved</span>}
            <Button type="submit" variant="primary" disabled={!dirty || busy || !name.trim()}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card className="flex items-center gap-4 p-5">
        <div className="flex-1">
          <p className="text-sm font-medium">Simplify debts</p>
          <p className="text-xs text-muted">Minimise the number of payments needed to settle the group.</p>
        </div>
        <Toggle checked={s.simplify_debts} label="Simplify debts" onChange={(v) => api("PATCH", "/api/settings", { simplify_debts: v }).catch(() => {})} />
      </Card>

      <Card className="flex items-center gap-4 p-5">
        {state!.viewer.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state!.viewer.avatar_url} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <Avatar member={me} size={40} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{state!.viewer.email}</p>
          <p className="text-xs text-muted">
            Signed in with Google as <b className="font-medium text-fg">{me?.name}</b>. New people need the group passcode the first time they sign in.
          </p>
        </div>
        <Button onClick={signOut}>
          <LogOut size={15} /> Sign out
        </Button>
      </Card>
    </div>
  );
}
