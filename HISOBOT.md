# SMARTVISION AI — hisobot

## ✅ Yangi (real ishlash uchun)

### 1. Haqiqiy PostgreSQL bazasi
- Eski bitta ulanishli `prisma dev` o'rniga **haqiqiy PostgreSQL 17** (ma'lumotlar `.pgdata` papkasida).
- Bazada faqat **admin** va sizning **"ferma"** hisobingiz qoldi: obuna (Standard, 6-dekabrgacha), 150 000 so'mlik to'lov va cheki, **EDGE-FRM-0001** qurilmasi.
- Barcha test va demo hisoblar, test videosi, test tokeni, test rasmlari va cheklar o'chirildi.

### 2. Ro'yxatdan o'tish faqat haqiqiy email bilan
- 1-qadam: email yoziladi va unga **6 xonali kod** yuboriladi. Kod 10 daqiqa amal qiladi, 5 marta xato kiritish mumkin.
- 2-qadam: kod to'g'ri kiritilsagina ma'lumotlar formasi ochiladi va hisob yaratiladi.
- Email xato yozilsa, kod u yerga bormaydi va hisob ochilmaydi. "Emailni o'zgartirish" tugmasi bor.

### 3. Kirish usullari
- Kirish uchun 3 usul bor: **parol**, **emailga kelgan kod** yoki **Google**.
- Google bilan kirilganda, shu email bilan ochilgan hisob bo'lsa, o'shanga ulanadi. Hisob bo'lmasa, tashkilot nomi va telefon so'raladi.

### 4. Admin → Mijozlar → (mijoz nomi)
- **Bloklash:** mijoz tizimga kira olmaydi, barcha sessiyalari yopiladi va Edge qurilmasi rad etiladi. Ma'lumotlar saqlanadi, istalgan vaqtda blokdan chiqarish mumkin.
- **Butunlay o'chirish:** tasdiqlash uchun mijoz nomini yozish kerak.

## 🔁 Qanday ishga tushiriladi
- **`start.bat`** faylini ikki marta bosing. U bazani, saytni va AI agentni ishga tushiradi, keyin http://localhost:3000 sahifasini ochadi.
- **`stop.bat`** hammasini to'g'ri tartibda yopadi.

## ⚙️ Sizdan kerak bo'ladigan sozlamalar (`.env`)
- **Email yuborish (SMTP).** Busiz kodlar real pochtaga bormaydi, faqat **Admin → Chiquvchi xatlar** bo'limida ko'rinadi. Gmail uchun:
  1. Ikki bosqichli tasdiqni yoqing.
  2. https://myaccount.google.com/apppasswords sahifasida "ilova paroli" yarating.
  3. `.env` fayliga `SMTP_HOST="smtp.gmail.com"`, `SMTP_PORT="465"`, `SMTP_USER`, `SMTP_PASSWORD` (ilova paroli) va `SMTP_FROM` yozing.
