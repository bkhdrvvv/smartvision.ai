import { randomBytes } from "node:crypto";
import { Gift } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { CopyField } from "@/components/dash/CopyField";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/notify";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ReferralPage() {
  const user = await requireCustomer();
  const { d, f } = await getDict();
  const r = f.referral;
  let org = user.organization;
  if (!org.referralCode) org = await db.organization.update({ where: { id: org.id }, data: { referralCode: randomBytes(5).toString("base64url") } });
  const link = siteUrl(`/register?ref=${org.referralCode}`);
  const [invited, paid, couponRows] = await Promise.all([
    db.organization.count({ where: { referredById: org.id } }),
    db.organization.count({ where: { referredById: org.id, referralRewardedAt: { not: null } } }),
    db.setting.findMany({ where: { key: { startsWith: `refcoupon:${org.id}:` } } }),
  ]);
  const codes = couponRows.map((c) => c.key.split(":")[2]);
  const coupons = codes.length ? await db.coupon.findMany({ where: { code: { in: codes } } }) : [];
  const share = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(r.shareText)}`;
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${f.menu.referral}`} title={r.title} />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><Gift size={22} /></span>
              <p className="text-[14px] text-fg-muted">{r.lead}</p>
            </div>
            <div className="mt-5">
              <span className="label">{r.link}</span>
              <CopyField value={link} copy={r.copy} copied={r.copied} />
            </div>
            <a href={share} target="_blank" rel="noopener" className="btn btn-primary mt-4">{r.share}</a>
          </Panel>
          <Panel>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-line p-4"><div className="font-display text-[34px] font-extrabold">{invited}</div><div className="text-fg-dim">{r.invited}</div></div>
              <div className="rounded-2xl border border-line p-4"><div className="font-display text-[34px] font-extrabold">{paid}</div><div className="text-fg-dim">{r.paid}</div></div>
            </div>
            <div className="mt-5">
              <span className="label">{r.coupons}</span>
              {coupons.length ? (
                <ul className="space-y-2">
                  {coupons.map((c) => (
                    <li key={c.id} className="flex items-center justify-between rounded-xl border border-line p-3">
                      <span className="font-mono font-bold">{c.code}</span>
                      <span className={`chip ${c.redemptions >= (c.maxRedemptions ?? 1) ? "" : "chip-ok"}`}>{c.percentOff}%</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-fg-dim">{r.none}</p>
              )}
            </div>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
