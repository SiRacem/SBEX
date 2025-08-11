// src/components/commun/Login.jsx
import React, { useState, useEffect } from "react";
import { Button, Card, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom"; // استيراد useNavigate
import { useTranslation } from 'react-i18next';
import { loginUser } from "../../redux/actions/userAction";

const Login = () => {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate(); // تهيئة useNavigate
  const loading = useSelector((state) => state.userReducer?.loading ?? false);

  useEffect(() => { document.documentElement.dir = i18n.dir(i18n.language); }, [i18n, i18n.language]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // loginUser الآن يمكن أن يعيد true أو false أو بيانات الخطأ
    const result = await dispatch(loginUser({ email, password }, navigate));
    // لا نحتاج للتعامل مع الخطأ هنا، لأن App.js سيتعامل معه
  };

  return (
    <Container fluid className="d-flex align-items-center justify-content-center login-container py-4" style={{ minHeight: "100vh" }}>
      <Row className="justify-content-center w-100">
        <Col xs={11} sm={10} md={8} lg={6} xl={4}>
          <Card className="p-4 p-md-5 shadow-lg login-card">
            <Card.Body>
              <h2 className="text-center mb-4 fw-bold text-primary">{t('auth.welcomeBack')}</h2>
              <Form onSubmit={handleSubmit} noValidate>
                <Form.Group className="mb-3" controlId="formBasicEmail">
                  <Form.Label>{t('auth.emailLabel')}</Form.Label>
                  <Form.Control type="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-4" controlId="formBasicPassword">
                  <Form.Label>{t('auth.passwordLabel')}</Form.Label>
                  <Form.Control type="password" placeholder={t('auth.passwordPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Form.Group>
                <Button variant="primary" type="submit" className="w-100 mb-3" disabled={loading}>
                  {loading ? <><Spinner as="span" animation="border" size="sm" /> {t('auth.loggingIn')}</> : t('auth.loginButton')}
                </Button>
                <div className="text-center mt-3 auth-switch-link">
                  <span>{t('auth.noAccount')} </span><Link to="/register" className="fw-bold">{t('auth.signUpLink')}</Link>
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