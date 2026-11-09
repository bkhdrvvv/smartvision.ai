import "server-only";
import { db } from "./db";

export async function nextReference() {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const n = await db.payment.count({ where: { reference: { startsWith: `PAY-${day}` } } });
  return `PAY-${day}-${String(n + 1).padStart(4, "0")}`;
}

export function maskCard(card: string) {
  const digits = card.replace(/\D/g, "");
  return `Card •••• ${digits.slice(-4) || card.slice(-4)}`;
}

/** Apply coupon percentage to plan price (whole UZS) */
export function discounted(price: number, percentOff?: number | null) {
  return percentOff ? Math.round((price * (100 - percentOff)) / 100) : price;
}
