"use server";

import { db } from "@/lib/db";
import { contactSchema } from "@/lib/validators";
import { getDict } from "@/lib/i18n/server";
import { clientIp, hit } from "@/lib/ratelimit";

export type ContactState = { ok?: boolean; error?: string } | undefined;

export async function contactAction(_: ContactState, form: FormData): Promise<ContactState> {
  const { d } = await getDict();
  if (form.get("website")) return { ok: true }; // honeypot
  if (!hit(`contact:${await clientIp()}`, 5, 10 * 60_000)) return { error: d.auth.tooMany };
  const parsed = contactSchema.safeParse({
    name: form.get("name"),
    phone: form.get("phone"),
    email: form.get("email") ?? "",
    service: form.get("service") || undefined,
    message: form.get("message"),
  });
  if (!parsed.success) return { error: d.common.error };
  const v = parsed.data;
  await db.contactMessage.create({ data: { name: v.name, phone: v.phone, email: v.email || null, service: v.service ?? null, message: v.message } });
  return { ok: true };
}
