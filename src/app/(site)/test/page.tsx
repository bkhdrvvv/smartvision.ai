import { SecurityQuiz } from "@/components/site/Engage";
import { getDict } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { f } = await getDict();
  return { title: f.y.quizTitle, description: f.y.quizLead };
}

export default function SecurityTestPage() {
  return (
    <section className="px-5 pb-24 pt-32">
      <SecurityQuiz />
    </section>
  );
}
