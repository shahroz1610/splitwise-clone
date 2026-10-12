import "server-only";
import { getViewer, passcodeMatches } from "./auth";
import { HttpError } from "./http";

/**
 * Gate for the one-time join flow: the user must be signed in, not already
 * a member, and know the group passcode. Returns the signed-in user.
 */
export async function verifyJoin(passcode: unknown) {
  const viewer = await getViewer();
  if (!viewer) throw new HttpError(401, "Sign in to continue.");
  if (viewer.member) throw new HttpError(409, "You've already joined this group.");
  if (viewer.removed) throw new HttpError(403, "You were removed from this group. Ask a member to restore you.");
  if (!process.env.GROUP_PASSCODE) throw new HttpError(503, "Joining is disabled: GROUP_PASSCODE isn't configured on the server.");
  if (typeof passcode !== "string" || !passcodeMatches(passcode)) {
    // Slow down brute-force guessing a little.
    await new Promise((r) => setTimeout(r, 600));
    throw new HttpError(403, "That passcode isn't right.");
  }
  return viewer.user;
}
