import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "./db";

/**
 * Admin AI assistant: Claude answers questions about the platform using read-only database tools.
 * It never changes data (no block/delete/approve) — it explains and points to the right admin page.
 */

export const AI_MODEL = "claude-opus-5-5";
/** Google Gemini (free tier key from aistudio.google.com) is used when GEMINI_API_KEY is set; otherwise Claude. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const geminiKey = () => process.env.GEMINI_API_KEY;
const claudeKey = () => process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
export const aiConfigured = () => !!(geminiKey() || claudeKey());
export const aiProvider = () => (geminiKey() ? "Gemini" : "Claude");

const DAY = 86400_000;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "platform_overview",
    description: "Key numbers right now: customers (total / blocked), active subscriptions, payments waiting for review, revenue this month and last 30 days (UZS), cameras online/offline, Edge devices online, AI alerts in the last 24 h. Call this first for any general question about the business or system state.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_customers",
    description: "Customers (organizations) with contact email/phone, service type, current plan and subscription status with end date, camera count, and whether they are blocked. Optional text search on name / email / phone.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Part of the name, email or phone" },
        only_blocked: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "customer_details",
    description: "Everything about one customer: users, subscriptions history, payments, cameras with status, Edge devices with last heartbeat, AI alert counts for 7 days, block status. Pass the exact customer id or a name/email to search.",
    input_schema: { type: "object", properties: { customer: { type: "string", description: "Customer id, name or email" } }, required: ["customer"], additionalProperties: false },
  },
  {
    name: "recent_alerts",
    description: "Unusual behaviour detected by the AI on customer cameras (intrusion at night, crowd, running, fire/smoke, livestock count changes, camera offline...). Only WARNING and CRITICAL events. Optional filter by customer name/id.",
    input_schema: {
      type: "object",
      properties: { hours: { type: "integer", minimum: 1, maximum: 720 }, customer: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 } },
      additionalProperties: false,
    },
  },
  {
    name: "payments",
    description: "Payments with reference, customer, amount (UZS), status, period and dates. Filter by status (AWAITING_PAYMENT, RECEIPT_SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED) and by how many days back.",
    input_schema: {
      type: "object",
      properties: { status: { type: "string", enum: ["AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"] }, days: { type: "integer", minimum: 1, maximum: 365 } },
      additionalProperties: false,
    },
  },
  {
    name: "suspicious_logins",
    description: "Failed sign-ins (wrong password or 2FA code) and sign-in attempts of blocked accounts, grouped per account, for the last N hours.",
    input_schema: { type: "object", properties: { hours: { type: "integer", minimum: 1, maximum: 720 } }, additionalProperties: false },
  },
];

const schemas = {
  platform_overview: z.object({}).strict(),
  list_customers: z.object({ search: z.string().max(100).optional(), only_blocked: z.boolean().optional(), limit: z.number().int().min(1).max(100).optional() }).strict(),
  customer_details: z.object({ customer: z.string().min(1).max(200) }).strict(),
  recent_alerts: z.object({ hours: z.number().int().min(1).max(720).optional(), customer: z.string().max(200).optional(), limit: z.number().int().min(1).max(100).optional() }).strict(),
  payments: z.object({ status: z.enum(["AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"]).optional(), days: z.number().int().min(1).max(365).optional() }).strict(),
  suspicious_logins: z.object({ hours: z.number().int().min(1).max(720).optional() }).strict(),
} as const;

async function findOrg(q: string) {
  return (
    (await db.organization.findUnique({ where: { id: q } }).catch(() => null)) ??
    (await db.organization.findFirst({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { users: { some: { email: { contains: q, mode: "insensitive" } } } }, { phone: { contains: q } }] } }))
  );
}

async function runTool(name: string, raw: unknown): Promise<unknown> {
  const schema = schemas[name as keyof typeof schemas];
  if (!schema) return { error: `unknown tool ${name}` };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: "invalid input", details: parsed.error.flatten() };
  const now = Date.now();

  switch (name) {
    case "platform_overview": {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const [customers, blocked, activeSubs, pending, monthPays, p30, cams, devices, alerts, openTickets] = await Promise.all([
        db.organization.count(),
        db.organization.count({ where: { blockedAt: { not: null } } }),
        db.subscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { gt: new Date() } } }),
        db.payment.count({ where: { status: { in: ["RECEIPT_SUBMITTED", "UNDER_REVIEW"] } } }),
        db.payment.findMany({ where: { status: "APPROVED", reviewedAt: { gte: monthStart } }, select: { amount: true } }),
        db.payment.findMany({ where: { status: "APPROVED", reviewedAt: { gte: new Date(now - 30 * DAY) } }, select: { amount: true } }),
        db.camera.groupBy({ by: ["status"], _count: { _all: true } }),
        db.edgeDevice.findMany({ select: { lastHeartbeat: true } }),
        db.event.count({ where: { severity: { in: ["WARNING", "CRITICAL"] }, occurredAt: { gte: new Date(now - DAY) } } }),
        db.ticket.count({ where: { status: "OPEN" } }),
      ]);
      return {
        customers, blocked_customers: blocked, active_subscriptions: activeSubs, payments_waiting_review: pending,
        revenue_this_month_uzs: sum(monthPays.map((p) => p.amount)), revenue_last_30_days_uzs: sum(p30.map((p) => p.amount)),
        cameras: Object.fromEntries(cams.map((c) => [c.status, c._count._all])),
        edge_devices: { total: devices.length, online: devices.filter((x) => x.lastHeartbeat && now - x.lastHeartbeat.getTime() < 5 * 60_000).length },
        ai_alerts_last_24h: alerts,
        complaints_and_appeals_waiting_for_answer: openTickets, // page: /admin/tickets
      };
    }
    case "list_customers": {
      const a = parsed.data as z.infer<typeof schemas.list_customers>;
      const q = a.search?.trim();
      const orgs = await db.organization.findMany({
        where: {
          ...(a.only_blocked ? { blockedAt: { not: null } } : {}),
          ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { users: { some: { email: { contains: q, mode: "insensitive" } } } }] } : {}),
        },
        include: { users: { select: { email: true, name: true }, take: 1 }, _count: { select: { cameras: true } }, subscriptions: { where: { status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, take: 5, include: { plan: true } } },
        orderBy: { createdAt: "desc" },
        take: a.limit ?? 50,
      });
      return orgs.map((o) => ({
        id: o.id, name: o.name, service: o.service, phone: o.phone, owner: o.users[0], cameras: o._count.cameras,
        // the running (paid) subscription and, separately, any renewal / upgrade request still waiting for payment
        active_subscription: (() => {
          const s = o.subscriptions.find((x) => x.status === "ACTIVE" && x.currentPeriodEnd && x.currentPeriodEnd.getTime() > now);
          return s ? { plan: s.plan.tier, active_until: s.currentPeriodEnd } : null;
        })(),
        pending_request: (() => {
          const s = o.subscriptions.find((x) => ["REQUESTED", "APPROVED", "AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW"].includes(x.status));
          return s ? { plan: s.plan.tier, status: s.status, note: "renewal/upgrade request, service is not interrupted while an active subscription exists" } : null;
        })(),
        blocked: o.blockedAt ? { since: o.blockedAt, reason: o.blockReason } : false,
        registered: o.createdAt,
      }));
    }
    case "customer_details": {
      const o = await findOrg((parsed.data as { customer: string }).customer);
      if (!o) return { error: "customer not found" };
      const [full, alerts] = await Promise.all([
        db.organization.findUnique({
          where: { id: o.id },
          include: {
            users: { select: { email: true, name: true, phone: true, emailVerifiedAt: true, createdAt: true } },
            subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 10 },
            payments: { orderBy: { createdAt: "desc" }, take: 10, select: { reference: true, amount: true, status: true, periodStart: true, periodEnd: true, submittedAt: true, reviewedAt: true } },
            cameras: { select: { code: true, name: true, location: true, status: true, lastSeenAt: true, aiEnabled: true } },
            devices: { select: { serial: true, firmware: true, lastHeartbeat: true } },
          },
        }),
        db.event.groupBy({ by: ["type", "severity"], where: { organizationId: o.id, occurredAt: { gte: new Date(now - 7 * DAY) }, severity: { in: ["WARNING", "CRITICAL"] } }, _count: { _all: true } }),
      ]);
      return {
        ...full,
        subscriptions: full?.subscriptions.map((s) => ({ plan: `${s.plan.service} ${s.plan.tier}`, price_uzs: s.plan.priceMonthly, status: s.status, start: s.currentPeriodStart, end: s.currentPeriodEnd })),
        service_active_now: !!full?.subscriptions.some((s) => s.status === "ACTIVE" && s.currentPeriodEnd && s.currentPeriodEnd.getTime() > now),
        alerts_7_days: alerts.map((a) => ({ type: a.type, severity: a.severity, count: a._count._all })),
        admin_page: `/admin/customers/${o.id}`,
        cameras_page: `/admin/customers/${o.id}/live`,
      };
    }
    case "recent_alerts": {
      const a = parsed.data as z.infer<typeof schemas.recent_alerts>;
      const org = a.customer ? await findOrg(a.customer) : null;
      if (a.customer && !org) return { error: "customer not found" };
      const rows = await db.event.findMany({
        where: { severity: { in: ["WARNING", "CRITICAL"] }, occurredAt: { gte: new Date(now - (a.hours ?? 24) * 3600_000) }, ...(org ? { organizationId: org.id } : {}) },
        orderBy: { occurredAt: "desc" },
        take: a.limit ?? 40,
        include: { camera: { select: { name: true } }, organization: { select: { name: true } } },
      });
      return rows.map((e) => ({ at: e.occurredAt, customer: e.organization.name, camera: e.camera?.name, type: e.type, severity: e.severity, confidence: e.confidence, value: e.value, has_photo: !!e.snapshotKey }));
    }
    case "payments": {
      const a = parsed.data as z.infer<typeof schemas.payments>;
      const rows = await db.payment.findMany({
        where: { ...(a.status ? { status: a.status } : {}), createdAt: { gte: new Date(now - (a.days ?? 30) * DAY) } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { organization: { select: { name: true } } },
      });
      return rows.map((p) => ({ reference: p.reference, customer: p.organization.name, amount_uzs: p.amount, status: p.status, period: [p.periodStart, p.periodEnd], submitted: p.submittedAt, reviewed: p.reviewedAt }));
    }
    case "suspicious_logins": {
      const a = parsed.data as z.infer<typeof schemas.suspicious_logins>;
      const rows = await db.auditLog.findMany({
        where: { action: { in: ["auth.login_failed", "auth.2fa_failed", "auth.login_blocked"] }, createdAt: { gte: new Date(now - (a.hours ?? 24) * 3600_000) } },
        include: { user: { select: { email: true } } },
        take: 500,
      });
      const g = new Map<string, { email: string; failed_password: number; failed_2fa: number; blocked_attempts: number; last: Date }>();
      for (const r of rows) {
        const k = r.user?.email ?? "unknown";
        const x = g.get(k) ?? { email: k, failed_password: 0, failed_2fa: 0, blocked_attempts: 0, last: r.createdAt };
        if (r.action === "auth.login_failed") x.failed_password++;
        else if (r.action === "auth.2fa_failed") x.failed_2fa++;
        else x.blocked_attempts++;
        if (r.createdAt > x.last) x.last = r.createdAt;
        g.set(k, x);
      }
      return [...g.values()];
    }
  }
  return { error: "unhandled" };
}

const SYSTEM = `You are the built-in assistant of the SMARTVISION AI admin panel. SMARTVISION AI is a video-monitoring platform for schools, homes and farms in Uzbekistan: customers connect cameras to a local Edge AI computer (YOLOv8), pay a monthly subscription by card transfer (the admin checks the receipt and approves it), and get AI alerts.

You help the platform administrator. Answer in the language the admin writes in (Uzbek, Russian or English); for Uzbek use Latin script. Be concise and concrete: numbers, names, dates. Money is in UZS (so'm) — format like 150 000 so'm. A customer can have an ACTIVE subscription and at the same time a renewal request in AWAITING_PAYMENT: then the service is active until the end date and the renewal is just waiting for the receipt — say it exactly like that, never call such a customer "unpaid".

Use the tools to look up real data before answering any question about customers, payments, cameras, alerts or sign-ins; never invent data. Your tools are read-only: you cannot block, delete, approve or change anything. When an action is needed, say exactly where to do it in the admin panel:
- Block / unblock or watch a customer's cameras: "Xavfsizlik" page (/admin/security) or the customer's page.
- Delete a customer, reset a password: Admin → Mijozlar → customer name.
- Approve receipts: "To'lovlar" (/admin/payments). Subscription requests: "Arizalar" (/admin/requests).
- Answer complaints and appeals: "Murojaatlar" (/admin/tickets).
You may also answer general questions (how the platform works, camera setup, RTSP, security advice, business ideas). Format with short paragraphs or bullet lists; plain Markdown only.`;

export type ChatTurn = { role: "user" | "assistant"; text: string };

/** Runs the tool loop for one admin question. History holds earlier turns as plain text. */
export async function askAdminAi(history: ChatTurn[]): Promise<{ text: string } | { error: string }> {
  return geminiKey() ? askGemini(history) : askClaude(history);
}

