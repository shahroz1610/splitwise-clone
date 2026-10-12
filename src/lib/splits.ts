import type { SplitType } from "./types";

export type SplitResult =
  | { ok: true; shares: { member_id: string; share_cents: number; input_value: number | null }[] }
  | { ok: false; error: string };

/**
 * Distribute `total` cents proportionally to `weights` using the largest-remainder method,
 * so the parts always add up to exactly `total`.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map(Math.floor);
  let remainder = total - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    parts[order[k].i] += 1;
  }
  return parts;
}

/** Turn the form's per-person inputs into exact cent shares for an expense. */
export function computeSplits(
  amountCents: number,
  type: SplitType,
  entries: { member_id: string; value: number }[],
): SplitResult {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  if (entries.length === 0) return { ok: false, error: "Choose at least one person to split with." };
  const ids = new Set(entries.map((e) => e.member_id));
  if (ids.size !== entries.length) return { ok: false, error: "A person appears twice in the split." };

  switch (type) {
    case "equal": {
      const parts = allocate(amountCents, entries.map(() => 1));
      return {
        ok: true,
        shares: entries.map((e, i) => ({ member_id: e.member_id, share_cents: parts[i], input_value: null })),
      };
    }
    case "exact": {
      const cents = entries.map((e) => Math.round(e.value * 100));
      if (cents.some((c) => !Number.isFinite(c) || c < 0)) return { ok: false, error: "Amounts can't be negative." };
      const sum = cents.reduce((a, b) => a + b, 0);
      if (sum !== amountCents) {
        const diff = amountCents - sum;
        return {
          ok: false,
          error: `Amounts add up to ${(sum / 100).toFixed(2)}, ${(Math.abs(diff) / 100).toFixed(2)} ${diff > 0 ? "short of" : "over"} the total.`,
        };
      }
      return {
        ok: true,
        shares: entries.map((e, i) => ({ member_id: e.member_id, share_cents: cents[i], input_value: cents[i] / 100 })),
      };
    }
    case "percent": {
      if (entries.some((e) => !Number.isFinite(e.value) || e.value < 0)) {
        return { ok: false, error: "Percentages can't be negative." };
      }
      const sum = entries.reduce((a, e) => a + e.value, 0);
      if (Math.abs(sum - 100) > 0.001) {
        return { ok: false, error: `Percentages add up to ${round2(sum)}%, they need to total 100%.` };
      }
      const parts = allocate(amountCents, entries.map((e) => e.value));
      return {
        ok: true,
        shares: entries.map((e, i) => ({ member_id: e.member_id, share_cents: parts[i], input_value: e.value })),
      };
    }
    case "shares": {
      if (entries.some((e) => !Number.isFinite(e.value) || e.value < 0)) {
        return { ok: false, error: "Shares can't be negative." };
      }
      const sum = entries.reduce((a, e) => a + e.value, 0);
      if (sum <= 0) return { ok: false, error: "Give at least one person a share." };
      const parts = allocate(amountCents, entries.map((e) => e.value));
      return {
        ok: true,
        shares: entries.map((e, i) => ({ member_id: e.member_id, share_cents: parts[i], input_value: e.value })),
      };
    }
    default:
      return { ok: false, error: "Unknown split type." };
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
