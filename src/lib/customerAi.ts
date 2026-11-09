import "server-only";
import { z } from "zod";
import { db } from "./db";
import { geminiLoop, toGeminiTools, type ChatTurn } from "./adminAi";

/**
 * Customer AI assistant: answers questions about ONE organization's cameras, events and attendance.
 * Every tool is read-only and filtered by the signed-in customer's organization id.
 */
const tools = [
  {
    name: "overview",
    description: "Cameras with status (online/weak/offline) and last signal time, today's event counts by type, current guard mode, subscription end date.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "events",
    description: "AI events of this customer's cameras, newest first. Filter by hours back (default 24), by type (ENTRY, EXIT, PERSON, UNKNOWN_PERSON, OCCUPANCY, SAFETY, CAMERA_STATUS, LIVESTOCK, VEHICLE, FIRE_SMOKE, INTRUSION, FALL, ZONE, STUDENT), by camera name, or only warnings.",
    input_schema: {
      type: "object",
      properties: {
        hours: { type: "integer", minimum: 1, maximum: 720 },
        type: { type: "string" },
        camera: { type: "string" },
        plate: { type: "string", description: "part of a licence plate, letters/digits only" },
        only_alerts: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "attendance",
    description: "School attendance for a day (YYYY-MM-DD, default today in Tashkent): which students came (first and last time seen) and who is absent.",
    input_schema: { type: "object", properties: { day: { type: "string" } }, additionalProperties: false },
  },
];

const schemas = {
  overview: z.object({}).strict(),
  events: z.object({ hours: z.number().int().min(1).max(720).optional(), type: z.string().max(30).optional(), camera: z.string().max(80).optional(), plate: z.string().max(16).optional(), only_alerts: z.boolean().optional(), limit: z.number().int().min(1).max(100).optional() }).strict(),
  attendance: z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict(),
};

const tz = (d: Date) => d.toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" });
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });

function runner(orgId: string) {
  return async (name: string, raw: unknown): Promise<unknown> => {
    const schema = schemas[name as keyof typeof schemas];
    if (!schema) return { error: `unknown tool ${name}` };
    const p = schema.safeParse(raw ?? {});
    if (!p.success) return { error: "invalid input" };
    if (name === "overview") {
      const start = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }) + "T00:00:00+05:00");
      const [org, cams, byType, sub] = await Promise.all([
        db.organization.findUnique({ where: { id: orgId }, select: { name: true, service: true, guardMode: true, guardFrom: true, guardTo: true } }),
        db.camera.findMany({ where: { organizationId: orgId }, select: { code: true, name: true, location: true, status: true, lastSeenAt: true, aiEnabled: true } }),
        db.event.groupBy({ by: ["type"], where: { organizationId: orgId, occurredAt: { gte: start } }, _count: { _all: true } }),
        db.subscription.findFirst({ where: { organizationId: orgId, status: "ACTIVE" }, orderBy: { currentPeriodEnd: "desc" }, include: { plan: true } }),
      ]);
      return {
        organization: org,
        cameras: cams.map((c) => ({ ...c, lastSeenAt: c.lastSeenAt ? tz(c.lastSeenAt) : null })),
        events_today: Object.fromEntries(byType.map((t) => [t.type, t._count._all])),
        subscription: sub ? { plan: sub.plan.tier, until: sub.currentPeriodEnd ? tz(sub.currentPeriodEnd) : null } : null,
        now_tashkent: tz(new Date()),
      };
    }
    if (name === "events") {
      const a = p.data as z.infer<typeof schemas.events>;
      const rows = await db.event.findMany({
        where: {
          organizationId: orgId,
          occurredAt: { gte: new Date(Date.now() - (a.hours ?? 24) * 3600_000) },
          ...(a.type ? { type: a.type as never } : {}),
          ...(a.only_alerts ? { severity: { in: ["WARNING", "CRITICAL"] } } : {}),
          ...(a.camera ? { camera: { name: { contains: a.camera, mode: "insensitive" } } } : {}),
          ...(a.plate && a.plate.replace(/[^A-Za-z0-9]/g, "") ? { plate: { contains: a.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase() } } : {}),
        },
        orderBy: { occurredAt: "desc" },
        take: a.limit ?? 40,
        include: { camera: { select: { name: true } } },
      });
      return rows.map((e) => ({ at: tz(e.occurredAt), camera: e.camera?.name, type: e.type, severity: e.severity, value: e.value, plate: e.plate ?? undefined, has_photo: !!e.snapshotKey }));
    }
    if (name === "attendance") {
      const day = (p.data as { day?: string }).day ?? today();
      const students = await db.student.findMany({ where: { organizationId: orgId }, include: { attendance: { where: { day } } }, orderBy: { name: "asc" } });
      return {
        day,
        total: students.length,
        present: students.filter((s) => s.attendance.length).map((s) => ({ name: s.name, group: s.group, first: tz(s.attendance[0].firstSeenAt), last: tz(s.attendance[0].lastSeenAt) })),
        absent: students.filter((s) => !s.attendance.length).map((s) => ({ name: s.name, group: s.group })),
      };
    }
    return { error: "unhandled" };
  };
}

const SYSTEM = `You are the AI assistant inside the SMARTVISION AI customer dashboard (video monitoring with AI for schools, homes and farms in Uzbekistan).
You talk to the customer about THEIR OWN cameras only. Answer in the language they write in (Uzbek in Latin script, Russian or English). Be short, friendly and simple — like explaining to someone who is not technical. Times are Tashkent time.
Always use the tools to look up real data before answering about cameras, events or attendance; never invent anything. Tools are read-only.
Where to do things in the dashboard: live video — "Jonli monitoring"; all events with photos — "AI hodisalar"; guard mode, Telegram, speaker, team — "Sozlamalar"; forbidden zone — "Kameralar" → camera → "Zona chizish"; students — "O'quvchilar"; payment — "Obuna".
Event types: ENTRY/EXIT = crossed the counting line, UNKNOWN_PERSON/INTRUSION = person during guard hours, ZONE = person in the forbidden zone, FALL = a person fell, FIRE_SMOKE = possible fire, LIVESTOCK = animal count, VEHICLE = car (plate = its licence plate if it was read; page "Mashina raqamlari"), STUDENT = recognised student, TAMPER = camera covered (value 1) or turned away (value 2), LOITER = a stranger stayed long (value = seconds), CAMERA_HEALTH = blurred (value 1) or too dark (value 2) picture. Events marked falseAlarm were wrong alerts. Plain Markdown only.`;

const decls = toGeminiTools(tools);

export function askCustomerAi(orgId: string, history: ChatTurn[]) {
  return geminiLoop(history, SYSTEM, decls, runner(orgId));
}
