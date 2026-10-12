import { CURRENCIES } from "@/lib/money";
import { check, HttpError, logActivity, mutation, str } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";

export const PATCH = mutation(async (body) => {
  const update: Record<string, unknown> = {};
  const changes: string[] = [];

  if (body.group_name !== undefined) {
    update.group_name = str(body.group_name, "Group name", { max: 80 });
    changes.push(`renamed the group to “${update.group_name}”`);
  }
  if (body.currency !== undefined) {
    if (typeof body.currency !== "string" || !CURRENCIES.includes(body.currency)) throw new HttpError(400, "Unsupported currency.");
    update.currency = body.currency;
    changes.push(`set the currency to ${body.currency}`);
  }
  if (body.simplify_debts !== undefined) {
    if (typeof body.simplify_debts !== "boolean") throw new HttpError(400, "simplify_debts must be true or false.");
    update.simplify_debts = body.simplify_debts;
    changes.push(`turned ${body.simplify_debts ? "on" : "off"} simplify debts`);
  }
  if (changes.length === 0) return { ok: true };

  update.updated_at = new Date().toISOString();
  check(await db().from("settings").upsert({ id: 1, ...update }));
  const message = changes.join(", ");
  await logActivity({ kind: "settings_updated", message: message[0].toUpperCase() + message.slice(1), actor: body.actor });
});
