# SMARTVISION AI — to'liq loyiha prompti

> Bu promptni istalgan kuchli AI dasturchiga (Claude, ChatGPT va h.k.) bering — u shu saytni noldan qurib chiqadi.
> Har bir bo'limni ketma-ket bajarishni so'rang, har bosqichdan keyin test qildiring.

---

## 1. Rol va maqsad

Sen tajribali full-stack dasturchi va mahsulot dizaynerisan. Menga **SMARTVISION AI** — maktablar, uylar va fermalar uchun
sun'iy intellektli video kuzatuv platformasini qurib ber. Mijozning o'z IP kameralari joyidagi kichik kompyuterga (Edge AI)
ulanadi, AI odam, mashina, hayvon, yong'in, yiqilish va boshqalarni aniqlaydi va rasm bilan saytga hamda Telegramga
ogohlantirish yuboradi. **Video joyida qoladi**, serverga faqat hodisalar va kichik rasmlar keladi.

Bozor: O'zbekiston. Tillar: **o'zbek (lotin, asosiy), rus, ingliz**. Valyuta: so'm.

## 2. Texnologiyalar

- **Next.js 15 (App Router)**, React 19, TypeScript, server actions, **Tailwind CSS v4**, framer-motion, lucide-react ikonlari.
- **PostgreSQL + Prisma**. Fayllar (cheklar, rasmlar) — serverda yopiq papkada, faqat egasiga beriladi.
- Auth: email + parol (bcrypt), JWT cookie (httpOnly), token versiyasi (hamma sessiyalarni o'chirish uchun), ixtiyoriy 2FA (TOTP).
- **Edge agent: Python** (YOLOX aniqlash, YuNet + SFace yuz tanish, fast-alpr mashina raqami), RTSP/ONVIF kameralar.
- **Telegram Bot API** (polling), Gemini — AI yordamchilar uchun.
- Brauzerda AI demo: TensorFlow.js + COCO-SSD (CDN orqali).
- Hech qanday pullik servis majburiy emas. SMS va avtomatik qo'ng'iroq **yo'q**.

## 3. Dizayn

- **Qorong'i premium uslub**: fon #070b16, ko'k-binafsha gradientlar (#22d3ee → #4f46e5 → #7c3aed), "glass" kartalar,
  yumshoq soya va nur effektlari, katta qalin sarlavhalar (Inter Tight), matn — Inter, raqamlar — JetBrains Mono.
- Logo: kamera diafragmasi + AI ko'zi (SVG), yonida "SMARTVISION **AI**" (AI — gradient). Logo hech qachon ikki qatorga tushmasin.
- Har bir sahifa **telefonda gorizontal scrollsiz** ishlasin. Animatsiyalar yengil (fadeUp, spring).
- Ikonkalar — faqat SVG (lucide), stiker/emoji dizayn elementi sifatida ishlatilmasin (xabarlarda mumkin).
- Bolalarcha emas — **premium, ishonchli, texnologik** ko'rinish.

## 4. Ommaviy sayt (mehmonlar uchun)

1. **Tepada aksiya banneri** — admin matnini o'zgartiradi, taymer bilan ("⏳ 20 kun 4 soat 59 daqiqa qoldi"). Hozirgi aksiya: birinchi oyga 20%, kod `AKSIYA20`.
2. **Sarlavha (header)**: Bosh sahifa, Yechimlar, Narxlar, Demo, AI'ni sinab ko'ring, Aloqa; til almashtirgich (UZ/RU/EN); Kirish / Boshlash. Telefonda yon menyu.
3. **Bosh sahifa**: katta hero (3D/animatsiya), 3 yechim (Smart School, Smart Home, Smart Farm), qanday ishlaydi (4 qadam),
   afzalliklar, "Qiziqarli" bloki (AI sinov, xavfsizlik testi, bepul maslahat formasi, "ulashing — 10% oling" `ULASH10`), mijoz sharhlari, footer.
4. **Yechimlar sahifalari** (`/solutions/school|home|farm`): har biriga mos funksiyalar. Maktabda — "Maktabda bir kun" animatsiyali vaqt chizig'i; fermada — fermer kalkulyatori (yo'qotishlar → AI qancha saqlab qoladi).
5. **Narxlar** (`/pricing`): xizmat tablari, **Oylik / Yillik** tugmasi, 3 tarif kartasi, narx kalkulyatori (kamera soni → mos tarif), tejash kalkulyatori.
6. **Demo** (`/demo`): mijoz kabineti qanday ko'rinishi — namunaviy ma'lumotlar bilan, "namuna" belgisi bilan.
7. **AI'ni sinab ko'ring** (`/try`): mehmon o'z kamerasini yoqadi, AI brauzerning o'zida odam/narsalarni ramkaga oladi (serverga hech narsa ketmaydi). Pastida "oddiy kamera vs AI kamera" surgichli solishtirish.
8. **Xavfsizlik testi** (`/test`): 8 savol → ball va maslahat.
9. **Aloqa**, **Biz haqimizda**, **Shartlar**, **Maxfiylik**, chiroyli **404**.
10. **AI sotuv maslahatchisi** (o'ng pastda chat): faqat haqiqiy tariflar asosida javob beradi, narx o'ylab topmaydi.
11. Cookie ogohlantirishi (faqat zarur cookie), PWA (ilovani o'rnatish), sitemap, robots, ulashish rasmi (OG).

Kontaktlar: telefon **+998 99 140 20 60**, email **smartvisionai@mail.com**, Telegram @zxc_bkhdrvv, Instagram bkhdrvvvv.7.

## 5. Tariflar va to'lov

| Xizmat | Start | Standard | PRO |
|---|---|---|---|
| Maktab | 60 000 (3 kamera) | 100 000 (5) | 200 000 (10) |
| Uy | 50 000 (2) | 90 000 (4) | 160 000 (8) |
| Ferma | 100 000 (3) | 150 000 (6) | 250 000 (12) |

- Narxlar so'm/oy. Oddiy funksiyalar — Start'da, kuchli xavfsizlik (Night Vision, yuz tanish, raqam o'qish, ovozli ogohlantirish va h.k.) — qimmat tariflarda. Standard ⊃ Start, PRO ⊃ Standard. Yopiq funksiyada "PRO tarifda" qulfi ko'rsatilsin.
- **Yillik to'lov**: 12 oy narxidan chegirma — Start −20 000, Standard −35 000, PRO −50 000 so'm; obuna 365 kun.
- **Kupon** foiz chegirma beradi (faqat birinchi oyga), muddat va limit bilan.
- **7 kunlik bepul sinov** — bir tashkilot / telefon uchun faqat bir marta, email tasdiqlangan bo'lishi shart.
- To'lov jarayoni (Click/Payme hozircha **yo'q**): mijoz tarif tanlaydi → admin tasdiqlaydi → mijoz kartaga o'tkazadi va chek rasmini yuklaydi → admin chekni tekshiradi → obuna yoqiladi. Muddatidan oldin uzaytirilsa, qolgan kunlar ustiga qo'shiladi.
- Taklif tizimi: do'stini taklif qilgan odam do'sti birinchi to'lov qilgach 20% kupon oladi.

## 6. Mijoz kabineti (`/dashboard`)

Chap menyu (scroll bo'ladi, pastda akkaunt va chiqish doim ko'rinadi):
Umumiy ko'rinish, Kameralar, Jonli monitoring, AI hodisalar, AI yordamchi, O'quvchilar, Mashina raqamlari, Mehmonlar, Tahlil, Hisobotlar, Bildirishnomalar, Obuna, Jamoa, Do'stni taklif, Sozlamalar, Yordam.

- **Bosh sahifa**: salomlashish (vaqtga qarab), xavfsizlik chirog'i (yashil/sariq/qizil), KPI kartalar, birinchi qadamlar ro'yxati, **yutuq nishonlari** (10 ta: 7/30 kun xavfsiz, 100/1000 hodisa, 3 kamera, Telegram, qo'riqlash rejimi, PRO, raqamlar, davomat), so'nggi hodisalar, kamera holati, tarif kartasi (yillikda "💚 X so'm tejadingiz").
- **Hodisalar**: rasm, tur, kamera, ishonchlilik, "yolg'on signal" belgisi, hal qilindi.
- **Maktab**: o'quvchilar ro'yxati (yuz bilan), davomat, soat 09:00 da kelmaganlar/kechikkanlar ro'yxati, ota-onaga Telegram (kirdi/chiqdi), oyning 1-kuni ota-onaga oylik davomat.
- **Mashina raqamlari**: o'zbek raqam formati badge ko'rinishida, oq/qora ro'yxat, tiniq rasm.
- **Qo'riqlash rejimi** (tunda/ketganda har qanday harakat — xavf), **taqiqlangan zona** chizish, **ovozli ogohlantirish** (brauzer ruxsat so'raydi; ruxsat berilmasa karnay ishlamaydi).
- **Hisobotlar**: CSV yuklash + **oylik PDF hisobot** (oq qog'oz ko'rinishi, brauzerning "PDF saqlash"i bilan).
- **Telegram ulash**: Sozlamalar → «Telegramni ulash» tugmasi → botga o'tadi → ulanadi.
- **Ruxsatlar oynasi**: ovoz, bildirishnoma, mikrofon — bir marta so'raladi, "Keyinroq" 24 soat.
- **Yordam**: admin bilan chat (matn, rasm, ovozli xabar), sharh yozish formasi.

## 7. Admin panel (`/admin`)

Umumiy ko'rinish (mijozlar, faol obunalar, kameralar, onlayn Edge; **daromad grafigi oylik/yillik alohida**), Mijozlar (tahrirlash, bloklash, parolni tiklash, o'chirish — nomini yozib tasdiqlash bilan), Xavfsizlik, AI yordamchi (ma'lumotlar bazasi bo'yicha savollarga javob), Murojaatlar (chat), Mijozlar fikrlari (tasdiqlansa saytda chiqadi), Arizalar, Tarif va narxlar, Kuponlar, To'lovlar (chekni ko'rish, tasdiqlash/rad etish, CSV), Edge qurilmalar, Bildirishnomalar, Aksiya banneri, Tizim sozlamalari, Audit jurnali.

## 8. Telegram bot

- Bot **maxfiy**: faqat ulangan foydalanuvchilarga javob beradi, guruhlardan chiqib ketadi, begonaga kuniga bitta salom, flood limit.
- Mijozga: AI ogohlantirishlar (rasm bilan), obuna/to'lov xabarlari, kunlik xulosa (20:00), haftalik hisobot (dushanba 08:00: hodisalar, odamlar, mashinalar, eng band kun, **kamera uzilishlari**), bayram kuponlari.
- Adminga: yangi ariza, chek yuklandi, yangi murojaat, bepul maslahat so'rovi, kirish ogohlantirishi; admin buyruqlari (/stats, /requests va h.k.).
- Bot nomi, logosi, tavsifi kod orqali o'rnatiladi.

## 9. Avtomatik ishlar (har 10 daqiqada cron)

Obuna muddati tugashi va 3 kun oldin eslatma (oyliklarga yillik taklifi bilan), kunlik zaxira nusxa, eski yuz rasmlarini 30 kundan keyin o'chirish, haftalik va kunlik hisobotlar, maktab davomati, ota-onalarga oylik hisobot, bayram kuponlari (Yangi yil, 8-mart, Navro'z, Mustaqillik, O'qituvchilar kuni — 15%, 3 kun), 30 kundan keyin "bizni baholang" so'rovi.
Har bir ish **bir marta** bajarilsin (bayroq kaliti bilan), ikki marta yubormasin.

## 10. Xavfsizlik va maxfiylik

- Har bir server action'da rol tekshiruvi (CUSTOMER / ADMIN, tashkilot egasi / a'zo).
- Rate limit (kirish, forma, chat), honeypot maydon, CSRF'ga chidamli server actions, xavfsiz header'lar
  (Permissions-Policy: `camera=(self), microphone=(self)` — aks holda ovozli xabar ishlamaydi).
