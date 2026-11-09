import Link from "next/link";
import { AuthShell } from "@/components/site/AuthShell";
import { ResetForm } from "@/components/site/RecoveryForms";
import { consumeAuthToken } from "@/lib/authTokens";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { d } = await getDict();
  const { t = "" } = await searchParams;
  const valid = !!(await consumeAuthToken(t, "RESET_PASSWORD", true)); // peek only — burned on submit
  return (
    <AuthShell title={d.auth.resetTitle} text={valid ? d.auth.resetText : d.auth.linkInvalid}>
      {valid ? <ResetForm token={t} /> : <Link href="/forgot-password" className="btn btn-primary w-full">{d.auth.resetSend}</Link>}
    </AuthShell>
  );
}
