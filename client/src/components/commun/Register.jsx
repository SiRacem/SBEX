// src/components/commun/Register.jsx
import React, { useState, useEffect } from "react";
import {
  Alert,
  Button,
  Form,
  Spinner,
  Container,
  Row,
  Col,
  Card,
} from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  registerUser,
  clearUserErrors,
  clearRegistrationStatus,
} from "../../redux/actions/userAction";
import { toast } from "react-toastify";
import { FaUser, FaStore } from "react-icons/fa";

const Register = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // States for form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [userRole, setUserRole] = useState("User");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const [formErrors, setFormErrors] = useState({});

  const loading = useSelector((state) => state.userReducer?.loading ?? false);
  const registrationStatus = useSelector(
    (state) => state.userReducer?.registrationStatus ?? null
  );

  useEffect(() => {
    document.documentElement.dir = i18n.dir();
  }, [i18n, i18n.language]);

  // استخراج كود الإحالة من الرابط تلقائياً
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const refCode = params.get("ref");
    if (refCode) {
      setReferralCode(refCode);
    }
  }, [location]);

  useEffect(() => {
    if (registrationStatus === "success") {
      dispatch(clearRegistrationStatus());
      navigate("/login");
    }
  }, [registrationStatus, dispatch, navigate]);

  const validateForm = () => {
    const newErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = t("auth.validation.fullNameRequired", "Full name is required.");
    }

    if (!email.trim()) {
      newErrors.email = t("auth.validation.emailRequired", "Email is required.");
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = t("auth.validation.emailInvalid", "Email address is invalid.");
    }

    if (!password) {
      newErrors.password = t("auth.validation.passwordRequired", "Password is required.");
    } else if (password.length < 6) {
      newErrors.password = t("auth.validation.passwordLength", "Password must be at least 6 characters.");
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = t("auth.validation.passwordsDoNotMatch", "Passwords do not match!");
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(clearUserErrors());

    if (validateForm()) {
      dispatch(
        registerUser({
          fullName,
          email,
          phone,
          address,
          userRole,
          password,
          referredByCode: referralCode // نرسل كود الدعوة (إن وجد) تحت هذا الاسم
        })
      );
    } else {
      toast.warn(t("auth.validation.fixErrors", "Please fix the errors in the form."));
    }
  };

  const handleInputChange = (setter, fieldName) => (e) => {
    setter(e.target.value);
    if (formErrors[fieldName]) {
      setFormErrors((prevErrors) => ({ ...prevErrors, [fieldName]: null }));
    }
  };

  return (
    <Container
      fluid
      className="d-flex align-items-center justify-content-center register-container py-4"
      style={{ minHeight: "100vh" }}
    >
      <Row className="justify-content-center w-100">
        <Col xs={11} sm={10} md={8} lg={7} xl={5}>
          <Card className="p-4 p-md-5 shadow-lg register-card">
            <Card.Body>
              <h2 className="text-center mb-4 fw-bold text-primary">
                {t("auth.createAccount")}
              </h2>

              <Form onSubmit={handleSubmit} noValidate>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>{t("auth.fullNameLabel")}</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder={t("auth.fullNamePlaceholder")}
                        value={fullName}
                        onChange={handleInputChange(setFullName, "fullName")}
                        required
                        isInvalid={!!formErrors.fullName}
                      />
                      <Form.Control.Feedback type="invalid">
                        {formErrors.fullName}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>{t("auth.emailLabel")}</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder={t("auth.emailPlaceholder")}
                        value={email}
                        onChange={handleInputChange(setEmail, "email")}
                        required
                        isInvalid={!!formErrors.email}
                      />
                      <Form.Control.Feedback type="invalid">
                        {formErrors.email}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>{t("auth.phoneLabel")}</Form.Label>
                      <Form.Control
                        type="tel"
                        placeholder={t("auth.phonePlaceholder")}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>{t("auth.addressLabel")}</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder={t("auth.addressPlaceholder")}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12} className="mb-3">
                    <Form.Label>{t("auth.registerAsLabel")}</Form.Label>
                    <Row className="g-2">
                      <Col>
                        <Card
                          className={`role-card ${
                            userRole === "User" ? "selected" : ""
                          }`}
                          onClick={() => setUserRole("User")}
                        >
                          <Card.Body className="text-center">
                            <FaUser size={24} className="mb-2" />
                            <div>{t("auth.userRole")}</div>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col>
                        <Card
                          className={`role-card ${
                            userRole === "Vendor" ? "selected" : ""
                          }`}
                          onClick={() => setUserRole("Vendor")}
                        >
                          <Card.Body className="text-center">
                            <FaStore size={24} className="mb-2" />
                            <div>{t("auth.vendorRole")}</div>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  </Col>

                  {/* حقل كود الدعوة الجديد */}
                  <Col xs={12} className="mb-3">
                    <Form.Group>
                      <Form.Label>{t("auth.referralCodeLabel", "كود الدعوة (اختياري)")}</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder={t("auth.referralCodePlaceholder", "أدخل كود الدعوة إذا وجد")}
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>{t("auth.passwordLabel")}</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder={t("auth.passwordMinChars")}
                        value={password}
                        onChange={handleInputChange(setPassword, "password")}
                        required
                        minLength={6}
                        isInvalid={!!formErrors.password}
                      />
                      <Form.Control.Feedback type="invalid">
                        {formErrors.password}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-4">
                      <Form.Label>{t("auth.confirmPasswordLabel")}</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder={t("auth.confirmPasswordPlaceholder")}
                        value={confirmPassword}
                        onChange={handleInputChange(
                          setConfirmPassword,
                          "confirmPassword"
                        )}
                        required
                        isInvalid={!!formErrors.confirmPassword}
                      />
                      <Form.Control.Feedback type="invalid">
                        {formErrors.confirmPassword}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>
                <Button
                  variant="primary"
                  type="submit"
                  className="w-100 mb-3"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" />{" "}
                      {t("auth.registering")}
                    </>
                  ) : (
                    t("auth.registerButton")
                  )}
                </Button>
                <div className="text-center mt-3 auth-switch-link">
                  <span>{t("auth.haveAccount")} </span>
                  <Link to="/login" className="fw-bold">
                    {t("auth.loginLink")}
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

export default Register;