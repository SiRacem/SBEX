// client/src/pages/RateLimitExceededPage.jsx

import React, { useState, useEffect, useCallback } from "react";
import { Container, Card, Button, Alert, Spinner } from "react-bootstrap";
import { FaHourglassHalf, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const RateLimitExceededPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(null);

  const calculateTimeLeft = useCallback(() => {
    const resetTimeString = localStorage.getItem("rateLimitResetTime");
    if (!resetTimeString) return 0;

    const resetTime = new Date(resetTimeString).getTime();
    const now = new Date().getTime();
    const difference = resetTime - now;

    return difference > 0 ? difference : 0;
  }, []);

  useEffect(() => {
    const remaining = calculateTimeLeft();
    setTimeLeft(remaining);

    if (remaining > 0) {
      const interval = setInterval(() => {
        const newRemaining = calculateTimeLeft();
        setTimeLeft(newRemaining);
        if (newRemaining <= 0) {
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [calculateTimeLeft]);

  const formatTime = (ms) => {
    if (ms === null) return <Spinner as="span" animation="border" size="sm" />;
    if (ms <= 0) {
      return t("rateLimit.now", "الآن!");
    }
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  };

  const canGoBack = timeLeft !== null && timeLeft <= 0;

  return (
    <Container
      fluid
      className="d-flex align-items-center justify-content-center vh-100 bg-light"
    >
      <Card
        className="text-center shadow-lg p-4 p-md-5"
        style={{ maxWidth: "500px", width: "90%" }}
      >
        <Card.Body>
          <FaHourglassHalf size={50} className="text-danger mb-4" />
          <h1 className="h3 fw-bold">{t("rateLimit.title")}</h1>
          <p className="text-muted">{t("rateLimit.subtitle")}</p>

          <Alert variant={canGoBack ? "success" : "warning"} className="my-4">
            {t("rateLimit.tryAgainIn")}
            <div className="display-4 fw-bold my-2 countdown-timer">
              {formatTime(timeLeft)}
            </div>
          </Alert>

          {canGoBack ? (
            <Button
              variant="success"
              size="lg"
              onClick={() => {
                localStorage.removeItem("rateLimitResetTime");
                navigate("/login", { replace: true });
              }}
            >
              <FaArrowLeft className="me-2" />
              {t("rateLimit.goBackButtonReady")}
            </Button>
          ) : (
            <Button variant="secondary" size="lg" disabled>
              <FaHourglassHalf className="me-2 spinner-grow spinner-grow-sm" />
              {t("rateLimit.goBackButtonWaiting")}
            </Button>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default RateLimitExceededPage;
