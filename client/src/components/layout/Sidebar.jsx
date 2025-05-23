// src/components/layout/Sidebar.jsx

import React, { useState, useCallback, useEffect } from "react"; // أضفت useEffect
import { Link, NavLink, useLocation } from "react-router-dom"; // <--- أضفت useLocation
import {
  FaHome,
  FaWallet,
  FaImages,
  FaUserCircle,
  FaSignOutAlt,
  FaUsers,
  FaTasks,
  FaHeadset,
  FaMoneyCheckAlt,
  FaGavel,
  FaUserCheck,
  FaClipboardList,
  FaChalkboardTeacher,
  FaExclamationTriangle,
} from "react-icons/fa";
import { useSelector, useDispatch } from "react-redux";
import { Form, Nav, Badge } from "react-bootstrap"; // <--- أضفت Nav و Badge
import { logoutUser } from "../../redux/actions/userAction";
import { adminGetDisputedMediationsAction } from "../../redux/actions/mediationAction"; // <--- استيراد الـ action
import "./Sidebar.css";

const logoUrl =
  "https://res.cloudinary.com/draghygoj/image/upload/v1746477147/wmremove-transformed-removebg-preview_adyzjs.png";

const Sidebar = ({ onSearchChange }) => {
  const dispatch = useDispatch();
  const location = useLocation(); // <--- استخدام hook useLocation
  const [searchTerm, setSearchTerm] = useState("");

  const user = useSelector((state) => state.userReducer.user);
  const userRole = user?.userRole;
  const isMediatorQualified = user?.isMediatorQualified;

  // --- [!!!] جلب عدد النزاعات المعلقة للأدمن [!!!] ---
  const { adminDisputedMediations } = useSelector(
    (state) => state.mediationReducer
  );
  const disputedCasesCount = adminDisputedMediations?.totalCount ?? 0; // القيمة الافتراضية 0

  useEffect(() => {
    // جلب عدد النزاعات عندما يكون المستخدم أدمن وعند تحميل الشريط الجانبي
    // هذا سيضمن أن العدد محدث بشكل معقول
    // يمكنك تحسين هذا لاحقًا إذا أردت تحديثًا في الوقت الفعلي للـ Badge
    if (userRole === "Admin") {
      dispatch(adminGetDisputedMediationsAction(1, 1)); // جلب الصفحة الأولى، نحتاج فقط للعدد الإجمالي
    }
  }, [dispatch, userRole]);
  // -------------------------------------------------

  const handleLogout = useCallback(() => {
    dispatch(logoutUser());
  }, [dispatch]);

  const handleSearch = useCallback(
    (e) => {
      setSearchTerm(e.target.value);
      if (onSearchChange) {
        onSearchChange(e.target.value);
      }
    },
    [onSearchChange]
  );

  return (
    <div className="unified-sidebar">
      <div className="sidebar-header">
        <Link to="/" className="sidebar-logo-link">
          <img src={logoUrl} alt="Logo" className="sidebar-logo" />
        </Link>
        <div className="sidebar-search-container">
          <Form
            className="d-flex sidebar-search-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <Form.Control
              type="search"
              placeholder="Search..."
              aria-label="Search"
              className="form-control-sm search-input"
              value={searchTerm}
              onChange={handleSearch}
            />
          </Form>
        </div>
      </div>
      <nav className="sidebar-nav">
        <NavLink className="sidebar-link" to="/dashboard" end title="Dashboard">
          <FaHome className="icon" /> <span className="link-text">Main</span>
        </NavLink>
        <NavLink className="sidebar-link" to="/dashboard/wallet" title="Wallet">
          <FaWallet className="icon" />
          <span className="link-text">Wallet</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/profile"
          title="Profile"
        >
          <FaUserCircle className="icon" />
          <span className="link-text">Profile</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/support"
          title="Support"
        >
          <FaHeadset className="icon" />
          <span className="link-text">Support</span>
        </NavLink>

        {isMediatorQualified && (
          <NavLink
            className="sidebar-link"
            to="/dashboard/mediator/assignments"
            title="Mediator Dashboard"
          >
            <FaChalkboardTeacher className="icon" />
            <span className="link-text">Mediator Hub</span>
          </NavLink>
        )}

        {userRole === "Vendor" && (
          <>
            <NavLink
              className="sidebar-link"
              to="/dashboard/comptes_bids"
              title="My Accounts & Bids"
            >
              <FaImages className="icon" />
              <span className="link-text">My Accounts & Bids</span>
            </NavLink>
          </>
        )}

        {userRole === "Admin" && (
          <>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/products"
              title="Manage Products"
            >
              <FaTasks className="icon" />
              <span className="link-text">Products</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/users"
              title="Manage Users"
            >
              <FaUsers className="icon" />
              <span className="link-text">Users</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/payment-methods"
              title="Payment Methods"
            >
              <FaMoneyCheckAlt className="icon" />
              <span className="link-text">Payment Methods</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/deposits"
              title="Manage Deposits"
            >
              <FaGavel className="icon" />
              <span className="link-text">Manage Deposits</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/mediator-review"
              title="Mediator Applications"
            >
              <FaUserCheck className="icon" />
              <span className="link-text">Mediator Apps</span>
            </NavLink>
            {/* --- [!!!] استخدام NavLink بدلاً من Nav.Link لـ react-router-dom [!!!] --- */}
            <NavLink
              className="sidebar-link" // استخدم نفس الـ class للاتساق
              to="/dashboard/admin/disputes"
              title="Disputed Cases"
              // activeClassName="active" // NavLink يتعامل مع active تلقائيًا إذا كان المسار متطابقًا
            >
              <FaExclamationTriangle className="icon" />
              {/* تعديل: icon بدلاً من me-2 */}
              <span className="link-text">Disputed Cases</span>
              {disputedCasesCount > 0 && ( // <--- استخدام disputedCasesCount
                <Badge pill bg="danger" className="ms-2">
                  {disputedCasesCount}
                </Badge>
              )}
            </NavLink>
            {/* ---------------------------------------------------------------------- */}
          </>
        )}

        {(userRole === "User" || userRole === "Vendor") && (
          <NavLink
            className="sidebar-link"
            to="/my-mediation-requests"
            title="My Orders"
          >
            <FaClipboardList className="icon" />
            <span className="link-text">My Orders</span>
          </NavLink>
        )}
      </nav>
      <div className="sidebar-footer">
        <Link
          to="/login"
          className="sidebar-link logout-button"
          onClick={handleLogout}
        >
          <FaSignOutAlt className="icon" />
          <span className="link-text">Logout</span>
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
