// src/components/commun/OfflineHeader.jsx
import React, { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Navbar, Container, Button, Nav } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { logoutUser } from "../../redux/actions/userAction";
import { FaSignInAlt, FaSignOutAlt, FaUserCircle } from "react-icons/fa";
import LanguageSwitcher from "./LanguageSwitcher"; // استيراد مبدل اللغة
import "./OfflineHeader.css";

const OfflineHeader = () => {
  const { t } = useTranslation();
  const logoUrl =
    "https://res.cloudinary.com/draghygoj/image/upload/v1746478284/logo2-removebg-preview_j6mt9l.png";

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuth, user } = useSelector(
    (state) => state.userReducer || { isAuth: false, user: null }
  );

  const handleLogout = useCallback(() => {
    if (window.confirm(t("confirmLogout"))) {
      dispatch(logoutUser());
    }
  }, [dispatch, t]);

  return (
    <Navbar
      bg="white"
      variant="light"
      expand="lg"
      className="main-header shadow-sm py-2 sticky-top"
    >
      <Container fluid="xl">
        <Navbar.Brand
          as={Link}
          to={isAuth ? "/dashboard" : "/"}
          className="d-flex align-items-center header-brand"
        >
          <img src={logoUrl} alt="Logo" className="sidebar-logo" />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-navbar-nav" />
        <Navbar.Collapse id="main-navbar-nav">
          <Nav className="ms-auto align-items-center">
            {isAuth && user ? (
              <>
                <Nav.Link
                  as={Link}
                  to="/dashboard"
                  className="text-dark me-3 fw-500"
                >
                  {t("sidebar.main")}
                </Nav.Link>
                <Nav.Link
                  as={Link}
                  to="/dashboard/profile"
                  className="d-flex align-items-center me-3 text-dark fw-500"
                >
                  <FaUserCircle className="me-2" />
                  {user.fullName || user.email}
                </Nav.Link>
                <LanguageSwitcher as="dropdown" />
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={handleLogout}
                  className="ms-3"
                >
                  <FaSignOutAlt className="me-1" /> {t("sidebar.logout")}
                </Button>
              </>
            ) : (
              <>
                <LanguageSwitcher as="dropdown" />
                <Button
                  variant="primary"
                  size="sm"
                  className="ms-3"
                  onClick={() => navigate("/login")}
                >
                  <FaSignInAlt className="me-1" />{" "}
                  {t("auth.loginRegisterButton", "Login / Register")}
                </Button>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};
export default OfflineHeader;
