import React, { useEffect, useState, useCallback, useContext, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Container, Row, Col, Card, Spinner, Alert, Image, Badge, Button, Tooltip, OverlayTrigger } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { LinkContainer } from "react-router-bootstrap";
import {
  FaCalendarAlt, FaBoxOpen, FaCheckCircle, FaMapMarkerAlt, FaThumbsUp, FaThumbsDown,
  FaExclamationTriangle, FaStar, FaQuestionCircle, FaAward, FaMedal, FaTrophy,
  FaGem, FaCrown, FaSkullCrossbones, FaDragon, FaShieldAlt,
  FaUserPlus, FaUserCheck, FaUsers, FaArrowRight, FaArrowLeft
} from "react-icons/fa";
import "./UserProfilePage.css";
import { useSelector, useDispatch } from "react-redux";
import ReportUserModal from "./ReportUserModal";
import { SocketContext } from "../App";
import { toggleFollow } from "../redux/actions/userAction";
import { toast } from "react-toastify";

const defaultAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png";
const REPORT_COOLDOWN_HOURS = 24;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const getRecentlyReportedUsers = () => { try { const reported = localStorage.getItem("recentlyReportedUsers"); return reported ? JSON.parse(reported) : {}; } catch (e) { return {}; } };
const markUserAsReported = (reportedUserId) => { const reportedUsers = getRecentlyReportedUsers(); reportedUsers[reportedUserId] = Date.now(); try { localStorage.setItem("recentlyReportedUsers", JSON.stringify(reportedUsers)); } catch (e) { console.error(e); } };
const checkIfRecentlyReported = (reportedUserId) => { const reportedUsers = getRecentlyReportedUsers(); const reportTimestamp = reportedUsers[reportedUserId]; if (!reportTimestamp) return false; return Date.now() - reportTimestamp < REPORT_COOLDOWN_HOURS * 60 * 60 * 1000; };

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

  const { Icon, color } = badges[badgeName] || { Icon: FaQuestionCircle, color: "#6c757d" };

  return (
    <Badge pill bg="light" text="dark" className="d-inline-flex align-items-center border px-3 py-2 shadow-sm" style={{fontSize: '0.85rem'}}>
      <Icon className="me-2" style={{ color }} />
      <span>{t(`reputationLevels.${badgeName}`, badgeName)}</span>
    </Badge>
  );
};

