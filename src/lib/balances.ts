import type { Expense, Payment } from "./types";

/** A single "from owes to" edge, in cents. */
export interface Debt {
  from: string;
  to: string;
  amount: number;
}

export interface MemberStats {
  /** Positive: the group owes this person. Negative: this person owes the group. */
  net: number;
  /** Total this person paid for expenses. */
  paid: number;
  /** Total of this person's shares across expenses. */
  share: number;
  /** Settle-up payments sent and received. */
  sent: number;
  received: number;
}

export function memberStats(memberIds: string[], expenses: Expense[], payments: Payment[]): Map<string, MemberStats> {
  const stats = new Map<string, MemberStats>();
  const get = (id: string) => {
    let s = stats.get(id);
    if (!s) {
      s = { net: 0, paid: 0, share: 0, sent: 0, received: 0 };
      stats.set(id, s);
    }
    return s;
  };
  memberIds.forEach(get);

  for (const e of expenses) {
    const payer = get(e.paid_by);
    payer.paid += e.amount_cents;
    payer.net += e.amount_cents;
    for (const s of e.splits) {
      const m = get(s.member_id);
      m.share += s.share_cents;
      m.net -= s.share_cents;
    }
  }
  for (const p of payments) {
    const from = get(p.from_member);
    const to = get(p.to_member);
    from.sent += p.amount_cents;
    from.net += p.amount_cents;
    to.received += p.amount_cents;
    to.net -= p.amount_cents;
  }
  return stats;
}

/**
 * Who owes whom without simplification: every expense creates a debt from each
 * participant to the payer, then debts between each pair of people are netted.
 */
export function pairwiseDebts(expenses: Expense[], payments: Payment[]): Debt[] {
  // owed[a][b] = how much a owes b (can go negative before netting).
  const owed = new Map<string, number>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  // Stored relative to the lexicographically smaller id: positive means small owes large.
  const add = (debtor: string, creditor: string, amount: number) => {
    if (debtor === creditor || amount === 0) return;
    const k = key(debtor, creditor);
    const sign = debtor < creditor ? 1 : -1;
    owed.set(k, (owed.get(k) ?? 0) + sign * amount);
  };

  for (const e of expenses) {
    for (const s of e.splits) add(s.member_id, e.paid_by, s.share_cents);
  }
  // A payment from A to B is the reverse of a debt: it reduces what A owes B.
  for (const p of payments) add(p.to_member, p.from_member, p.amount_cents);

  const debts: Debt[] = [];
  for (const [k, v] of owed) {
    if (v === 0) continue;
    const [small, large] = k.split("|");
    debts.push(v > 0 ? { from: small, to: large, amount: v } : { from: large, to: small, amount: -v });
  }
  return debts.sort((a, b) => b.amount - a.amount);
}

/**
 * Simplify debts: settle everyone's net balance with as few payments as practical.
 * Greedily matches the largest debtor with the largest creditor, which yields at most n-1 payments.
 */
export function simplifyDebts(nets: Map<string, number>): Debt[] {
  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];
  for (const [id, net] of nets) {
    if (net > 0) creditors.push({ id, amt: net });
    else if (net < 0) debtors.push({ id, amt: -net });
  }
  const byAmt = (a: { amt: number; id: string }, b: { amt: number; id: string }) => b.amt - a.amt || a.id.localeCompare(b.id);
  creditors.sort(byAmt);
  debtors.sort(byAmt);

  const debts: Debt[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amt, creditors[j].amt);
    if (amount > 0) debts.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].amt -= amount;
    creditors[j].amt -= amount;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return debts;
}

export function groupDebts(
  memberIds: string[],
  expenses: Expense[],
  payments: Payment[],
  simplify: boolean,
): { stats: Map<string, MemberStats>; debts: Debt[] } {
  const stats = memberStats(memberIds, expenses, payments);
  const nets = new Map([...stats].map(([id, s]) => [id, s.net]));
  return { stats, debts: simplify ? simplifyDebts(nets) : pairwiseDebts(expenses, payments) };
}
