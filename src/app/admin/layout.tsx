import { Shell } from "@/components/dash/Shell";
import { requireAdmin } from "@/lib/auth";
import { enforceSubscriptions } from "@/lib/subscription";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { ago, initials } from "@/lib/format";
import { Permissions } from "@/components/dash/Permissions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const { d } = await getDict();
  await enforceSubscriptions(); // keep ACTIVE counts honest for admins too
  const [requests, payments, messages, unread, latest, tickets] = await Promise.all([
    db.subscription.count({ where: { status: "REQUESTED" } }),
    db.payment.count({ where: { status: { in: ["RECEIPT_SUBMITTED", "UNDER_REVIEW"] } } }),
    db.contactMessage.count({ where: { handled: false } }),
    db.notification.count({ where: { userId: admin.id, read: false } }),
    db.notification.findMany({ where: { userId: admin.id }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.ticket.count({ where: { status: "OPEN" } }),
  ]);
  return (
    <Shell
      info={{
        variant: "admin",
        user: { name: admin.name, email: admin.email, initials: initials(admin.name) || "AD" },
        badges: { requests, payments, notifications: messages, tickets },
        unread,
        notifications: latest.map((n) => ({ id: n.id, title: n.title, body: n.body, ago: ago(n.createdAt, d) })),
      }}
    >
      {children}
      <Permissions />
    </Shell>
  );
}
