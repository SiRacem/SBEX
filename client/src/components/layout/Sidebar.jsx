// src/components/layout/Sidebar.jsx
// *** نسخة نهائية مُعاد كتابتها للإصلاح ***

import React, { useState, useCallback } from "react";
import { Link, NavLink } from "react-router-dom";
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
  FaClipboardCheck,
  FaClipboardList,
  FaChalkboardTeacher,
} from "react-icons/fa";
import { useSelector, useDispatch } from "react-redux";
import { Form } from "react-bootstrap";
import { logoutUser } from "../../redux/actions/userAction";
import "./Sidebar.css"; // تأكد من وجود هذا الملف

const logoUrl =
  "https://res.cloudinary.com/draghygoj/image/upload/v1746477147/wmremove-transformed-removebg-preview_adyzjs.png"; // استخدم رابطًا خارجيًا مؤقتًا للتأكد

const Sidebar = ({ onSearchChange }) => {
  const dispatch = useDispatch();
  const [searchTerm, setSearchTerm] = useState("");
  const user = useSelector((state) => state.userReducer.user);
  const userRole = user?.userRole;
  const isMediatorQualified = user?.isMediatorQualified;
  

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
      {/* تم تبسيط الكلاسات هنا */}
      {/* Header section for logo and search (on larger screens) */}
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
      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {/* --- روابط مشتركة --- */}
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
          <NavLink className="sidebar-link" to="/dashboard/mediator/assignments" title="Mediator Dashboard">
            <FaChalkboardTeacher className="icon" /> {/* أو FaGavel أو أي أيقونة تراها مناسبة */}
            <span className="link-text">Mediator Hub</span>
          </NavLink>
        )}

        {/* --- روابط البائع --- */}
        {userRole === "Vendor" && (
          <>
            <NavLink className="sidebar-link" to="/dashboard/comptes_bids" title="My Accounts & Bids"><FaImages className="icon" /><span className="link-text">My Accounts & Bids</span></NavLink>
          </>
        )}

        {/* --- روابط الأدمن --- */}
        {userRole === "Admin" && (
          <>
            <NavLink className="sidebar-link" to="/dashboard/admin/products" title="Manage Products"><FaTasks className="icon" /><span className="link-text">Products</span></NavLink>
            <NavLink className="sidebar-link" to="/dashboard/admin/users" title="Manage Users"><FaUsers className="icon" /><span className="link-text">Users</span></NavLink>
            <NavLink className="sidebar-link" to="/dashboard/admin/payment-methods" title="Payment Methods"><FaMoneyCheckAlt className="icon" /><span className="link-text">Payment Methods</span></NavLink>
            <NavLink className="sidebar-link" to="/dashboard/admin/deposits" title="Manage Deposits"><FaGavel className="icon" /> {/* غير الأيقونة إذا أردت */} <span className="link-text">Manage Deposits</span></NavLink> {/* غيرت النص ليناسب الأيقونة */}
            <NavLink className="sidebar-link" to="/dashboard/admin/mediator-review" title="Mediator Applications"><FaUserCheck className="icon" /><span className="link-text">Mediator Apps</span></NavLink> {/* غيرت النص */}
          </>
        )}
        
         {/* أو إذا كان المستخدم العادي (المشتري) والبائع يمكن أن يكون لديهم "My Orders" */}
        {(userRole === "User" || userRole === "Vendor") && (
            <NavLink className="sidebar-link" to="/my-mediation-requests" title="My Orders"> <FaClipboardList className="icon" /> <span className="link-text">My Orders</span> </NavLink>
        )}
      </nav>
      {/* Logout Button (on larger screens) */}
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
