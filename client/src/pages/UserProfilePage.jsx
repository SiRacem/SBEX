import React, {
  useEffect,
  useState,
  useCallback,
  useContext,
  useMemo,
} from "react";
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
import { LinkContainer } from "react-router-bootstrap";
import {
  FaCalendarAlt,
  FaBoxOpen,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaThumbsUp,
  FaThumbsDown,
  FaExclamationTriangle,
  FaStar,
  FaQuestionCircle,
  FaAward,
  FaMedal,
  FaTrophy,
  FaGem,
  FaCrown,
  FaSkullCrossbones,
  FaDragon,
  FaShieldAlt,
  FaUserPlus,   // <-- إضافة
  FaUserCheck,  // <-- إضافة
  FaUsers       // <-- إضافة
} from "react-icons/fa";
import "./UserProfilePage.css";
import { useSelector, useDispatch } from "react-redux"; // <-- إضافة useDispatch
import ReportUserModal from "./ReportUserModal";
import { SocketContext } from "../App";
import { toggleFollow } from "../redux/actions/userAction"; // <-- إضافة الأكشن
import { toast } from "react-toastify"; // <-- إضافة toast

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

const ReputationBadgeDisplay = ({ numericLevel, t }) => {
  const badges = {
    Mythic: { Icon: FaSkullCrossbones, color: "#A020F0" },
    Legend: { Icon: FaDragon, color: "#FF8C00" },
    Grandmaster: { Icon: FaCrown, color: "#FF4500" },
    Master: { Icon: FaCrown, color: "#D4AF37" },
    Diamond: { Icon: FaGem, color: "#00BFFF" },
    Platinum: { Icon: FaShieldAlt, color: "#708090" },
    Gold: { Icon: FaTrophy, color: "#FFD700" },
    Silver: { Icon: FaMedal, color: "#A9A9A9" },
    Bronze: { Icon: FaAward, color: "#CD7F32" },
    Novice: { Icon: FaStar, color: "#6C757D" },
  };

  let badgeName = "Novice";
  if (numericLevel >= 35) badgeName = "Mythic";
  else if (numericLevel >= 30) badgeName = "Legend";
  else if (numericLevel >= 25) badgeName = "Grandmaster";
  else if (numericLevel >= 20) badgeName = "Master";
  else if (numericLevel >= 15) badgeName = "Diamond";
  else if (numericLevel >= 10) badgeName = "Platinum";
  else if (numericLevel >= 7) badgeName = "Gold";
  else if (numericLevel >= 5) badgeName = "Silver";
  else if (numericLevel >= 3) badgeName = "Bronze";

  const { Icon, color } = badges[badgeName] || {
    Icon: FaQuestionCircle,
    color: "#6c757d",
  };

  return (
    <Badge
      pill
      bg="light"
      text="dark"
      className="d-inline-flex align-items-center reputation-badge"
    >
      <Icon className="me-1" style={{ color }} />
      <span>{t(`reputationLevels.${badgeName}`, badgeName)}</span>
    </Badge>
  );
};

