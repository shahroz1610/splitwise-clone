import { emailRoute, signInWithEmailPassword } from "@/lib/server/email-auth";

export const POST = emailRoute((body) => signInWithEmailPassword(body.email, body.password));
