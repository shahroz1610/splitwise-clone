import { NextResponse } from "next/server";
import { authClient } from "@/lib/server/auth";

/** Google redirects back here (via Supabase) with a one-time code we swap for a session cookie. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error_description");
  if (!code) {
    return NextResponse.redirect(`${url.origin}/?auth_error=${encodeURIComponent(providerError ?? "Sign-in was cancelled")}`);
  }
  const supabase = await authClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${url.origin}/?auth_error=${encodeURIComponent(error.message)}`);
  return NextResponse.redirect(`${url.origin}/`);
}
