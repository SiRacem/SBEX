import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown, Image, ListGroup } from "react-bootstrap";
import { FaCheckCircle } from "react-icons/fa";

import flagEn from "../../assets/flags/us.svg";
import flagAr from "../../assets/flags/sa.svg";
import flagTn from "../../assets/flags/tn.svg";
import flagFr from "../../assets/flags/fr.svg";

const languages = [
  { code: "en", name: "English", flag: flagEn },
  { code: "ar", name: "العربية", flag: flagAr },
  { code: "fr", name: "Français", flag: flagFr },
  { code: "tn", name: "تونسي", flag: flagTn },
];

const LanguageSwitcher = ({ as = "dropdown" }) => {
  const { i18n } = useTranslation();
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  React.useEffect(() => {
    const currentLang = i18n.language;
    const rtlLanguages = ["ar", "tn"];
    document.documentElement.lang = currentLang;
    document.documentElement.dir = rtlLanguages.includes(
      currentLang.split("-")[0]
    )
      ? "rtl"
      : "ltr";
  }, [i18n, i18n.language]);

  const currentLanguage = languages.find((lang) => lang.code === i18n.language);

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
          >
            <div className="d-flex align-items-center">
              {/* نستخدم me-3 بشكل طبيعي. الـ CSS سيهتم بعكسها */}
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

  // Dropdown version
  return (
    <Dropdown>
      <Dropdown.Toggle
        variant="dark"
        id="language-switcher-dropdown"
        className="d-flex align-items-center"
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
};

export default LanguageSwitcher;
