import Link from "next/link";
import { LoginForm } from "@/components/site/AuthForms";
import { AuthShell } from "@/components/site/AuthShell";
import { getDict } from "@/lib/i18n/server";
import { googleEnabled } from "@/lib/login";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.nav.login };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; step?: string }> }) {
  const { d } = await getDict();
  const { next, error, step } = await searchParams;
  const errors: Record<string, string> = {
    blocked: d.auth.blocked,
    google: d.auth.googleError,
    google_off: d.auth.googleError,
    google_cancel: d.auth.googleCancel,
    google_unverified: d.auth.googleUnverified,
    too_many: d.auth.tooMany,
  };
  return (
    <AuthShell title={d.auth.loginTitle} text={d.auth.loginText}>
      <LoginForm next={next} google={googleEnabled()} initial2fa={step === "2fa"} initialError={error ? errors[error] ?? d.auth.googleError : undefined} />
      <p className="mt-4 text-center text-sm"><Link href="/forgot-password" className="text-fg-muted hover:text-brand-400">{d.auth.forgot}</Link></p>
    </AuthShell>
  );
}
