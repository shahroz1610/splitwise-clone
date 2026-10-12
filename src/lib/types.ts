export type SplitType = "equal" | "exact" | "percent" | "shares";

export interface Settings {
  group_name: string;
  currency: string;
  simplify_debts: boolean;
}

export interface Member {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  created_at: string;
}

export interface ExpenseSplit {
  member_id: string;
  share_cents: number;
  input_value: number | null;
}

export interface Expense {
  id: string;
  description: string;
  amount_cents: number;
  paid_by: string;
  category: string;
  split_type: SplitType;
  expense_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  splits: ExpenseSplit[];
}

export interface Payment {
  id: string;
  from_member: string;
  to_member: string;
  amount_cents: number;
  payment_date: string;
  note: string | null;
  created_at: string;
}

export interface Activity {
  id: number;
  kind: string;
  message: string;
  actor_name: string | null;
  amount_cents: number | null;
  created_at: string;
}

export interface GroupState {
  settings: Settings;
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
  activity: Activity[];
  /** Whether this browser may make changes (passcode accepted, or no passcode configured). */
  canEdit: boolean;
  passcodeRequired: boolean;
}

/** Payload the client sends to create/update an expense. Shares are computed on the server. */
export interface ExpenseInput {
  description: string;
  amount_cents: number;
  paid_by: string;
  category: string;
  split_type: SplitType;
  expense_date: string;
  notes: string | null;
  /** Participants and their raw input (ignored for "equal"). */
  entries: { member_id: string; value: number }[];
}

export interface PaymentInput {
  from_member: string;
  to_member: string;
  amount_cents: number;
  payment_date: string;
  note: string | null;
}
