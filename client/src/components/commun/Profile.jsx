import React, { useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Container, Row, Col, Card, Spinner, Image, Badge, ProgressBar, Alert, Tooltip, OverlayTrigger, Modal, Button, Form } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LinkContainer } from "react-router-bootstrap";
import { getProfile, updateProfilePicture, resetUpdateAvatarStatus } from "../../redux/actions/userAction";
import CurrencySwitcher from "./CurrencySwitcher";
import useCurrencyDisplay from "../../hooks/useCurrencyDisplay";
import MediatorApplication from "./MediatorApplication";
import "./ProfileRedesigned.css";
import { toast } from "react-toastify";
import {
  FaCheckCircle, FaDollarSign, FaPiggyBank, FaUniversity, FaBalanceScale, FaHourglassHalf,
  FaStar, FaGift, FaUserShield, FaCamera, FaQuestionCircle, FaAward, FaMedal, FaTrophy,
  FaGem, FaCrown, FaSkullCrossbones, FaDragon, FaShieldAlt, FaMapMarkerAlt
} from "react-icons/fa";
import { BarChart2, ThumbsUp as FeatherThumbsUp, ThumbsDown as FeatherThumbsDown, Tag as FeatherTag, Check as FeatherCheck, XCircle } from "react-feather";
import { IoWalletOutline } from "react-icons/io5";
import LevelsModal from "../ratings/LevelsModal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const defaultAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png";
const MAX_LEVEL_CAP_FRONTEND = 100;
const BASE_POINTS_FOR_LEVEL_2_FRONTEND = 10;
const POINTS_INCREMENT_PER_LEVEL_STEP_FRONTEND = 5;

function calculateCumulativePointsForLevelFrontend(targetLevel) {
  if (targetLevel <= 1) return 0;
  let totalPoints = 0;
  let pointsForCurrentStep = BASE_POINTS_FOR_LEVEL_2_FRONTEND;
  for (let i = 2; i <= targetLevel; i++) {
    totalPoints += pointsForCurrentStep;
    if (i < targetLevel) pointsForCurrentStep += POINTS_INCREMENT_PER_LEVEL_STEP_FRONTEND;
  }
  return totalPoints;
}

const calculatePositiveFeedbackPercent = (p, n) => { const t = p + n; return t === 0 ? 0 : Math.round((p / t) * 100); };
const calculateNegativeFeedbackPercent = (p, n) => { const t = p + n; return t === 0 ? 0 : Math.round((n / t) * 100); };

// [!!!] تعديل تصميم الشارة ليكون مثل الصفحة العامة (كبير وواضح) [!!!]
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
    
    // تصميم متطابق مع UserProfilePage.jsx
    return (
      <Badge pill bg="light" text="dark" className="d-inline-flex align-items-center border px-3 py-2 shadow-sm" style={{fontSize: '0.85rem'}}>
        <Icon className="me-2" style={{ color }} />
        <span>{t(`reputationLevels.${badgeName}`, badgeName)}</span>
      </Badge>
    );
};

