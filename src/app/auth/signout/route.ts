import { authClient } from "@/lib/server/auth";

export async function POST() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}
