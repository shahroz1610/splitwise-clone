"use client";

import { Archive, Check, Pencil, RotateCcw, Trash2, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { useGroup } from "../store";
import { Avatar, Button, Card, cx, Empty, ErrorText, Input } from "../ui";

export function PeopleTab() {
  const { state, stats, fmt, api, requireEdit, meId } = useGroup();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = state!.members.filter((m) => !m.archived);
  const archived = state!.members.filter((m) => m.archived);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    requireEdit(async () => {
      setBusy(true);
      setError(null);
      try {
        await api("POST", "/api/members", { name: name.trim() });
        setName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add.");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <form onSubmit={add} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a person by name" maxLength={60} />
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            <UserPlus size={16} /> Add
          </Button>
        </form>
        {error && (
          <div className="mt-3">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </Card>

      {active.length === 0 ? (
        <Card>
          <Empty icon={<Users size={22} />} title="No one here yet">
            Add everyone who shares expenses in this group.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.map((m) => {
            const s = stats.get(m.id) ?? { net: 0, paid: 0, share: 0, sent: 0, received: 0 };
            return <PersonCard key={m.id} id={m.id} isMe={m.id === meId} net={s.net} paid={s.paid} share={s.share} fmt={fmt} />;
          })}
        </div>
      )}

      {archived.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Former members</h3>
          <Card className="divide-y divide-border">
            {archived.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar member={m} size={26} />
                <span className="flex-1 text-sm text-muted">{m.name}</span>
                <Button size="sm" variant="ghost" onClick={() => requireEdit(() => api("PATCH", `/api/members/${m.id}`, { archived: false }).catch(() => {}))}>
                  <RotateCcw size={14} /> Restore
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function PersonCard({ id, isMe, net, paid, share, fmt }: { id: string; isMe: boolean; net: number; paid: number; share: number; fmt: (c: number) => string }) {
  const { member, api, requireEdit, state } = useGroup();
  const m = member(id)!;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(m.name);
  const [error, setError] = useState<string | null>(null);

  const referenced =
    state!.expenses.some((e) => e.paid_by === id || e.splits.some((s) => s.member_id === id)) ||
    state!.payments.some((p) => p.from_member === id || p.to_member === id);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar member={m} size={40} />
        {editing ? (
          <form
            className="flex flex-1 gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api("PATCH", `/api/members/${id}`, { name });
                setEditing(false);
              });
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-9" maxLength={60} />
            <Button size="sm" type="submit" variant="primary" className="h-9" aria-label="Save name">
              <Check size={15} />
            </Button>
            <Button size="sm" type="button" variant="ghost" className="h-9" onClick={() => (setEditing(false), setName(m.name))} aria-label="Cancel">
              <X size={15} />
            </Button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {m.name}
                {isMe && <span className="font-normal text-muted"> (you)</span>}
              </p>
              <p className={cx("text-sm tabular", net > 0 ? "text-owed" : net < 0 ? "text-owe" : "text-muted")}>
                {net === 0 ? "Settled up" : net > 0 ? `Gets back ${fmt(net)}` : `Owes ${fmt(-net)}`}
              </p>
            </div>
            <button onClick={() => requireEdit(() => setEditing(true))} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-fg" aria-label={`Rename ${m.name}`}>
              <Pencil size={15} />
            </button>
            {referenced ? (
              <button
                onClick={() => requireEdit(() => run(() => api("PATCH", `/api/members/${id}`, { archived: true })))}
                disabled={net !== 0}
                title={net !== 0 ? "Settle up before removing" : "Remove from group (keeps history)"}
                className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-fg disabled:opacity-30"
                aria-label={`Archive ${m.name}`}
              >
                <Archive size={15} />
              </button>
            ) : (
              <button
                onClick={() => requireEdit(() => run(() => api("DELETE", `/api/members/${id}`)))}
                className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-danger"
                aria-label={`Delete ${m.name}`}
              >
                <Trash2 size={15} />
              </button>
            )}
          </>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
        <div>
          <p className="text-muted">Paid</p>
          <p className="font-medium tabular">{fmt(paid)}</p>
        </div>
        <div>
          <p className="text-muted">Share of expenses</p>
          <p className="font-medium tabular">{fmt(share)}</p>
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Card>
  );
}
