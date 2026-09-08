import type { User } from "@workspace/db";

/**
 * Strip server-only credential fields before sending a user object to the client.
 * Add any future credential columns (TOTP secrets, recovery codes, etc.) here.
 */
export function toPublicUser(user: User) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _ph, ...publicUser } = user;
  return {
    ...publicUser,
    hasPassword: user.passwordHash !== null && user.passwordHash !== undefined,
  };
}
