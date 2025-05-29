// src/pages/UserProfilePage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Image,
  Badge,
  ListGroup,
  Button,
  Tooltip,
  OverlayTrigger,
} from "react-bootstrap";
import {
  FaCalendarAlt,
  FaTag,
  FaBoxOpen,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaThumbsUp,
  FaThumbsDown,
  FaExclamationTriangle, // الأيقونة ستبقى كما هي
} from "react-icons/fa";
import "./UserProfilePage.css";
import { useSelector } from "react-redux";
import ReportUserModal from "./ReportUserModal";

const defaultAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png";
const REPORT_COOLDOWN_HOURS = 24;

// --- دوال localStorage المساعدة (تبقى كما هي) ---
const getRecentlyReportedUsers = () => {
  /* ... */
};
const markUserAsReported = (reportedUserId) => {
  /* ... */
};
const checkIfRecentlyReported = (reportedUserId) => {
  /* ... */
};
// --- نهاية دوال localStorage ---

const UserProfilePage = () => {
  const { userId: viewedUserId } = useParams();
  const currentUser = useSelector((state) => state.userReducer.user);

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isRecentlyReported, setIsRecentlyReported] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!viewedUserId || !/^[0-9a-fA-F]{24}$/.test(viewedUserId)) {
      setError("Invalid User ID provided.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`/user/profile/${viewedUserId}`);
      setProfileData(data);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to load user profile.");
    } finally {
      setLoading(false);
    }
  }, [viewedUserId]);

  useEffect(() => {
    fetchProfile();
    if (viewedUserId) {
      setIsRecentlyReported(checkIfRecentlyReported(viewedUserId));
    }
  }, [fetchProfile, viewedUserId]);

  const canReportThisUser =
    currentUser && profileData && currentUser._id !== profileData._id;
  const reportButtonDisabled = isRecentlyReported;

  const handleReportSuccess = () => {
    markUserAsReported(viewedUserId);
    setIsRecentlyReported(true);
    setShowReportModal(false);
  };

  if (loading)
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2 text-muted">Loading Profile...</p>
      </Container>
    );
  if (error)
    return (
      <Container className="py-5">
        <Alert variant="danger" className="text-center">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
          <Button as={Link} to="/" variant="outline-danger">
            Go Home
          </Button>
        </Alert>
      </Container>
    );
  if (!profileData)
    return (
      <Container className="py-5">
        <Alert variant="warning" className="text-center">
          Profile data not found.
        </Alert>
      </Container>
    );

  const totalRatings =
    (profileData.positiveRatings ?? 0) + (profileData.negativeRatings ?? 0);
  const positivePercentage =
    totalRatings > 0
      ? Math.round(((profileData.positiveRatings ?? 0) / totalRatings) * 100)
      : 0;

  const reportButtonTooltipText = isRecentlyReported
    ? `You have recently reported ${
        profileData.fullName || "this user"
      }. You can report again after ${REPORT_COOLDOWN_HOURS} hours.`
    : `Report ${profileData.fullName || "this user"}`;

  return (
    <Container className="user-profile-page py-4 py-md-5">
      <Row className="justify-content-center">
        <Col lg={10} xl={9}>
          <Card className="shadow-sm profile-card-main overflow-hidden position-relative">
            {canReportThisUser && (
              <OverlayTrigger
                placement="left"
                overlay={
                  <Tooltip id={`tooltip-report-${profileData._id}`}>
                    {reportButtonTooltipText}
                  </Tooltip>
                }
              >
                <div
                  style={{
                    position: "absolute",
                    top: "1rem",
                    right: "1rem",
                    zIndex: 10,
                    // إضافة cursor: 'not-allowed' عندما يكون الزر معطلاً مباشرة على الـ div
                    // لأن Tooltip قد يمنع ظهور cursor الـ button المعطل
                    cursor: reportButtonDisabled ? "not-allowed" : "pointer",
                  }}
                  // لا نمرر onClick هنا مباشرة، بل للـ Button الداخلي
                >
                  <Button
                    variant="link"
                    onClick={() =>
                      !reportButtonDisabled && setShowReportModal(true)
                    }
                    className={`p-0 report-user-icon-button ${
                      reportButtonDisabled ? "disabled-report-button" : ""
                    }`}
                    disabled={reportButtonDisabled} // التعطيل الفعلي للزر
                    aria-label={reportButtonTooltipText}
                  >
                    <FaExclamationTriangle
                      size={24}
                      style={{
                        color: reportButtonDisabled ? "#adb5bd" : "#dc3545", // رمادي إذا معطل، أحمر إذا نشط
                        opacity: reportButtonDisabled ? 0.6 : 1, // أقل وضوحًا إذا معطل
                      }}
                    />
                  </Button>
                </div>
              </OverlayTrigger>
            )}

            <Card.Header className="profile-header bg-light p-4 text-md-start text-center border-0">
              <Row className="align-items-center gy-3">
                <Col xs={12} md={2} className="text-center">
                  <Image
                    src={profileData.avatarUrl || defaultAvatar}
                    roundedCircle
                    className="profile-avatar"
                    alt={`${profileData.fullName}'s avatar`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = defaultAvatar;
                    }}
                  />
                </Col>
                <Col
                  xs={12}
                  md={
                    profileData.userRole === "Admin" || !canReportThisUser
                      ? 10
                      : 9
                  }
                >
                  <div className="d-flex flex-column flex-md-row align-items-center justify-content-start mb-2">
                    <h2 className="profile-name mb-1 mb-md-0 me-md-3">
                      {profileData.fullName}
                    </h2>
                  </div>
                  <Badge
                    pill
                    bg="info"
                    text="dark"
                    className="profile-role align-self-start mb-2"
                  >
                    <FaTag className="me-1" /> {profileData.userRole || "User"}
                  </Badge>
                  <p className="text-muted small mb-0">
                    <FaCalendarAlt size={14} className="me-1 opacity-75" />
                    Member since:{" "}
                    {new Date(
                      profileData.registerDate || Date.now()
                    ).toLocaleDateString()}
                  </p>
                  {profileData.reputationLevel && profileData.level && (
                    <div className="mt-2">
                      <Badge bg="secondary" className="me-1">
                        {profileData.reputationLevel}
                      </Badge>
                      <Badge bg="primary">Level {profileData.level}</Badge>
                    </div>
                  )}
                </Col>
              </Row>
            </Card.Header>
            <Card.Body className="p-4">
              <Row>
                <Col md={6} className="mb-4 mb-md-0">
                  <h5 className="mb-3 section-sub-title">User Statistics</h5>
                  <ListGroup variant="flush" className="stats-list">
                    <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                      <span>
                        <FaBoxOpen className="me-2 text-primary icon" /> Active
                        Listings
                      </span>
                      <Badge bg="light" text="dark" className="stat-badge">
                        {profileData.activeListingsCount ?? 0}
                      </Badge>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                      <span>
                        <FaCheckCircle className="me-2 text-success icon" />{" "}
                        Products Sold
                      </span>
                      <Badge bg="light" text="dark" className="stat-badge">
                        {profileData.productsSoldCount ?? 0}
                      </Badge>
                    </ListGroup.Item>
                    {profileData.address && (
                      <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                        <span>
                          <FaMapMarkerAlt className="me-2 text-secondary icon" />{" "}
                          Location
                        </span>
                        <span className="text-muted small">
                          {profileData.address}
                        </span>
                      </ListGroup.Item>
                    )}
                  </ListGroup>
                </Col>
                <Col md={6}>
                  <h5 className="mb-3 section-sub-title">User Rating</h5>
                  {totalRatings > 0 ? (
                    <div className="rating-box text-center p-3 bg-light rounded border">
                      <div
                        className={`rating-percentage display-6 fw-bold mb-2 ${
                          positivePercentage >= 75
                            ? "text-success"
                            : positivePercentage >= 50
                            ? "text-warning"
                            : "text-danger"
                        }`}
                      >
                        {positivePercentage}%
                      </div>
                      <div className="rating-text small text-muted mb-2">
                        Positive Rating
                      </div>
                      <div className="d-flex justify-content-center small">
                        <span className="me-3 rating-count positive">
                          <FaThumbsUp className="me-1" />
                          {profileData.positiveRatings ?? 0}
                        </span>
                        <span className="rating-count negative">
                          <FaThumbsDown className="me-1" />
                          {profileData.negativeRatings ?? 0}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted p-3 bg-light rounded border">
                      <small>No ratings available yet.</small>
                    </div>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      {profileData && canReportThisUser && (
        <ReportUserModal
          show={showReportModal && !isRecentlyReported}
          handleClose={() => setShowReportModal(false)}
          reportedUserId={profileData._id}
          reportedUserFullName={profileData.fullName}
          onReportSuccess={handleReportSuccess}
        />
      )}
    </Container>
  );
};

export default UserProfilePage;