const UserProfilePage = () => {
  const { t, i18n } = useTranslation();
  const { userId: viewedUserId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user: currentUser, loadingFollow } = useSelector((state) => state.userReducer);
  const socket = useContext(SocketContext);

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isRecentlyReported, setIsRecentlyReported] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => { document.documentElement.dir = i18n.dir(); }, [i18n, i18n.language]);

  const fetchProfile = useCallback(async () => {
    if (!viewedUserId || !/^[0-9a-fA-F]{24}$/.test(viewedUserId)) {
      setError(t("userProfilePage.invalidId")); setLoading(false); return;
    }
    setLoading(true); setError(null);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/user/profile/${viewedUserId}`);
      setProfileData(data);
    } catch (err) { setError(err.response?.data?.msg || t("userProfilePage.loadFail")); } finally { setLoading(false); }
  }, [viewedUserId, t]);

  useEffect(() => { fetchProfile(); if (viewedUserId) setIsRecentlyReported(checkIfRecentlyReported(viewedUserId)); }, [fetchProfile, viewedUserId]);

  useEffect(() => {
    if (!socket) return;
    const handleProfileUpdate = (updatedUserData) => {
      if (updatedUserData && updatedUserData._id === viewedUserId) {
        setProfileData((prevData) => ({
          ...prevData,
          ...updatedUserData,
          user: { ...(prevData?.user || {}), ...(updatedUserData.user || updatedUserData) },
        }));
      }
    };
    socket.on("user_profile_updated", handleProfileUpdate);
    return () => { socket.off("user_profile_updated", handleProfileUpdate); };
  }, [socket, viewedUserId]);

  const userDetails = profileData?.user;

  const isFollowing = useMemo(() => {
    if (!currentUser || !currentUser.following) return false;
    return currentUser.following.some(id => id.toString() === viewedUserId.toString());
  }, [currentUser, viewedUserId]);

  const handleFollowClick = () => {
    if (!currentUser) { toast.info(t("auth.loginRequired")); return; }
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 400);
    const countChange = isFollowing ? -1 : 1;
    setProfileData(prev => {
      if (!prev || !prev.user) return prev;
      return { ...prev, user: { ...prev.user, followersCount: Math.max(0, (prev.user.followersCount || 0) + countChange) } };
    });
    dispatch(toggleFollow(viewedUserId));
  };

  const unlockedAchievements = useMemo(() => {
    return (userDetails?.achievements || []).filter((a) => a.achievement).sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt)).slice(0, 5);
  }, [userDetails?.achievements]);

  const canReportThisUser = currentUser && userDetails && currentUser._id !== userDetails._id;
  const reportButtonDisabled = isRecentlyReported;

  const handleReportSuccess = () => { markUserAsReported(viewedUserId); setIsRecentlyReported(true); setShowReportModal(false); };

  const getAvatarSrc = () => {
    const avatarUrl = userDetails?.avatarUrl;
    if (avatarUrl) { if (avatarUrl.startsWith("http")) return avatarUrl; return `${BACKEND_URL}/${avatarUrl.replace(/\\/g, "/")}`; }
    return defaultAvatar;
  };

  if (loading) return <Container className="text-center py-5"><Spinner animation="border" variant="primary" /><p className="mt-2 text-muted">{t("userProfilePage.loading")}</p></Container>;
  if (error) return <Container className="py-5"><Alert variant="danger" className="text-center">{error} <Button as={Link} to="/" variant="outline-danger" size="sm" className="ms-2">{t("userProfilePage.goHome")}</Button></Alert></Container>;
  if (!userDetails) return <Container className="py-5"><Alert variant="warning" className="text-center">{t("userProfilePage.dataNotFound")}</Alert></Container>;

  const totalRatings = (userDetails?.positiveRatings ?? 0) + (userDetails?.negativeRatings ?? 0);
  const positivePercentage = totalRatings > 0 ? Math.round(((userDetails.positiveRatings ?? 0) / totalRatings) * 100) : 0;

  const reportButtonTooltipText = isRecentlyReported ? t("userProfilePage.reportTooltipCooldown", { hours: REPORT_COOLDOWN_HOURS }) : t("userProfilePage.reportTooltip");

  return (
    <Container className="user-profile-page animate-entry">
      <Row className="justify-content-center">
        <Col lg={10} xl={9}>
          <Card className="profile-card-main">
            <div className="profile-cover">
                <div className={`position-absolute top-0 m-2 ${i18n.dir() === "rtl" ? "end-0" : "start-0"}`} style={{ zIndex: 20 }}>
                    <Button variant="light" className="profile-back-btn" onClick={() => navigate(-1)} aria-label={t("common.back", "Back")}>
                        {i18n.dir() === 'rtl' ? <FaArrowRight size={14} /> : <FaArrowLeft size={14} />}
                    </Button>
                </div>
                {canReportThisUser && (
                    <div className={`position-absolute top-0 m-2 ${i18n.dir() === "rtl" ? "start-0" : "end-0"}`} style={{ zIndex: 20 }}>
                        <OverlayTrigger placement="bottom" overlay={<Tooltip id="report-tooltip">{reportButtonTooltipText}</Tooltip>}>
                            <Button variant="light" onClick={() => !reportButtonDisabled && setShowReportModal(true)} className="profile-back-btn" disabled={reportButtonDisabled} style={{color: '#dc3545'}}>
                                <FaExclamationTriangle size={16} />
                            </Button>
                        </OverlayTrigger>
                    </div>
                )}
            </div>

            <Card.Body className="text-center pt-0 pb-5">
                <div className="profile-avatar-container">
                    <Image src={getAvatarSrc()} roundedCircle className="profile-avatar" alt={userDetails.fullName} onError={(e) => { e.target.onerror = null; e.target.src = defaultAvatar; }} />
                </div>

                <h2 className="profile-name">{userDetails.fullName}</h2>
                
                <div className="profile-details-row mb-4">
                    <Badge pill bg="light" text="dark" className="profile-role-badge border">
                        {t(`common.roles.${userDetails.userRole}`, { defaultValue: userDetails.userRole })}
                    </Badge>
                    <span className="d-flex align-items-center">
                        <FaMapMarkerAlt className="me-1 text-danger" /> {userDetails.address || t("common.noAddress")}
                    </span>
                    <span className="d-flex align-items-center">
                        <FaCalendarAlt className="me-1 text-primary" /> {new Date(userDetails.registerDate || Date.now()).toLocaleDateString(i18n.language)}
                    </span>
                </div>

                <div className="d-flex justify-content-center align-items-center gap-2 mb-4 flex-wrap">
                    <ReputationBadgeDisplay numericLevel={userDetails.level || 1} t={t} />
                    <Badge bg="warning" text="dark" className="px-3 py-2 rounded-pill shadow-sm">
                        <FaStar className="me-1" /> {t("common.level", { level: userDetails.level || 1 })}
                    </Badge>
                    
                    {currentUser && currentUser._id !== viewedUserId && (
                        <Button
                            variant="light"
                            className={`btn-follow-magic ms-2 ${isFollowing ? 'following' : 'not-following'} ${isAnimating ? 'animate-pop' : ''}`}
                            onClick={handleFollowClick}
                            disabled={loadingFollow}
                        >
                            {loadingFollow ? <Spinner size="sm" /> : (
                                <>
                                    {isFollowing ? <FaUserCheck /> : <FaUserPlus />}
                                    <span>{isFollowing ? t("profilePage.following") : t("profilePage.followBtn")}</span>
                                </>
                            )}
                        </Button>
                    )}
                </div>

                <hr className="my-4 opacity-10" />

                <Row className="g-4 text-start">
                    <Col md={7}>
                        <h5 className="section-sub-title mb-4">
                            <FaBoxOpen className="me-2 text-info" /> {t("userProfilePage.userStats")}
                        </h5>
                        <div className="stats-grid-container">
                            <div className="stat-card">
                                <div className="stat-icon-wrapper bg-info-subtle text-info">
                                    <FaBoxOpen />
                                </div>
                                <div className="stat-value">{profileData?.activeListingsCount ?? 0}</div>
                                <div className="stat-label">{t("userProfilePage.activeListings")}</div>
                            </div>
                            
                            <div className="stat-card">
                                <div className="stat-icon-wrapper bg-success-subtle text-success">
                                    <FaCheckCircle />
                                </div>
                                <div className="stat-value">{profileData?.productsSoldCount ?? 0}</div>
                                <div className="stat-label">{t("userProfilePage.productsSold")}</div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon-wrapper bg-warning-subtle text-warning">
                                    <FaUsers />
                                </div>
                                <div className="stat-value">{userDetails.followersCount || 0}</div>
                                <div className="stat-label">{t("profilePage.followers")}</div>
                            </div>
                        </div>
                    </Col>

                    <Col md={5}>
                        <h5 className="section-sub-title mb-4 text-center">
                            <FaStar className="me-2 text-warning" /> {t("userProfilePage.userRating")}
                        </h5>
                        <div className="text-center">
                            <div className="rating-circle-wrapper" style={{ '--rating-percent': `${positivePercentage}%`, '--rating-color': positivePercentage >= 80 ? '#48bb78' : positivePercentage >= 50 ? '#ecc94b' : '#f56565' }}>
                                <div className="rating-circle-inner">
                                    <span className="rating-score">{positivePercentage}%</span>
                                    <span className="rating-label">{t("userProfilePage.positiveRating")}</span>
                                </div>
                            </div>
                            
                            <div className="d-flex justify-content-center gap-4 mt-3">
                                <div className="text-success fw-bold">
                                    <FaThumbsUp className="me-1" /> {userDetails.positiveRatings ?? 0}
                                </div>
                                <div className="text-danger fw-bold">
                                    <FaThumbsDown className="me-1" /> {userDetails.negativeRatings ?? 0}
                                </div>
                            </div>
                        </div>
                    </Col>
                </Row>

            </Card.Body>
          </Card>

          <Card className="achievements-card mt-4 p-4">
            <h5 className="section-sub-title mb-4">
                <FaTrophy className="me-2 text-primary" style={{color: '#9b59b6'}} /> {t("profilePage.achievementsSectionTitle")}
            </h5>
            {unlockedAchievements.length > 0 ? (
                <div className="d-flex flex-wrap gap-3 justify-content-center justify-content-md-start">
                  {unlockedAchievements.map((userAchievement) => (
                    <OverlayTrigger key={userAchievement.achievement._id} placement="top" overlay={<Tooltip id={`tooltip-${userAchievement.achievement._id}`}>
                        <strong>{userAchievement.achievement.title[i18n.language] || userAchievement.achievement.title.ar}</strong><br />
                        <small>{userAchievement.achievement.description[i18n.language] || userAchievement.achievement.description.ar}</small>
                      </Tooltip>}>
                        <div className="achievement-item">
                            <i className={`${userAchievement.achievement.icon} fa-2x`}></i>
                        </div>
                    </OverlayTrigger>
                  ))}
                  {(userDetails.achievements?.length || 0) > 5 && (
                      <LinkContainer to="/dashboard/achievements">
                        <Button variant="light" size="sm" className="rounded-pill px-3 align-self-center border">
                          + {userDetails.achievements.length - 5}
                        </Button>
                      </LinkContainer>
                  )}
                </div>
              ) : (
                <p className="text-muted text-center py-3 bg-light rounded">{t("profilePage.noAchievements")}</p>
              )}
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