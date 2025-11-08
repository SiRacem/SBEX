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
import { useTranslation } from "react-i18next";
import {
  FaCalendarAlt,
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
  const { t, i18n } = useTranslation();
  const { userId: viewedUserId } = useParams();
  const currentUser = useSelector((state) => state.userReducer.user);
  const socket = useContext(SocketContext);

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isRecentlyReported, setIsRecentlyReported] = useState(false);

  useEffect(() => {
    document.documentElement.dir = i18n.dir();
  }, [i18n, i18n.language]);

  const fetchProfile = useCallback(async () => {
    if (!viewedUserId || !/^[0-9a-fA-F]{24}$/.test(viewedUserId)) {
      setError(t("userProfilePage.invalidId"));
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
      setError(err.response?.data?.msg || t("userProfilePage.loadFail"));
    } finally {
      setLoading(false);
    }
  }, [viewedUserId, t]);

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
    const avatarUrl = userDetails?.avatarUrl;
    if (avatarUrl) {
      if (avatarUrl.startsWith("http")) {
        return avatarUrl;
      }
      return `${BACKEND_URL}/${avatarUrl.replace(/\\/g, "/")}`;
    }
    return defaultAvatar;
  };

  if (loading)
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2 text-muted">{t("userProfilePage.loading")}</p>
      </Container>
    );
  if (error)
    return (
      <Container className="py-5">
        <Alert variant="danger" className="text-center">
          <Alert.Heading>{t("userProfilePage.errorTitle")}</Alert.Heading>
          <p>{error}</p>
          <Button as={Link} to="/" variant="outline-danger">
            {t("userProfilePage.goHome")}
          </Button>
        </Alert>
      </Container>
    );
  if (!userDetails)
    return (
      <Container className="py-5">
        <Alert variant="warning" className="text-center">
          {t("userProfilePage.dataNotFound")}
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
    ? t("userProfilePage.reportTooltipCooldown", {
        name: userDetails?.fullName || "this user",
        hours: REPORT_COOLDOWN_HOURS,
      })
    : t("userProfilePage.reportTooltip", {
        name: userDetails?.fullName || "this user",
      });

  return (
    <Container className="user-profile-page py-4 py-md-5">
      <Row className="justify-content-center">
        <Col lg={10} xl={9}>
          <Card className="shadow-sm profile-card-main overflow-hidden position-relative">
            {canReportThisUser && (
              <OverlayTrigger
                placement={i18n.dir() === "rtl" ? "right" : "left"}
                overlay={
                  <Tooltip id={`tooltip-report-${userDetails._id}`}>
                    {reportButtonTooltipText}
                  </Tooltip>
                }
              >
                <div
                  className={`position-absolute top-0 m-3 ${
                    i18n.dir() === "rtl" ? "start-0" : "end-0"
                  }`}
                  style={{
                    zIndex: 10,
                    cursor: reportButtonDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  <Button
                    variant="link"
                    onClick={() =>
                      !reportButtonDisabled && setShowReportModal(true)
                    }
                    className="p-0 report-user-icon-button"
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
                    <Badge
                      pill
                      bg="info"
                      text="dark"
                      className="profile-role ms-md-2"
                    >
                      {t(`roles.${userDetails.userRole}`, {
                        defaultValue: userDetails.userRole,
                      })}
                    </Badge>
                    <p className="text-muted small mb-0 ms-md-auto">
                      <FaCalendarAlt size={14} className="me-1 opacity-75" />
                      {t("userProfilePage.memberSince")}:{" "}
                      {new Date(
                        userDetails.registerDate || Date.now()
                      ).toLocaleDateString(i18n.language)}
                    </p>
                  </div>
                  {userDetails.reputationLevel &&
                    (userDetails.level || userDetails.level === 0) && (
                      <div className="mt-2">
                        <Badge bg="secondary" className="me-2">
                          {t(
                            `reputationLevels.${userDetails.reputationLevel}`,
                            { defaultValue: userDetails.reputationLevel }
                          )}
                        </Badge>
                        <Badge bg="primary">
                          <FaStar size={12} className="me-1" />
                          {t("common.level", { level: userDetails.level })}
                        </Badge>
                      </div>
                    )}
                </Col>
              </Row>
            </Card.Header>
            <Card.Body className="p-4">
              <Row>
                <Col md={6} className="mb-4 mb-md-0">
                  <h5 className="mb-3 section-sub-title">
                    {t("userProfilePage.userStats")}
                  </h5>
                  <ListGroup variant="flush" className="stats-list">
                    <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                      <span>
                        <FaBoxOpen className="me-2 text-primary icon" />
                        {t("userProfilePage.activeListings")}
                      </span>
                      <Badge bg="light" text="dark">
                        {profileData?.activeListingsCount ?? 0}
                      </Badge>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                      <span>
                        <FaCheckCircle className="me-2 text-success icon" />
                        {t("userProfilePage.productsSold")}
                      </span>
                      <Badge bg="light" text="dark">
                        {profileData?.productsSoldCount ?? 0}
                      </Badge>
                    </ListGroup.Item>
                    {userDetails.address && (
                      <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                        <span>
                          <FaMapMarkerAlt className="me-2 text-secondary icon" />
                          {t("userProfilePage.location")}
                        </span>
                        <span className="text-muted small">
                          {userDetails.address}
                        </span>
                      </ListGroup.Item>
                    )}
                  </ListGroup>
                </Col>
                <Col md={6}>
                  <h5 className="mb-3 section-sub-title">
                    {t("userProfilePage.userRating")}
                  </h5>
                  {totalRatings > 0 ? (
                    <div className="rating-box text-center p-3 bg-light rounded border">
                      <div className="rating-percentage display-4 fw-bold text-success">
                        {positivePercentage}%
                      </div>
                      <div className="rating-text small text-muted mb-2">
                        {t("userProfilePage.positiveRating")}
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
                      <small>{t("userProfilePage.noRatings")}</small>
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
