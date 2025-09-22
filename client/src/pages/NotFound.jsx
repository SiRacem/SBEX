import React from "react";
import { Link } from "react-router-dom";
import { Container, Row, Col, Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { FaExclamationTriangle } from "react-icons/fa";

const NotFound = () => {
  const { t } = useTranslation();

  return (
    <Container className="d-flex align-items-center justify-content-center vh-100">
      <Row className="text-center">
        <Col>
          <FaExclamationTriangle size={80} className="text-warning mb-4" />
          <h1 className="display-1">404</h1>
          <h2>{t("notFound.title", "Page Not Found")}</h2>
          <p className="lead text-muted">
            {t(
              "notFound.message",
              "Sorry, the page you are looking for does not exist."
            )}
          </p>
          <Button as={Link} to="/" variant="primary" className="mt-4">
            {t("notFound.goHome", "Go to Homepage")}
          </Button>
        </Col>
      </Row>
    </Container>
  );
};

export default NotFound;