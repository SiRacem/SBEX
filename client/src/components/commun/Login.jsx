// client/src/components/commun/Login.jsx

import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, clearUserErrors } from "../../redux/actions/userAction";
import { toast } from "react-toastify";
import {
  Form,
  Button,
  Container,
  Row,
  Col,
  Card,
  Spinner,
} from "react-bootstrap";
import { useTranslation } from "react-i18next";

const Login = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { isAuth, loading, errorMessage } = useSelector(
    (state) => state.userReducer
  );

  // [!!!] START: الإصلاح رقم 1 - التحقق من الحظر عند تحميل الصفحة [!!!]
  useEffect(() => {
    const resetTimeString = localStorage.getItem("rateLimitResetTime");
    if (resetTimeString) {
      const resetTime = new Date(resetTimeString).getTime();
      if (resetTime > new Date().getTime()) {
        // إذا كان الحظر لا يزال نشطاً، قم بالتحويل مباشرة
        navigate("/rate-limit-exceeded", { replace: true });
      } else {
        // إذا انتهى وقت الحظر، قم بإزالته
        localStorage.removeItem("rateLimitResetTime");
      }
    }
  }, [navigate]);
  // [!!!] END: نهاية الإصلاح رقم 1 [!!!]

  useEffect(() => {
    document.documentElement.dir = i18n.dir(i18n.language);
  }, [i18n, i18n.language]);

  useEffect(() => {
    if (isAuth) {
      navigate("/dashboard", { replace: true });
      return;
    }

    // [!!!] START: الإصلاح النهائي - منطق مبسط جداً [!!!]
    if (errorMessage) {
      const isRateLimitError =
        errorMessage.key === "apiErrors.tooManyLoginAttempts" ||
        errorMessage.key === "apiErrors.tooManyRequests";

      // فقط تحقق مما إذا كان يجب التحويل
      if (isRateLimitError) {
        if (errorMessage.rateLimit?.resetTime) {
          localStorage.setItem(
            "rateLimitResetTime",
            errorMessage.rateLimit.resetTime
          );
        }
        // لا تعرض toast من هنا، فقط قم بالتحويل
        navigate("/rate-limit-exceeded", { replace: true });
      }

      // لا تقم بمسح الخطأ هنا، دعه يمسح عند المحاولة التالية
    }
    // [!!!] END: نهاية الإصلاح [!!!]
  }, [isAuth, errorMessage, navigate, dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error(t("auth.toast.fillAllFields", "Please fill in all fields."));
      return;
    }
    dispatch(clearUserErrors());
    dispatch(loginUser({ email, password }));
  };

  return (
    <Container
      fluid
      className="d-flex align-items-center justify-content-center login-container py-4"
      style={{ minHeight: "100vh" }}
    >
      <Row className="justify-content-center w-100">
        <Col xs={11} sm={10} md={8} lg={6} xl={4}>
          <Card className="p-4 p-md-5 shadow-lg login-card">
            <Card.Body>
              <h2 className="text-center mb-4 fw-bold text-primary">
                {t("auth.welcomeBack")}
              </h2>
              <Form onSubmit={handleSubmit} noValidate>
                <Form.Group className="mb-3" controlId="formBasicEmail">
                  <Form.Label>{t("auth.emailLabel")}</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder={t("auth.emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </Form.Group>
                <Form.Group className="mb-4" controlId="formBasicPassword">
                  <Form.Label>{t("auth.passwordLabel")}</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder={t("auth.passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </Form.Group>
                <Button
                  variant="primary"
                  type="submit"
                  className="w-100 mb-3"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" />{" "}
                      {t("auth.loggingIn")}
                    </>
                  ) : (
                    t("auth.loginButton")
                  )}
                </Button>
                <div className="text-center mt-3 auth-switch-link">
                  <span>{t("auth.noAccount")} </span>
                  <Link to="/register" className="fw-bold">
                    {t("auth.signUpLink")}
                  </Link>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;