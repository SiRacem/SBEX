// src/components/commun/Profile.jsx
// *** نسخة كاملة ونهائية بدون أي اختصارات - مع تصميم احترافي محسن ***

import React, { useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Image,
  Badge,
  ProgressBar,
  Alert,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import { getProfile } from "../../redux/actions/userAction"; // تأكد من المسار
import CurrencySwitcher from "./CurrencySwitcher"; // تأكد من المسار
import useCurrencyDisplay from "../../hooks/useCurrencyDisplay"; // تأكد من المسار
import MediatorApplication from "./MediatorApplication"; // تأكد من المسار
import "./ProfileRedesigned.css"; // تأكد من المسار

// Import Icons
import {
  FaMapMarkerAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaDollarSign,
  FaPiggyBank,
  FaUniversity,
  FaBalanceScale,
  FaHourglassHalf,
  FaStar,
  FaThumbsUp,
  FaThumbsDown,
  FaShoppingBag,
  FaTags,
  FaChartLine,
  FaGift, // أيقونة للمكافأة
  FaCheckCircle as CheckCircle, // Import CheckCircle
} from "react-icons/fa";
import {
  Briefcase,
  BarChart2,
  ThumbsUp as FeatherThumbsUp,
  ThumbsDown as FeatherThumbsDown,
  Tag as FeatherTag,
  Check as FeatherCheck,
  MapPin,
  XCircle,
} from "react-feather"; // Example using Feather
import { IoWalletOutline } from "react-icons/io5"; // Keep generic wallet

// --- Helper Functions ---
const calculatePositiveFeedbackPercent = (positive, negative) => {
  const total = positive + negative;
  if (total === 0) return 0;
  return Math.round((positive / total) * 100);
};

const pointsForNextLevel = (currentLevel) => {
  // مثال بسيط، قم بتعديله حسب نظام النقاط الخاص بك
  if (currentLevel < 1) return 10;
  return ((currentLevel * (currentLevel + 1)) / 2) * 10; // Example: 1->10, 2->30, 3->60
};

const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
    safeCurrencyCode = "TND";
  }
  try {
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    console.warn(
      `Currency formatting error for code '${safeCurrencyCode}':`,
      error
    );
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};
// -----------------------

