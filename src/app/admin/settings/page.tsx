import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { SettingsForm } from "@/components/dash/AdminForms";
import { SecurityPanel } from "@/components/dash/SecurityPanel";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { twoFactor } from "@/lib/security";
import { mailStatus } from "@/lib/notify";
import { getDict } from "@/lib/i18n/server";
import { botToken, botUsername } from "@/lib/telegram";
import { getPromo } from "@/lib/promo";
import { BotPanel, PromoPanel } from "@/components/dash/AdminFeaturePanels";
import { TelegramPanel } from "@/components/dash/FeaturePanels";

export default async function AdminSettings() {
  const admin = await requireAdmin();
  const { d, f } = await getDict();
  const [values, logs, twofa, botName, promo, botReady] = await Promise.all([
    getSettings(),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { user: true } }),
    twoFactor.secret(admin.id),
    botUsername(),
    getPromo(true),
    botToken().then(Boolean),
  ]);
  const ms = mailStatus();
  return (
    <>
      <Topbar crumb={`Admin / ${d.dash.menu.system}`} title={d.dash.adminSettings.title} />
      <PageBody>
        {!twofa && (
          <div className="rounded-2xl border border-warn/40 bg-warn/[.07] p-4 text-sm text-warn-soft">{d.auth.twofaAdminWarn}</div>
        )}
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-5">
            <Panel><SettingsForm values={values} /></Panel>
            <Panel title={d.dash.outbox.channels}>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between"><span>Email (SMTP)</span><span className={`chip ${ms.email ? "chip-ok" : "chip-warn"}`}>{ms.email ? d.dash.outbox.live : d.dash.outbox.outboxOnly}</span></li>
                <li className="flex justify-between"><span>SMS (Eskiz.uz)</span><span className={`chip ${ms.sms ? "chip-ok" : "chip-warn"}`}>{ms.sms ? d.dash.outbox.live : d.dash.outbox.outboxOnly}</span></li>
              </ul>
              <p className="mt-3 text-[12px] text-fg-dim">{d.dash.outbox.howTo}</p>
            </Panel>
          </div>
          <div className="space-y-5">
            <Panel title={f.bot.title}><BotPanel username={botName} /></Panel>
            <Panel title={f.telegram.title}><TelegramPanel linked={!!admin.telegramChatId} name={admin.telegramName} botReady={botReady} /></Panel>
            <Panel title={f.promo.title}><PromoPanel text={promo.text} link={promo.link} until={promo.until} /></Panel>
            <Panel title={d.auth.security}><SecurityPanel twofaEnabled={!!twofa} /></Panel>
            <Panel title="Audit log">
              <ul className="divide-y divide-line border-t border-line font-mono text-[12px]">
                {logs.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 py-2.5"><span>{l.action} {l.target ? <span className="text-fg-dim">{l.target.slice(0, 14)}</span> : null}</span><span className="text-fg-dim">{l.user?.email ?? "system"} · {l.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span></li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
