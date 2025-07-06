// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// استيراد ملفات الترجمة لكل لغة
import translationEN from './locales/en/translation.json';
import translationAR from './locales/ar/translation.json';
import translationTN from './locales/tn/translation.json';
import translationFR from './locales/fr/translation.json';

// تعريف الموارد (الترجمات) التي ستستخدمها i18next
const resources = {
  en: {
    translation: translationEN,
  },
  ar: {
    translation: translationAR,
  },
  tn: {
    translation: translationTN,
  },
  fr: {
    translation: translationFR,
  },
};

i18n
  // LanguageDetector: يكتشف لغة المستخدم تلقائيًا
  .use(LanguageDetector)
  // initReactI18next: يمرر i18n instance إلى react-i18next
  .use(initReactI18next)
  // إعدادات i18next
  .init({
    resources, // الموارد (الترجمات) التي سيتم استخدامها

    // اللغة الافتراضية التي سيتم استخدامها في حال فشل اكتشاف اللغة
    // أو إذا كانت اللغة المكتشفة غير مدعومة
    fallbackLng: 'en',

    // قائمة اللغات المدعومة بشكل صريح
    supportedLngs: ['en', 'ar', 'tn', 'fr'],

    // تفعيل وضع التصحيح في الكونسول (مفيد جدًا أثناء التطوير)
    debug: process.env.NODE_ENV === 'development',

    // خيارات إضافية
    interpolation: {
      escapeValue: false, // React يقوم بالفعل بالحماية من هجمات XSS
    },

    // إعدادات خاصة بـ LanguageDetector
    detection: {
      // ترتيب طرق اكتشاف اللغة:
      // 1. localStorage: يبحث عن اللغة التي اختارها المستخدم سابقًا.
      // 2. navigator: يبحث عن لغة المتصفح.
      // 3. htmlTag: يبحث عن السمة 'lang' في وسم <html>.
      order: ['localStorage', 'navigator', 'htmlTag'],

      // أين يتم تخزين اختيار المستخدم للغة بشكل دائم
      caches: ['localStorage'],
    },
  });

// --- [!!!] تعديل حاسم لضمان عمل RTL بشكل صحيح ---
// نقوم بتعريف دالة dir يدويًا على i18n instance
// هذا يتجاوز السلوك الافتراضي ويضمن أن 'tn' تُعامل كـ RTL
i18n.dir = (lng) => {
  const currentLang = lng || i18n.language;
  const rtlLangs = ['ar', 'tn']; // قائمتنا الصريحة للغات RTL

  if (!currentLang) {
    return 'ltr';
  }

  // نتحقق من رمز اللغة الأساسي (مثل 'ar' من 'ar-SA')
  const langPart = currentLang.split('-')[0];

  return rtlLangs.includes(langPart) ? 'rtl' : 'ltr';
};


export default i18n;