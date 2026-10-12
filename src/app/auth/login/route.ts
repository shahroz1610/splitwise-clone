import { NextResponse } from "next/server";
import { authClient } from "@/lib/server/auth";

/** Start Google sign-in. The PKCE verifier is stored in a cookie by the Supabase client. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const supabase = await authClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback`, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error?.message ?? "Could not start sign-in")}`);
  }
  return NextResponse.redirect(data.url);
}
