import { deleteExpense, saveExpense } from "@/lib/server/expense";
import { mutation } from "@/lib/server/http";

type Ctx = RouteContext<"/api/expenses/[id]">;

export const PUT = mutation<Ctx>(async (body, ctx) => saveExpense((await ctx.params).id, body));

export const DELETE = mutation<Ctx>(async (body, ctx) => {
  await deleteExpense((await ctx.params).id, body.actor);
});
