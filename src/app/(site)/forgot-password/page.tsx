import { AuthShell } from "@/components/site/AuthShell";
import { ForgotForm } from "@/components/site/RecoveryForms";
import { getDict } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.auth.forgot };
}

export default async function ForgotPage() {
  const { d } = await getDict();
  return (
    <AuthShell title={d.auth.forgotTitle} text={d.auth.forgotText}>
      <ForgotForm />
    </AuthShell>
  );
}
