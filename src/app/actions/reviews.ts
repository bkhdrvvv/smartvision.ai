"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireAdmin, requireCustomer } from "@/lib/auth";
import { hit } from "@/lib/ratelimit";
import type { ActionResult } from "./customer";

/** A customer writes a review; it is shown on the site only after the admin publishes it. */
export async function submitReview(_: ActionResult, form: FormData): Promise<ActionResult> {
  const u = await requireCustomer();
  if (!hit(`review:${u.id}`, 3, 24 * 3600_000)) return { error: "too_many" };
  const p = z.object({ author: z.string().trim().min(2).max(60), rating: z.coerce.number().int().min(1).max(5), text: z.string().trim().min(10).max(800) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "invalid" };
  await db.review.create({ data: { organizationId: u.organization.id, ...p.data } });
  await audit(u.id, "review.submit", u.organization.id);
  return { ok: true };
}

export async function setReviewApproved(id: string, approved: boolean) {
  const admin = await requireAdmin();
  await db.review.update({ where: { id }, data: { approved } });
  await audit(admin.id, approved ? "review.publish" : "review.hide", id);
  revalidatePath("/admin/reviews");
  revalidatePath("/");
}
