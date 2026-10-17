import { connection } from "next/server";
import { getViewer } from "@/lib/server/auth";
import { timed } from "@/lib/server/http-timing";
import { json } from "@/lib/server/http";
import { loadGroup } from "@/lib/server/state";
import type { AuthGate, GroupState } from "@/lib/types";

export async function GET() {
  // Always run at request time; never prerender group data at build.
  // Must stay outside the try so the prerender bail-out isn't swallowed.
  await connection();
  try {
    const viewer = await timed("state viewer", getViewer());
    if (!viewer) return json({ code: "signed_out" } satisfies AuthGate, 401);
    if (!viewer.member) {
      const { email, name, avatar_url } = viewer.user;
      return json({ code: "not_joined", email, name, avatar_url, removed: viewer.removed } satisfies AuthGate, 403);
    }
    const group = await timed("state loadGroup", loadGroup());
    const state: GroupState = {
      ...group,
      viewer: { member_id: viewer.member.id, email: viewer.user.email, name: viewer.user.name, avatar_url: viewer.user.avatar_url },
    };
    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Could not load the group." }, 500);
  }
}
