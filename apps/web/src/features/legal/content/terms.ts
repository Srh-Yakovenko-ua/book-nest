import type { Locale } from "@/i18n/routing";

import type { LegalDocumentContent, LegalDocumentDictionary } from "./types";

const en: LegalDocumentContent = {
  lastUpdated: "Last updated: 9 July 2026",
  lead: [
    "These Terms are the agreement between you and BookNest when you use book-nest.net. Please read them. By creating an account or using the service you accept these Terms.",
  ],
  sections: [
    {
      blocks: [
        {
          kind: "paragraph",
          text: "BookNest is a personal reading library. It lets you catalog books, series, authors and publishers, track reading progress, keep lists, favorites and a reading queue, and record loans and deliveries. We may add, change or remove features over time.",
        },
      ],
      heading: "1. The service",
      id: "the-service",
    },
    {
      blocks: [
        {
          items: [
            "You must provide accurate information and keep it up to date.",
            "You are responsible for keeping your password safe and for everything that happens under your account. Tell us at privacy@book-nest.net if you think your account has been compromised.",
            "You must be at least 16 years old to use BookNest.",
            "One person, one account. Do not impersonate anyone or use another person's details.",
          ],
          kind: "list",
        },
      ],
      heading: "2. Your account",
      id: "your-account",
    },
    {
      blocks: [
        { kind: "paragraph", text: "When using BookNest, you agree not to:" },
        {
          items: [
            "break any law or infringe anyone's rights, including intellectual property or privacy rights",
            "upload or store content that is illegal, harmful, hateful or infringing",
            "try to break, overload, scrape, reverse engineer or gain unauthorized access to the service or its infrastructure",
            "use the service to send spam or malware, or to harass others",
            "add personal data about other people that you have no right to add",
          ],
          kind: "list",
        },
        {
          kind: "paragraph",
          text: "We may suspend or limit access if we reasonably believe you are breaking these rules.",
        },
      ],
      heading: "3. Acceptable use",
      id: "acceptable-use",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "The books, notes, lists and other content you add stay yours. You grant us the limited permission we need to store, process and show that content back to you so the service works. You are responsible for the content you add and for having the right to add it. We do not claim ownership of your content and we do not use it for advertising.",
        },
      ],
      heading: "4. Your content",
      id: "your-content",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "The BookNest name, logo, design and software are ours or our licensors' and are protected by intellectual property law. These Terms do not give you any right to use our brand without permission.",
        },
      ],
      heading: "5. Our content and brand",
      id: "our-content",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: 'BookNest is provided "as is" and "as available". It is an actively developed product, and we do not promise that it will always be available, uninterrupted, or error-free. We may change, suspend or discontinue any part of the service at any time. Where the law allows, we give no warranties beyond those that cannot be excluded.',
        },
      ],
      heading: '6. Availability and "as is"',
      id: "availability",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "To the fullest extent permitted by law, BookNest is not liable for indirect, incidental or consequential damages, or for loss of data or profits, arising from your use of or inability to use the service. Nothing in these Terms limits liability that cannot be limited by law. We strongly recommend you keep your own copies of anything important.",
        },
      ],
      heading: "7. Limitation of liability",
      id: "liability",
    },
    {
      blocks: [
        {
          items: [
            "You can stop using BookNest and delete your account at any time.",
            "We may suspend or terminate your account if you break these Terms or if we must do so for legal or security reasons. Where reasonable, we will give you notice.",
            "Sections that by their nature should survive termination (for example content ownership, liability and governing law) continue to apply.",
          ],
          kind: "list",
        },
      ],
      heading: "8. Termination",
      id: "termination",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: 'We may update these Terms. If we make significant changes, we will update the "Last updated" date and, where appropriate, notify you. Continuing to use BookNest after a change means you accept the updated Terms.',
        },
      ],
      heading: "9. Changes to these Terms",
      id: "changes",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "These Terms are governed by the laws of Ukraine, without affecting any mandatory consumer protection rights you have in your country of residence.",
        },
      ],
      heading: "10. Governing law",
      id: "governing-law",
    },
    {
      blocks: [
        { kind: "paragraph", text: "Questions about these Terms: **privacy@book-nest.net**." },
      ],
      heading: "11. Contact",
      id: "contact",
    },
  ],
  title: "Terms of Service",
};

