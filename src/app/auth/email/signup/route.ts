import { emailRoute, signUpWithPassword } from "@/lib/server/email-auth";

export const POST = emailRoute((body, req) => signUpWithPassword(body.email, body.password, new URL(req.url).origin));
