"use client";

import { Check, KeyRound, LogOut, UserPlus } from "lucide-react";
import { useState } from "react";
import type { AuthGate } from "@/lib/types";
import { useGroup } from "./store";
import { Avatar, Button, Card, cx, ErrorText, Field, Input } from "./ui";

export function AuthScreen({ gate }: { gate: AuthGate }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-fg">S</div>
          <h1 className="text-xl font-semibold tracking-tight">Split</h1>
          <p className="text-sm text-muted">Shared expenses for the group</p>
        </div>
        {gate.code === "signed_out" ? <SignIn /> : <Join gate={gate} />}
      </div>
    </div>
  );
}

function SignIn() {
  // Shown once after a failed OAuth round-trip; read straight from the URL.
  const error = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("auth_error");
  return (
    <Card className="space-y-4 p-6">
      <a
        href="/auth/login"
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-surface text-sm font-medium hover:bg-subtle"
      >
        <GoogleIcon />
        Continue with Google
      </a>
      <p className="text-center text-xs text-muted">First time here? You&apos;ll need the group passcode once after signing in.</p>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

type Claimable = { id: string; name: string; color: string };

function Join({ gate }: { gate: Extract<AuthGate, { code: "not_joined" }> }) {
  const { reload, signOut } = useGroup();
  const [passcode, setPasscode] = useState("");
  const [options, setOptions] = useState<Claimable[] | null>(null);
  const [choice, setChoice] = useState<string>("new");
  const [name, setName] = useState(gate.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: Record<string, unknown>) {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }

  async function checkPasscode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = (await post("/api/join/check", { passcode })) as { members: Claimable[]; suggested_name: string };
      setOptions(data.members);
      // If someone already added a person with the same name, they're probably you.
      const match = data.members.find((m) => m.name.toLowerCase() === gate.name.toLowerCase());
      setChoice(match?.id ?? "new");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check the passcode.");
    } finally {
      setBusy(false);
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/join", choice === "new" ? { passcode, name: name.trim() } : { passcode, member_id: choice });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
      setBusy(false);
    }
  }

  const account = (
    <div className="flex items-center gap-3 border-b border-border pb-4">
      {gate.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={gate.avatar_url} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <Avatar size={36} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{gate.name}</p>
        <p className="truncate text-xs text-muted">{gate.email}</p>
      </div>
      <button onClick={signOut} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-fg" title="Use a different account" aria-label="Sign out">
        <LogOut size={16} />
      </button>
    </div>
  );

  if (gate.removed) {
    return (
      <Card className="space-y-4 p-6">
        {account}
        <p className="text-sm">You were removed from this group.</p>
        <p className="text-sm text-muted">Ask someone in the group to restore you from the People tab, then sign in again.</p>
      </Card>
    );
  }

  if (!options) {
    return (
      <Card className="p-6">
        {account}
        <form onSubmit={checkPasscode} className="space-y-4 pt-4">
          <div className="flex gap-3 text-sm text-muted">
            <KeyRound size={18} className="mt-0.5 shrink-0" />
            <span>Enter the group passcode to join. You only need to do this once — next time, just sign in with Google.</span>
          </div>
          <Input type="password" autoFocus value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Group passcode" autoComplete="off" />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !passcode}>
            {busy ? "Checking…" : "Continue"}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {account}
      <form onSubmit={join} className="space-y-4 pt-4">
        <p className="text-sm font-medium">{options.length ? "Which one is you?" : "Join the group"}</p>
        <ul className="space-y-1.5">
          {options.map((m) => (
            <li key={m.id}>
              <Choice selected={choice === m.id} onClick={() => setChoice(m.id)}>
                <Avatar member={{ ...m, archived: false, created_at: "", email: null, avatar_url: null, linked: false }} size={26} />
                <span className="flex-1 text-sm">{m.name}</span>
              </Choice>
            </li>
          ))}
          <li>
            <Choice selected={choice === "new"} onClick={() => setChoice("new")}>
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-subtle text-muted">
                <UserPlus size={14} />
              </span>
              <span className="flex-1 text-sm">{options.length ? "I'm not listed — add me" : "Add me to the group"}</span>
            </Choice>
          </li>
        </ul>
        {choice === "new" && (
          <Field label="Your name in the group">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="primary" className="w-full" disabled={busy || (choice === "new" && !name.trim())}>
          {busy ? "Joining…" : "Join group"}
        </Button>
      </form>
    </Card>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
        selected ? "border-fg bg-subtle" : "border-border hover:bg-subtle",
      )}
    >
      {children}
      {selected && <Check size={16} />}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
