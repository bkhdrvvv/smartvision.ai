/**
 * SMARTVISION AI — Terms of Use and Privacy Policy (uz / ru / en).
 * Bump LEGAL_VERSION when the text changes materially: every customer is asked to accept the new version.
 */
import type { Locale } from "./i18n";

export const LEGAL_VERSION = "2026-11-07";

export type LegalDoc = { title: string; updated: string; intro: string; sections: { h: string; p: string[] }[] };

const TERMS: Record<Locale, LegalDoc> = {
  uz: {
    title: "Foydalanish shartlari",
    updated: "Kuchga kirgan sana: 7-noyabr, 2026-yil",
    intro:
      "Ushbu shartlar SMARTVISION AI platformasi (sayt, mijoz kabineti, Edge AI dasturi va yordam chati — keyingi o'rinlarda «Xizmat») dan foydalanish tartibini belgilaydi. Hisob yaratish yoki Xizmatdan foydalanish orqali siz ushbu shartlarni va Maxfiylik siyosatini to'liq qabul qilasiz.",
    sections: [
      { h: "1. Xizmat nima", p: ["SMARTVISION AI — maktab, uy va fermalar uchun aqlli videokuzatuv: kameralaringiz tasviri sizning joyingizdagi Edge AI kompyuterida tahlil qilinadi, platforma esa hodisalar, ogohlantirishlar, hisobotlar va jonli ko'rishni taqdim etadi.", "Kameralar, Edge kompyuter, internet va elektr ta'minoti mijoz tomonida bo'ladi va ularning ishlashi uchun mijoz javobgar."] },
      { h: "2. Hisob", p: ["Ro'yxatdan o'tish uchun haqiqiy email (tasdiqlash kodi bilan) yoki Google hisobi, to'g'ri ism, tashkilot nomi va telefon raqami kerak.", "Parolingiz va hisobingizga kirish uchun siz javobgarsiz. Hisobni boshqalarga berish taqiqlanadi. Shubhali kirishni sezsangiz, darhol parolni almashtiring va bizga yozing."] },
      { h: "3. Obuna va to'lov", p: ["Obuna oylik va oldindan to'lanadi. To'lov ko'rsatilgan kartaga o'tkaziladi, mijoz kabinetga chekni yuklaydi, administrator uni qo'lda tekshiradi. Xizmat to'lov tasdiqlangandan keyin 30 kunga faollashadi.", "Avtomatik pul yechib olinmaydi. Muddat tugashidan 3 kun oldin eslatma yuboriladi; to'lanmasa obuna yopiladi, ma'lumotlar saqlanib qoladi.", "7 kunlik bepul sinov har bir mijozga (tashkilot va telefon raqami bo'yicha) faqat bir marta beriladi. Kupon chegirmalari kuponda yozilgan shartlar bo'yicha qo'llanadi.", "Tasdiqlangan to'lov qaytarilmaydi, Xizmat bizning aybimiz bilan ko'rsatilmagan holatlar bundan mustasno — bunday holat murojaat orqali ko'rib chiqiladi."] },
      { h: "4. Kameralar va qonunchilik", p: ["Kameralarni O'zbekiston qonunlariga muvofiq o'rnatish va ishlatish mijozning majburiyatidir: kuzatilayotgan hududda odamlarni videokuzatuv haqida ogohlantirish (belgi, e'lon), maktablarda ma'muriyat va ota-onalarning roziligi, xodimlarni xabardor qilish shular jumlasiga kiradi.", "Hojatxona, kiyinish xonasi va shaxsiy hayot daxlsiz bo'lishi kerak bo'lgan boshqa joylarga kamera o'rnatish qat'iyan taqiqlanadi. Xizmatdan boshqa odamlarni yashirin yoki noqonuniy kuzatish uchun foydalanish taqiqlanadi."] },
      { h: "5. Sun'iy intellekt va aniqlik", p: ["AI odamlar, transport va hayvonlarni aniqlashda xato qilishi mumkin. Ogohlantirishlar yordamchi vositadir va qo'riqchi, yong'in signalizatsiyasi yoki favqulodda xizmatlarning o'rnini bosmaydi.", "Yong'in/tutun aniqlash tajribaviy funksiya. Night Vision (faqat Pro tarifi) qorong'i tasvirni yoritadi, lekin to'liq qorong'ilikda infraqizil kamera kerak bo'lishi mumkin."] },
      { h: "6. Ma'lumotlar", p: ["Shaxsiy ma'lumotlar Maxfiylik siyosatiga muvofiq qayta ishlanadi. Yuz va bosh rasmlari 30 kundan keyin avtomatik o'chiriladi.", "Administrator mijoz kameralarini faqat texnik yordam, xavfsizlik yoki shikoyatni tekshirish uchun ko'rishi mumkin; har bir ko'rish audit jurnaliga yoziladi."] },
      { h: "7. Taqiqlangan harakatlar", p: ["Xizmatni buzishga, boshqa mijozlar ma'lumotlariga kirishga, qurilma kalitlarini tarqatishga, yordam chatini haqorat yoki spam uchun ishlatishga, noqonuniy kontent yuborishga yo'l qo'yilmaydi."] },
      { h: "8. Bloklash va hisobni o'chirish", p: ["Shartlar buzilsa, firibgarlik yoki xavfsizlikka tahdid aniqlansa, hisob ogohlantirishsiz bloklanishi mumkin: kirish va Edge qurilmalar to'xtatiladi, ma'lumotlar saqlanadi.", "Hisobingiz va ma'lumotlaringizni butunlay o'chirishni yordam chati orqali so'rashingiz mumkin. O'chirilgan ma'lumotlarni tiklab bo'lmaydi."] },
      { h: "9. Javobgarlik", p: ["Xizmat «boricha» taqdim etiladi. Internet, elektr, kamera yoki uchinchi tomon xizmatlaridagi uzilishlar uchun javobgar emasmiz. Har qanday holatda javobgarligimiz oxirgi oy uchun to'langan obuna summasidan oshmaydi."] },
      { h: "10. Murojaatlar va nizolar", p: ["Savol, shikoyat va takliflar saytdagi «Shikoyat va murojaatlar» chati orqali qabul qilinadi. Nizolar avval muzokara yo'li bilan, kelishilmasa — O'zbekiston Respublikasi qonunchiligiga muvofiq Toshkent shahri sudlarida hal qilinadi."] },
      { h: "11. O'zgartirishlar", p: ["Shartlar o'zgartirilishi mumkin. Muhim o'zgarishlarda kabinetingizda yangi tahrirni qabul qilish so'raladi; qabul qilmaguningizcha Xizmatning ayrim qismlari cheklanishi mumkin."] },
    ],
  },
  ru: {
    title: "Условия использования",
    updated: "Дата вступления в силу: 7 ноября 2026 г.",
    intro:
      "Настоящие условия регулируют использование платформы SMARTVISION AI (сайт, кабинет клиента, программа Edge AI и чат поддержки — далее «Сервис»). Создавая аккаунт или пользуясь Сервисом, вы полностью принимаете эти условия и Политику конфиденциальности.",
    sections: [
      { h: "1. Что такое Сервис", p: ["SMARTVISION AI — умное видеонаблюдение для школ, домов и ферм: изображение ваших камер анализируется на Edge AI-компьютере на вашем объекте, а платформа предоставляет события, оповещения, отчёты и живой просмотр.", "Камеры, Edge-компьютер, интернет и электропитание находятся на стороне клиента, и клиент отвечает за их работу."] },
      { h: "2. Аккаунт", p: ["Для регистрации нужен настоящий email (с кодом подтверждения) или аккаунт Google, верные имя, название организации и телефон.", "Вы отвечаете за свой пароль и доступ к аккаунту. Передавать аккаунт другим запрещено. При подозрительном входе сразу смените пароль и напишите нам."] },
      { h: "3. Подписка и оплата", p: ["Подписка месячная, оплачивается заранее: перевод на указанную карту, клиент загружает чек в кабинет, администратор проверяет его вручную. Сервис включается на 30 дней после подтверждения оплаты.", "Автоматических списаний нет. За 3 дня до окончания приходит напоминание; без оплаты подписка закрывается, данные сохраняются.", "Бесплатный пробный период 7 дней даётся каждому клиенту (по организации и номеру телефона) только один раз. Скидки по купонам действуют на условиях купона.", "Подтверждённая оплата не возвращается, кроме случаев, когда Сервис не был оказан по нашей вине — такие случаи рассматриваются через обращение."] },
      { h: "4. Камеры и закон", p: ["Клиент обязан устанавливать и использовать камеры в соответствии с законодательством Узбекистана: предупреждать людей о видеонаблюдении (знаки, объявления), в школах — получить согласие администрации и родителей, информировать сотрудников.", "Строго запрещено ставить камеры в туалетах, раздевалках и других местах, где нарушается неприкосновенность частной жизни, а также использовать Сервис для скрытого или незаконного наблюдения."] },
      { h: "5. Искусственный интеллект и точность", p: ["AI может ошибаться при распознавании людей, транспорта и животных. Оповещения — вспомогательный инструмент и не заменяют охрану, пожарную сигнализацию или экстренные службы.", "Обнаружение огня/дыма — экспериментальная функция. Night Vision (только тариф Pro) осветляет тёмное изображение, но в полной темноте может понадобиться ИК-камера."] },
      { h: "6. Данные", p: ["Персональные данные обрабатываются согласно Политике конфиденциальности. Снимки лиц и голов автоматически удаляются через 30 дней.", "Администратор может просматривать камеры клиента только для техподдержки, безопасности или проверки жалобы; каждый просмотр записывается в журнал аудита."] },
      { h: "7. Запрещённые действия", p: ["Запрещено взламывать Сервис, получать доступ к данным других клиентов, распространять ключи устройств, использовать чат поддержки для оскорблений или спама, отправлять незаконный контент."] },
      { h: "8. Блокировка и удаление аккаунта", p: ["При нарушении условий, мошенничестве или угрозе безопасности аккаунт может быть заблокирован без предупреждения: вход и Edge-устройства отключаются, данные сохраняются.", "Полное удаление аккаунта и данных можно запросить через чат поддержки. Удалённые данные восстановить нельзя."] },
      { h: "9. Ответственность", p: ["Сервис предоставляется «как есть». Мы не отвечаем за сбои интернета, электропитания, камер или сторонних сервисов. В любом случае наша ответственность не превышает суммы подписки, оплаченной за последний месяц."] },
      { h: "10. Обращения и споры", p: ["Вопросы, жалобы и предложения принимаются в чате «Жалобы и обращения» на сайте. Споры решаются переговорами, а при недостижении согласия — в судах г. Ташкента по законодательству Республики Узбекистан."] },
      { h: "11. Изменения", p: ["Условия могут меняться. При существенных изменениях в кабинете будет предложено принять новую редакцию; до принятия часть функций может быть ограничена."] },
    ],
  },
  en: {
    title: "Terms of Use",
    updated: "Effective date: 7 November 2026",
    intro:
      "These terms govern the use of the SMARTVISION AI platform (website, customer dashboard, Edge AI software and support chat — the “Service”). By creating an account or using the Service you fully accept these terms and the Privacy Policy.",
    sections: [
      { h: "1. The Service", p: ["SMARTVISION AI is smart video monitoring for schools, homes and farms: your cameras are analysed on an Edge AI computer at your site, and the platform provides events, alerts, reports and live viewing.", "Cameras, the Edge computer, internet and power are on the customer's side, and the customer is responsible for them working."] },
      { h: "2. Account", p: ["Registration requires a real email (confirmed with a code) or a Google account, your correct name, organisation name and phone number.", "You are responsible for your password and access to your account. Sharing an account is not allowed. If you notice a suspicious sign-in, change your password at once and contact us."] },
      { h: "3. Subscription and payment", p: ["Subscriptions are monthly and paid in advance: a transfer to the card shown, the customer uploads the receipt, an administrator checks it manually. The Service is activated for 30 days after the payment is approved.", "There are no automatic charges. A reminder is sent 3 days before the end; without payment the subscription closes and the data is kept.", "The 7-day free trial is given once per customer (organisation and phone number). Coupon discounts apply on the coupon's terms.", "Approved payments are not refunded, except when the Service was not provided through our fault — such cases are reviewed through an appeal."] },
      { h: "4. Cameras and the law", p: ["The customer must install and use cameras in line with the laws of Uzbekistan: inform people about video surveillance (signs, notices), obtain the consent of the administration and parents in schools, inform employees.", "Cameras in toilets, changing rooms and other places where privacy must be respected are strictly forbidden, as is using the Service for hidden or unlawful surveillance."] },
      { h: "5. Artificial intelligence and accuracy", p: ["The AI can make mistakes when detecting people, vehicles and animals. Alerts are an aid and do not replace guards, fire alarms or emergency services.", "Fire/smoke detection is experimental. Night Vision (Pro plan only) brightens dark images, but complete darkness may require an infrared camera."] },
      { h: "6. Data", p: ["Personal data is processed according to the Privacy Policy. Face and head snapshots are deleted automatically after 30 days.", "An administrator may view a customer's cameras only for technical support, security or to check a complaint; every view is written to the audit log."] },
      { h: "7. Prohibited use", p: ["Attacking the Service, accessing other customers' data, sharing device keys, using the support chat for abuse or spam, or sending unlawful content is not allowed."] },
      { h: "8. Blocking and deleting an account", p: ["If the terms are broken, or fraud or a security threat is found, the account may be blocked without notice: sign-in and Edge devices stop, the data is kept.", "You can ask for your account and data to be deleted completely through the support chat. Deleted data cannot be restored."] },
      { h: "9. Liability", p: ["The Service is provided “as is”. We are not liable for outages of internet, power, cameras or third-party services. In any case our liability does not exceed the subscription amount paid for the last month."] },
      { h: "10. Appeals and disputes", p: ["Questions, complaints and suggestions are received in the “Complaints & appeals” chat on the website. Disputes are settled by negotiation and, failing that, in the courts of Tashkent under the laws of the Republic of Uzbekistan."] },
      { h: "11. Changes", p: ["These terms may change. For material changes your dashboard will ask you to accept the new version; until then some features may be limited."] },
    ],
  },
};

