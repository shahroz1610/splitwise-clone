import "server-only";
import { authClient } from "./auth";
import { HttpError, json } from "./http";

/** A failed email/password attempt. `code` lets the client switch screens without parsing the message. */
export class EmailAuthError extends HttpError {
  constructor(
    status: number,
    message: string,
    public code?: "email_not_confirmed" | "email_taken",
  ) {
    super(status, message);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(value: unknown): string {
  if (typeof value !== "string") throw new HttpError(400, "Enter a valid email address.");
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL.test(email)) throw new HttpError(400, "Enter a valid email address.");
  return email;
}

/** Supabase Auth stores this with bcrypt and ignores bytes after 72, so reject those up front. */
export function parsePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  if (value.length > 72) throw new HttpError(400, "Password must be at most 72 characters.");
  return value;
}

export function parseCode(value: unknown): string {
  if (typeof value !== "string" || !/^\d{6}$/.test(value.trim())) {
    throw new HttpError(400, "Enter the 6-digit code from your email.");
  }
  return value.trim();
}

function mapAuthError(error: { message: string; status?: number }): EmailAuthError {
  const message = error.message || "Something went wrong.";
  const m = message.toLowerCase();
  if (error.status === 429 || m.includes("rate limit") || m.includes("only request this after") || m.includes("for security purposes")) {
    return new EmailAuthError(429, "Too many attempts. Wait a minute and try again.");
  }
  if (m.includes("email not confirmed")) {
    return new EmailAuthError(403, "Confirm your email with the code we sent before signing in.", "email_not_confirmed");
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return new EmailAuthError(401, "Email or password is incorrect.");
  }
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already exists")) {
    return new EmailAuthError(409, "An account with this email already exists. Sign in instead.", "email_taken");
  }
  if (m.includes("otp") || m.includes("token")) {
    return new EmailAuthError(400, "That code is incorrect or has expired.");
  }
  if (m.includes("password") && message.length < 240) return new EmailAuthError(400, message);
  if (m.includes("email") && (m.includes("invalid") || m.includes("unable to validate"))) {
    return new EmailAuthError(400, "Enter a valid email address.");
  }
  return new EmailAuthError(400, "Something went wrong. Try again.");
}

/**
 * Create an email/password account. Supabase Auth hashes the password and emails a 6-digit code
 * when confirmations are on. The session cookie is only set after `verifyEmailCode`.
 */
export async function signUpWithPassword(emailInput: unknown, passwordInput: unknown, origin: string) {
  const email = parseEmail(emailInput);
  const password = parsePassword(passwordInput);
  const supabase = await authClient();
  // emailRedirectTo lets a confirmation link finish sign-in if the email template still has one.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) throw mapAuthError(error);
  // Confirmed accounts come back with no identities and no email, so the address can't be taken over.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new EmailAuthError(409, "An account with this email already exists. Sign in instead.", "email_taken");
  }
  if (!data.user) throw new EmailAuthError(400, "Could not create the account. Try again.");
  return { status: data.session ? ("signed_in" as const) : ("confirm" as const) };
}

export async function signInWithEmailPassword(emailInput: unknown, passwordInput: unknown) {
  const email = parseEmail(emailInput);
  const password = parsePassword(passwordInput);
  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const mapped = mapAuthError(error);
    if (mapped.status === 401) await new Promise((r) => setTimeout(r, 400));
    throw mapped;
  }
  return { ok: true as const };
}

/** Check a signup confirmation code and start the session. */
export async function verifyEmailCode(emailInput: unknown, codeInput: unknown) {
  const email = parseEmail(emailInput);
  const token = parseCode(codeInput);
  const supabase = await authClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
  if (error) throw mapAuthError(error);
  return { ok: true as const };
}

/** Always succeeds for unknown addresses so this can't be used to discover accounts. */
export async function requestPasswordReset(emailInput: unknown) {
  const email = parseEmail(emailInput);
  const supabase = await authClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    const m = error.message.toLowerCase();
    if (!m.includes("not found") && !m.includes("no user")) throw mapAuthError(error);
  }
  return { ok: true as const };
}

/**
 * Verify the reset code, then replace the password. The password is checked before the code is
 * consumed, and Supabase hashes the new one the same way as signup.
 */
export async function confirmPasswordReset(emailInput: unknown, codeInput: unknown, passwordInput: unknown) {
  const email = parseEmail(emailInput);
  const token = parseCode(codeInput);
  const password = parsePassword(passwordInput);
  const supabase = await authClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
  if (error) throw mapAuthError(error);
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) throw mapAuthError(updateError);
  return { ok: true as const };
}

export async function resendEmailCode(emailInput: unknown, purpose: unknown) {
  const email = parseEmail(emailInput);
  if (purpose === "recovery") return requestPasswordReset(email);
  if (purpose !== "signup") throw new HttpError(400, "Invalid request.");
  const supabase = await authClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) throw mapAuthError(error);
  return { ok: true as const };
}

export function emailRoute(handler: (body: Record<string, unknown>, req: Request) => Promise<unknown>) {
  return async (req: Request) => {
    try {
      const body = (await req.json().catch(() => null)) as unknown;
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid request.");
      return json((await handler(body as Record<string, unknown>, req)) ?? { ok: true });
    } catch (err) {
      if (err instanceof EmailAuthError) {
        return json(err.code ? { error: err.message, code: err.code } : { error: err.message }, err.status);
      }
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Something went wrong." }, 500);
    }
  };
}
