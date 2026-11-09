# SMARTVISION AI — saytni internetga chiqarish (smartvisionai.uz)

## Qisqacha
Domen + server (VPS) + **bepul HTTPS sertifikat** (Let's Encrypt, Caddy orqali avtomatik olinadi va o'zi yangilanadi).
Hammasi `setup.sh` bilan bitta buyruqda o'rnatiladi.

## 1. Sotib olish (sizdan)
1. **Domen:** `smartvisionai.uz` — bo'sh (2026-yil 7-noyabrda tekshirildi). Ro'yxatdan o'tkazish uchun cctld.uz saytidagi akkreditatsiyalangan registratorlardan birini tanlang.
2. **VPS:** Ubuntu 24.04, kamida 2 vCPU, 4 GB RAM, 60 GB SSD. **Server O'zbekiston hududida bo'lishi kerak** — «Shaxsga doir ma'lumotlar to'g'risida»gi qonun O'zbekiston fuqarolarining shaxsiy ma'lumotlarini O'zbekistondagi serverlarda saqlashni talab qiladi.
3. Domen panelida DNS yozuvlari: `A  @  → server IP`, `A  www → server IP`.

## 2. O'rnatish (men qilaman, yoki o'zingiz)
```bash
# kompyuterdagi loyihani serverga ko'chirish (node_modules, .next, .pgdata, .tools siz)
scp -r "new file" root@SERVER_IP:/opt/smartvision
# ma'lumotlarni ham ko'chirish: kompyuterda  node scripts/backup-now.cjs backups/restore.json
ssh root@SERVER_IP "bash /opt/smartvision/deploy/setup.sh"
```
`setup.sh` quyidagilarni o'rnatadi:
- Node.js 22;
- PostgreSQL (UTF-8);
- Caddy (HTTPS);
- xavfsizlik devori: faqat 22, 80 va 443-portlar ochiq;
- fail2ban (parol tanlab buzishdan himoya);
- sayt xizmati: avtomatik ishga tushadi, xato bo'lsa qayta yonadi;
- har kecha 03:30 da zaxira nusxa, oxirgi 14 kuni saqlanadi.

Ko'chirgandan keyin:
- `.env` ga eski `.env` faylidan SMTP, Google va Gemini kalitlarini qo'ying.
- Google Cloud → Credentials → redirect URI: `https://smartvisionai.uz/api/auth/google/callback`. Keyin OAuth consent screen'da **Publish app** ni bosing, saytda Privacy va Terms sahifalari tayyor.
- Mijozlarning Edge agentlarini yangi manzilga ulang: `python agent.py --server https://smartvisionai.uz`.

## 3. Qonuniy talablar — saytda tayyor ✅
- **Foydalanish shartlari** (`/terms`) va **Maxfiylik siyosati** (`/privacy`) 3 tilda yozilgan.
- Ro'yxatdan o'tishda shartlar va maxfiylik siyosatini qabul qilish hamda **shaxsiy ma'lumotlarni qayta ishlashga rozilik** majburiy. Rozilik bergan sana va shartlar versiyasi bazada saqlanadi.
- Shartlar yangilanganda har bir mijoz kabinetda yangi tahrirni qabul qiladi.
- Cookie haqida ogohlantirish chiqadi. Faqat zarur cookie'lar ishlatiladi.
- Yuz rasmlari 30 kunda o'chiriladi. Admin mijoz kamerasini ko'rsa, bu audit jurnaliga yoziladi.
- Mijoz o'z ma'lumotlarini o'chirishni chat orqali so'raydi, admin "Mijozni o'chirish" tugmasi bilan o'chiradi.
- Shikoyat va murojaatlar uchun chat bor.

## 4. Qonuniy talablar — faqat siz qila oladigan ishlar ⚠️
1. **Yuridik shaxs yoki YaTT** sifatida ro'yxatdan o'ting. Keyin Admin → Tizim sozlamalari → kompaniya nomi, STIR va manzilni kiriting, ular Shartlar sahifasida avtomatik chiqadi.
2. **Shaxsga doir ma'lumotlar bazasini davlat reestrida ro'yxatdan o'tkazish** talab qilinishi mumkin, chunki sayt mijozlar, yuz rasmlari va videolar bilan ishlaydi. Huquqshunos bilan aniqlang.
3. **To'lovlar.** Hozir pul shaxsiy kartaga o'tkaziladi va chek qo'lda tekshiriladi. Rasmiy biznes uchun Payme yoki Click kabi to'lov tizimi orqali qabul qilish va soliq hisobotini yuritish to'g'ri bo'ladi.
4. Shartlar matni yaxshi asos bo'lib xizmat qiladi, lekin uni ishga tushirishdan oldin **huquqshunosga bir marta ko'rsating**.
5. YOLOv8 litsenziyasi muammosi hal bo'lgan: agent endi bepul YOLOX bilan ishlaydi.
