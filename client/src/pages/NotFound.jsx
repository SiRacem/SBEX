// src/pages/NotFound.jsx

import React from "react";
import { Link } from "react-router-dom";
import { Container, Row, Col, Button } from "react-bootstrap";
import { useTranslation } from "react-i18next"; // 1. استيراد الهوك
import { FaExclamationTriangle } from "react-icons/fa";

const NotFound = () => {
  const { t } = useTranslation(); // 2. الحصول على دالة الترجمة

  return (
    <Container className="d-flex align-items-center justify-content-center vh-100">
      <Row className="text-center">
        <Col>
          <FaExclamationTriangle size={80} className="text-warning mb-4" />
          <h1 className="display-1">404</h1>
          {/* 3. استخدام دالة الترجمة بدلاً من النصوص الثابتة */}
          <h2>{t("notFound.title")}</h2>
          <p className="lead text-muted">{t("notFound.message")}</p>
          <Button as={Link} to="/" variant="primary" className="mt-4">
            {t("notFound.goHome")}
          </Button>
        </Col>
      </Row>
    </Container>
  );
};

export default NotFound;