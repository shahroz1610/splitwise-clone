import { emailRoute, verifyEmailCode } from "@/lib/server/email-auth";

export const POST = emailRoute((body) => verifyEmailCode(body.email, body.code));
