import { Sparkles } from "lucide-react";
import { Topbar, PageBody } from "@/components/dash/Shell";
import { CustomerAssistant } from "@/components/dash/AdminAssistant";
import { requireCustomer } from "@/lib/auth";
import { aiConfigured } from "@/lib/adminAi";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { f } = await getDict();
  return { title: f.ai.title };
}

export default async function CustomerAiPage() {
  await requireCustomer();
  const { d, f } = await getDict();
  return (
    <>
      <Topbar
        crumb={`${d.nav.dashboard} / ${f.menu.ai}`}
        title={f.ai.title}
        chip={<span className="chip chip-violet hidden !h-11 !rounded-xl !px-4 !text-[14px] md:inline-flex"><Sparkles size={14} /> AI</span>}
      />
      <PageBody>
        <CustomerAssistant configured={aiConfigured()} />
      </PageBody>
    </>
  );
}