const UserProfilePage = () => {
  const { t, i18n } = useTranslation();
  const { userId: viewedUserId } = useParams();
  const dispatch = useDispatch(); // <-- تعريف dispatch هنا (كان مفقوداً)
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

  const userDetails = profileData?.user;

  // --- التحقق من المتابعة ---
  const isFollowing = useMemo(() => {
    return currentUser?.following?.includes(viewedUserId);
  }, [currentUser?.following, viewedUserId]);

  // [!!!] دالة المتابعة المحسنة [!!!]
  const handleFollowClick = async () => {
    if (!currentUser) {
      toast.info(t("auth.loginRequired"));
      return;
    }

    // 1. التحديث المحلي الفوري (Optimistic Update)
    // إذا كنت أتابع حالياً -> سأنقص 1، إذا لم أكن أتابع -> سأزيد 1
    const newCount = isFollowing 
        ? Math.max(0, (userDetails.followersCount || 0) - 1) 
        : (userDetails.followersCount || 0) + 1;

    setProfileData(prev => ({
        ...prev,
        user: {
            ...prev.user,
            followersCount: newCount
        }
    }));

    // 2. إرسال الطلب للريدكس (الذي يحدث السيرفر)
    await dispatch(toggleFollow(viewedUserId));
  };

  const unlockedAchievements = useMemo(() => {
    return (userDetails?.achievements || [])
      .filter((a) => a.achievement)
      .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
      .slice(0, 5);
  }, [userDetails?.achievements]);

  const canReportThisUser = currentUser && userDetails && currentUser._id !== userDetails._id;
  const reportButtonDisabled = isRecentlyReported;

  const handleReportSuccess = () => {
    markUserAsReported(viewedUserId);
    setIsRecentlyReported(true);
    setShowReportModal(false);
  };

  const getAvatarSrc = () => {
    const avatarUrl = userDetails?.avatarUrl;
    if (avatarUrl) {
      if (avatarUrl.startsWith("http")) return avatarUrl;
      return `${BACKEND_URL}/${avatarUrl.replace(/\\/g, "/")}`;
    }
    return defaultAvatar;
  };

  if (loading) return <Container className="text-center py-5"><Spinner animation="border" variant="primary" /><p className="mt-2 text-muted">{t("userProfilePage.loading")}</p></Container>;
  if (error) return <Container className="py-5"><Alert variant="danger" className="text-center"><Alert.Heading>{t("userProfilePage.errorTitle")}</Alert.Heading><p>{error}</p><Button as={Link} to="/" variant="outline-danger">{t("userProfilePage.goHome")}</Button></Alert></Container>;
  if (!userDetails) return <Container className="py-5"><Alert variant="warning" className="text-center">{t("userProfilePage.dataNotFound")}</Alert></Container>;

  const totalRatings = (userDetails?.positiveRatings ?? 0) + (userDetails?.negativeRatings ?? 0);
  const positivePercentage = totalRatings > 0 ? Math.round(((userDetails.positiveRatings ?? 0) / totalRatings) * 100) : 0;

  const reportButtonTooltipText = isRecentlyReported
    ? t("userProfilePage.reportTooltipCooldown", { name: userDetails?.fullName || "this user", hours: REPORT_COOLDOWN_HOURS })
    : t("userProfilePage.reportTooltip", { name: userDetails?.fullName || "this user" });

  return (
    <Container className="user-profile-page py-4 py-md-5">
      <Row className="justify-content-center">
        <Col lg={10} xl={9}>
          <Card className="shadow-sm profile-card-main overflow-hidden position-relative">
            {canReportThisUser && (
              <OverlayTrigger placement={i18n.dir() === "rtl" ? "right" : "left"} overlay={<Tooltip id={`tooltip-report-${userDetails._id}`}>{reportButtonTooltipText}</Tooltip>}>
                <div className={`position-absolute top-0 m-3 ${i18n.dir() === "rtl" ? "start-0" : "end-0"}`} style={{ zIndex: 10, cursor: reportButtonDisabled ? "not-allowed" : "pointer" }}>
                  <Button variant="link" onClick={() => !reportButtonDisabled && setShowReportModal(true)} className="p-0 report-user-icon-button" disabled={reportButtonDisabled} aria-label={reportButtonTooltipText}>
                    <FaExclamationTriangle size={24} style={{ color: reportButtonDisabled ? "#adb5bd" : "#dc3545", opacity: reportButtonDisabled ? 0.6 : 1 }} />
                  </Button>
                </div>
              </OverlayTrigger>
            )}
            <Card.Header className="profile-header bg-light p-4 text-md-start text-center border-0">
              <Row className="align-items-center gy-3">
                <Col xs={12} md="auto" className="text-center">
                  <Image src={getAvatarSrc()} roundedCircle className="profile-avatar" alt={`${userDetails.fullName}'s avatar`} onError={(e) => { e.target.onerror = null; e.target.src = defaultAvatar; }} />
                </Col>
                <Col xs={12} md>
                  <div className="d-flex flex-column flex-md-row align-items-center mb-2">
                    <h2 className="profile-name mb-1 mb-md-0 me-md-3">{userDetails.fullName}</h2>
                    <div className="d-flex align-items-center flex-wrap">
                      <Badge pill bg="info" text="dark" className="profile-role me-2">{t(`common.roles.${userDetails.userRole}`, { defaultValue: userDetails.userRole })}</Badge>
                      <ReputationBadgeDisplay numericLevel={userDetails.level || 1} t={t} />
                      <Badge bg="primary" className="ms-2"><FaStar size={12} className="me-1" />{t("common.level", { level: userDetails.level || 1 })}</Badge>
                      
                      {/* زر المتابعة */}
                      {currentUser && currentUser._id !== viewedUserId && (
                        <Button
                          variant={isFollowing ? "outline-secondary" : "primary"}
                          size="sm"
                          className="ms-3 d-flex align-items-center"
                          onClick={handleFollowClick}
                        >
                          {isFollowing ? <FaUserCheck className="me-1" /> : <FaUserPlus className="me-1" />}
                          {isFollowing ? t("profilePage.following") : t("profilePage.followBtn")}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="d-flex align-items-center text-muted small mb-0">
                    <span className="me-3">
                      <FaCalendarAlt size={14} className="me-1 opacity-75" />
                      {t("userProfilePage.memberSince")}: {new Date(userDetails.registerDate || Date.now()).toLocaleDateString(i18n.language)}
                    </span>
                    <span>
                      <FaUsers size={14} className="me-1 opacity-75" />
                      {userDetails.followersCount || 0} {t("profilePage.followers")}
                    </span>
                  </div>
                </Col>
              </Row>
            </Card.Header>
            <Card.Body className="p-4">
              <Row>
                <Col md={6} className="mb-4 mb-md-0">
                  <h5 className="mb-3 section-sub-title">{t("userProfilePage.userStats")}</h5>
                  <ListGroup variant="flush" className="stats-list">
                    <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                      <span><FaBoxOpen className="me-2 text-primary icon" />{t("userProfilePage.activeListings")}</span>
                      <Badge bg="light" text="dark" className="stat-badge">{profileData?.activeListingsCount ?? 0}</Badge>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                      <span><FaCheckCircle className="me-2 text-success icon" />{t("userProfilePage.productsSold")}</span>
                      <Badge bg="light" text="dark" className="stat-badge">{profileData?.productsSoldCount ?? 0}</Badge>
                    </ListGroup.Item>
                    {userDetails.address && (
                      <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                        <span><FaMapMarkerAlt className="me-2 text-secondary icon" />{t("userProfilePage.location")}</span>
                        <span className="text-muted small">{userDetails.address}</span>
                      </ListGroup.Item>
                    )}
                  </ListGroup>
                </Col>
                <Col md={6}>
                  <h5 className="mb-3 section-sub-title">{t("userProfilePage.userRating")}</h5>
                  {totalRatings > 0 ? (
                    <div className="rating-box text-center p-3 bg-light rounded border">
                      <div className="rating-percentage display-4 fw-bold text-success">{positivePercentage}%</div>
                      <div className="rating-text small text-muted mb-2">{t("userProfilePage.positiveRating")}</div>
                      <div className="d-flex justify-content-center small">
                        <span className="me-3 rating-count positive"><FaThumbsUp className="me-1" />{userDetails.positiveRatings ?? 0}</span>
                        <span className="rating-count negative"><FaThumbsDown className="me-1" />{userDetails.negativeRatings ?? 0}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted p-3 bg-light rounded border"><small>{t("userProfilePage.noRatings")}</small></div>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="shadow-sm border-0 mt-4">
            <Card.Header className="bg-white p-3 border-0">
              <h5 className="mb-0 section-title-modern"><FaTrophy className="me-2 text-primary" /> {t("profilePage.achievementsSectionTitle")}</h5>
            </Card.Header>
            <Card.Body className="p-4">
              {unlockedAchievements.length > 0 ? (
                <Row className="g-3">
                  {unlockedAchievements.map((userAchievement) => (
                    <Col key={userAchievement.achievement._id} xs="auto">
                      <OverlayTrigger placement="top" overlay={<Tooltip id={`tooltip-public-${userAchievement.achievement._id}`}>
                        <strong>{userAchievement.achievement.title[i18n.language] || userAchievement.achievement.title.ar}</strong><br />
                        <small>{userAchievement.achievement.description[i18n.language] || userAchievement.achievement.description.ar}</small>
                      </Tooltip>}>
                        <div className="achievement-icon-display"><i className={`${userAchievement.achievement.icon} fa-2x`}></i></div>
                      </OverlayTrigger>
                    </Col>
                  ))}
                  {(userDetails.achievements?.length || 0) > 5 && (
                    <Col xs={12} className="mt-3">
                      <LinkContainer to="/dashboard/achievements">
                        <Button variant="link" size="sm" className="p-0">{t("profilePage.viewAllAchievements", { count: userDetails.achievements.length })}</Button>
                      </LinkContainer>
                    </Col>
                  )}
                </Row>
              ) : (
                <p className="text-muted text-center mb-0">{t("profilePage.noAchievements")}</p>
              )}
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