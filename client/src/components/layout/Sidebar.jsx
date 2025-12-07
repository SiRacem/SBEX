// src/components/layout/Sidebar.jsx

import React, { useState, useCallback, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next"; // <-- [!] الخطوة 1: استيراد الهوك

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
  FaQuestion,
  FaNewspaper,
  FaTrophy,
  FaMedal,
  FaUserPlus,
  FaCogs,
  FaHeart,
  FaDice,
  FaCalendarCheck,
  FaComments,
  FaPlusCircle,
  FaGlobe
} from "react-icons/fa";
import { HiMiniPaintBrush } from "react-icons/hi2";
import { TbReport } from "react-icons/tb";
import { ImTicket } from "react-icons/im";
import { useSelector, useDispatch } from "react-redux";
import { Form, Badge } from "react-bootstrap";
import { logoutUser } from "../../redux/actions/userAction";
import { adminGetDisputedMediationsAction } from "../../redux/actions/mediationAction";
import "./Sidebar.css";

const logoUrl =
  "https://res.cloudinary.com/draghygoj/image/upload/v1746477147/wmremove-transformed-removebg-preview_adyzjs.png";

const Sidebar = ({ onSearchChange }) => {
  const { t } = useTranslation(); // <-- [!] الخطوة 2: الحصول على دالة الترجمة

  const dispatch = useDispatch();
  const [searchTerm, setSearchTerm] = useState("");

  const user = useSelector((state) => state.userReducer.user);
  const userRole = user?.userRole;
  const isMediatorQualified = user?.isMediatorQualified;

  const { adminDisputedMediations } = useSelector(
    (state) => state.mediationReducer
  );
  const disputedCasesCount = adminDisputedMediations?.totalCount ?? 0;

  useEffect(() => {
    if (userRole === "Admin") {
      dispatch(adminGetDisputedMediationsAction(1, 1));
    }
  }, [dispatch, userRole]);

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
            {/* [!] الخطوة 3: تطبيق الترجمة على النصوص الثابتة */}
            <Form.Control
              type="search"
              placeholder={t("sidebar.searchPlaceholder")}
              aria-label="Search"
              className="form-control-sm search-input"
              value={searchTerm}
              onChange={handleSearch}
            />
          </Form>
        </div>
      </div>
      <nav className="sidebar-nav">
        {/* [!] الخطوة 3: تطبيق الترجمة على النصوص الثابتة */}
        <NavLink
          className="sidebar-link"
          to="/dashboard"
          end
          title={t("sidebar.main")}
        >
          <FaHome className="icon" />
          <span className="link-text">{t("sidebar.main")}</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/wallet"
          title={t("sidebar.wallet")}
        >
          <FaWallet className="icon" />
          <span className="link-text">{t("sidebar.wallet")}</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/profile"
          title={t("sidebar.profile")}
        >
          <FaUserCircle className="icon" />
          <span className="link-text">{t("sidebar.profile")}</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/tournaments"
          title={t("sidebar.tournaments")} // تأكد من إضافة هذا المفتاح في ملفات الترجمة
        >
          <FaTrophy className="icon" /> {/* استورد FaTrophy من react-icons/fa */}
          <span className="link-text">{t("sidebar.tournaments")}</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/achievements"
          title={t("sidebar.achievements")}
        >
          <FaTrophy className="icon" />
          <span className="link-text">{t("sidebar.achievements")}</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/wishlist"
          title={t("sidebar.achievements")}
        >
          <FaHeart className="icon" />
          <span className="link-text">{t("sidebar.wishlist")}</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/lucky-wheel"
          title={t("sidebar.luckyWheel")}
        >
          <FaDice className="icon" />
          <span className="link-text">{t("sidebar.luckyWheel")}</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/quests"
          title={t("sidebar.quests")}
        >
          <FaClipboardList className="icon" />
          <span className="link-text">{t("sidebar.quests")}</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/leaderboard"
          title={t("sidebar.leaderboard")}
        >
          <FaMedal className="icon" />
          <span className="link-text">{t("sidebar.leaderboard")}</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/global-chat"
          title={t("sidebar.globalChat")}
        >
          <FaComments className="icon" /> 
          <span className="link-text">{t("sidebar.globalChat")}</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/referrals"
          title={t("sidebar.referrals")}
        >
          <FaUserPlus className="icon" />
          <span className="link-text">{t("sidebar.referrals")}</span>
        </NavLink>
        <NavLink
          className="sidebar-link"
          to="/dashboard/FAQ"
          title={t("sidebar.faq")}
        >
          <FaQuestion className="icon" />
          <span className="link-text">{t("sidebar.faq")}</span>
        </NavLink>

        {isMediatorQualified && (
          <NavLink
            className="sidebar-link"
            to="/dashboard/mediator/assignments"
            title={t("sidebar.mediatorHub")}
          >
            <FaChalkboardTeacher className="icon" />
            <span className="link-text">{t("sidebar.mediatorHub")}</span>
          </NavLink>
        )}

        {userRole === "Vendor" && (
          <>
            <NavLink
              className="sidebar-link"
              to="/dashboard/comptes_bids"
              title={t("sidebar.myAccountsBids")}
            >
              <FaImages className="icon" />
              <span className="link-text">{t("sidebar.myAccountsBids")}</span>
            </NavLink>
          </>
        )}

        {userRole === "Admin" && (
          <>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/products"
              title={t("sidebar.products")}
            >
              <FaTasks className="icon" />
              <span className="link-text">{t("sidebar.products")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/users"
              title={t("sidebar.users")}
            >
              <FaUsers className="icon" />
              <span className="link-text">{t("sidebar.users")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/create-tournament"
              title={t("sidebar.createTournament")}
            >
              <FaPlusCircle className="icon" /> {/* استورد FaPlusCircle */}
              <span className="link-text">{t("sidebar.createTournament")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/leagues"
              title={t("sidebar.manageLeagues")} // أضف مفتاح الترجمة هذا
            >
              <FaGlobe className="icon" /> {/* استورد FaGlobe */}
              <span className="link-text">{t("sidebar.manageLeagues")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/news"
              title={t("sidebar.manageNews")}
            >
              <FaNewspaper className="icon" />
              <span className="link-text">{t("sidebar.manageNews")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/achievements"
              title={t("sidebar.manageAchievements")}
            >
              <FaTrophy className="icon" />
              <span className="link-text">
                {t("sidebar.manageAchievements")}
              </span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/quests"
              title={t("sidebar.manageQuests")}
            >
              <FaTasks className="icon" />
              <span className="link-text">
                {t("sidebar.manageQuests")}
              </span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/check-in-settings"
              title={t("sidebar.checkInSettings")}
            >
              <FaCalendarCheck className="icon" />
              <span className="link-text">
                {t("sidebar.checkInSettings")}
              </span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/wheel-settings"
              title={t("sidebar.wheelSettings")}
            >
              <FaCogs className="icon" />
              <span className="link-text">
                {t("sidebar.wheelSettings")}
              </span>
            </NavLink>
            <NavLink className="sidebar-link" to="/dashboard/admin/referrals">
              <FaCogs className="icon" />
              <span className="link-text">{t("sidebar.manageReferrals")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/faq"
              title={t("sidebar.manageFAQ")}
            >
              <HiMiniPaintBrush className="icons" />
              <span className="link-text">{t("sidebar.manageFAQ")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/payment-methods"
              title={t("sidebar.paymentMethods")}
            >
              <FaMoneyCheckAlt className="icon" />
              <span className="link-text">{t("sidebar.paymentMethods")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/deposits"
              title={t("sidebar.manageDeposits")}
            >
              <FaGavel className="icon" />
              <span className="link-text">{t("sidebar.manageDeposits")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/reports"
              title={t("sidebar.manageReports")}
            >
              <TbReport className="icons" />
              <span className="link-text">{t("sidebar.manageReports")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/tickets"
              title={t("sidebar.manageTickets")}
            >
              <ImTicket className="icons" />
              <span className="link-text">{t("sidebar.manageTickets")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/disputes"
              title={t("sidebar.disputedCases")}
            >
              <FaExclamationTriangle className="icon" />
              <span className="link-text">{t("sidebar.disputedCases")}</span>
              {disputedCasesCount > 0 && (
                <Badge pill bg="danger" className="ms-2">
                  {disputedCasesCount}
                </Badge>
              )}
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/dashboard/admin/mediator-review"
              title={t("sidebar.mediatorApps")}
            >
              <FaUserCheck className="icon" />
              <span className="link-text">{t("sidebar.mediatorApps")}</span>
            </NavLink>
          </>
        )}

        {(userRole === "User" || userRole === "Vendor") && (
          <>
            <NavLink
              className="sidebar-link"
              to="/dashboard/tickets"
              title={t("sidebar.support")}
            >
              <FaHeadset className="icon" />
              <span className="link-text">{t("sidebar.support")}</span>
            </NavLink>
            <NavLink
              className="sidebar-link"
              to="/my-mediation-requests"
              title={t("sidebar.myOrders")}
            >
              <FaClipboardList className="icon" />
              <span className="link-text">{t("sidebar.myOrders")}</span>
            </NavLink>
          </>
        )}
      </nav>
      <div className="sidebar-footer">
        <Link
          to="/login"
          className="sidebar-link logout-button"
          onClick={handleLogout}
        >
          <FaSignOutAlt className="icon" />
          <span className="link-text">{t("sidebar.logout")}</span>
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
