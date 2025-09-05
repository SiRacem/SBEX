// src/pages/RateLimitExceededPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Container, Card, Button, Spinner } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { FaHourglassHalf, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const RateLimitExceededPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Function to get the reset time from localStorage
  const getResetTimeFromStorage = useCallback(() => {
    const storedTime = localStorage.getItem("rateLimitResetTime");
    if (!storedTime) return null;

    const resetDate = new Date(storedTime);
    // If the stored time is invalid or in the past, remove it and return null
    if (isNaN(resetDate.getTime()) || resetDate < new Date()) {
      localStorage.removeItem("rateLimitResetTime");
      return null;
    }
    return resetDate;
  }, []);

  const [resetTime, setResetTime] = useState(getResetTimeFromStorage());

  const calculateTimeLeft = useCallback(() => {
    if (!resetTime) return { total: 0, minutes: 0, seconds: 0 };

    const difference = resetTime - new Date();

    if (difference > 0) {
      return {
        total: difference,
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return { total: 0, minutes: 0, seconds: 0 };
  }, [resetTime]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    // If the time is up, clear the interval and the stored item
    if (timeLeft.total <= 0) {
      localStorage.removeItem("rateLimitResetTime");
      return;
    }

    // Set up an interval to update the countdown every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    // Clean up the interval when the component unmounts or dependencies change
    return () => clearInterval(timer);
  }, [calculateTimeLeft, timeLeft.total]);

  const handleGoBack = () => {
    // Always clear the storage when the user manually navigates away
    localStorage.removeItem("rateLimitResetTime");
    navigate("/login", { replace: true });
  };

  const isTimeUp = timeLeft.total <= 0;

  return (
    <div
      className="d-flex align-items-center justify-content-center vh-100"
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <Container>
        <Card
          className="text-center p-4 p-md-5 shadow-lg border-0"
          style={{ borderRadius: "15px" }}
        >
          <Card.Body>
            <FaHourglassHalf size={60} className="text-primary mb-4" />
            <h1 className="display-4 fw-bold">
              {t("rateLimit.title", "Too Many Attempts")}
            </h1>
            <p className="lead text-muted mb-4">
              {t(
                "rateLimit.subtitle",
                "For security reasons, your access has been temporarily locked."
              )}
            </p>
            <div className="countdown-timer bg-light p-3 rounded mb-4">
              <div className="fs-5 text-dark mb-1">
                {t("rateLimit.tryAgainIn", "Please try again in")}
              </div>
              {isTimeUp ? (
                <div className="display-3 fw-bolder text-success">
                  {t("rateLimit.now", "Now!")}
                </div>
              ) : (
                <div className="display-3 fw-bolder text-primary">
                  {String(timeLeft.minutes).padStart(2, "0")}:
                  {String(timeLeft.seconds).padStart(2, "0")}
                </div>
              )}
            </div>
            <Button
              variant={isTimeUp ? "success" : "primary"}
              size="lg"
              onClick={handleGoBack}
              disabled={!isTimeUp}
            >
              {isTimeUp ? (
                <>
                  <FaArrowLeft className="me-2" />
                  {t("rateLimit.goBackButtonReady", "Go to Login")}
                </>
              ) : (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    className="me-2"
                  />
                  {t("rateLimit.goBackButtonWaiting", "Wait to Continue")}
                </>
              )}
            </Button>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default RateLimitExceededPage;
