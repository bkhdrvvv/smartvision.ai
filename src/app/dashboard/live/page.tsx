import Link from "next/link";
import { Lock, VideoOff } from "lucide-react";
import { getActiveSubscription } from "@/lib/subscription";
import { Topbar, PageBody } from "@/components/dash/Shell";
import { LiveWall } from "@/components/dash/LiveWall";
import { requireCustomer } from "@/lib/auth";
import { loadLive } from "@/lib/live";
import { getDict } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.dash.menu.live };
}

export default async function LivePage() {
  const user = await requireCustomer();
  const { d } = await getDict();
  const org = user.organization;
  if (!(await getActiveSubscription(org.id))) {
    return (
      <>
        <Topbar crumb={`${d.nav.dashboard} / ${d.dash.menu.live}`} title={d.dash.menu.live} />
        <PageBody>
          <div className="card grid min-h-[320px] place-items-center !rounded-[20px] p-8 text-center">
            <div>
              <VideoOff size={34} className="mx-auto text-fg-dim" />
              <h2 className="mt-4 text-xl font-bold">{d.dash.expiry.expiredTitle}</h2>
              <p className="mt-1 text-fg-muted">{d.dash.expiry.bannerText}</p>
              <Link href="/dashboard/subscription" className="btn btn-primary mt-6">{d.dash.menu.subscription}</Link>
            </div>
          </div>
        </PageBody>
      </>
    );
  }
  const live = await loadLive(org.id);

  return (
    <>
      <Topbar
        crumb={`${d.nav.dashboard} / ${d.dash.menu.live}`}
        title={d.dash.menu.live}
        chip={<span className="chip chip-blue hidden !h-11 !rounded-xl !px-4 !text-[14px] md:inline-flex"><Lock size={14} /> {d.dash.live.secure}</span>}
      />
      <PageBody>
        <LiveWall cams={live.cams} initialEvents={live.events} initialFaces={live.faces} demo={org.demo} nightAllowed={live.nightAllowed} />
      </PageBody>
    </>
  );
}