// --- Main Component ---
const Profile = () => {
  const dispatch = useDispatch();
  const { user, loading, isAuth } = useSelector((state) => state.userReducer);

  // --- Use Currency Display Hooks ---
  const principalBalanceDisplay = useCurrencyDisplay(user?.balance);
  const depositBalanceDisplay = useCurrencyDisplay(user?.depositBalance);
  const withdrawalBalanceDisplay = useCurrencyDisplay(user?.withdrawalBalance);
  const sellerAvailableBalanceDisplay = useCurrencyDisplay(
    user?.sellerAvailableBalance
  );
  const sellerPendingBalanceDisplay = useCurrencyDisplay(
    user?.sellerPendingBalance
  );

  // --- Calculate Derived Data ---
  const positiveRatings = user?.positiveRatings ?? 0;
  const negativeRatings = user?.negativeRatings ?? 0;
  const positiveFeedbackPercent = useMemo(
    () => calculatePositiveFeedbackPercent(positiveRatings, negativeRatings),
    [positiveRatings, negativeRatings]
  );
  const currentLevel = user?.level ?? 1;
  const currentPoints = user?.reputationPoints ?? 0;
  const nextLevelPoints = useMemo(
    () => pointsForNextLevel(currentLevel),
    [currentLevel]
  );
  const pointsProgress = useMemo(
    () => Math.min(currentPoints, nextLevelPoints),
    [currentPoints, nextLevelPoints]
  ); // Points capped at next level for progress bar
  const pointsNeeded = useMemo(
    () => Math.max(0, nextLevelPoints - currentPoints),
    [nextLevelPoints, currentPoints]
  );
  const progressPercent = useMemo(
    () =>
      nextLevelPoints > 0
        ? Math.min(100, Math.round((pointsProgress / nextLevelPoints) * 100))
        : 0,
    [pointsProgress, nextLevelPoints]
  );
  const approvedProductsCount = user?.approvedProducts ?? 0; // Assume fetched with user profile
  const soldProductsCount = user?.productsSoldCount ?? 0; // Assume fetched with user profile

  // --- Fetch Profile ---
  useEffect(() => {
    if (isAuth && !user && !loading) {
      dispatch(getProfile());
    }
  }, [dispatch, isAuth, user, loading]);

  // --- Loading State ---
  if (loading && !user) {
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  // --- Not Authenticated or User Failed to Load ---
  if (!isAuth || !user) {
    return (
      <Container className="py-5">
        <Alert variant="warning" className="text-center">
          Please <Link to="/login">login</Link> to view your profile.
        </Alert>
      </Container>
    );
  }

  // --- Helper function to render Level Section ---
  const renderLevelSection = () => {
    const nextLevelReward =
      currentLevel === 1 ? "2 TND" : currentLevel === 2 ? "5 TND" : "Badge"; // Example reward logic

    return (
      <div className="level-section-widget mt-4 p-3 bg-light rounded">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="d-flex align-items-center">
            <Badge pill bg="info" text="dark" className="level-badge-lg me-2">
              <FaStar className="me-1" /> Level {currentLevel}
            </Badge>
            <span className="text-muted small">
              ({currentPoints} Reputation Pts)
            </span>
          </div>
          {/* Display next level target and reward */}
          {nextLevelPoints > currentPoints && nextLevelPoints > 0 && (
            <div
              className="text-end text-muted small"
              title={`Reward for reaching Level ${currentLevel + 1}`}
            >
              <FaGift className="text-warning me-1" /> Next: {nextLevelReward} (
              {nextLevelPoints} pts)
            </div>
          )}
        </div>
        {/* Progress bar if not max level */}
        {nextLevelPoints > currentPoints && nextLevelPoints > 0 ? (
          <ProgressBar
            className="level-progress-bar"
            style={{ height: "10px" }}
          >
            <ProgressBar
              variant="info"
              now={progressPercent}
              label={`${currentPoints}/${nextLevelPoints}`}
              // visuallyHidden={progressPercent < 15}
            />
          </ProgressBar>
        ) : (
          <div className="text-center text-success small mt-2">
            Max Level Reached!
          </div>
        )}
      </div>
    );
  };
  // ------------------------------------------------

  // --- Main Render ---
  return (
    <Container fluid className="profile-page-professional py-4 px-md-4">
      <Row>
        {/* --- Left Column: Basic Info, Rating, Level --- */}
        <Col lg={4} className="mb-4">
          <Card className="h-100 shadow-sm border-0 profile-widget">
            <Card.Body className="p-4 text-center">
              <Image
                src={
                  user.avatarUrl ||
                  "https://bootdey.com/img/Content/avatar/avatar7.png"
                }
                roundedCircle
                width={120}
                height={120}
                className="profile-avatar-lg mb-3"
                alt={`${user.fullName || "User"}'s avatar`}
              />
              <h3 className="profile-name-lg mb-1">{user.fullName || "N/A"}</h3>
              <p className="text-muted mb-2">{user.email}</p>
              <p className="text-muted small mb-3">
                <MapPin size={14} className="me-1" />
                {user.address || "Location not set"}
              </p>
              <div className="mb-3">
                <Badge
                  pill
                  bg={user.blocked ? "danger" : "success"}
                  className="status-badge-lg me-2"
                >
                  {user.blocked ? (
                    <XCircle size={14} className="me-1" />
                  ) : (
                    <CheckCircle size={14} className="me-1" />
                  )}
                  {user.blocked ? "Blocked" : "Active"}
                </Badge>
                <Badge pill bg="primary" className="role-badge-lg">
                  <Briefcase size={14} className="me-1" />
                  {user.userRole}
                </Badge>
              </div>
              {/* Render Level Section */}
              {renderLevelSection()}
            </Card.Body>
            {/* Seller Rating Section Footer */}
            {positiveRatings > 0 || negativeRatings > 0 ? (
              <Card.Footer className="bg-light p-3 border-0">
                <h6 className="text-muted small mb-2 text-center">
                  Seller Rating
                </h6>
                <div className="d-flex justify-content-around align-items-center mb-2">
                  <div className="text-success small">
                    <FeatherThumbsUp size={16} className="me-1" />{" "}
                    {positiveRatings}
                  </div>
                  <div className="text-danger small">
                    <FeatherThumbsDown size={16} className="me-1" />{" "}
                    {negativeRatings}
                  </div>
                </div>
                <ProgressBar className="rating-progress-bar">
                  <ProgressBar
                    variant="success"
                    now={positiveFeedbackPercent}
                    key={1}
                    label={`${positiveFeedbackPercent}%`}
                  />
                  <ProgressBar
                    variant="danger"
                    now={100 - positiveFeedbackPercent}
                    key={2}
                  />
                </ProgressBar>
              </Card.Footer>
            ) : (
              <Card.Footer className="bg-light p-3 border-0 text-center text-muted small">
                No ratings yet.
              </Card.Footer>
            )}
          </Card>
        </Col>

        {/* --- Right Column: Balances, Stats, Mediator App --- */}
        <Col lg={8}>
          {/* --- Balances Card --- */}
          <Card className="shadow-sm border-0 mb-4">
            <Card.Header className="bg-white p-3 border-0 d-flex justify-content-between align-items-center">
              <h5 className="mb-0 section-title-modern">
                <IoWalletOutline className="me-2 text-primary" /> Account
                Balances
              </h5>
              <CurrencySwitcher size="sm" />
            </Card.Header>
            <Card.Body className="p-4">
              <Row className="g-3 text-center">
                <Col sm={6} md={4} className="mb-3">
                  {" "}
                  <div className="balance-widget">
                    {" "}
                    <FaPiggyBank className="icon text-primary" />{" "}
                    <span className="label">Principal</span>{" "}
                    <span className="value">
                      {principalBalanceDisplay.displayValue}
                    </span>{" "}
                    <span className="approx">
                      {principalBalanceDisplay.approxValue}
                    </span>{" "}
                  </div>{" "}
                </Col>
                <Col sm={6} md={4} className="mb-3">
                  {" "}
                  <div className="balance-widget">
                    {" "}
                    <FaUniversity className="icon text-info" />{" "}
                    <span className="label">Deposit</span>{" "}
                    <span className="value">
                      {depositBalanceDisplay.displayValue}
                    </span>{" "}
                    <span className="approx">
                      {depositBalanceDisplay.approxValue}
                    </span>{" "}
                  </div>{" "}
                </Col>
                <Col sm={6} md={4} className="mb-3">
                  {" "}
                  <div className="balance-widget">
                    {" "}
                    <FaDollarSign className="icon text-danger" />{" "}
                    <span className="label">Withdrawal</span>{" "}
                    <span className="value">
                      {withdrawalBalanceDisplay.displayValue}
                    </span>{" "}
                    <span className="approx">
                      {withdrawalBalanceDisplay.approxValue}
                    </span>{" "}
                  </div>{" "}
                </Col>
                {(user.userRole === "Vendor" || user.userRole === "Admin") && (
                  <>
                    {" "}
                    <Col sm={6} md={6} className="mb-3 mb-md-0">
                      {" "}
                      <div className="balance-widget">
                        {" "}
                        <FaBalanceScale className="icon text-success" />{" "}
                        <span className="label">Seller Available</span>{" "}
                        <span className="value">
                          {sellerAvailableBalanceDisplay.displayValue}
                        </span>{" "}
                        <span className="approx">
                          {sellerAvailableBalanceDisplay.approxValue}
                        </span>{" "}
                      </div>{" "}
                    </Col>{" "}
                    <Col sm={6} md={6}>
                      {" "}
                      <div className="balance-widget">
                        {" "}
                        <FaHourglassHalf className="icon text-warning" />{" "}
                        <span className="label">Seller On Hold</span>{" "}
                        <span className="value">
                          {sellerPendingBalanceDisplay.displayValue}
                        </span>{" "}
                        <span className="approx">
                          {sellerPendingBalanceDisplay.approxValue}
                        </span>{" "}
                      </div>{" "}
                    </Col>{" "}
                  </>
                )}
              </Row>
            </Card.Body>
          </Card>

          {/* --- User Statistics Card --- */}
          <Card className="shadow-sm border-0 mb-4">
            <Card.Header className="bg-white p-3 border-0">
              <h5 className="mb-0 section-title-modern">
                <BarChart2 className="me-2 text-primary" /> User Statistics
              </h5>
            </Card.Header>
            <Card.Body className="p-4">
              <Row className="g-3">
                {" "}
                {/* Added g-3 for spacing */}
                <Col md={6} className="statistic-entry-col">
                  {" "}
                  {/* Use md={6} for two columns */}
                  <div className="statistic-entry">
                    <FeatherTag size={20} className="me-2 text-info" />
                    <div>
                      <span className="stat-value">
                        {approvedProductsCount}
                      </span>
                      <span className="stat-label">Active Listings</span>
                    </div>
                  </div>
                </Col>
                <Col md={6} className="statistic-entry-col">
                  {" "}
                  {/* Use md={6} for two columns */}
                  <div className="statistic-entry">
                    <FeatherCheck size={20} className="me-2 text-success" />
                    <div>
                      <span className="stat-value">{soldProductsCount}</span>
                      <span className="stat-label">Products Sold</span>
                    </div>
                  </div>
                </Col>
                {/* Add more Col md={6} here for additional stats */}
              </Row>
            </Card.Body>
          </Card>

          {/* --- Mediator Application Card (Conditional) --- */}
          {!user.blocked && <MediatorApplication />}
          {/* --------------------------------------------- */}
        </Col>
      </Row>
    </Container>
  );
};

export default Profile;