const PRIVACY: Record<Locale, LegalDoc> = {
  uz: {
    title: "Maxfiylik siyosati",
    updated: "Kuchga kirgan sana: 7-noyabr, 2026-yil",
    intro: "Ushbu siyosat SMARTVISION AI qanday shaxsiy ma'lumotlarni yig'ishi, nima uchun ishlatishi va qanday himoya qilishini tushuntiradi. U O'zbekiston Respublikasining «Shaxsga doir ma'lumotlar to'g'risida»gi Qonuniga muvofiq tuzilgan.",
    sections: [
      { h: "1. Qanday ma'lumotlar yig'iladi", p: ["Hisob: ism, email, telefon, tashkilot nomi, parol (faqat shifrlangan xesh), Google hisobi identifikatori (Google orqali kirsangiz).", "To'lov: to'lov summasi, sanasi va siz yuklagan chek rasmi. Karta ma'lumotlaringiz bizda saqlanmaydi.", "Kamera ma'lumotlari: AI hodisalari (vaqt, turi, kamera), aniqlangan odamlarning yuz/bosh rasmlari, Edge qurilma holati. To'liq video arxivi platformada saqlanmaydi — jonli tasvir faqat ko'rilayotganda uzatiladi.", "Yordam chati: xabarlar, yuborilgan rasm va ovozli xabarlar, online holati va xabar ko'rilgan vaqt.", "Texnik: IP manzil, kirish vaqtlari, xavfsizlik jurnali, brauzer cookie fayllari."] },
      { h: "2. Nima uchun ishlatiladi", p: ["Xizmatni ko'rsatish, obuna va to'lovlarni tekshirish, ogohlantirish yuborish, texnik yordam, hisobni himoya qilish (shubhali kirishlarni aniqlash) va qonun talablarini bajarish uchun. Ma'lumotlaringiz sotilmaydi va reklama uchun ishlatilmaydi."] },
      { h: "3. Saqlash joyi va muddati", p: ["Ma'lumotlar O'zbekiston qonunchiligi talabiga muvofiq O'zbekiston hududidagi serverlarda saqlanadi.", "Yuz va bosh rasmlari — 30 kun, keyin avtomatik o'chiriladi. Hodisalar, to'lovlar va cheklar — hisob mavjud ekan va buxgalteriya hisobi uchun talab qilinadigan muddatda. Chat — murojaat o'chirilguncha. Hisob o'chirilganda unga tegishli fayllar ham o'chiriladi."] },
      { h: "4. Kimlarga beriladi", p: ["Faqat Xizmat ishlashi uchun zarur bo'lgan hollarda: email xatlarini yuborish (pochta xizmati), Google orqali kirish (Google), administratorning AI yordamchisi (savolga javob berish uchun kerakli ma'lumotlar AI xizmatiga yuboriladi). Qonunda belgilangan hollarda vakolatli davlat organlariga."] },
      { h: "5. Xavfsizlik", p: ["Shifrlangan ulanish (HTTPS), parollarning xesh ko'rinishida saqlanishi, ikki bosqichli tasdiq (2FA), kirishga urinishlarni cheklash, maxfiy fayllar faqat egasiga ko'rsatilishi, administrator harakatlarining audit jurnali va kunlik zaxira nusxalar."] },
      { h: "6. Sizning huquqlaringiz", p: ["Ma'lumotlaringizni ko'rish, tuzatish, o'chirishni so'rash va roziligingizni qaytarib olish huquqiga egasiz. Buning uchun yordam chatiga yozing — 30 kun ichida javob beramiz."] },
      { h: "7. Bolalar va maktablar", p: ["Maktablarda o'quvchilar tasviri bo'yicha rozilik olish va ota-onalarni xabardor qilish uchun maktab (mijoz) javobgar. Xizmat 16 yoshdan kichik shaxslar tomonidan hisob ochish uchun mo'ljallanmagan."] },
      { h: "8. Cookie fayllari", p: ["Faqat zarur cookie'lar ishlatiladi: tizimga kirish sessiyasi, tanlangan til, mehmonning yordam chatiga kirish kaliti. Reklama yoki kuzatuv cookie'lari yo'q."] },
      { h: "9. Aloqa", p: ["Maxfiylik bo'yicha savollar uchun saytdagi «Shikoyat va murojaatlar» chatiga yozing."] },
    ],
  },
  ru: {
    title: "Политика конфиденциальности",
    updated: "Дата вступления в силу: 7 ноября 2026 г.",
    intro: "Эта политика объясняет, какие персональные данные собирает SMARTVISION AI, зачем и как их защищает. Она составлена в соответствии с Законом Республики Узбекистан «О персональных данных».",
    sections: [
      { h: "1. Какие данные собираются", p: ["Аккаунт: имя, email, телефон, название организации, пароль (только зашифрованный хеш), идентификатор Google (если вы входите через Google).", "Оплата: сумма, дата и загруженное вами фото чека. Данные вашей карты у нас не хранятся.", "Данные камер: события AI (время, тип, камера), снимки лиц/голов распознанных людей, состояние Edge-устройства. Полный видеоархив на платформе не хранится — живое изображение передаётся только во время просмотра.", "Чат поддержки: сообщения, отправленные фото и голосовые сообщения, статус «в сети» и время просмотра сообщений.", "Технические: IP-адрес, время входа, журнал безопасности, cookie браузера."] },
      { h: "2. Зачем используются", p: ["Для оказания Сервиса, проверки подписок и оплат, отправки оповещений, техподдержки, защиты аккаунта (обнаружение подозрительных входов) и выполнения требований закона. Ваши данные не продаются и не используются для рекламы."] },
      { h: "3. Где и сколько хранятся", p: ["Данные хранятся на серверах на территории Узбекистана в соответствии с законодательством.", "Снимки лиц и голов — 30 дней, затем удаляются автоматически. События, оплаты и чеки — пока существует аккаунт и в сроки, требуемые для бухгалтерского учёта. Чат — до удаления обращения. При удалении аккаунта удаляются и его файлы."] },
      { h: "4. Кому передаются", p: ["Только когда это нужно для работы Сервиса: отправка писем (почтовый сервис), вход через Google (Google), AI-ассистент администратора (нужные для ответа данные отправляются AI-сервису). В случаях, предусмотренных законом, — уполномоченным государственным органам."] },
      { h: "5. Безопасность", p: ["Шифрованное соединение (HTTPS), хранение паролей в виде хеша, двухэтапная проверка (2FA), ограничение попыток входа, закрытые файлы доступны только владельцу, журнал действий администратора и ежедневные резервные копии."] },
      { h: "6. Ваши права", p: ["Вы вправе просматривать, исправлять, требовать удаления своих данных и отозвать согласие. Напишите в чат поддержки — ответим в течение 30 дней."] },
      { h: "7. Дети и школы", p: ["В школах за получение согласия и информирование родителей об изображении учеников отвечает школа (клиент). Сервис не предназначен для создания аккаунтов лицами младше 16 лет."] },
      { h: "8. Cookie", p: ["Используются только необходимые cookie: сессия входа, выбранный язык, ключ доступа посетителя к чату поддержки. Рекламных и отслеживающих cookie нет."] },
      { h: "9. Контакты", p: ["По вопросам конфиденциальности пишите в чат «Жалобы и обращения» на сайте."] },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Effective date: 7 November 2026",
    intro: "This policy explains what personal data SMARTVISION AI collects, why, and how it is protected. It follows the Law of the Republic of Uzbekistan “On Personal Data”.",
    sections: [
      { h: "1. What we collect", p: ["Account: name, email, phone, organisation name, password (only an encrypted hash), Google account ID (if you sign in with Google).", "Payments: amount, date and the receipt image you upload. We do not store your card details.", "Camera data: AI events (time, type, camera), face/head snapshots of detected people, Edge device status. No full video archive is stored on the platform — live images are sent only while someone is watching.", "Support chat: messages, photos and voice notes you send, online status and when messages were seen.", "Technical: IP address, sign-in times, security log, browser cookies."] },
      { h: "2. Why we use it", p: ["To provide the Service, check subscriptions and payments, send alerts, give support, protect accounts (detect suspicious sign-ins) and meet legal duties. Your data is not sold and not used for advertising."] },
      { h: "3. Where and how long it is kept", p: ["Data is stored on servers in Uzbekistan as required by law.", "Face and head snapshots — 30 days, then deleted automatically. Events, payments and receipts — while the account exists and for the period required for accounting. Chat — until the appeal is deleted. Deleting an account also deletes its files."] },
      { h: "4. Who it is shared with", p: ["Only when needed for the Service to work: sending emails (mail service), Google sign-in (Google), the administrator's AI assistant (the data needed to answer is sent to the AI service). Competent state bodies where the law requires."] },
      { h: "5. Security", p: ["Encrypted connections (HTTPS), passwords stored as hashes, two-step verification (2FA), sign-in rate limits, private files shown only to their owner, an audit log of administrator actions and daily backups."] },
      { h: "6. Your rights", p: ["You may view, correct and request deletion of your data and withdraw consent. Write to the support chat — we answer within 30 days."] },
      { h: "7. Children and schools", p: ["In schools the school (the customer) is responsible for consent and informing parents about pupils' images. The Service is not intended for accounts of persons under 16."] },
      { h: "8. Cookies", p: ["Only necessary cookies are used: the sign-in session, the chosen language, a visitor's key to the support chat. No advertising or tracking cookies."] },
      { h: "9. Contact", p: ["For privacy questions write to the “Complaints & appeals” chat on the website."] },
    ],
  },
};

export const legalDoc = (kind: "terms" | "privacy", locale: Locale) => (kind === "terms" ? TERMS : PRIVACY)[locale];
