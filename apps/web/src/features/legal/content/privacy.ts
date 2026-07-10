import type { Locale } from "@/i18n/routing";

import type { LegalDocumentContent, LegalDocumentDictionary } from "./types";

const en: LegalDocumentContent = {
  lastUpdated: "Last updated: 9 July 2026",
  lead: [
    "This Privacy Policy explains what personal data BookNest collects, why we collect it, how we use it, and the rights you have over it. We keep it short and plain on purpose.",
  ],
  sections: [
    {
      blocks: [
        {
          kind: "paragraph",
          text: 'BookNest is a personal reading library service available at book-nest.net. For the purposes of the EU General Data Protection Regulation (GDPR) and the Law of Ukraine "On Personal Data Protection", the data controller is the operator of BookNest.',
        },
        {
          kind: "paragraph",
          text: "You can reach us about anything in this policy, including to exercise your rights, at **privacy@book-nest.net**.",
        },
      ],
      heading: "1. Who we are",
      id: "who-we-are",
    },
    {
      blocks: [
        { kind: "paragraph", text: "We only collect what the service needs to work." },
        { kind: "subheading", text: "Account data you give us" },
        {
          items: [
            "Name and, optionally, last name and nickname",
            "Email address",
            "Password (we never store it in plain text; we store only a one-way bcrypt hash)",
            "Optionally, your date of birth and a profile picture, if you choose to add them",
            "Optional profile details such as social links",
          ],
          kind: "list",
        },
        { kind: "subheading", text: "Content you add to your library" },
        {
          items: [
            "Books, series, authors, publishers, custom lists, favorites and your reading queue",
            "Reading progress, ratings and personal reading impressions or notes",
            "Loan and delivery records. These can include names of other people you enter yourself, for example the name of a person you lent a book to or who is delivering an order. Please only add information about other people that you are entitled to add.",
          ],
          kind: "list",
        },
        { kind: "subheading", text: "Technical data collected automatically" },
        {
          items: [
            "Your IP address and basic request information in our server logs, kept for security and troubleshooting",
            "A single strictly necessary session cookie (see Cookies below)",
          ],
          kind: "list",
        },
        {
          kind: "paragraph",
          text: "We do not use advertising trackers, and we do not run third-party analytics that profile you.",
        },
      ],
      heading: "2. What data we collect",
      id: "data-we-collect",
    },
    {
      blocks: [
        {
          items: [
            "To create and run your account and provide the service: performance of our contract with you (GDPR Art. 6(1)(b))",
            "To send you essential emails such as email verification, password reset and important security notices: performance of our contract and our legitimate interest in securing accounts (Art. 6(1)(b) and (f))",
            "To keep the service secure, prevent abuse and fix problems: our legitimate interest (Art. 6(1)(f))",
            "To meet legal obligations where they apply (Art. 6(1)(c))",
          ],
          kind: "list",
        },
        {
          kind: "paragraph",
          text: "We do not sell your personal data, and we do not use it for automated decision-making or profiling.",
        },
      ],
      heading: "3. Why we use your data and our legal basis",
      id: "why-we-use-data",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "We use one cookie, called `refresh_token`. It is strictly necessary: it keeps you signed in securely. It is set as HttpOnly (not readable by JavaScript) and SameSite=Lax, and it is only sent to our authentication endpoints.",
        },
        {
          kind: "paragraph",
          text: "Because this cookie is strictly necessary to provide a service you actively asked for, it does not require consent under the GDPR and the ePrivacy rules. We do not use any advertising, marketing or analytics cookies. If that ever changes, we will ask for your consent first.",
        },
      ],
      heading: "4. Cookies",
      id: "cookies",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "We do not sell or rent your data. We share it only with the service providers (processors) that we need to run BookNest:",
        },
        {
          items: [
            "**Hetzner Online GmbH** (Germany, EU): hosting of our servers and database.",
            "**Cloudflare, Inc.** (USA): DNS, content delivery and protection against attacks. Cloudflare processes technical data such as your IP address when you connect to the site.",
            "**Email delivery**: transactional emails (verification, password reset and security notices) are sent from our domain through our email service provider.",
          ],
          kind: "list",
        },
        {
          kind: "paragraph",
          text: "Each provider only processes data on our instructions and under a data processing agreement.",
        },
      ],
      heading: "5. Who we share data with",
      id: "data-sharing",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "Our servers and database are located in the EU (Germany). Some providers, such as Cloudflare, may process technical data outside the EU, including in the United States. Where that happens, the transfer is covered by appropriate safeguards such as the European Commission's Standard Contractual Clauses.",
        },
      ],
      heading: "6. International transfers",
      id: "international-transfers",
    },
    {
      blocks: [
        {
          items: [
            "Account and library data: for as long as your account exists. When you delete your account, we delete or anonymize your personal data, except where we must keep something to meet a legal obligation.",
            "Email verification and password reset tokens: these are short-lived and expire automatically.",
            "Server logs: kept for a limited period for security and troubleshooting, then deleted.",
          ],
          kind: "list",
        },
      ],
      heading: "7. How long we keep your data",
      id: "data-retention",
    },
    {
      blocks: [
        { kind: "paragraph", text: "Under the GDPR and Ukrainian law you have the right to:" },
        {
          items: [
            "access the personal data we hold about you",
            "correct data that is wrong or incomplete",
            'delete your data ("right to be forgotten")',
            "restrict or object to certain processing",
            "receive your data in a portable, machine-readable format",
            "withdraw consent at any time, where we rely on consent",
          ],
          kind: "list",
        },
        {
          kind: "paragraph",
          text: "To use any of these rights, email us at **privacy@book-nest.net**. You also have the right to complain to a data protection authority, in Ukraine the Ukrainian Parliament Commissioner for Human Rights, or the supervisory authority in your EU country of residence.",
        },
      ],
      heading: "8. Your rights",
      id: "your-rights",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "We store passwords only as a one-way bcrypt hash, serve the whole site over HTTPS, keep the session cookie HttpOnly, and apply rate limiting and other safeguards. No system is perfectly secure, but we take reasonable steps to protect your data.",
        },
      ],
      heading: "9. How we protect your data",
      id: "security",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "BookNest is not intended for children under 16. If you are under 16, please do not create an account. If you believe a child has given us personal data, contact us and we will delete it.",
        },
      ],
      heading: "10. Children",
      id: "children",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: 'If we make significant changes, we will update the "Last updated" date and, where appropriate, notify you. Continuing to use BookNest after a change means you accept the updated policy.',
        },
      ],
      heading: "11. Changes to this policy",
      id: "changes",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "Questions, requests or complaints: **privacy@book-nest.net**.",
        },
      ],
      heading: "12. Contact",
      id: "contact",
    },
  ],
  title: "Privacy Policy",
};

