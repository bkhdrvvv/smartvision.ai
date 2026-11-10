import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { featureDicts } from "./i18n/features";
import { fmt, isLocale, type Locale } from "./i18n";

/*
 * Telegram bot (free Bot API). The admin pastes the token from @BotFather in Admin → Settings.
 * No public webhook is needed: the server polls getUpdates every few seconds (src/instrumentation.ts),
 * so the bot also works when the site runs on a home computer.
 *
 *   t.me/<bot>?start=u_<code>  → links a customer's Telegram (alerts with photos)
 *   t.me/<bot>?start=p_<code>  → a parent subscribes to their child's arrival messages
 *   /stop                      → unlink
 */
const TOKEN_KEY = "telegram:token";
const OFFSET_KEY = "telegram:offset";
const NAME_KEY = "telegram:username";

const fd = (l?: string | null) => featureDicts[(isLocale(l) ? l : "uz") as Locale];

export async function botToken(): Promise<string | null> {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  const r = await db.setting.findUnique({ where: { key: TOKEN_KEY } }).catch(() => null);
  return r?.value || null;
}

export async function botUsername(): Promise<string | null> {
  return (await db.setting.findUnique({ where: { key: NAME_KEY } }).catch(() => null))?.value || null;
}

async function call<T = unknown>(method: string, body?: Record<string, unknown> | FormData, token?: string | null): Promise<T | null> {
  const t = token ?? (await botToken());
  if (!t) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${t}/${method}`, {
      method: "POST",
      ...(body instanceof FormData ? { body } : { headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = (await r.json()) as { ok: boolean; result?: T; description?: string };
    if (!j.ok) {
      console.error("[telegram]", method, j.description);
      return null;
    }
    return j.result ?? null;
  } catch (e) {
    console.error("[telegram]", method, (e as Error).message);
    return null;
  }
}

/** Save a token after checking it with getMe. */
export async function setBotToken(token: string | null): Promise<{ ok: true; username: string } | { ok: false }> {
  if (!token) {
    await db.setting.deleteMany({ where: { key: { in: [TOKEN_KEY, NAME_KEY, OFFSET_KEY] } } });
    return { ok: false };
  }
  const me = await call<{ username: string }>("getMe", {}, token);
  if (!me?.username) return { ok: false };
  for (const [key, value] of [[TOKEN_KEY, token], [NAME_KEY, me.username]] as const)
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  await call("deleteWebhook", {}, token); // polling mode
  await applyBotProfile(token);
  return { ok: true, username: me.username };
}

type Keyboard = { text: string; callback_data: string }[][];

const PROFILE = {
  "": { name: "SmartVision AI", short: "Kameralaringizdan AI ogohlantirishlar — rasm bilan, shu yerga.", about: "SMARTVISION AI — maktab, uy va ferma uchun sun'iy intellektli video kuzatuv.\n\nKamera xavfli narsani ko'rsa (begona odam, yong'in, yiqilish, taqiqlangan zona, notanish mashina) — rasm bilan shu yerga xabar keladi.\n\nUlash: saytda Sozlamalar → «Telegramni ulash».\nBuyruqlar: /holat · /rasm · /qoriqlash" },
  ru: { name: "SmartVision AI", short: "AI-тревоги с ваших камер — с фото, прямо сюда.", about: "SMARTVISION AI — видеонаблюдение с искусственным интеллектом для школ, домов и ферм.\n\nКамера увидела опасность (посторонний, пожар, падение, запретная зона, чужая машина) — сюда придёт сообщение с фото.\n\nПодключение: на сайте Настройки → «Подключить Telegram».\nКоманды: /holat · /rasm · /qoriqlash" },
  en: { name: "SmartVision AI", short: "AI alerts from your cameras — with a photo, right here.", about: "SMARTVISION AI — AI video monitoring for schools, homes and farms.\n\nWhen a camera sees danger (stranger, fire, fall, forbidden zone, unknown car) you get a message with a photo here.\n\nConnect: on the site Settings → “Connect Telegram”.\nCommands: /holat · /rasm · /qoriqlash" },
} as const;

/** Name, descriptions and the "/" command menu in uz (default), ru and en. */
export async function applyBotProfile(token?: string | null) {
  for (const [lang, l] of [["", "uz"], ["ru", "ru"], ["en", "en"]] as const) {
    const p = PROFILE[lang];
    const lc = lang ? { language_code: lang } : {};
    const t = featureDicts[l].x;
    await call("setMyName", { name: p.name, ...lc }, token);
    await call("setMyShortDescription", { short_description: p.short, ...lc }, token);
    await call("setMyDescription", { description: p.about, ...lc }, token);
    await call("setMyCommands", { commands: [{ command: "holat", description: t.tgCmdStatus }, { command: "rasm", description: t.tgCmdPhoto }, { command: "qoriqlash", description: t.tgCmdGuard }], ...lc }, token);
  }
}

export async function sendText(chatId: string, text: string, keyboard?: Keyboard) {
  return call("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true, ...(keyboard && { reply_markup: { inline_keyboard: keyboard } }) });
}

export async function sendPhoto(chatId: string, jpeg: Buffer, caption: string, keyboard?: Keyboard) {
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", caption.slice(0, 1000));
  if (keyboard) form.set("reply_markup", JSON.stringify({ inline_keyboard: keyboard }));
  form.set("photo", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "event.jpg");
  return call("sendPhoto", form);
}

/* ───── linking ───── */

/** One-time code for t.me/<bot>?start=u_<code> (valid 30 minutes). */
export async function userLinkCode(userId: string) {
  const code = randomBytes(9).toString("base64url");
  await db.setting.upsert({ where: { key: `tglink:${code}` }, create: { key: `tglink:${code}`, value: `${userId}|${Date.now() + 30 * 60_000}` }, update: {} });
  return code;
}

export async function botLink(payload: string) {
  const u = await botUsername();
  return u ? `https://t.me/${u}?start=${payload}` : null;
}

