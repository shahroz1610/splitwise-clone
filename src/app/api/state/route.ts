import { connection } from "next/server";
import { canEdit, passcodeRequired } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { loadGroup } from "@/lib/server/state";
import type { GroupState } from "@/lib/types";

export async function GET() {
  // Always run at request time; never prerender group data at build.
  // Must stay outside the try so the prerender bail-out isn't swallowed.
  await connection();
  try {
    const editable = await canEdit();
    const group = await loadGroup();
    const state: GroupState = { ...group, canEdit: editable, passcodeRequired: passcodeRequired() };
    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Could not load the group." }, 500);
  }
}
