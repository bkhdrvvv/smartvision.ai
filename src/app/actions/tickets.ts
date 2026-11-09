"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { TicketKind } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, getCurrentUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { clientIp, hit } from "@/lib/ratelimit";
import { notifyUsers } from "@/lib/notify";
import { guestCookie, newGuestToken } from "@/lib/chat";
import { sessionCookieOptions } from "@/lib/session";

export type TicketState = { error?: string; ok?: boolean; number?: number; fields?: Record<string, string> } | undefined;

const KINDS = ["COMPLAINT", "QUESTION", "SUGGESTION", "TECHNICAL", "PAYMENT"] as const;
const base = z.object({
  kind: z.enum(KINDS),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(2).max(4000),
});
const guest = base.extend({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{9,20}$/),
});

/**
 * New appeal → opens a chat. Signed-in customers: account details are attached automatically.
 * Visitors: name + phone; the chat is reachable from this browser through a secret cookie (no emails).
 */
export async function createTicket(_: TicketState, form: FormData): Promise<TicketState> {
  const { d } = await getDict();
  const t = d.support;
  const raw = Object.fromEntries(["kind", "subject", "message", "name", "email", "phone"].map((k) => [k, String(form.get(k) ?? "")]));
  if (!hit(`ticket-ip:${await clientIp()}`, 8, 60 * 60_000)) return { error: d.auth.tooMany, fields: raw };

  const user = await getCurrentUser();
  const customer = user && user.role === "CUSTOMER" ? user : null;
  let sender: { name: string; email: string; phone: string | null; userId: string | null; orgId: string | null };
  let v: z.infer<typeof base>;
  if (customer) {
    const p = base.safeParse(raw);
    if (!p.success) return { error: t.invalid, fields: raw };
    v = p.data;
    sender = { name: customer.name, email: customer.email, phone: customer.phone ?? customer.organization?.phone ?? null, userId: customer.id, orgId: customer.organizationId };
  } else {
    const p = guest.safeParse(raw);
    if (!p.success) return { error: t.invalidGuest, fields: raw };
    v = p.data;
    sender = { name: p.data.name, email: p.data.email || "", phone: p.data.phone, userId: null, orgId: null };
  }
  const token = customer ? null : newGuestToken();

  const ticket = await db.ticket.create({
    data: {
      kind: v.kind as TicketKind,
      subject: v.subject,
      name: sender.name,
      email: sender.email,
      phone: sender.phone,
      userId: sender.userId,
      organizationId: sender.orgId,
      guestTokenHash: token?.hash,
      messages: { create: { body: v.message, authorId: sender.userId } },
    },
  });
  await audit(sender.userId, "ticket.create", ticket.id, { number: ticket.number, kind: v.kind });
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await notifyUsers(admins.map((a) => a.id), "SYSTEM", (dd) => ({ title: fmt(dd.support.notifyNewTitle, { n: ticket.number }), body: `${sender.name}: ${v.subject}` }), "info", `/admin/tickets/${ticket.id}`);
  revalidatePath("/admin", "layout");

  if (token) {
    // the visitor's key to this chat — a year, http-only, never shown to scripts
    (await cookies()).set(guestCookie(ticket.id), token.raw, { ...sessionCookieOptions, maxAge: 365 * 86400 });
    redirect(`/support/t/${ticket.id}`);
  }
  redirect(`/dashboard/support/${ticket.id}`);
}

/** Close / reopen. Admin: any ticket. Customer: only their own. */
export async function setTicketStatus(ticketId: string, status: "OPEN" | "CLOSED") {
  const user = await getCurrentUser();
  if (!user) return;
  const where = user.role === "ADMIN" ? { id: ticketId } : { id: ticketId, organizationId: user.organizationId ?? "-" };
  const t = await db.ticket.findFirst({ where });
  if (!t) return;
  await db.ticket.update({ where: { id: t.id }, data: { status } });
  await audit(user.id, `ticket.${status === "CLOSED" ? "close" : "reopen"}`, t.id, { number: t.number });
  revalidatePath(user.role === "ADMIN" ? `/admin/tickets/${t.id}` : `/dashboard/support/${t.id}`);
  revalidatePath("/admin", "layout");
}