type Update = {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { first_name?: string; username?: string; language_code?: string }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number }; from?: { language_code?: string } };
};

/** Called every few seconds; handles /start and /stop. */
export async function pollUpdates() {
  if (!(await botToken())) return 0;
  const off = Number((await db.setting.findUnique({ where: { key: OFFSET_KEY } }))?.value) || 0;
  const ups = await call<Update[]>("getUpdates", { offset: off, timeout: 0, allowed_updates: ["message", "callback_query"] });
  if (!ups?.length) return 0;
  for (const u of ups) {
    try {
      await handle(u);
    } catch (e) {
      console.error("[telegram] handle", (e as Error).message);
    }
  }
  const next = String(ups[ups.length - 1].update_id + 1);
  await db.setting.upsert({ where: { key: OFFSET_KEY }, create: { key: OFFSET_KEY, value: next }, update: { value: next } });
  return ups.length;
}

async function handle(u: Update) {
  if (u.callback_query) return handleButton(u.callback_query);
  const m = u.message;
  if (!m?.text || m.chat.type !== "private") return;
  const chat = String(m.chat.id);
  const lang = (m.from?.language_code ?? "uz").slice(0, 2);
  const t = fd(lang === "ru" || lang === "en" ? lang : "uz").tg;
  const [cmd0, arg] = m.text.trim().split(/\s+/, 2);
  const cmd = cmd0.split("@")[0].toLowerCase();
  if (cmd === "/holat" || cmd === "/rasm" || cmd === "/qoriqlash" || cmd === "/help") return handleCommand(chat, cmd, lang);

  if (cmd === "/stop") {
    await db.user.updateMany({ where: { telegramChatId: chat }, data: { telegramChatId: null, telegramName: null } });
    const kids = await db.student.findMany({ where: { parentChats: { has: chat } }, select: { id: true, parentChats: true } });
    for (const k of kids) await db.student.update({ where: { id: k.id }, data: { parentChats: k.parentChats.filter((c) => c !== chat) } });
    return sendText(chat, t.stopped);
  }
  if (cmd !== "/start") return sendText(chat, t.hello);
  if (!arg) return sendText(chat, t.hello);

  if (arg.startsWith("u_")) {
    const key = `tglink:${arg.slice(2)}`;
    const row = await db.setting.findUnique({ where: { key } });
    const [uid, exp] = (row?.value ?? "").split("|");
    if (!row || !uid || Number(exp) < Date.now()) return sendText(chat, t.badCode);
    await db.setting.delete({ where: { key } });
    // one Telegram chat belongs to one account
    await db.user.updateMany({ where: { telegramChatId: chat }, data: { telegramChatId: null } });
    const user = await db.user.update({ where: { id: uid }, data: { telegramChatId: chat, telegramName: m.from?.username ? `@${m.from.username}` : (m.from?.first_name ?? "Telegram") } });
    return sendText(chat, fd(user.locale).tg.linkedUser);
  }
  if (arg.startsWith("p_")) {
    const st = await db.student.findUnique({ where: { parentCode: arg.slice(2) } });
    if (!st) return sendText(chat, t.badCode);
    if (!st.parentChats.includes(chat)) await db.student.update({ where: { id: st.id }, data: { parentChats: [...st.parentChats, chat].slice(-6) } });
    return sendText(chat, fmt(t.linkedParent, { n: st.name }));
  }
  return sendText(chat, t.hello);
}

