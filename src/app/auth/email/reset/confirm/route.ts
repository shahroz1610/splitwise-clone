import { confirmPasswordReset, emailRoute } from "@/lib/server/email-auth";

export const POST = emailRoute((body) => confirmPasswordReset(body.email, body.code, body.password));
