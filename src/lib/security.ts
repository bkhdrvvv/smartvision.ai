import "server-only";
import { db } from "./db";

/*
 * Per-user security state kept in the Setting key/value table (no schema migration needed):
 *   tv:<userId>          session "token version" — bumping it signs out every other device
 *   2fa:<userId>         confirmed TOTP secret (2FA on)
 *   2fa-pending:<userId> secret shown during setup, until the first code is confirmed
 */
const get = async (key: string) => (await db.setting.findUnique({ where: { key } }))?.value ?? null;
const put = (key: string, value: string) => db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });

export async function tokenVersion(userId: string) {
  return Number(await get(`tv:${userId}`)) || 0;
}

/** Invalidate all existing sessions of the user (password change, "sign out everywhere"). Returns the new version. */
export async function bumpTokenVersion(userId: string) {
  const v = (await tokenVersion(userId)) + 1;
  await put(`tv:${userId}`, String(v));
  return v;
}

export const twoFactor = {
  secret: (userId: string) => get(`2fa:${userId}`),
  pending: (userId: string) => get(`2fa-pending:${userId}`),
  setPending: (userId: string, s: string) => put(`2fa-pending:${userId}`, s),
  async enable(userId: string, s: string) {
    await put(`2fa:${userId}`, s);
    await db.setting.deleteMany({ where: { key: `2fa-pending:${userId}` } });
  },
  disable: (userId: string) => db.setting.deleteMany({ where: { key: { in: [`2fa:${userId}`, `2fa-pending:${userId}`] } } }),
};