const uk: LegalDocumentContent = {
  lastUpdated: "Останнє оновлення: 9 липня 2026",
  lead: [
    "Ця Політика конфіденційності пояснює, які персональні дані збирає BookNest, навіщо, як ми їх використовуємо та які права ви маєте. Ми свідомо тримаємо її короткою та зрозумілою.",
  ],
  sections: [
    {
      blocks: [
        {
          kind: "paragraph",
          text: "BookNest — це сервіс персональної бібліотеки для читання за адресою book-nest.net. Для цілей Загального регламенту ЄС про захист даних (GDPR) та Закону України «Про захист персональних даних» володільцем даних є оператор BookNest.",
        },
        {
          kind: "paragraph",
          text: "З будь-яких питань щодо цієї політики, зокрема щоб скористатися своїми правами, пишіть нам на **privacy@book-nest.net**.",
        },
      ],
      heading: "1. Хто ми",
      id: "who-we-are",
    },
    {
      blocks: [
        { kind: "paragraph", text: "Ми збираємо лише те, що потрібно для роботи сервісу." },
        { kind: "subheading", text: "Дані облікового запису, які ви надаєте" },
        {
          items: [
            "Ім'я, а також, за бажанням, прізвище та нікнейм",
            "Адресу електронної пошти",
            "Пароль (ми ніколи не зберігаємо його у відкритому вигляді, лише односторонній bcrypt-хеш)",
            "За бажанням — дату народження та фото профілю, якщо ви їх додасте",
            "Додаткові дані профілю, наприклад посилання на соцмережі",
          ],
          kind: "list",
        },
        { kind: "subheading", text: "Контент, який ви додаєте до бібліотеки" },
        {
          items: [
            "Книги, серії, авторів, видавництва, власні списки, обране та чергу читання",
            "Прогрес читання, оцінки та особисті враження чи нотатки",
            "Записи про позики та доставки. Вони можуть містити імена інших людей, які ви вводите самостійно, наприклад ім'я людини, якій ви позичили книгу, або яка доставляє замовлення. Будь ласка, додавайте дані про інших людей лише тоді, коли ви маєте на це право.",
          ],
          kind: "list",
        },
        { kind: "subheading", text: "Технічні дані, що збираються автоматично" },
        {
          items: [
            "Вашу IP-адресу та базову інформацію про запити в логах сервера, які ми зберігаємо для безпеки та усунення несправностей",
            "Один строго необхідний сесійний файл cookie (див. розділ «Файли cookie»)",
          ],
          kind: "list",
        },
        {
          kind: "paragraph",
          text: "Ми не використовуємо рекламні трекери та не запускаємо сторонню аналітику, що профілює вас.",
        },
      ],
      heading: "2. Які дані ми збираємо",
      id: "data-we-collect",
    },
    {
      blocks: [
        {
          items: [
            "Щоб створити й обслуговувати ваш обліковий запис та надавати сервіс: виконання договору з вами (ст. 6(1)(b) GDPR)",
            "Щоб надсилати важливі листи, як-от підтвердження пошти, скидання пароля та повідомлення про безпеку: виконання договору та наш законний інтерес у захисті облікових записів (ст. 6(1)(b) та (f))",
            "Щоб підтримувати безпеку сервісу, запобігати зловживанням та виправляти проблеми: наш законний інтерес (ст. 6(1)(f))",
            "Щоб виконувати юридичні обов'язки, коли вони застосовуються (ст. 6(1)(c))",
          ],
          kind: "list",
        },
        {
          kind: "paragraph",
          text: "Ми не продаємо ваші персональні дані та не використовуємо їх для автоматизованого ухвалення рішень чи профілювання.",
        },
      ],
      heading: "3. Навіщо ми використовуємо ваші дані та правова підстава",
      id: "why-we-use-data",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "Ми використовуємо один файл cookie під назвою `refresh_token`. Він строго необхідний: він безпечно тримає вас у системі. Він встановлюється як HttpOnly (недоступний для JavaScript) та SameSite=Lax і надсилається лише на наші ендпоінти автентифікації.",
        },
        {
          kind: "paragraph",
          text: "Оскільки цей cookie строго необхідний для надання сервісу, який ви самі запросили, він не потребує згоди за GDPR та правилами ePrivacy. Ми не використовуємо жодних рекламних, маркетингових чи аналітичних cookie. Якщо це колись зміниться, ми спершу попросимо вашу згоду.",
        },
      ],
      heading: "4. Файли cookie",
      id: "cookies",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "Ми не продаємо та не здаємо в оренду ваші дані. Ми передаємо їх лише постачальникам послуг (процесорам), які потрібні для роботи BookNest:",
        },
        {
          items: [
            "**Hetzner Online GmbH** (Німеччина, ЄС): хостинг наших серверів і бази даних.",
            "**Cloudflare, Inc.** (США): DNS, доставка контенту та захист від атак. Cloudflare обробляє технічні дані, наприклад вашу IP-адресу, коли ви під'єднуєтесь до сайту.",
            "**Доставка пошти**: транзакційні листи (підтвердження, скидання пароля та повідомлення про безпеку) надсилаються з нашого домену через нашого постачальника послуг електронної пошти.",
          ],
          kind: "list",
        },
        {
          kind: "paragraph",
          text: "Кожен постачальник обробляє дані лише за нашими інструкціями та згідно з договором про обробку даних.",
        },
      ],
      heading: "5. Кому ми передаємо дані",
      id: "data-sharing",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "Наші сервери та база даних розташовані в ЄС (Німеччина). Деякі постачальники, як-от Cloudflare, можуть обробляти технічні дані за межами ЄС, зокрема у США. У таких випадках передача захищена належними механізмами, наприклад Стандартними договірними положеннями Європейської Комісії.",
        },
      ],
      heading: "6. Міжнародна передача даних",
      id: "international-transfers",
    },
    {
      blocks: [
        {
          items: [
            "Дані облікового запису та бібліотеки: доки існує ваш обліковий запис. Коли ви видаляєте його, ми видаляємо або знеособлюємо ваші персональні дані, окрім випадків, коли щось потрібно зберегти для виконання юридичного обов'язку.",
            "Токени підтвердження пошти та скидання пароля: вони короткочасні та спливають автоматично.",
            "Логи сервера: зберігаються обмежений час для безпеки та усунення несправностей, потім видаляються.",
          ],
          kind: "list",
        },
      ],
      heading: "7. Скільки ми зберігаємо дані",
      id: "data-retention",
    },
    {
      blocks: [
        { kind: "paragraph", text: "За GDPR та законодавством України ви маєте право:" },
        {
          items: [
            "отримати доступ до персональних даних, які ми зберігаємо про вас",
            "виправити помилкові або неповні дані",
            "видалити свої дані («право бути забутим»)",
            "обмежити певну обробку або заперечити проти неї",
            "отримати свої дані у портативному, машинозчитуваному форматі",
            "відкликати згоду в будь-який час, коли ми покладаємось на згоду",
          ],
          kind: "list",
        },
        {
          kind: "paragraph",
          text: "Щоб скористатися будь-яким із цих прав, напишіть нам на **privacy@book-nest.net**. Ви також маєте право подати скаргу до органу захисту даних, в Україні це Уповноважений Верховної Ради з прав людини, або до наглядового органу вашої країни проживання в ЄС.",
        },
      ],
      heading: "8. Ваші права",
      id: "your-rights",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "Ми зберігаємо паролі лише як односторонній bcrypt-хеш, віддаємо весь сайт через HTTPS, тримаємо сесійний cookie як HttpOnly, застосовуємо обмеження частоти запитів та інші запобіжники. Жодна система не є ідеально захищеною, але ми вживаємо розумних заходів для захисту ваших даних.",
        },
      ],
      heading: "9. Як ми захищаємо ваші дані",
      id: "security",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "BookNest не призначений для дітей віком до 16 років. Якщо вам менше 16, будь ласка, не створюйте обліковий запис. Якщо ви вважаєте, що дитина надала нам персональні дані, зв'яжіться з нами, і ми їх видалимо.",
        },
      ],
      heading: "10. Діти",
      id: "children",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "Якщо ми внесемо суттєві зміни, ми оновимо дату «Останнє оновлення» і, за потреби, повідомимо вас. Подальше користування BookNest після зміни означає, що ви приймаєте оновлену політику.",
        },
      ],
      heading: "11. Зміни до цієї політики",
      id: "changes",
    },
    {
      blocks: [
        { kind: "paragraph", text: "Питання, запити чи скарги: **privacy@book-nest.net**." },
      ],
      heading: "12. Контакти",
      id: "contact",
    },
  ],
  title: "Політика конфіденційності",
};

const privacyContent: LegalDocumentDictionary = { en, uk };

export function getPrivacyContent(locale: Locale): LegalDocumentContent {
  return privacyContent[locale];
}
