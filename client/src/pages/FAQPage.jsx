// src/pages/FAQPage.jsx
import React, { useEffect, useContext, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Form,
  InputGroup,
  Button,
  Accordion,
} from "react-bootstrap";
import { useTranslation } from "react-i18next"; // استيراد الهوك الخاص بالترجمة
import { getActiveFAQs } from "../redux/actions/faqAction";
import {
  FaQuestionCircle,
  FaSearch,
  FaBook,
  FaUser,
  FaShieldAlt,
  FaDollarSign,
  FaCreditCard,
  FaChevronRight,
} from "react-icons/fa";
import { SocketContext } from "../App";
import "./FAQPageRedesigned.css"; // تأكد من استيراد ملف CSS
import { toast } from 'react-toastify';

// مكون البطاقة لكل فئة
const CategoryCard = ({ categoryName, faqs, onCategoryClick }) => {
  const { t } = useTranslation(); // للحصول على الترجمة داخل المكون الفرعي إذا احتجت

  // يمكنك هنا تعيين أيقونات مخصصة لكل فئة
  const getCategoryIcon = (category) => {
    const lowerCaseCategory = category.toLowerCase();
    if (
      lowerCaseCategory.includes("account") ||
      lowerCaseCategory.includes("profile")
    )
      return <FaUser size={28} />;
    if (
      lowerCaseCategory.includes("mediation") ||
      lowerCaseCategory.includes("dispute")
    )
      return <FaShieldAlt size={28} />;
    if (
      lowerCaseCategory.includes("payment") ||
      lowerCaseCategory.includes("billing")
    )
      return <FaCreditCard size={28} />;
    if (
      lowerCaseCategory.includes("selling") ||
      lowerCaseCategory.includes("buying")
    )
      return <FaDollarSign size={28} />;
    if (lowerCaseCategory.includes("general"))
      return <FaQuestionCircle size={28} />;
    // أيقونة افتراضية إذا لم تتطابق أي فئة
    return <FaBook size={28} />;
  };

  return (
    <Col md={6} lg={4} className="mb-4">
      <Card
        className="faq-category-card h-100"
        onClick={() => onCategoryClick(categoryName)}
      >
        <Card.Body className="text-center d-flex flex-column">
          <div className="icon-container mb-3">
            {getCategoryIcon(categoryName)}
          </div>
          <Card.Title as="h4" className="mb-2">
            {categoryName}
          </Card.Title>
          <Card.Text className="text-muted flex-grow-1">
            Find answers related to {categoryName.toLowerCase()}.
          </Card.Text>
          <div className="mt-3 articles-count">
            {faqs.length} {faqs.length === 1 ? "article" : "articles"}
          </div>
        </Card.Body>
      </Card>
    </Col>
  );
};