/* ───── commands: /holat /rasm /qoriqlash (only for a linked customer) ───── */
const GUARD_LABEL = (l: Locale, m: string) => (featureDicts[l].guard.modes as Record<string, string>)[m] ?? m;

async function handleCommand(chat: string, cmd: string, lang: string) {
  const user = await db.user.findFirst({ where: { telegramChatId: chat }, include: { organization: true } });
  const l = ((user && isLocale(user.locale) ? user.locale : lang === "ru" || lang === "en" ? lang : "uz") as Locale);
  const x = featureDicts[l].x;
  if (cmd === "/help") return sendText(chat, x.tgHelp);
  if (user?.role === "ADMIN") return adminCommand(chat, cmd, l);
  if (!user?.organization) return sendText(chat, x.tgNotLinked);
  const org = user.organization;
  const cams = await db.camera.findMany({ where: { organizationId: org.id }, orderBy: { code: "asc" } });
  if (cmd === "/holat") {
    const start = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }) + "T00:00:00+05:00");
    const [e, w] = await Promise.all([
      db.event.count({ where: { organizationId: org.id, occurredAt: { gte: start } } }),
      db.event.count({ where: { organizationId: org.id, occurredAt: { gte: start }, severity: { in: ["WARNING", "CRITICAL"] } } }),
    ]);
    const fresh = (d: Date | null) => !!d && Date.now() - d.getTime() < 60_000;
    const lines = cams.map((c) => `${c.status !== "OFFLINE" && fresh(c.lastSeenAt) ? "🟢" : "🔴"} ${c.name} (${c.code})`).join("\n") || x.tgNoCams;
    return sendText(chat, fmt(x.tgStatus, { o: org.name, c: lines, e, w, g: GUARD_LABEL(l, org.guardMode) }));
  }
  if (cmd === "/rasm") {
    const { getFrame } = await import("./relay");
    let sent = 0;
    for (const c of cams) {
      const f = getFrame(c.id);
      if (f && f.jpeg.length > 100 && Date.now() - f.at < 30_000) {
        await sendPhoto(chat, f.jpeg, `📷 ${c.name} · ${new Date(f.at).toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
        sent++;
      }
    }
    return sent ? null : sendText(chat, x.tgNoFrame);
  }
  // /qoriqlash → buttons with the four modes
  const modes = ["always", "auto", "off", "custom"] as const;
  return sendText(chat, `${x.tgGuardAsk}\n(${GUARD_LABEL(l, org.guardMode)})`, [
    modes.slice(0, 2).map((m) => ({ text: (m === org.guardMode ? "● " : "") + GUARD_LABEL(l, m), callback_data: `g:${m}` })),
    modes.slice(2).map((m) => ({ text: (m === org.guardMode ? "● " : "") + GUARD_LABEL(l, m), callback_data: `g:${m}` })),
  ]);
}

/* ───── the platform admin: /holat = whole platform, /rasm = latest frames of all customers ───── */
const ADMIN_T = {
  uz: { title: "📊 SMARTVISION AI — platforma holati", customers: "Mijozlar", active: "Faol obunalar", cams: "Kameralar", online: "onlayn", alerts: "Bugungi ogohlantirishlar", payments: "Tekshiruv kutayotgan to'lovlar", requests: "Yangi arizalar", tickets: "Javob kutayotgan murojaatlar", guard: "Qo'riqlash rejimi har bir mijozda alohida — mijoz uni o'z Telegramidan /qoriqlash bilan boshqaradi.", noFrame: "Hozir hech bir kameradan rasm yo'q (Edge agentlar ishlamayapti)." },
  ru: { title: "📊 SMARTVISION AI — состояние платформы", customers: "Клиенты", active: "Активные подписки", cams: "Камеры", online: "онлайн", alerts: "Тревоги за сегодня", payments: "Платежи на проверке", requests: "Новые заявки", tickets: "Обращения без ответа", guard: "Режим охраны у каждого клиента свой — клиент управляет им командой /qoriqlash.", noFrame: "Сейчас нет кадров ни с одной камеры (Edge агенты не работают)." },
  en: { title: "📊 SMARTVISION AI — platform status", customers: "Customers", active: "Active subscriptions", cams: "Cameras", online: "online", alerts: "Alerts today", payments: "Payments to review", requests: "New requests", tickets: "Tickets waiting", guard: "Guard mode belongs to each customer — they control it with /qoriqlash.", noFrame: "No picture from any camera right now (Edge agents are not running)." },
};

async function adminCommand(chat: string, cmd: string, l: Locale) {
  const a = ADMIN_T[l];
  if (cmd === "/qoriqlash") return sendText(chat, a.guard);
  const cams = await db.camera.findMany({ include: { organization: { select: { name: true } } }, orderBy: { lastSeenAt: "desc" } });
  if (cmd === "/rasm") {
    const { getFrame } = await import("./relay");
    let sent = 0;
    for (const c of cams) {
      const f = getFrame(c.id);
      if (sent < 6 && f && f.jpeg.length > 100 && Date.now() - f.at < 30_000) {
        await sendPhoto(chat, f.jpeg, `📷 ${c.organization.name} · ${c.name}`);
        sent++;
      }
    }
    return sent ? null : sendText(chat, a.noFrame);
  }
  const start = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }) + "T00:00:00+05:00");
  const [orgs, active, alerts, pays, reqs, tickets] = await Promise.all([
    db.organization.count({ where: { demo: false } }),
    db.subscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { gt: new Date() } } }),
    db.event.count({ where: { occurredAt: { gte: start }, severity: { in: ["WARNING", "CRITICAL"] } } }),
    db.payment.count({ where: { status: { in: ["RECEIPT_SUBMITTED", "UNDER_REVIEW"] } } }),
    db.subscription.count({ where: { status: "REQUESTED" } }),
    db.ticket.count({ where: { status: "OPEN" } }),
  ]);
  const on = cams.filter((c) => c.status !== "OFFLINE" && c.lastSeenAt && Date.now() - c.lastSeenAt.getTime() < 60_000).length;
  return sendText(chat, [
    a.title, "",
    `👥 ${a.customers}: ${orgs}`,
    `✅ ${a.active}: ${active}`,
    `📷 ${a.cams}: ${cams.length} (${on} ${a.online})`,
    `⚠️ ${a.alerts}: ${alerts}`,
    `💳 ${a.payments}: ${pays}`,
    `📝 ${a.requests}: ${reqs}`,
    `💬 ${a.tickets}: ${tickets}`,
  ].join("\n"));
}

/* ───── buttons: under alerts (✅ all good / 👎 false alarm) and guard mode ───── */
async function handleButton(q: NonNullable<Update["callback_query"]>) {
  const chat = String(q.message?.chat.id ?? "");
  const answer = (text?: string) => call("answerCallbackQuery", { callback_query_id: q.id, ...(text && { text }) });
  const user = chat ? await db.user.findFirst({ where: { telegramChatId: chat } }) : null;
  const l = (user && isLocale(user.locale) ? user.locale : "uz") as Locale;
  const x = featureDicts[l].x;
  const isAdmin = user?.role === "ADMIN";
  if (!user || (!user.organizationId && !isAdmin)) return answer(x.tgNotLinked);
  const [kind, id] = (q.data ?? "").split(":", 2);
  if (isAdmin && kind === "g") return answer(ADMIN_T[l].guard);
  if (kind === "g" && ["auto", "custom", "always", "off"].includes(id) && user.orgRole !== "VIEWER") {
    await db.organization.update({ where: { id: user.organizationId! }, data: { guardMode: id } });
    await db.auditLog.create({ data: { userId: user.id, action: "org.guard.telegram", target: user.organizationId, meta: { mode: id } } });
    await answer(fmt(x.tgGuardSet, { m: GUARD_LABEL(l, id) }));
    return sendText(chat, fmt(x.tgGuardSet, { m: GUARD_LABEL(l, id) }));
  }
  if ((kind === "ok" || kind === "fa") && id && user.orgRole !== "VIEWER") {
    const e = await db.event.findFirst({ where: { id, ...(isAdmin ? {} : { organizationId: user.organizationId! }) }, include: { camera: true } });
    if (!e) return answer();
    if (kind === "ok") await db.event.update({ where: { id: e.id }, data: { resolved: true } });
    else if (!e.falseAlarm) {
      await db.event.update({ where: { id: e.id }, data: { falseAlarm: true, resolved: true } });
      if (e.camera) await db.camera.update({ where: { id: e.camera.id }, data: { minConf: Math.min(0.75, Math.round((e.camera.minConf + 0.04) * 100) / 100) } });
    }
    if (q.message) await call("editMessageReplyMarkup", { chat_id: chat, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
    await answer(kind === "ok" ? x.tgOk : x.tgFa);
    return sendText(chat, kind === "ok" ? x.tgOk : x.tgFa);
  }
  return answer();
}

/** Alert every linked user of an organization (photo if there is one). With an event id: ✅ / 👎 buttons under it. */
export async function telegramToOrg(orgId: string, text: (l: Locale) => string, photo?: Buffer | null, eventId?: string) {
  if (!(await botToken())) return;
  const users = await db.user.findMany({ where: { organizationId: orgId, telegramChatId: { not: null } }, select: { telegramChatId: true, locale: true, orgRole: true } });
  for (const u of users) {
    const l = (isLocale(u.locale) ? u.locale : "uz") as Locale;
    const msg = text(l);
    const kb: Keyboard | undefined = eventId && u.orgRole !== "VIEWER" ? [[{ text: featureDicts[l].x.tgBtnOk, callback_data: `ok:${eventId}` }, { text: featureDicts[l].x.tgBtnFa, callback_data: `fa:${eventId}` }]] : undefined;
    if (photo) await sendPhoto(u.telegramChatId!, photo, msg, kb);
    else await sendText(u.telegramChatId!, msg, kb);
  }
}
