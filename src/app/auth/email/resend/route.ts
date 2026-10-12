import { emailRoute, resendEmailCode } from "@/lib/server/email-auth";

export const POST = emailRoute((body) => resendEmailCode(body.email, body.purpose));
