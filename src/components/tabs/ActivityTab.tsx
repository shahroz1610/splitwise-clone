"use client";

import { Activity as ActivityIcon, Banknote, Pencil, Plus, Settings, Trash2, UserCog } from "lucide-react";
import { useGroup } from "../store";
import { Card, Empty } from "../ui";

const ICONS: Record<string, typeof Plus> = {
  expense_added: Plus,
  expense_updated: Pencil,
  expense_deleted: Trash2,
  payment_added: Banknote,
  payment_deleted: Trash2,
  member_added: UserCog,
  member_updated: UserCog,
  member_removed: UserCog,
  settings_updated: Settings,
};

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ActivityTab() {
  const { state } = useGroup();
  const items = state!.activity;
  if (items.length === 0) {
    return (
      <Card>
        <Empty icon={<ActivityIcon size={22} />} title="No activity yet">
          Changes to expenses, payments and people will show up here.
        </Empty>
      </Card>
    );
  }
  return (
    <Card className="divide-y divide-border">
      {items.map((a) => {
        const Icon = ICONS[a.kind] ?? ActivityIcon;
        const destructive = a.kind.endsWith("deleted");
        return (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-0.5 rounded-lg p-1.5 ${destructive ? "bg-owe-soft text-owe" : a.kind.startsWith("payment") ? "bg-owed-soft text-owed" : "bg-subtle text-muted"}`}>
              <Icon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{a.message}</p>
              <p className="text-xs text-muted">
                {a.actor_name ? `by ${a.actor_name} · ` : ""}
                <time dateTime={a.created_at} title={new Date(a.created_at).toLocaleString()}>
                  {timeAgo(a.created_at)}
                </time>
              </p>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