/* ───────── Google Gemini (REST generateContent with function calling) ───────── */
type GPart = { text?: string; thought?: boolean; functionCall?: { name: string; args?: unknown; id?: string }; functionResponse?: unknown; thoughtSignature?: string };
type GContent = { role: "user" | "model"; parts: GPart[] };

/** Gemini takes an OpenAPI-style subset: drop JSON-schema-only keywords. */
function toGeminiSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(toGeminiSchema);
  if (s && typeof s === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) if (k !== "additionalProperties") out[k] = toGeminiSchema(v);
    return out;
  }
  return s;
}
export const toGeminiTools = (ts: { name: string; description?: string; input_schema: unknown }[]) => [{ functionDeclarations: ts.map((t) => ({ name: t.name, description: t.description, parameters: toGeminiSchema(t.input_schema) })) }];
const geminiTools = toGeminiTools(tools);

const askGemini = (history: ChatTurn[]) => geminiLoop(history, SYSTEM, geminiTools, runTool);

/** Gemini tool loop, shared by the admin and the customer assistants (each passes its own prompt and read-only tools). */
export async function geminiLoop(
  history: ChatTurn[],
  system: string,
  toolDecls: unknown,
  exec: (name: string, args: unknown) => Promise<unknown>,
): Promise<{ text: string } | { error: string }> {
  if (!geminiKey()) return { error: "not_configured" };
  const SYSTEM = system;
  const geminiTools = toolDecls;
  const runTool = exec;
  const contents: GContent[] = history.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  for (let i = 0; i < 10; i++) {
    let j: { candidates?: { content?: GContent; finishReason?: string }[]; promptFeedback?: { blockReason?: string }; error?: { code?: number; status?: string } };
    try {
      const body = JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents, tools: geminiTools, generationConfig: { maxOutputTokens: 8192 } });
      const call = () => fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": geminiKey()! }, body, signal: AbortSignal.timeout(75_000) });
      // the free tier is sometimes slow or briefly overloaded: one retry on timeout / 5xx
      let r = await call().catch(() => null);
      if (!r || r.status >= 500) r = await call();
      j = await r.json();
      if (!r.ok) {
        if (r.status === 429) return { error: "rate" };
        if (r.status === 400 && /API key/i.test(JSON.stringify(j))) return { error: "auth" };
        if (r.status === 401 || r.status === 403) return { error: "auth" };
        console.error("[gemini]", r.status, JSON.stringify(j).slice(0, 500));
        return { error: `api ${r.status}` };
      }
    } catch (e) {
      console.error("[gemini]", e);
      return { error: "network" };
    }
    if (j.promptFeedback?.blockReason) return { error: "refusal" };
    const cand = j.candidates?.[0];
    const parts = cand?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
    if (!calls.length) {
      if (cand?.finishReason === "SAFETY") return { error: "refusal" };
      return { text: text || "—" };
    }
    // echo the model turn unchanged (it carries thought signatures), then all function results in one turn
    contents.push({ role: "model", parts });
    const responses = await Promise.all(
      calls.map(async (p) => {
        const fc = p.functionCall!;
        let out: unknown;
        try {
          out = await runTool(fc.name, fc.args ?? {});
        } catch (e) {
          out = { error: (e as Error).message };
        }
        // Gemini expects an object; wrap arrays / primitives
        const response = out && typeof out === "object" && !Array.isArray(out) ? out : { result: out };
        return { functionResponse: { name: fc.name, ...(fc.id ? { id: fc.id } : {}), response: JSON.parse(JSON.stringify(response)) } }; // plain JSON (dates → strings); tools already cap row counts
      }),
    );
    contents.push({ role: "user", parts: responses as GPart[] });
  }
  return { error: "loop" };
}

/* ───────── Claude (Anthropic) ───────── */
async function askClaude(history: ChatTurn[]): Promise<{ text: string } | { error: string }> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.text }));

  for (let i = 0; i < 10; i++) {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await client.beta.messages.create({
        model: AI_MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools,
        messages,
      });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) return { error: "auth" };
      if (e instanceof Anthropic.RateLimitError) return { error: "rate" };
      if (e instanceof Anthropic.APIError) return { error: `api ${e.status ?? ""}` };
      return { error: "network" };
    }
    if (res.stop_reason === "refusal") return { error: "refusal" };
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    if (res.stop_reason === "end_turn" || res.stop_reason === "max_tokens" || res.stop_reason === "stop_sequence") return { text: text || "—" };

    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason === "pause_turn") continue;

    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!uses.length) return { text: text || "—" };
    // run all tool calls of this turn, return every result in one user message
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
      uses.map(async (u) => {
        try {
          const out = await runTool(u.name, u.input);
          return { type: "tool_result" as const, tool_use_id: u.id, content: JSON.stringify(out).slice(0, 60_000) };
        } catch (e) {
          return { type: "tool_result" as const, tool_use_id: u.id, content: `error: ${(e as Error).message}`, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }
  return { error: "loop" };
}
