import { saveExpense } from "@/lib/server/expense";
import { mutation } from "@/lib/server/http";

export const POST = mutation(async (body) => saveExpense(null, body));