const uk: LegalDocumentContent = {
  lastUpdated: "Останнє оновлення: 9 липня 2026",
  lead: [
    "Ці Умови є угодою між вами та BookNest, коли ви користуєтесь book-nest.net. Будь ласка, прочитайте їх. Створюючи обліковий запис або користуючись сервісом, ви приймаєте ці Умови.",
  ],
  sections: [
    {
      blocks: [
        {
          kind: "paragraph",
          text: "BookNest — це персональна бібліотека для читання. Він дозволяє каталогізувати книги, серії, авторів і видавництва, відстежувати прогрес читання, вести списки, обране та чергу читання, а також записувати позики й доставки. Згодом ми можемо додавати, змінювати або прибирати функції.",
        },
      ],
      heading: "1. Сервіс",
      id: "the-service",
    },
    {
      blocks: [
        {
          items: [
            "Ви маєте надавати достовірну інформацію та підтримувати її в актуальному стані.",
            "Ви відповідаєте за збереження свого пароля та за все, що відбувається під вашим обліковим записом. Повідомте нас на privacy@book-nest.net, якщо вважаєте, що ваш обліковий запис скомпрометовано.",
            "Щоб користуватися BookNest, вам має бути щонайменше 16 років.",
            "Одна людина — один обліковий запис. Не видавайте себе за іншу особу та не використовуйте чужі дані.",
          ],
          kind: "list",
        },
      ],
      heading: "2. Ваш обліковий запис",
      id: "your-account",
    },
    {
      blocks: [
        { kind: "paragraph", text: "Користуючись BookNest, ви погоджуєтесь не:" },
        {
          items: [
            "порушувати закон чи чиїсь права, зокрема права інтелектуальної власності або приватності",
            "завантажувати чи зберігати контент, що є незаконним, шкідливим, ворожим або таким, що порушує права",
            "намагатися зламати, перевантажити, скрейпити, здійснювати реверс-інжиніринг чи отримувати несанкціонований доступ до сервісу або його інфраструктури",
            "використовувати сервіс для розсилання спаму чи шкідливого ПЗ або для переслідування інших",
            "додавати персональні дані інших людей, на які ви не маєте права",
          ],
          kind: "list",
        },
        {
          kind: "paragraph",
          text: "Ми можемо призупинити чи обмежити доступ, якщо маємо обґрунтовані підстави вважати, що ви порушуєте ці правила.",
        },
      ],
      heading: "3. Прийнятне користування",
      id: "acceptable-use",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "Книги, нотатки, списки та інший контент, який ви додаєте, залишаються вашими. Ви надаєте нам обмежений дозвіл, потрібний для зберігання, обробки та показу цього контенту вам, щоб сервіс працював. Ви відповідаєте за контент, який додаєте, і за наявність права його додавати. Ми не претендуємо на власність вашого контенту та не використовуємо його для реклами.",
        },
      ],
      heading: "4. Ваш контент",
      id: "your-content",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "Назва BookNest, логотип, дизайн і програмне забезпечення належать нам або нашим ліцензіарам і захищені правом інтелектуальної власності. Ці Умови не дають вам права використовувати наш бренд без дозволу.",
        },
      ],
      heading: "5. Наш контент і бренд",
      id: "our-content",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "BookNest надається «як є» та «як доступно». Це продукт, що активно розробляється, і ми не обіцяємо, що він завжди буде доступним, безперервним чи без помилок. Ми можемо змінювати, призупиняти чи припиняти будь-яку частину сервісу в будь-який час. У межах, дозволених законом, ми не надаємо гарантій, окрім тих, які не можна виключити.",
        },
      ],
      heading: "6. Доступність і надання «як є»",
      id: "availability",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "У максимально дозволених законом межах BookNest не несе відповідальності за непрямі, побічні чи наслідкові збитки, а також за втрату даних чи прибутку, що виникають через ваше користування чи неможливість користуватися сервісом. Ніщо в цих Умовах не обмежує відповідальність, яку не можна обмежити за законом. Ми наполегливо радимо тримати власні копії всього важливого.",
        },
      ],
      heading: "7. Обмеження відповідальності",
      id: "liability",
    },
    {
      blocks: [
        {
          items: [
            "Ви можете припинити користування BookNest і видалити свій обліковий запис у будь-який час.",
            "Ми можемо призупинити чи припинити ваш обліковий запис, якщо ви порушуєте ці Умови або якщо ми зобов'язані зробити це з юридичних чи безпекових причин. Коли це доречно, ми повідомимо вас заздалегідь.",
            "Розділи, які за своєю природою мають діяти після припинення (наприклад, власність на контент, відповідальність та застосовне право), продовжують застосовуватися.",
          ],
          kind: "list",
        },
      ],
      heading: "8. Припинення",
      id: "termination",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "Ми можемо оновлювати ці Умови. Якщо ми внесемо суттєві зміни, ми оновимо дату «Останнє оновлення» і, за потреби, повідомимо вас. Подальше користування BookNest після зміни означає, що ви приймаєте оновлені Умови.",
        },
      ],
      heading: "9. Зміни до цих Умов",
      id: "changes",
    },
    {
      blocks: [
        {
          kind: "paragraph",
          text: "Ці Умови регулюються законодавством України, без обмеження ваших обов'язкових прав споживача у країні вашого проживання.",
        },
      ],
      heading: "10. Застосовне право",
      id: "governing-law",
    },
    {
      blocks: [{ kind: "paragraph", text: "Питання щодо цих Умов: **privacy@book-nest.net**." }],
      heading: "11. Контакти",
      id: "contact",
    },
  ],
  title: "Умови використання",
};

const termsContent: LegalDocumentDictionary = { en, uk };

export function getTermsContent(locale: Locale): LegalDocumentContent {
  return termsContent[locale];
}
