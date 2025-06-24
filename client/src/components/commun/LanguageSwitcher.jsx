// src/components/LanguageSwitcher.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown, Image, ListGroup } from "react-bootstrap";
import { FaCheckCircle } from "react-icons/fa";

// استيراد صور الأعلام. تأكد من أن هذه المسارات صحيحة في مشروعك
import flagEn from "../../assets/flags/us.svg"; // علم بريطانيا للغة الإنجليزية
import flagAr from "../../assets/flags/sa.svg"; // علم السعودية للغة العربية
import flagTn from "../../assets/flags/tn.svg"; // علم تونس
import flagFr from "../../assets/flags/fr.svg";

const languages = [
  { code: "en", name: "English", flag: flagEn },
  { code: "ar", name: "العربية", flag: flagAr },
  { code: "fr", name: "Français", flag: flagFr }, // <-- إضافة جديدة
  { code: "tn", name: "تونسي", flag: flagTn },
];

/**
 * مكون مرن لتغيير اللغة، يمكن عرضه كقائمة منسدلة أو كقائمة عادية.
 * @param {object} props - الخصائص الممررة للمكون.
 * @param {'dropdown' | 'list'} [props.as='dropdown'] - كيفية عرض المكون.
 */
const LanguageSwitcher = ({ as = "dropdown" }) => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  // هذا الـ useEffect مسؤول عن تحديث اتجاه الصفحة بالكامل
  // بناءً على اللغة المختارة.
  React.useEffect(() => {
    const currentLang = i18n.language;
    // تعريف اللغات التي تتطلب RTL
    const rtlLanguages = ["ar", "tn"];

    document.documentElement.lang = currentLang;
    document.documentElement.dir = rtlLanguages.includes(currentLang)
      ? "rtl"
      : "ltr";
  }, [i18n, i18n.language]);

  const currentLanguage = languages.find((lang) => lang.code === i18n.language);

  // --- عرض القائمة المنسدلة (للاستخدام في الهيدر مثلاً) ---
  if (as === "dropdown") {
    return (
      <Dropdown>
        <Dropdown.Toggle
          variant="dark"
          id="language-switcher-dropdown"
          className="d-flex align-items-center language-switcher-toggle"
        >
          {currentLanguage ? (
            <>
              <Image
                src={currentLanguage.flag}
                roundedCircle
                width="20"
                height="20"
                className="me-2"
              />
              <span className="d-none d-md-inline">{currentLanguage.name}</span>
              {/* عرض رمز اللغة فقط على الشاشات الصغيرة */}
              <span className="d-inline d-md-none">
                {currentLanguage.code.toUpperCase()}
              </span>
            </>
          ) : (
            "Lang"
          )}
        </Dropdown.Toggle>

        <Dropdown.Menu variant="dark">
          {languages.map((lang) => (
            <Dropdown.Item
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              active={i18n.language === lang.code}
              className="d-flex align-items-center"
            >
              <Image
                src={lang.flag}
                roundedCircle
                width="20"
                height="20"
                className="me-2"
              />
              <span>{lang.name}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  // --- عرض قائمة عادية (للاستخدام داخل Offcanvas أو Sidebar) ---
  if (as === "list") {
    return (
      <ListGroup variant="flush">
        {languages.map((lang) => (
          <ListGroup.Item
            key={lang.code}
            action
            onClick={() => changeLanguage(lang.code)}
            active={i18n.language === lang.code}
            className="d-flex justify-content-between align-items-center"
            style={{ cursor: "pointer" }}
          >
            <div className="d-flex align-items-center">
              <Image
                src={lang.flag}
                roundedCircle
                width="24"
                height="24"
                className="me-3"
              />
              <span>{lang.name}</span>
            </div>
            {i18n.language === lang.code && (
              <FaCheckCircle className="text-success" />
            )}
          </ListGroup.Item>
        ))}
      </ListGroup>
    );
  }

  // في حالة تمرير قيمة غير مدعومة لـ 'as'
  return null;
};

export default LanguageSwitcher;