- **Google orqali kirish.** `GOOGLE_CLIENT_ID` va `GOOGLE_CLIENT_SECRET` yozilmaguncha bu tugma ko'rinmaydi. Olish tartibi:
  1. https://console.cloud.google.com sahifasini oching.
  2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application** ni tanlang.
  3. **Authorized redirect URI** ga `http://localhost:3000/api/auth/google/callback` ni yozing (domen bo'lsa, `https://domen/api/auth/google/callback`).

## ⚠️ Ochiq qolgan masalalar
- ~~YOLOv8 litsenziyasi~~ — hal qilindi: agent endi bepul YOLOX bilan ishlaydi (pastga qarang).
- **Yong'in/tutun aniqlash tajribaviy.**
- **Saytni internetga chiqarish uchun VPS va domen kerak.** Domen bo'lganda `NEXT_PUBLIC_SITE_URL` ni ham almashtiring.
- Eski `prisma dev` bazasi zaxira sifatida diskda qoldi. U endi ishlatilmaydi.

## 🆕 Yangi qo'shilganlar

### YOLOX — bepul AI model (tijoriy foydalanish uchun ham)
- Agent endi **YOLOX** (Apache-2.0) + **ONNX Runtime** (MIT) bilan ishlaydi. YOLOv8 (AGPL) litsenziya muammosi yo'q.
- Shu kompyuterdagi sinovda YOLOX-Nano eski YOLOv8'dan **14 marta tez** ishladi: 7,2 va 0,5 kadr/s. Odamlarni ham ko'proq topdi.
- Eski modelga qaytish kerak bo'lsa: `python agent.py --detector yolov8` (`pip install -r requirements-yolov8.txt` bilan).

### Night Vision — faqat Pro tarifida
- Kadr qorong'i bo'lsa, agent tasvirni o'zi yoritadi: CLAHE, gamma va shovqinni kamaytirish. Kunduzi bu rejim o'zi o'chadi.
- Night Vision faqat **Pro** tarifida ishlaydi. Server buni har daqiqada tekshiradi, shuning uchun mijoz Pro'ga o'tsa, rejim o'zi yoqiladi.
- Bosh sahifadagi va narxlar sahifasidagi Pro kartasida **NIGHT VISION** alohida yashil blok bo'lib ko'rinadi.
- Sozlash: `--night-vision auto|on|off` (standart: auto).

### Shikoyat va murojaatlar — Instagram'ga o'xshash chat
- **Sayt (/support):** mehmon ism va telefonini yozadi. Shu zahoti yordam xizmati bilan **chat** ochiladi, email yuborilmaydi. Chat shu brauzerda saqlanadi.
- **Mijoz kabineti → Murojaatlar:** hisobdagi mijozning chatlari shu yerda.
- **Admin → Murojaatlar:** chatning yonida **kim yozgani** ko'rsatiladi: ism, telefon, mijoz hisobi, tarif, kameralar soni, bloklanganmi.
- Chatda yuborish mumkin:
  - **matn va emoji** 😊;
  - **rasm** (JPG, PNG, WEBP, GIF; tanlash, sudrab tashlash yoki joylash orqali);
  - **ovozli xabar** (mikrofon tugmasi, 3 daqiqagacha).
- Xabar holati: ✓ **yuborildi**, ✓✓ **ko'rildi · soat**.
- Odamning holati: **Online · necha daqiqadan beri** yoki **Chiqib ketdi: bugun 20:55**. Admin ro'yxatida hozir online bo'lgan mijoz yashil belgi bilan ajralib turadi.
- Rasm va ovozli fayllar maxfiy saqlanadi: ularni faqat chatning ikki tomoni ko'ra oladi. Begona odam ochmoqchi bo'lsa, 403 yoki 404 xatosi chiqadi.

### Ma'lumotlar bazasi UTF-8 ga ko'chirildi
- Eski baza Windows'ning WIN1251 kodirovkasida edi va emoji (📷🎤😊) hamda ko'p belgilarni saqlay olmasdi. Chatda smayl yozilsa, xato chiqardi.
- Barcha ma'lumotlar yangi **UTF-8** bazasiga (`smartvision_utf8`) ko'chirildi. Eski baza (`smartvision`) zaxira sifatida qoldi.

## ✅ Yakuniy tekshiruv (7-noyabr, kechqurun)
- **127/127** tekshiruv o'tdi: 3 til × mehmon, mijoz va admin uchun barcha sahifalar va 4 ta kirish qoidasi. Server jurnalida xato yo'q.
- Chat sinovi o'tdi: mehmon va mijoz yozdi, matn, rasm, ovoz, ✓✓ belgilari, Online va "Chiqib ketdi" holatlari ishladi.
- Hamma rasmlar `screenshots` papkasida (24 ta).
- Bazada faqat **ferma** va **admin (bakamron@gmail.com)** qoldi. Toza zaxira nusxa: `backups\clean-final.json`.
- Sinov brauzerida mikrofonga ruxsat bo'lmagani uchun haqiqiy ovoz yozish sinab ko'rilmadi. Ovozli xabarning server qismi haqiqiy audio fayl bilan sinaldi. Telefonda mikrofon tugmasini bir marta bosib ko'ring: brauzer ruxsat so'raydi.
## 🆕 Qonuniy talablar va server tayyorlovi (7-noyabr, tun)
- **Domen:** `smartvision.uz` band (2023-yildan beri boshqa egasi bor). **`smartvisionai.uz` bo'sh**, xuddi shunday `smartvision-ai.uz` va `smart-vision.uz` ham bo'sh.
- **Foydalanish shartlari** va **Maxfiylik siyosati** to'liq yozildi (3 tilda, 11 va 9 bo'lim). Ularda obuna va to'lov, bir martalik sinov, kameralarni qonuniy o'rnatish, AI aniqligi, yuz rasmlarini 30 kunda o'chirish, admin kamerani ko'rganda jurnalga yozish, bloklash, javobgarlik, O'zbekiston qonunchiligi va shaxsiy ma'lumotlar bo'yicha huquqlar bor.
- **Ro'yxatdan o'tishda rozilik majburiy:** "Shartlar va siyosatni qabul qilaman hamda shaxsiy ma'lumotlarimni qayta ishlashga roziman" belgisi. Belgisiz server ham hisob ochmaydi. Rozilik vaqti va versiyasi bazada saqlanadi.
- **Eski mijozlar:** kabinetga kirganda yangi shartlarni qabul qilish oynasi chiqadi. ferma mijozi ham uni bir marta qabul qiladi.
- **Cookie ogohlantirishi** saytda chiqadi. Faqat zarur cookie'lar ishlatiladi.
- **Operator ma'lumotlari:** Admin → Tizim sozlamalari → kompaniya nomi, STIR va manzil. Ular Shartlar sahifasida avtomatik ko'rinadi. ⚠️ STIR'ni siz kiritasiz.
- **Bepul HTTPS sertifikati:** Let's Encrypt uchun domen va internetdagi server kerak, shuning uchun hozir o'rnatib bo'lmaydi. Hammasi `deploy/` papkasida tayyor turibdi:
  - Caddy sertifikatni o'zi oladi va o'zi yangilaydi;
  - xavfsizlik devori va fail2ban;
  - sayt xizmati;
  - har kecha zaxira nusxa.

  Qo'llanma: `deploy/README.md`.