- Cheklar va yuz rasmlari ommaviy emas. Parol, token, .env, baza, yuklangan fayllar git'ga tushmasin.
- Edge qurilma faqat o'z kaliti bilan ulanadi; bloklangan mijoz qurilmasi rad etiladi.
- Edge agentda veb-kamera standart holatda **o'chiq**; test faqat test video yoki soxta kamera bilan.

## 11. Sifat talablari

- TypeScript xatosiz (`tsc --noEmit`), production build muvaffaqiyatli.
- Har bir funksiyani **haqiqiy brauzerda (headless) test qil**: sahifa ochiladi, tugma bosiladi, bazada natija bor, konsolda xato yo'q, telefon kengligida sig'adi.
- Har bir yangi funksiya 3 tilda tarjima qilinsin (o'zbekcha matnlar tabiiy, "krinj" emas).
- Hydration xatolari bo'lmasin: vaqtga bog'liq matn (taymer, "hozir") faqat brauzerda chizilsin.
- Kod tushunarli bo'lsin, har bir murakkab joyga qisqa izoh.

## 12. Hozircha qilinmaydi

Click/Payme avtomatik to'lov (YaTT ro'yxatdan o'tgach), hodisa videosi yozish, SMS va avtomatik qo'ng'iroq.

## 13. Ish tartibi

1. Avval ma'lumotlar bazasi sxemasi va auth.
2. Ommaviy sayt + tariflar.
3. Mijoz kabineti + obuna/to'lov oqimi.
4. Admin panel.
5. Edge agent API + Python agent.
6. Telegram bot + cron ishlari.
7. Qiziqarli funksiyalar (AI sinov, test, kalkulyatorlar, nishonlar).
8. To'liq test, skrinshotlar, deploy yo'riqnomasi.

Har bosqich oxirida: nima qilinganini, nima test qilinganini va nima qolganini qisqa yoz. Mendan keraksiz savol so'rama — oqilona standart tanla va davom et.