const FAQPage = () => {
  const { t, i18n } = useTranslation(); // استخدام الهوك للحصول على دالة الترجمة t و instance i18n
  const dispatch = useDispatch();
  const socket = useContext(SocketContext);
  const { groupedFAQs, loading, error } = useSelector(
    (state) => state.faqReducer
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);

  // useEffect لجلب البيانات عند تحميل الصفحة
  useEffect(() => {
    dispatch(getActiveFAQs());
  }, [dispatch]);

  // useEffect للاستماع إلى تحديثات Socket.IO
  useEffect(() => {
    if (socket) {
      const handleFaqUpdate = () => {
        console.log("SOCKET: Re-fetching FAQs due to 'faqs_updated' event.");
        toast.info(t("faq.listUpdated"), { autoClose: 2000 }); // استخدام الترجمة للـ toast
        dispatch(getActiveFAQs());
      };
      socket.on("faqs_updated", handleFaqUpdate);
      return () => {
        socket.off("faqs_updated", handleFaqUpdate);
      };
    }
  }, [socket, dispatch, t]); // أضف t إلى الاعتماديات إذا كنت تستخدمها داخل الـ effect

  // useEffect لتحديث اتجاه الصفحة عند تغيير اللغة
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.dir(i18n.language);
  }, [i18n, i18n.language]);

  // تصفية الأسئلة والفئات بناءً على البحث
  const filteredFAQs = useMemo(() => {
    if (!searchQuery) return groupedFAQs;
    const lowercasedQuery = searchQuery.toLowerCase();
    const result = {};
    for (const category in groupedFAQs) {
      const filtered = groupedFAQs[category].filter(
        (faq) =>
          faq.question.toLowerCase().includes(lowercasedQuery) ||
          faq.answer.toLowerCase().includes(lowercasedQuery)
      );
      if (filtered.length > 0) {
        result[category] = filtered;
      }
    }
    return result;
  }, [searchQuery, groupedFAQs]);

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setExpandedQuestionId(null);
    window.scrollTo({ top: 250, behavior: "smooth" });
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
  };

  const toggleQuestion = (faqId) => {
    setExpandedQuestionId((prevId) => (prevId === faqId ? null : faqId));
  };

  if (loading && Object.keys(groupedFAQs).length === 0) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "80vh" }}
      >
        <Spinner
          animation="border"
          variant="primary"
          style={{ width: "4rem", height: "4rem" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger" className="text-center">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <div className="faq-page-container">
      <header className="faq-header">
        <Container>
          <h1 className="header-title">{t("faq.title")}</h1>
          <p className="header-subtitle">{t("faq.subtitle")}</p>
          <Form.Group className="search-bar-container mx-auto">
            <InputGroup>
              <InputGroup.Text>
                <FaSearch />
              </InputGroup.Text>
              <Form.Control
                type="search"
                placeholder={t("faq.searchPlaceholder")}
                className="search-input"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedCategory(null);
                  setExpandedQuestionId(null);
                }}
              />
            </InputGroup>
          </Form.Group>
        </Container>
      </header>

      <Container className="py-5 faq-content-area">
        {selectedCategory ? (
          <div className="category-questions-list">
            <Button
              variant="link"
              onClick={handleBackToCategories}
              className="mb-4 back-to-categories-btn"
            >
              ← {t("faq.backToCategories")}
            </Button>
            <h2 className="mb-3 category-title">{selectedCategory}</h2>

            {(filteredFAQs[selectedCategory] || []).map((faq) => (
              <div key={faq._id} className="question-item-wrapper">
                <div
                  className="question-item-header"
                  onClick={() => toggleQuestion(faq._id)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) =>
                    e.key === "Enter" && toggleQuestion(faq._id)
                  }
                  aria-expanded={expandedQuestionId === faq._id}
                  aria-controls={`faq-answer-${faq._id}`}
                >
                  <span>{faq.question}</span>
                  <FaChevronRight
                    className={`chevron-icon ${
                      expandedQuestionId === faq._id ? "expanded" : ""
                    }`}
                  />
                </div>
                {expandedQuestionId === faq._id && (
                  <div
                    className="question-item-body"
                    id={`faq-answer-${faq._id}`}
                    role="region"
                  >
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.7" }}>
                      {faq.answer}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Row>
            {loading ? (
              <div className="text-center w-100">
                <Spinner animation="border" />
              </div>
            ) : Object.keys(filteredFAQs).length > 0 ? (
              Object.keys(filteredFAQs)
                .sort()
                .map((category) =>
                  searchQuery ? (
                    <div key={category} className="w-100 mb-4">
                      <h4 className="mb-3 text-muted">{category}</h4>
                      {filteredFAQs[category].map((faq) => (
                        <div
                          key={faq._id}
                          className="search-result-item"
                          onClick={() => {
                            setSelectedCategory(category);
                            setExpandedQuestionId(faq._id);
                          }}
                        >
                          <h5>{faq.question}</h5>
                          <p className="text-muted">
                            {faq.answer.substring(0, 150)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <CategoryCard
                      key={category}
                      categoryName={category}
                      faqs={filteredFAQs[category]}
                      onCategoryClick={handleCategoryClick}
                    />
                  )
                )
            ) : (
              !loading && (
                <Col xs={12}>
                  <Alert variant="warning" className="text-center">
                    {searchQuery
                      ? t("faq.noResults", { query: searchQuery })
                      : t("faq.noFaqs")}
                  </Alert>
                </Col>
              )
            )}
          </Row>
        )}
      </Container>
    </div>
  );
};

export default FAQPage;
