import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { ActionForm } from "@/components/dash/Forms";
import { SecurityPanel } from "@/components/dash/SecurityPanel";
import { NotifyPrefs } from "@/components/dash/NotifyPrefs";
import { LangSegment } from "@/components/ui/LangSwitch";
import { updateProfile } from "@/app/actions/customer";
import { requireCustomer } from "@/lib/auth";
import { twoFactor } from "@/lib/security";
import { getDict } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { botToken } from "@/lib/telegram";
import { GuardPanel, SpeakerPanel, TeamPanel, TelegramPanel, WeeklyPanel } from "@/components/dash/FeaturePanels";
import { DailyPanel } from "@/components/dash/MorePanels";
import { PlanLock } from "@/components/dash/PlanLock";
import { planFeatures } from "@/lib/plan";

export default async function SettingsPage() {
  const user = await requireCustomer();
  const { d, f } = await getDict();
  const p = d.dash.settingsPage;
  const twofa = !!(await twoFactor.secret(user.id));
  const org = user.organization;
  const canEdit = user.orgRole !== "VIEWER";
  const [botReady, members, feats] = await Promise.all([
    botToken().then(Boolean),
    db.user.findMany({ where: { organizationId: org.id }, select: { id: true, name: true, email: true, orgRole: true }, orderBy: { createdAt: "asc" } }),
    planFeatures(org.id),
  ]);
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${d.dash.menu.settings}`} title={p.title} />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <Panel title={p.profile}>
              <ActionForm
                action={updateProfile}
                fields={[
                  { name: "name", label: d.auth.name, defaultValue: user.name, required: true },
                  { name: "phone", label: d.auth.phone, defaultValue: user.phone ?? "" },
                  { name: "orgName", label: d.auth.orgName, defaultValue: user.organization.name, required: true },
                ]}
              />
              <p className="mt-4 text-[13px] text-fg-dim">
                {d.auth.email}: <span className="text-fg">{user.email}</span>{" "}
                {user.emailVerifiedAt ? <span className="chip chip-ok !h-5 !text-[10px]">{d.auth.verified}</span> : <span className="chip chip-warn !h-5 !text-[10px]">{d.auth.notVerified}</span>}
              </p>
            </Panel>
            <Panel title={d.dash.notifyPrefs.title}>
              <NotifyPrefs email={user.notifyEmail} sms={user.notifySms} hasPhone={!!user.phone} verified={!!user.emailVerifiedAt} />
            </Panel>
            <Panel title={f.telegram.title}>
              <TelegramPanel linked={!!user.telegramChatId} name={user.telegramName} botReady={botReady} />
            </Panel>
            <Panel title={f.guard.title}>
              <GuardPanel mode={org.guardMode} from={org.guardFrom} to={org.guardTo} canEdit={canEdit} />
            </Panel>
            <Panel title={f.speaker.title}>
              {feats.has("speaker") ? <SpeakerPanel enabled={org.speakerEnabled} verified={!!org.speakerVerifiedAt} canEdit={canEdit} /> : <PlanLock service={org.service} feature="speaker" />}
            </Panel>
            <Panel title={p.language}><LangSegment /></Panel>
          </div>
          <div className="space-y-5">
            <Panel title={d.auth.security}>
              <SecurityPanel twofaEnabled={twofa} />
            </Panel>
            <Panel title={f.team.title}>
              {feats.has("team") || members.length > 1 ? <TeamPanel members={members.map((m) => ({ ...m, you: m.id === user.id }))} isOwner={user.orgRole === "OWNER" && feats.has("team")} /> : <PlanLock service={org.service} feature="team" />}
            </Panel>
            <Panel title={f.more.dailyTitle}>
              <DailyPanel on={org.dailySummary} canEdit={canEdit} />
            </Panel>
            <Panel title={f.weekly.title}>
              <WeeklyPanel on={org.weeklyReport} canEdit={canEdit} />
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
