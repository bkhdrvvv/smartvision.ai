# SMARTVISION AI — xavfsizlik va xatolar bo'yicha hisobot (13-noyabr 2026)

## 1. Admin panel himoyasi
| Nima qilindi | Natija (test) |
|---|---|
| Begona odam yoki mijoz `/admin` ni ochsa — oddiy **404** | ✅ 404 chiqadi |
| Admin **12 soatdan** keyin avtomatik chiqadi (mijozlar 7 kun) | ✅ |
| Admin uchun **2 bosqichli kirish (2FA) majburiy** — yoqilmaguncha faqat sozlash sahifasi ochiladi | ✅ |
| 2FA sozlash sahifasida **QR kod** (telefon bilan skanerlash), parol bloki olib tashlandi | ✅ |
| "2FA'ni yoqish" bosilganda chiqadigan noto'g'ri yashil "Xatolik yuz berdi" yozuvi | ✅ tuzatildi |
| 2FA yoqmagan admin API orqali ham cheklar/rasmlarni ocha olmaydi | ✅ 401 |

**Sizning ishingiz:** admin bo'lib kiring → telefonda Google Authenticator → «+» → «QR kodni skanerlash» → 6 xonali kod → «Tasdiqlash va yoqish».
Eslatma: «2FA'ni yoqish»ni har bosganda **yangi** QR chiqadi — oxirgisini skanerlang.

## 2. Xaker hujumi testi — 36 ta hujum, **0 tasi o'tdi**
Sinab ko'rildi va to'xtatildi: soxta admin token, imzosiz token, rolni o'zgartirish, muddati o'tgan token,
boshqa mijozning kamerasi / yuz rasmlari / to'lov cheki / o'quvchi rasmi / chati, kirmasdan API, kalitsiz cron / Telegram / Edge,
maxfiy fayllar (`.env`, `.git`, `prisma`, `uploads`, `backups`), saytni boshqa saytga joylash (clickjacking), begona saytga yo'naltirish.

## 3. Topilgan va tuzatilgan kamchiliklar
| # | Kamchilik | Xavf | Holat |
|---|---|---|---|
| 1 | Soxta IP (X-Forwarded-For) bilan cheksiz parol taxmin qilish | 🟠 O'rta | ✅ Tuzatildi — 9-urinishda bloklanadi, soxta IP ishlamaydi; email bo'yicha limit 60 → 20 / 15 daq |
| 2 | Content-Security-Policy yo'q edi | 🟡 Past | ✅ Qo'shildi (xarita, AI demo, lokal kameralar ishlashi tekshirildi) |
| 3 | Header'da "Next.js" ko'rinardi | 🟡 Past | ✅ Olib tashlandi |
| 4 | HSTS yo'q edi | 🟡 Past | ✅ HTTPS domen bo'lganda o'zi yoqiladi (Caddy ham qo'shadi) |
| 5 | Ro'yxatdan o'tishda "bu email band" — kim mijoz ekanini bilish mumkin edi | 🟡 Past | ✅ Endi javob bir xil; egasiga "sizda hisob bor, kiring" xati boradi |
| 6 | Server sozlamasida (Caddy) kamera bloklangan edi — internetda "AI'ni sinab ko'ring" ishlamas edi | 🟠 | ✅ Tuzatildi |
| 7 | Jamoa a'zosi tarif sotib olmoqchi bo'lsa ekranda **"forbidden"** chiqardi | 🟡 Xato | ✅ "Buni faqat hisob egasi qila oladi…" |
| 8 | 2FA xatolarida "already_enabled", "unauthorized" kabi kodlar chiqardi | 🟡 Xato | ✅ Tushunarli matn |

## 4. Kirish va sotib olish — to'liq sinov (hammasi ✅)
1. Noto'g'ri parol → "Email yoki parol noto'g'ri." 
2. To'g'ri parol → kabinet ochiladi
3. Yillik tarif + `AKSIYA20` kupon → 90 000×0.8 + 90 000×11 − 35 000 = **1,027,000** so'm (to'g'ri)
4. Ariza → admin tasdiqlaydi → to'lov **365 kunlik** yaratiladi
5. Mijoz chek yuklaydi → admin tasdiqlaydi → obuna **365 kunga faol**
6. Jamoa a'zosi xarid qila olmaydi va sababini tushunarli ko'radi
(Test uchun vaqtinchalik hisoblar ochildi va oxirida o'chirildi. Sizning Telegramingizga "yangi ariza / chek" xabarlari sinovdan kelgan bo'lishi mumkin.)

## 4b. Kuchli hujum (14-noyabr) va tuzatishlar
| # | Topilgan | Xavf | Holat |
|---|---|---|---|
| 9 | **Saytni qotirish (DoS):** mijoz admin amalining ID'sini yuborsa, so'rov cheksiz aylanib qolardi (Next.js amalni `/admin` sahifasiga uzatardi, u esa 404 sahifasiga, u yana uzatardi…). Har so'rov server xotirasini band qilardi. | 🔴 Yuqori | ✅ Tuzatildi — endi 50 ms da rad etiladi; urinish audit jurnaliga yoziladi |
| 10 | **Kuponni qayta ishlatish:** bitta mijoz AKSIYA20/ULASH10 ni har yangi arizada qayta ishlata olardi; bir martalik DOST kuponi to'lovgacha bir nechta mijozga ishlardi | 🟠 O'rta (pul) | ✅ Har kupon bir hisob uchun bir marta; DOST faqat egasiga; limitda kutilayotgan arizalar ham hisoblanadi |
| 11 | **Chiqishdan keyin ham token ishlardi** (o'g'irlangan cookie 7 kungacha amal qilardi) | 🟡 Past | ✅ "Chiqish" bosilganda token serverda bekor qilinadi (boshqa qurilmalar chiqib ketmaydi) |

Buzib bo'lmagan hujumlar: admin amallarini haqiqiy ID bilan chaqirish, CSRF (boshqa saytdan buyruq), soxta fayl (HTML/SVG rasm qilib), `../` yo'li, stored XSS (nom va xabarda skript), 2FA'siz admin, SQL injection (kodda xom SQL yo'q), parol tiklash havolasi, Google kirish, Edge orqali boshqa mijozga hodisa.
Qayta tekshiruv: oddiy hujumlar 34/34 to'xtatildi, kuchli hujumlar hammasi to'xtatildi, xarid zanjiri to'liq ishlaydi.

## 5. Serverga chiqarishda albatta
- `.env` da **`TRUST_PROXY="1"`** bo'lsin (namuna: `deploy/env.production.example`) — busiz hamma tashrif bitta IP deb hisoblanadi.
- Caddy sozlamasi (`deploy/Caddyfile`) yangilandi — haqiqiy IP'ni o'zi beradi.

## 6. Ochiq qolgan
- Ba'zan konsolda React #418 (hydration) xatosi — **xavfsizlikka aloqasi yo'q**, sahifa o'zi tiklanadi, foydalanuvchiga ko'rinmaydi. Sababi hali topilmadi.
- Bu kompyuterda (proksisiz) butun sayt uchun soatiga 15 ta email-kod limiti bor — faqat lokal sinovga ta'sir qiladi.
