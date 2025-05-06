// src/components/commun/OfflineHeader.jsx (Redesigned)
import React, { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Navbar, Container, Button, Nav } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { logoutUser } from "../../redux/actions/userAction";
import {
  FaSignInAlt,
  FaSignOutAlt,
  FaUserCircle,
  FaShoppingBag,
} from "react-icons/fa"; // إضافة أيقونة للمتجر
import "./OfflineHeader.css"; // ملف CSS جديد أو معدل

const OfflineHeader = () => {
  const logoUrl =
    "https://res.cloudinary.com/draghygoj/image/upload/v1746478284/logo2-removebg-preview_j6mt9l.png"; // استخدم رابطًا خارجيًا مؤقتًا للتأكد

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuth, user } = useSelector(
    (state) => state.userReducer || { isAuth: false, user: null }
  );

  const handleLogout = useCallback(() => {
    if (window.confirm("Logout?")) {
      dispatch(logoutUser());
    }
  }, [dispatch]);

  return (
    // --- تصميم Navbar جديد ---
    <Navbar
      bg="white"
      variant="light"
      expand="lg"
      className="main-header shadow-sm py-2 sticky-top"
    >
      <Container fluid="xl">
        {/* استخدام fluid="xl" لتوسيط المحتوى على الشاشات الكبيرة */}
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
                  Dashboard
                </Nav.Link>
                <Nav.Link
                  as={Link}
                  to="/dashboard/profile"
                  className="d-flex align-items-center me-3 text-dark fw-500"
                >
                  <FaUserCircle className="me-1 opacity-75" />
                  {user.fullName || user.email}
                </Nav.Link>
                <Link to="/login">
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={handleLogout}
                  >
                    <FaSignOutAlt className="me-1" /> Logout
                  </Button>
                </Link>
              </>
            ) : (
              <>
                {/* <Button variant="outline-primary" size="sm" className="me-2" onClick={() => navigate('/register')}>Register</Button> */}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate("/login")}
                >
                  <FaSignInAlt className="me-1" /> Login / Register
                </Button>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
    // --- نهاية تصميم Navbar ---
  );
};

export default OfflineHeader;
