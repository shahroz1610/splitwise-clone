import { emailRoute, requestPasswordReset } from "@/lib/server/email-auth";

export const POST = emailRoute((body) => requestPasswordReset(body.email));
