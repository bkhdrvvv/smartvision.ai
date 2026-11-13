import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { twoFactor } from "@/lib/security";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(req: Request) {
  const s = await getSession();
  if (s?.role !== "ADMIN" || !(await twoFactor.secret(s.uid))) return new Response("forbidden", { status: 403 });
  const [y, m] = (new URL(req.url).searchParams.get("month") ?? "").split("-").map(Number);
  const now = new Date();
  const start = new Date(y || now.getFullYear(), (m || now.getMonth() + 1) - 1, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const rows = await db.payment.findMany({ where: { createdAt: { gte: start, lt: end } }, include: { organization: true, subscription: { include: { plan: true } } }, orderBy: { createdAt: "desc" } });
  const out = [
    "reference,customer,service,plan,amount_uzs,status,period_start,period_end,submitted_at,reviewed_at",
    ...rows.map((r) => [r.reference, r.organization.name, r.organization.service, r.subscription.plan.tier, r.amount, r.status, r.periodStart.toISOString(), r.periodEnd.toISOString(), r.submittedAt?.toISOString(), r.reviewedAt?.toISOString()].map(esc).join(",")),
  ];
  return new Response("﻿" + out.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payments-${start.getFullYear()}-${start.getMonth() + 1}.csv"` } });
}