- **Faqat siz qila oladigan ishlar** (`deploy/README.md`, 4-bo'lim):
  - YaTT yoki yuridik shaxs ochish;
  - shaxsga doir ma'lumotlar bazasini davlat reestrida ro'yxatdan o'tkazish bo'yicha huquqshunos bilan maslahatlashish;
  - to'lovlarni Payme yoki Click orqali qabul qilish;
  - shartlarni huquqshunosga ko'rsatish.
- **Sinov:** 124/124 sahifa tekshiruvi o'tdi, rozilik oqimi sinaldi, server jurnalida xato yo'q. Yangi rasmlar: `screenshots/40-…43-…`.
- **Tuzatildi:** sayt Claude ilovasidan ochilganda ma'lumotlar bazasi yoqilmay, tariflar bo'sh chiqar edi. Endi `scripts/serve.mjs` avval bazani, keyin saytni yoqadi.
## 2026-11-08 — yangi imkoniyatlar

- **Telegram bot** — hodisa rasmi bilan Telegramga keladi. Bot tokenini admin qo'yadi: Admin → Sozlamalar → «Telegram bot». Mijoz Sozlamalar → «Telegramni ulash» tugmasini bosadi.
- **Qo'riqlash rejimi** — Avtomatik / O'z vaqtim / Doim / O'chiq (Sozlamalar).
- **Taqiqlangan zona** — Kameralar → qizil belgi → rasm ustiga zona chiziladi.
- **Yiqilishni aniqlash**.
- **Yong'in** — faqat maktab va ferma uchun, chunki uyda yolg'on signal beradi.
- **Hayvon sanash** — ferma uchun.
- **Jamoa** — Egasi / Yordamchi / Faqat ko'rish. Taklif emailga boradi.
- **Haftalik hisobot** — har dushanba Telegram va emailga.
- **Ovozli ogohlantirish** — mijoz karnay ulanganini aytadi, sinov ovozini tasdiqlaydi, kirganda brauzer ruxsati so'raladi.
- **O'quvchilar va davomat** — yuzdan tanish: OpenCV SFace/YuNet, bepul. Ota-onaga Telegram xabar boradi.
- **Mijoz uchun AI yordamchi** (Gemini) — faqat o'z ma'lumotlarini ko'radi.
- **Do'stni taklif qilish** — do'st birinchi marta to'lasa, taklif qilganga 50% kupon.
- **Aksiya banneri** — Admin → Sozlamalar.
- **Telefonga ilova o'rnatish (PWA)**.

Keyinroq qilinadi: mashina raqamini o'qish, hodisa videosi, Click/Payme.
SMS va qo'ng'iroq qilinmaydi.

Skrinshotlar: `screenshots/features/`.

## 2026-11-09

- **Mashina raqamini o'qish.** Bepul fast-alpr kutubxonasi (MIT) ishlatildi. Kamera mashinani ko'rsa, raqamini o'qiydi va aniq rasm yuboradi: tepada mashina, pastda kattalashtirilgan raqam.
- **Yangi sahifa: «Mashina raqamlari».** Raqam bo'yicha qidirish mumkin. AI hodisalar ro'yxatida ham raqam bo'yicha qidiradi.
- **Do'stni taklif qilish.** Do'st birinchi marta to'lasa, taklif qilgan odamga endi **20%** chegirma beriladi.
- **Tekshiruv.** Namuna rasmdagi raqam 100% to'g'ri o'qildi. Haqiqiy O'zbekiston raqamlari hali haqiqiy kamerada sinab ko'rilishi kerak.

## 2026-11-09 (kechqurun) — qo'shimcha ogohlantirishlar

- **Kamerani to'sish yoki burib qo'yish.** 5 soniya yopiq turgan yoki burilgan kamera aniqlanadi. Kechqurun asta-sekin qorong'ilashish to'sish deb hisoblanmaydi.
- **Uzoq turib qolish.** Notanish odam qo'riqlash vaqtida 2 daqiqadan ko'p tursa, ogohlantirish keladi. Fermada bu har doim ishlaydi.
- **Kamera sog'lig'i.** Tasvir 1 daqiqa xira yoki juda qorong'i bo'lsa, xabar keladi.
- **Mashina raqamlari ro'yxati.** «Tanish» mashina kelsa jim turadi, «Qora ro'yxat»dagisi kelsa jiddiy ogohlantirish beriladi. Xohlasa, notanish mashina uchun ham ogohlantirish yoqiladi.
- **Maktab.** Dars boshlanishidan keyin kelganlar «Kech qoldi» deb belgilanadi. Belgilangan soatda (odatda 9:00) kelmaganlar va kech qolganlar ro'yxati Telegramga va bildirishnomalarga keladi.
- **Ferma.** Hayvonlar soni kechagidan 20% dan ko'p kamaysa, ogohlantirish keladi.
- **Kunlik xulosa.** Har kuni 20:00 da Telegramga keladi.
- **«Yolg'on signal» tugmasi.** Bosilsa, shu kamera biroz kamroq sezgir bo'ladi. «Kameralar» sahifasida sezgirlikni asl holiga qaytarish mumkin.
- **Obuna eslatmalari** endi Telegramga ham keladi.

## 2026-11-10 — tariflar, kalkulyator, AI maslahatchi va boshqalar

- **Tariflar.** Start tarifida oddiy imkoniyatlar, Standard'da kuchliroq himoya, Pro'da eng kuchlisi. Imkoniyat haqiqatan cheklanadi: kamera dasturi faqat tarifga kirgan tahlilni yoqadi, saytda esa «Tarifni oshirish» qulfi ko'rinadi. Narxlar o'zgarmadi.
- **Narx kalkulyatori**, **AI maslahatchi** (saytda) va **Demo sahifa** qo'shildi.
- **Mijozlar fikrlari.** Mijoz kabinetdagi «Murojaatlar» sahifasidan yozadi, admin tasdiqlagandan keyin saytda chiqadi. Hozircha fikr yo'q, shuning uchun bo'lim yashirin.
- **Kabinetda yangi bo'limlar:**
  - «Bugun xavfsizmi?» indikatori;
  - eng gavjum soatlar grafigi;
  - harakat xaritasi;
  - haftalik taqqoslash.
- **Maktab uchun:**
  - o'qituvchilar davomati;
  - ota-onaga «Maktabdan chiqdi» xabari;
  - dars vaqtida koridorda yurganlar;
  - mehmonlar jurnali.
- **Ferma uchun:** hayvonlar hududi (hayvon hududdan chiqsa, ogohlantirish keladi).
- **Telegram:** /holat, /rasm, /qoriqlash buyruqlari va ogohlantirish ostida «Hammasi joyida» / «Yolg'on signal» tugmalari.
- **Admin:** daromad grafigi va keyingi oy prognozi; ketib qolishi mumkin bo'lgan mijozlar ro'yxati.
- **Aloqa:** telefon +998 99 140 20 60, email smartvisionai@mail.com. Bu email akkauntini o'zingiz ochishingiz kerak.
- **GitHub.** Kompyuterda git repozitoriy tayyor (yopiq ma'lumotlarsiz). Repozitoriyni GitHub saytida ochib, `git push` qilish qoldi.