const Profile = ({ profileForOtherUser = null }) => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const { username: routeUsername } = useParams();

  const { user, loading, isAuth, error, successUpdateAvatar, errorUpdateAvatar, loadingUpdateAvatar } = useSelector((state) => state.userReducer);

  const [profileData, setProfileData] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [showLevelsModal, setShowLevelsModal] = useState(false);

  const isViewingOwnProfile = !routeUsername && !profileForOtherUser;

  useEffect(() => {
    setIsLoadingProfile(true); setProfileError(null);
    if (isViewingOwnProfile) {
      if (user) { setProfileData(user); setIsLoadingProfile(loading && !user); setProfileError(error); }
      else if (!loading && isAuth) { dispatch(getProfile()); }
      else if (!isAuth && !loading) { setIsLoadingProfile(false); setProfileError(t("profilePage.loginPrompt")); }
      else { setIsLoadingProfile(loading); }
    } else if (profileForOtherUser) { setProfileData(profileForOtherUser); setIsLoadingProfile(false); }
    else { setIsLoadingProfile(false); setProfileError(t("profilePage.unableToDisplay")); }
  }, [dispatch, isViewingOwnProfile, user, loading, isAuth, error, profileForOtherUser, routeUsername, t]);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const avatarSrc = useMemo(() => {
    const url = profileData?.avatarUrl;
    if (url) { const cacheBuster = `?t=${new Date().getTime()}`; return url.startsWith("http") ? `${url}${cacheBuster}` : `${BACKEND_URL}/${url.replace(/\\/g, "/")}${cacheBuster}`; }
    return defaultAvatar;
  }, [profileData?.avatarUrl, successUpdateAvatar]);

  const handleOpenAvatarModal = () => { if (!isViewingOwnProfile) return; setPreviewImage(avatarSrc); setSelectedFile(null); setShowAvatarModal(true); };
  const handleCloseAvatarModal = () => { setShowAvatarModal(false); setPreviewImage(null); setSelectedFile(null); };

  useEffect(() => { if (successUpdateAvatar) { handleCloseAvatarModal(); dispatch(resetUpdateAvatarStatus()); } }, [successUpdateAvatar, dispatch]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { toast.error(t("profilePage.avatarUpdateError")); return; }
      if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) { toast.error(t("profilePage.avatarUpdateTypeError")); return; }
      setSelectedFile(file); setPreviewImage(URL.createObjectURL(file));
    }
  };

  const handleUploadAvatar = () => { if (!isViewingOwnProfile || !selectedFile) return; const formData = new FormData(); formData.append("avatar", selectedFile); dispatch(updateProfilePicture(formData)); };

  const principalBalanceDisplay = useCurrencyDisplay(profileData?.balance);
  const depositBalanceDisplay = useCurrencyDisplay(profileData?.depositBalance);
  const withdrawalBalanceDisplay = useCurrencyDisplay(profileData?.withdrawalBalance);
  const sellerAvailableBalanceDisplay = useCurrencyDisplay(profileData?.sellerAvailableBalance);
  const sellerPendingBalanceDisplay = useCurrencyDisplay(profileData?.sellerPendingBalance);

  const positiveRatings = profileData?.positiveRatings ?? 0;
  const negativeRatings = profileData?.negativeRatings ?? 0;
  const totalRatings = positiveRatings + negativeRatings;
  const positiveFeedbackPercent = useMemo(() => calculatePositiveFeedbackPercent(positiveRatings, negativeRatings), [positiveRatings, negativeRatings]);
  const negativeFeedbackPercent = useMemo(() => calculateNegativeFeedbackPercent(positiveRatings, negativeRatings), [positiveRatings, negativeRatings]);

  const currentLevel = profileData?.level ?? 1;
  const currentPoints = profileData?.reputationPoints ?? 0;
  const pointsForCurrentLevelAbsolute = useMemo(() => calculateCumulativePointsForLevelFrontend(currentLevel), [currentLevel]);
  const pointsNeededForThisLevelStep = useMemo(() => { if (currentLevel >= MAX_LEVEL_CAP_FRONTEND) return Infinity; const totalForNext = calculateCumulativePointsForLevelFrontend(currentLevel + 1); return Math.max(0, totalForNext - pointsForCurrentLevelAbsolute); }, [currentLevel, pointsForCurrentLevelAbsolute]);
  const pointsProgress = useMemo(() => Math.max(0, currentPoints - pointsForCurrentLevelAbsolute), [currentPoints, pointsForCurrentLevelAbsolute]);
  const progressPercent = useMemo(() => pointsNeededForThisLevelStep > 0 && pointsNeededForThisLevelStep !== Infinity ? Math.min(100, Math.round((pointsProgress / pointsNeededForThisLevelStep) * 100)) : currentLevel >= MAX_LEVEL_CAP_FRONTEND ? 100 : 0, [pointsProgress, pointsNeededForThisLevelStep, currentLevel]);

  const activeListingsCount = profileData?.activeListingsCount ?? 0;
  const soldProductsCount = profileData?.productsSoldCount ?? 0;

  const unlockedAchievements = useMemo(() => {
    return (profileData?.achievements || []).filter((a) => a.achievement && a.achievement.title && a.achievement.description).sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt)).slice(0, 5);
  }, [profileData?.achievements]);

  const renderLevelSection = () => {
    if (!profileData) return null;
    const numericLevel = profileData.level || 1;
    const nextNumericLevel = numericLevel + 1;
    const BASE_REWARD_FOR_LEVEL_2_FRONTEND = 2;
    const REWARD_INCREMENT_PER_LEVEL_FRONTEND = 2;
    const DEFAULT_CURRENCY_FRONTEND = "TND";
    function calculateRewardForLevelFrontend(targetLevel) {
      if (targetLevel < 2) return { amount: 0, currency: DEFAULT_CURRENCY_FRONTEND };
      const rewardAmount = BASE_REWARD_FOR_LEVEL_2_FRONTEND + (targetLevel - 2) * REWARD_INCREMENT_PER_LEVEL_FRONTEND;
      return { amount: rewardAmount, currency: DEFAULT_CURRENCY_FRONTEND };
    }
    const rewardForNextLevelInfo = calculateRewardForLevelFrontend(nextNumericLevel);
    const nextLevelRewardText = numericLevel >= MAX_LEVEL_CAP_FRONTEND ? t("profilePage.levelWidget.maxLevel") : rewardForNextLevelInfo.amount > 0 ? `${rewardForNextLevelInfo.amount} ${rewardForNextLevelInfo.currency}` : t("profilePage.levelWidget.nextReward");

    let levelBackgroundClass = 'level-bg-default';
    if (numericLevel >= 10) levelBackgroundClass = 'level-bg-high';
    else if (numericLevel >= 7) levelBackgroundClass = 'level-bg-advanced';
    else if (numericLevel >= 4) levelBackgroundClass = 'level-bg-intermediate';
    else if (numericLevel >= 2) levelBackgroundClass = 'level-bg-beginner';

    return (
      <div 
        className={`level-section-widget-v2 ${levelBackgroundClass}`}
        onClick={() => setShowLevelsModal(true)} 
        style={{ cursor: "pointer" }} 
        title={t("profilePage.levelWidget.viewAllTooltip")}
      >
        <div className="d-flex justify-content-between align-items-center mb-1">
          <span className="fw-bold small d-flex align-items-center">
             <FaCrown className="me-1" style={{opacity: 0.8}} />
             {t("profilePage.levelWidget.level", { level: numericLevel })}
          </span>
          <span className="reputation-points small">{currentPoints} XP</span>
        </div>
        
        {numericLevel < MAX_LEVEL_CAP_FRONTEND ? (
          <>
            <ProgressBar className="level-progress-bar-v2">
              <ProgressBar now={progressPercent} style={{ backgroundColor: 'rgba(255,255,255,0.9)' }} /> 
            </ProgressBar>
            <div className="d-flex justify-content-between align-items-center small mt-1" style={{opacity: 0.9}}>
              <span style={{fontSize: '0.7rem'}}>{t("profilePage.levelWidget.progressLabel", { progress: pointsProgress, needed: pointsNeededForThisLevelStep, nextLevel: nextNumericLevel })}</span>
              <span className="fw-bold" style={{fontSize: '0.7rem'}}>
                <FaGift className="me-1" /> {nextLevelRewardText}
              </span>
            </div>
          </>
        ) : (
          <div className="text-center small mt-2 fw-bold"><FaCheckCircle className="me-1" /> {t("profilePage.levelWidget.maxLevel")}</div>
        )}
      </div>
    );
  };

  if (isLoadingProfile && !profileData) return <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: "calc(100vh - 100px)" }}><Spinner animation="border" variant="primary" style={{ width: "3rem", height: "3rem" }} /><p className="ms-3 fs-5">{t("profilePage.loading")}</p></Container>;
  if (profileError || !profileData) return <Container className="py-5"><Alert variant={profileError ? "danger" : "warning"} className="text-center fs-5">{profileError || t("profilePage.error")}</Alert>{isViewingOwnProfile && !isAuth && !loading && <Link to="/login" className="btn btn-primary d-block mx-auto mt-3 fs-5">{t("profilePage.login")}</Link>}{isViewingOwnProfile && error && isAuth && <Button onClick={() => dispatch(getProfile())} variant="primary" className="d-block mx-auto mt-3 fs-5">{t("profilePage.retry")}</Button>}</Container>;

  return (
    <Container fluid className="profile-page-professional py-4 px-md-4 animate-fade-in">
      <Row className="g-4">
        
        {/* Left Column: Personal Info Card */}
        <Col lg={4}>
          <Card className="h-100 profile-widget">
            <div className="profile-cover-private"></div>
            
            <Card.Body className="p-4 text-center d-flex flex-column pt-0">
              <div className={`profile-avatar-container mx-auto ${isViewingOwnProfile ? "editable-avatar" : ""}`} style={{ width: 130, height: 130 }} onClick={isViewingOwnProfile ? handleOpenAvatarModal : undefined} title={isViewingOwnProfile ? t("profilePage.changeAvatarTooltip") : ""}>
                <Image src={avatarSrc} roundedCircle className="profile-avatar-lg" alt="Avatar" onError={(e) => { e.target.onerror = null; e.target.src = defaultAvatar; }} />
                {isViewingOwnProfile && <div className="profile-avatar-overlay"><FaCamera size={28} color="white" /></div>}
              </div>

              <h3 className="profile-name-lg mb-1">{profileData.fullName || "User"}</h3>
              <p className="text-muted mb-2 small">{profileData.email}</p>
              
              {profileData.address && <p className="text-muted small mb-3"><FaMapMarkerAlt className="me-1" /> {profileData.address}</p>}

              {/* [!!!] التصميم الجديد للشارات (Badges) [!!!] */}
<div className="d-flex flex-wrap justify-content-center align-items-center gap-2 mb-3">
                
                {/* 1. شارة الحالة (Active/Blocked) */}
                <Badge 
                    pill 
                    bg={profileData.blocked ? "danger" : "success"} 
                    className="profile-role-badge border" // نستخدم نفس كلاس التصميم الموحد
                    style={{ backgroundColor: profileData.blocked ? '#dc3545' : '#198754', color: 'white', borderColor: 'transparent' }}
                >
                    {profileData.blocked ? <XCircle size={14} className="me-1" /> : <FaCheckCircle size={14} className="me-1" />} 
                    {profileData.blocked ? t("profilePage.statusBlocked") : t("profilePage.statusActive")}
                </Badge>

                {/* 2. شارة الدور (User/Vendor/Admin) */}
                <Badge pill bg="info" text="dark" className="profile-role-badge border">
                    <FaUserShield size={14} className="me-1" />
                    {t(`common.roles.${profileData.userRole}`, { defaultValue: profileData.userRole })}
                </Badge>
                
                {/* 3. شارة الرتبة (Bronze/Silver...) */}
                <ReputationBadgeDisplay numericLevel={profileData.level || 1} t={t} />
                
              </div>

              <div className="mt-auto w-100">{renderLevelSection()}</div>
            </Card.Body>

            {/* [!!!] التصميم الجديد للتقييم (دائري + أرقام) [!!!] */}
            <div className="rating-section border-top">
                <h6 className="text-muted small mb-3 text-center">{t("userProfilePage.userRating")}</h6>
                
                {totalRatings > 0 ? (
                    <div className="d-flex justify-content-center align-items-center gap-4">
                        {/* الدائرة البيانية */}
                        <div className="rating-circle-wrapper" style={{ '--rating-percent': `${positiveFeedbackPercent}%`, '--rating-color': positiveFeedbackPercent >= 80 ? '#48bb78' : positiveFeedbackPercent >= 50 ? '#ecc94b' : '#f56565', width: '80px', height: '80px' }}>
                            <div className="rating-circle-inner" style={{ width: '65px', height: '65px' }}>
                                <span className="rating-score" style={{fontSize: '1.1rem'}}>{positiveFeedbackPercent}%</span>
                            </div>
                        </div>

                        {/* الأرقام (اللايك والديسلايك) */}
                        <div className="d-flex flex-column gap-2">
                            <div className="d-flex align-items-center text-success small fw-bold">
                                <FeatherThumbsUp size={16} className="me-2" />
                                {positiveRatings} {t("userProfilePage.positiveRating")}
                            </div>
                            <div className="d-flex align-items-center text-danger small fw-bold">
                                <FeatherThumbsDown size={16} className="me-2" />
                                {negativeRatings} {t("userProfilePage.negativeRating")}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-muted small py-2" style={{opacity: 0.7}}>
                        {t("userProfilePage.noRatings", "No ratings yet")}
                    </div>
                )}
            </div>
          </Card>
        </Col>

        {/* Right Column: Details & Stats */}
        <Col lg={8}>
          
          <Card className="shadow-sm border-0 mb-4 profile-widget">
            <div className="balance-card-header">
              <h5 className="mb-0 section-title-modern"><IoWalletOutline className="me-2 text-primary" /> {t("profilePage.balancesSectionTitle")}</h5>
              {isViewingOwnProfile && <CurrencySwitcher size="sm" />}
            </div>
            <Card.Body className="p-4">
              <Row className="g-3">
                <Col sm={6} md={4}>
                  <div className="balance-widget" style={{color: '#2d3748'}}>
                    <FaPiggyBank className="icon text-primary" />
                    <span className="value">{principalBalanceDisplay.displayValue}</span>
                    <span className="label">{t("profilePage.balancePrincipal")}</span>
                    <span className="approx">{principalBalanceDisplay.approxValue}</span>
                  </div>
                </Col>
                <Col sm={6} md={4}>
                  <div className="balance-widget" style={{color: '#2d3748'}}>
                    <FaUniversity className="icon text-info" />
                    <span className="value">{depositBalanceDisplay.displayValue}</span>
                    <span className="label">{t("profilePage.balanceDeposit")}</span>
                    <span className="approx">{depositBalanceDisplay.approxValue}</span>
                  </div>
                </Col>
                <Col sm={6} md={4}>
                  <div className="balance-widget" style={{color: '#2d3748'}}>
                    <FaDollarSign className="icon text-danger" />
                    <span className="value">{withdrawalBalanceDisplay.displayValue}</span>
                    <span className="label">{t("profilePage.balanceWithdrawal")}</span>
                    <span className="approx">{withdrawalBalanceDisplay.approxValue}</span>
                  </div>
                </Col>
                {(profileData.userRole === "Vendor" || profileData.userRole === "Admin") && (
                  <>
                    <Col sm={6} md={6}>
                      <div className="balance-widget">
                        <FaBalanceScale className="icon text-success" />
                        <span className="value">{sellerAvailableBalanceDisplay.displayValue}</span>
                        <span className="label">{t("profilePage.balanceSellerAvailable")}</span>
                        <span className="approx">{sellerAvailableBalanceDisplay.approxValue}</span>
                      </div>
                    </Col>
                    <Col sm={6} md={6}>
                      <div className="balance-widget">
                        <FaHourglassHalf className="icon text-warning" />
                        <span className="value">{sellerPendingBalanceDisplay.displayValue}</span>
                        <span className="label">{t("profilePage.balanceSellerOnHold")}</span>
                        <span className="approx">{sellerPendingBalanceDisplay.approxValue}</span>
                      </div>
                    </Col>
                  </>
                )}
              </Row>
            </Card.Body>
          </Card>

          {/* 7. Stats & Achievements */}
          <Row className="g-4">
            <Col md={6}>
                <Card className="h-100 shadow-sm border-0 profile-widget">
                    <Card.Header className="bg-white p-3 border-0">
                        <h6 className="mb-0 section-title-modern">
                            <BarChart2 className="me-2 text-info" /> {t("profilePage.statsSectionTitle")}
                        </h6>
                    </Card.Header>
                    <Card.Body className="p-3">
                        {/* [!!!] استرجاع تصميم البطاقات المربعة كما طلبت [!!!] */}
                        <div className="d-flex flex-column gap-3">
                            <div className="statistic-entry d-flex align-items-center p-3 rounded border bg-white">
                                <div className="me-3 p-3 rounded-circle bg-info-subtle text-info">
                                    <FeatherTag size={24} />
                                </div>
                                <div>
                                    <span className="d-block fw-bold fs-4 text-dark">{activeListingsCount}</span>
                                    <span className="text-muted small">{t("profilePage.statsActiveListings")}</span>
                                </div>
                            </div>
                            
                            <div className="statistic-entry d-flex align-items-center p-3 rounded border bg-white">
                                <div className="me-3 p-3 rounded-circle bg-success-subtle text-success">
                                    <FeatherCheck size={24} />
                                </div>
                                <div>
                                    <span className="d-block fw-bold fs-4 text-dark">{soldProductsCount}</span>
                                    <span className="text-muted small">{t("profilePage.statsProductsSold")}</span>
                                </div>
                            </div>
                        </div>
                    </Card.Body>
                </Card>
            </Col>
            
            <Col md={6}>
                <Card className="h-100 shadow-sm border-0 profile-widget">
                    <Card.Header className="bg-white p-3 border-0"><h6 className="mb-0 section-title-modern"><FaTrophy className="me-2 text-warning" /> {t("profilePage.achievementsSectionTitle")}</h6></Card.Header>
                    <Card.Body className="p-3 d-flex flex-wrap gap-2 align-content-start justify-content-center">
                        {unlockedAchievements.length > 0 ? unlockedAchievements.map((ua) => (
                            <OverlayTrigger key={ua.achievement._id} placement="top" overlay={<Tooltip id={`t-${ua.achievement._id}`}><strong>{ua.achievement.title?.[i18n.language] || ua.achievement.title?.ar}</strong><br/>{ua.achievement.description?.[i18n.language] || ua.achievement.description?.ar}</Tooltip>}>
                                <div className="achievement-icon-display"><i className={`${ua.achievement.icon}`}></i></div>
                            </OverlayTrigger>
                        )) : <p className="text-muted w-100 text-center small">{t("profilePage.noAchievements")}</p>}
                        {profileData.achievements.length > 5 && <Link to="/dashboard/achievements" className="btn btn-light btn-sm rounded-pill border px-3 py-2 ms-auto">View All</Link>}
                    </Card.Body>
                </Card>
            </Col>
          </Row>

          {isViewingOwnProfile && !profileData?.blocked && <div className="mt-4"><MediatorApplication /></div>}
        </Col>
      </Row>

      <Modal show={showAvatarModal} onHide={handleCloseAvatarModal} centered>
        <Modal.Header closeButton><Modal.Title>{t("profilePage.avatarModalTitle")}</Modal.Title></Modal.Header>
        <Modal.Body className="text-center">
          {previewImage && <Image src={previewImage} roundedCircle width={150} height={150} className="mb-3 border shadow-sm" alt="Preview" />}
          <Form.Group className="mb-3"><Form.Control type="file" accept="image/*" onChange={handleFileChange} /></Form.Group>
          {errorUpdateAvatar && <Alert variant="danger" className="mt-2">{typeof errorUpdateAvatar === "string" ? errorUpdateAvatar : JSON.stringify(errorUpdateAvatar)}</Alert>}
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={handleCloseAvatarModal}>{t("profilePage.cancelButton")}</Button><Button variant="primary" onClick={handleUploadAvatar} disabled={!selectedFile || loadingUpdateAvatar}>{loadingUpdateAvatar ? <Spinner size="sm" /> : t("profilePage.uploadButton")}</Button></Modal.Footer>
      </Modal>
      {profileData && <LevelsModal show={showLevelsModal} handleClose={() => setShowLevelsModal(false)} currentUserData={profileData} />}
    </Container>
  );
};

export default Profile;