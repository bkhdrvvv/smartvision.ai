import { Shell } from "@/components/dash/Shell";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { ago, daysLeft, initials } from "@/lib/format";
import { getActiveSubscription, getExpiredSubscription, startOfDay } from "@/lib/dashboard";
import { ExpiryBanner } from "@/components/dash/ExpiryBanner";
import { VerifyBanner } from "@/components/site/RecoveryForms";
import { TermsGate } from "@/components/site/LegalBits";
import { LEGAL_VERSION } from "@/lib/legal";
import { Permissions } from "@/components/dash/Permissions";
import { PromoBar } from "@/components/site/PromoBar";
import { InstallApp } from "@/components/site/InstallApp";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCustomer();
  const { d, locale } = await getDict();
  const org = user.organization;
  // remember the interface language so server-side notifications are written in it
  if (user.locale !== locale) await db.user.update({ where: { id: user.id }, data: { locale } });
  // runs expiry + reminders (throttled) before anything else reads subscription state
  const active = await getActiveSubscription(org.id);
  const expired = active ? null : await getExpiredSubscription(org.id);
  const left = daysLeft(active?.currentPeriodEnd);
  const banner = expired ? "expired" : active && left <= 3 ? "ending" : null;
  const [cameras, events, unread, latest, device, support] = await Promise.all([
    db.camera.count({ where: { organizationId: org.id } }),
    db.event.count({ where: { organizationId: org.id, occurredAt: { gte: startOfDay() } } }),
    db.notification.count({ where: { userId: user.id, read: false } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.edgeDevice.findFirst({ where: { organizationId: org.id }, orderBy: { lastHeartbeat: "desc" } }),
    db.ticket.count({ where: { organizationId: org.id, unreadCustomer: true } }),
  ]);

  return (
    <Shell
      info={{
        variant: "customer",
        user: { name: org.name, email: org.domain ?? user.email, initials: initials(org.name) },
        badges: { cameras, events, notifications: unread, support },
        unread,
        notifications: latest.map((n) => ({ id: n.id, title: n.title, body: n.body, ago: ago(n.createdAt, d) })),
        orgRole: user.orgRole,
        edge: device ? { serial: device.serial, firmware: device.firmware, heartbeatSec: device.lastHeartbeat ? Math.round((Date.now() - device.lastHeartbeat.getTime()) / 1000) : null } : null,
      }}
    >
      {user.termsVersion !== LEGAL_VERSION && <TermsGate version={LEGAL_VERSION} />}
      {!user.emailVerifiedAt && <VerifyBanner email={user.email} />}
      <ExpiryBanner d={d} state={banner} daysLeft={left} />
      <div className="px-4 pt-4 sm:px-8 empty:hidden"><PromoBar dash /></div>
      {children}
      <Permissions speaker={org.speakerEnabled && !!org.speakerVerifiedAt} />
      <InstallApp />
    </Shell>
  );
}
