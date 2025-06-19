// src/pages/UserProfilePage.jsx
import React, { useEffect, useState, useCallback, useContext } from "react";
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
  FaExclamationTriangle,
  FaStar,
} from "react-icons/fa";
import "./UserProfilePage.css";
import { useSelector } from "react-redux";
import ReportUserModal from "./ReportUserModal";
import { SocketContext } from "../App";

const defaultAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png";
const REPORT_COOLDOWN_HOURS = 24;
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const getRecentlyReportedUsers = () => {
  try {
    const reported = localStorage.getItem("recentlyReportedUsers");
    return reported ? JSON.parse(reported) : {};
  } catch (e) {
    console.error(
      "Failed to parse recently reported users from localStorage",
      e
    );
    return {};
  }
};

const markUserAsReported = (reportedUserId) => {
  const reportedUsers = getRecentlyReportedUsers();
  reportedUsers[reportedUserId] = Date.now();
  try {
    localStorage.setItem(
      "recentlyReportedUsers",
      JSON.stringify(reportedUsers)
    );
  } catch (e) {
    console.error("Failed to save recently reported users to localStorage", e);
  }
};

const checkIfRecentlyReported = (reportedUserId) => {
  const reportedUsers = getRecentlyReportedUsers();
  const reportTimestamp = reportedUsers[reportedUserId];
  if (!reportTimestamp) return false;

  const cooldownMilliseconds = REPORT_COOLDOWN_HOURS * 60 * 60 * 1000;
  return Date.now() - reportTimestamp < cooldownMilliseconds;
};

const UserProfilePage = () => {
  const { userId: viewedUserId } = useParams();
  const currentUser = useSelector((state) => state.userReducer.user);
  const socket = useContext(SocketContext);

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
      const { data } = await axios.get(
        `${BACKEND_URL}/user/profile/${viewedUserId}`
      );
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

  useEffect(() => {
    if (!socket) return;

    const handleProfileUpdate = (updatedUserData) => {
      if (updatedUserData && updatedUserData._id === viewedUserId) {
        setProfileData((prevData) => ({
          // الدمج يضمن تحديث الحقول الجديدة مع الحفاظ على القديمة
          ...prevData,
          ...updatedUserData,
          user: {
            ...(prevData?.user || {}),
            ...(updatedUserData.user || updatedUserData),
          },
        }));
      }
    };

    socket.on("user_profile_updated", handleProfileUpdate);

    return () => {
      socket.off("user_profile_updated", handleProfileUpdate);
    };
  }, [socket, viewedUserId]);

  const userDetails = profileData?.user || profileData;
  const canReportThisUser =
    currentUser && userDetails && currentUser._id !== userDetails._id;
  const reportButtonDisabled = isRecentlyReported;

  const handleReportSuccess = () => {
    markUserAsReported(viewedUserId);
    setIsRecentlyReported(true);
    setShowReportModal(false);
  };

  const getAvatarSrc = () => {
    let avatarUrl = profileData?.avatarUrl;
    if (!avatarUrl) {
      avatarUrl = userDetails?.avatarUrl;
    }
    if (avatarUrl) {
      if (avatarUrl.startsWith("http")) {
        return avatarUrl;
      }
      return `${BACKEND_URL}/${avatarUrl}`;
    }
    return defaultAvatar;
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
  if (!userDetails)
    return (
      <Container className="py-5">
        <Alert variant="warning" className="text-center">
          Profile data not found.
        </Alert>
      </Container>
    );

  const totalRatings =
    (userDetails?.positiveRatings ?? 0) + (userDetails?.negativeRatings ?? 0);
  const positivePercentage =
    totalRatings > 0
      ? Math.round(((userDetails.positiveRatings ?? 0) / totalRatings) * 100)
      : 0;

  const reportButtonTooltipText = isRecentlyReported
    ? `You have recently reported ${
        userDetails?.fullName || "this user"
      }. You can report again after ${REPORT_COOLDOWN_HOURS} hours.`
    : `Report ${userDetails?.fullName || "this user"}`;

  return (
    <Container className="user-profile-page py-4 py-md-5">
      <Row className="justify-content-center">
        <Col lg={10} xl={9}>
          <Card className="shadow-sm profile-card-main overflow-hidden position-relative">
            {canReportThisUser && (
              <OverlayTrigger
                placement="left"
                overlay={
                  <Tooltip id={`tooltip-report-${userDetails._id}`}>
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
                    cursor: reportButtonDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  <Button
                    variant="link"
                    onClick={() =>
                      !reportButtonDisabled && setShowReportModal(true)
                    }
                    className={`p-0 report-user-icon-button ${
                      reportButtonDisabled ? "disabled-report-button" : ""
                    }`}
                    disabled={reportButtonDisabled}
                    aria-label={reportButtonTooltipText}
                  >
                    <FaExclamationTriangle
                      size={24}
                      style={{
                        color: reportButtonDisabled ? "#adb5bd" : "#dc3545",
                        opacity: reportButtonDisabled ? 0.6 : 1,
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
                    src={getAvatarSrc()}
                    roundedCircle
                    className="profile-avatar"
                    alt={`${userDetails.fullName}'s avatar`}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = defaultAvatar;
                    }}
                  />
                </Col>
                <Col xs={12} md={canReportThisUser ? 9 : 10}>
                  <div className="d-flex flex-column flex-md-row align-items-center justify-content-start mb-2">
                    <h2 className="profile-name mb-1 mb-md-0 me-md-3">
                      {userDetails.fullName}
                    </h2>
                  </div>
                  <Badge
                    pill
                    bg="info"
                    text="dark"
                    className="profile-role align-self-start mb-2"
                  >
                    <FaTag className="me-1" /> {userDetails.userRole || "User"}
                  </Badge>
                  <p className="text-muted small mb-0">
                    <FaCalendarAlt size={14} className="me-1 opacity-75" />
                    Member since:{" "}
                    {new Date(
                      userDetails.registerDate || Date.now()
                    ).toLocaleDateString()}
                  </p>
                  {userDetails.reputationLevel && userDetails.level && (
                    <div className="mt-2">
                      <Badge bg="secondary" className="me-2">
                        {userDetails.reputationLevel}
                      </Badge>
                      <Badge bg="primary">
                        <FaStar size={12} className="me-1" /> Level{" "}
                        {userDetails.level}
                      </Badge>
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
                        {profileData?.activeListingsCount ?? 0}
                      </Badge>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                      <span>
                        <FaCheckCircle className="me-2 text-success icon" />{" "}
                        Products Sold
                      </span>
                      <Badge bg="light" text="dark" className="stat-badge">
                        {profileData?.productsSoldCount ?? 0}
                      </Badge>
                    </ListGroup.Item>
                    {userDetails.address && (
                      <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                        <span>
                          <FaMapMarkerAlt className="me-2 text-secondary icon" />{" "}
                          Location
                        </span>
                        <span className="text-muted small">
                          {userDetails.address}
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
                          {userDetails.positiveRatings ?? 0}
                        </span>
                        <span className="rating-count negative">
                          <FaThumbsDown className="me-1" />
                          {userDetails.negativeRatings ?? 0}
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
      {userDetails && canReportThisUser && (
        <ReportUserModal
          show={showReportModal && !isRecentlyReported}
          handleClose={() => setShowReportModal(false)}
          reportedUserId={userDetails._id}
          reportedUserFullName={userDetails.fullName}
          onReportSuccess={handleReportSuccess}
        />
      )}
    </Container>
  );
};

export default UserProfilePage;
