import { cookies } from "next/headers";
import { RegisterForm, SignupEmailForm } from "@/components/site/AuthForms";
import { AuthShell } from "@/components/site/AuthShell";
import { getDict } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { googleEnabled } from "@/lib/login";
import { SIGNUP_COOKIE, verifySignup } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.auth.signUp };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { d } = await getDict();
  const { plan } = await searchParams;
  const p = plan ? await db.plan.findUnique({ where: { id: plan } }).catch(() => null) : null;
  // step 2 only after the email was proven (code from the email, or Google)
  const proof = await verifySignup((await cookies()).get(SIGNUP_COOKIE)?.value);
  return (
    <AuthShell title={d.auth.registerTitle} text={d.auth.registerText}>
      {proof ? (
        <RegisterForm plan={p?.id} service={p?.service} email={proof.email} google={!!proof.gid} googleName={proof.name} />
      ) : (
        <SignupEmailForm plan={p?.id} google={googleEnabled()} />
      )}
    </AuthShell>
  );
}
