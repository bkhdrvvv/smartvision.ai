import { LegalPage } from "@/components/site/LegalPage";
import { getDict } from "@/lib/i18n/server";
import { legalDoc } from "@/lib/legal";
import { getSettings } from "@/lib/settings";

export async function generateMetadata() {
  const { locale } = await getDict();
  return { title: legalDoc("privacy", locale).title };
}

export default async function Page() {
  const { d, locale } = await getDict();
  const s = await getSettings();
  const operator = { name: s.companyName, tin: s.companyTin, address: s.companyAddress, phone: s.supportPhone, email: s.supportEmail, labels: d.legalUi };
  return <LegalPage doc={legalDoc("privacy", locale)} other={{ href: "/terms", label: d.footer.terms }} operator={operator} />;
}