import "server-only";
import { HttpError } from "./errors";

export function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new HttpError(500, result.error.message);
  return result.data;
}
