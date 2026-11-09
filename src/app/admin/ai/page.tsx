import { Sparkles } from "lucide-react";
import { Topbar, PageBody } from "@/components/dash/Shell";
import { AdminAssistant } from "@/components/dash/AdminAssistant";
import { requireAdmin } from "@/lib/auth";
import { aiConfigured, aiProvider } from "@/lib/adminAi";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.dash.menu.ai };
}

export default async function AdminAiPage() {
  await requireAdmin();
  const { d } = await getDict();
  return (
    <>
      <Topbar
        crumb={`Admin / ${d.dash.menu.ai}`}
        title={d.dash.adminAi.title}
        chip={<span className="chip chip-violet hidden !h-11 !rounded-xl !px-4 !text-[14px] md:inline-flex"><Sparkles size={14} /> {aiProvider()}</span>}
      />
      <PageBody>
        <AdminAssistant configured={aiConfigured()} />
      </PageBody>
    </>
  );
}
