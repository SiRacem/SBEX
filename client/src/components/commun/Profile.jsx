// src/components/commun/Profile.jsx
import React, { useEffect, useMemo, useState, useContext } from "react";
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
  Tooltip,
  OverlayTrigger,
  Modal,
  Button,
  Form,
} from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import {
  getProfile,
  updateProfilePicture,
} from "../../redux/actions/userAction";
import CurrencySwitcher from "./CurrencySwitcher";
import useCurrencyDisplay from "../../hooks/useCurrencyDisplay";
import MediatorApplication from "./MediatorApplication";
import "./ProfileRedesigned.css";
import { toast } from "react-toastify";
import {
  FaCheckCircle,
  FaDollarSign,
  FaPiggyBank,
  FaUniversity,
  FaBalanceScale,
  FaHourglassHalf,
  FaStar,
  FaGift,
  FaUserShield,
  FaCamera,
  FaQuestionCircle,
  FaAward,
  FaMedal,
  FaTrophy,
  FaGem,
  FaCrown,
  FaSkullCrossbones,
  FaDragon,
  FaShieldAlt,
} from "react-icons/fa";
import {
  Briefcase,
  BarChart2,
  ThumbsUp as FeatherThumbsUp,
  ThumbsDown as FeatherThumbsDown,
  Tag as FeatherTag,
  Check as FeatherCheck,
  XCircle,
  MapPin,
} from "react-feather";
import { IoWalletOutline } from "react-icons/io5";
import { SocketContext } from "../../App";
import LevelsModal from "../ratings/LevelsModal";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const BASE_POINTS_FOR_LEVEL_2_FRONTEND = 10;
const POINTS_INCREMENT_PER_LEVEL_STEP_FRONTEND = 5;
const BASE_REWARD_FOR_LEVEL_2_FRONTEND = 2;
const REWARD_INCREMENT_PER_LEVEL_FRONTEND = 2;
const DEFAULT_CURRENCY_FRONTEND = "TND";
const MAX_LEVEL_CAP_FRONTEND = 100;

function calculateCumulativePointsForLevelFrontend(targetLevel) {
  if (targetLevel <= 1) return 0;
  let totalPoints = 0;
  let pointsForCurrentStep = BASE_POINTS_FOR_LEVEL_2_FRONTEND;
  for (let i = 2; i <= targetLevel; i++) {
    totalPoints += pointsForCurrentStep;
    if (i < targetLevel) {
      pointsForCurrentStep += POINTS_INCREMENT_PER_LEVEL_STEP_FRONTEND;
    }
  }
  return totalPoints;
}
function calculateRewardForLevelFrontend(targetLevel) {
  if (targetLevel < 2)
    return { amount: 0, currency: DEFAULT_CURRENCY_FRONTEND };
  const rewardAmount =
    BASE_REWARD_FOR_LEVEL_2_FRONTEND +
    (targetLevel - 2) * REWARD_INCREMENT_PER_LEVEL_FRONTEND;
  return { amount: rewardAmount, currency: DEFAULT_CURRENCY_FRONTEND };
}
const calculatePositiveFeedbackPercent = (p, n) => {
  const t = p + n;
  return t === 0 ? 0 : Math.round((p / t) * 100);
};
const calculateNegativeFeedbackPercent = (p, n) => {
  const t = p + n;
  return t === 0 ? 0 : Math.round((n / t) * 100);
};

// --- [!!!] تعريف الدالة هنا [!!!] ---
// This function should ideally mirror the logic in your backend's determineReputationBadge
function determineReputationBadgeFrontend(numericLevel) {
  // Ensure icons are returned as JSX elements for ReputationBadgeDisplay component
  // The 'color' here will be used for the icon via style prop
  // 'badgeClasses' in ReputationBadgeDisplay will determine the badge's background/text color from CSS
  if (numericLevel >= 35)
    return {
      name: "Mythic",
      IconComponent: FaSkullCrossbones,
      color: "#A020F0",
    };
  if (numericLevel >= 30)
    return { name: "Legend", IconComponent: FaDragon, color: "#FF8C00" };
  if (numericLevel >= 25)
    return { name: "Grandmaster", IconComponent: FaCrown, color: "#FF4500" };
  if (numericLevel >= 20)
    return { name: "Master", IconComponent: FaCrown, color: "#D4AF37" };
  if (numericLevel >= 15)
    return { name: "Diamond", IconComponent: FaGem, color: "#00BFFF" };
  if (numericLevel >= 10)
    return { name: "Platinum", IconComponent: FaShieldAlt, color: "#708090" };
  if (numericLevel >= 7)
    return { name: "Gold", IconComponent: FaTrophy, color: "#FFD700" };
  if (numericLevel >= 5)
    return { name: "Silver", IconComponent: FaMedal, color: "#A9A9A9" };
  if (numericLevel >= 3)
    return { name: "Bronze", IconComponent: FaAward, color: "#CD7F32" };
  if (numericLevel >= 1)
    return { name: "Novice", IconComponent: FaStar, color: "#6C757D" }; // Default for level 1 & 2
  return {
    name: "Unranked",
    IconComponent: FaQuestionCircle,
    color: "#6C757D",
  }; // Fallback
}

const Profile = ({ profileForOtherUser = null }) => {
  const dispatch = useDispatch();
  const socket = useContext(SocketContext);
  const { username: routeUsername } = useParams();
  const currentUserState = useSelector((state) => state.userReducer);

  const [profileData, setProfileData] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const [showLevelsModal, setShowLevelsModal] = useState(false);
  const handleOpenLevelsModal = () => setShowLevelsModal(true);
  const handleCloseLevelsModal = () => setShowLevelsModal(false);

  const isViewingOwnProfile = !routeUsername && !profileForOtherUser;
  const targetUserId = useMemo(() => {
    if (isViewingOwnProfile) return currentUserState.user?._id;
    if (profileForOtherUser) return profileForOtherUser._id;
    return null;
  }, [isViewingOwnProfile, currentUserState.user, profileForOtherUser]);

  useEffect(() => {
    const fetchProfileData = () => {
      setIsLoadingProfile(true);
      setProfileError(null);
      if (isViewingOwnProfile) {
        if (currentUserState.user) {
          setProfileData(currentUserState.user);
          setIsLoadingProfile(
            currentUserState.loading && !currentUserState.user
          );
          setProfileError(currentUserState.error);
        } else if (!currentUserState.loading && currentUserState.isAuth) {
          dispatch(getProfile());
        } else if (!currentUserState.isAuth && !currentUserState.loading) {
          setIsLoadingProfile(false);
          setProfileError("Please login to view your profile.");
        } else setIsLoadingProfile(currentUserState.loading);
      } else if (profileForOtherUser) {
        setProfileData(profileForOtherUser);
        setIsLoadingProfile(false);
      } else if (routeUsername) {
        console.warn(
          "Viewing other user's profile by route username requires dedicated API and Redux logic."
        );
        setIsLoadingProfile(false);
        if (
          currentUserState.user &&
          currentUserState.user.fullName?.toLowerCase() ===
            routeUsername.toLowerCase()
        ) {
          setProfileData(currentUserState.user);
        } else setProfileError(`Profile for ${routeUsername} is unavailable.`);
      } else {
        setIsLoadingProfile(false);
        setProfileError("Unable to determine which profile to display.");
      }
    };
    fetchProfileData();
  }, [
    dispatch,
    isViewingOwnProfile,
    currentUserState.user,
    currentUserState.loading,
    currentUserState.isAuth,
    currentUserState.error,
    profileForOtherUser,
    routeUsername,
  ]);

  // useEffect(() => {
  //   if (socket && targetUserId) {
  //     const handleProfileUpdate = (updatedUserData) => {
  //       if (updatedUserData && updatedUserData._id === targetUserId) {
  //         toast.info(
  //           `${
  //             isViewingOwnProfile
  //               ? "Your"
  //               : (updatedUserData.fullName || "User") + "'s"
  //           } profile has been updated.`,
  //           { autoClose: 2000 }
  //         );
  //         if (isViewingOwnProfile) dispatch(getProfile());
  //         else
  //           setProfileData((prevData) => ({
  //             ...(prevData || {}),
  //             ...updatedUserData,
  //           }));
  //       }
  //     };
  //     socket.on("user_profile_updated", handleProfileUpdate);
  //     return () => socket.off("user_profile_updated", handleProfileUpdate);
  //   }
  // }, [socket, targetUserId, dispatch, isViewingOwnProfile]);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const principalBalanceDisplay = useCurrencyDisplay(profileData?.balance);
  const depositBalanceDisplay = useCurrencyDisplay(profileData?.depositBalance);
  const withdrawalBalanceDisplay = useCurrencyDisplay(
    profileData?.withdrawalBalance
  );
  const sellerAvailableBalanceDisplay = useCurrencyDisplay(
    profileData?.sellerAvailableBalance
  );
  const sellerPendingBalanceDisplay = useCurrencyDisplay(
    profileData?.sellerPendingBalance
  );

  const positiveRatings = profileData?.positiveRatings ?? 0;
  const negativeRatings = profileData?.negativeRatings ?? 0;
  const positiveFeedbackPercent = useMemo(
    () => calculatePositiveFeedbackPercent(positiveRatings, negativeRatings),
    [positiveRatings, negativeRatings]
  );
  const negativeFeedbackPercent = useMemo(
    () => calculateNegativeFeedbackPercent(positiveRatings, negativeRatings),
    [positiveRatings, negativeRatings]
  );

  const currentLevel = profileData?.level ?? 1;
  const currentPoints = profileData?.reputationPoints ?? 0;

  const pointsForCurrentLevelAbsolute = useMemo(
    () => calculateCumulativePointsForLevelFrontend(currentLevel),
    [currentLevel]
  );
  const pointsNeededForThisLevelStep = useMemo(() => {
    if (currentLevel >= MAX_LEVEL_CAP_FRONTEND) return Infinity;
    const totalForNext = calculateCumulativePointsForLevelFrontend(
      currentLevel + 1
    );
    return Math.max(0, totalForNext - pointsForCurrentLevelAbsolute);
  }, [currentLevel, pointsForCurrentLevelAbsolute]);

  const pointsProgress = useMemo(
    () => Math.max(0, currentPoints - pointsForCurrentLevelAbsolute),
    [currentPoints, pointsForCurrentLevelAbsolute]
  );

  const progressPercent = useMemo(
    () =>
      pointsNeededForThisLevelStep > 0 &&
      pointsNeededForThisLevelStep !== Infinity
        ? Math.min(
            100,
            Math.round((pointsProgress / pointsNeededForThisLevelStep) * 100)
          )
        : currentLevel >= MAX_LEVEL_CAP_FRONTEND
        ? 100
        : 0,
    [pointsProgress, pointsNeededForThisLevelStep, currentLevel]
  );

  const activeListingsCount = profileData?.activeListingsCount ?? 0;
  const soldProductsCount = profileData?.productsSoldCount ?? 0;

  const handleOpenAvatarModal = () => {
    if (!isViewingOwnProfile) return;
    setPreviewImage(
      profileData?.avatarUrl
        ? profileData.avatarUrl.startsWith("http")
          ? profileData.avatarUrl
          : `${BACKEND_URL}/${profileData.avatarUrl}`
        : "https://bootdey.com/img/Content/avatar/avatar7.png"
    );
    setSelectedFile(null);
    setShowAvatarModal(true);
  };
  const handleCloseAvatarModal = () => {
    setShowAvatarModal(false);
    setPreviewImage(null);
    setSelectedFile(null);
  };
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Max 2MB.");
        return;
      }
      if (
        !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
          file.type
        )
      ) {
        toast.error("JPG, PNG, GIF, WEBP only.");
        return;
      }
      setSelectedFile(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };
  const handleUploadAvatar = () => {
    if (!isViewingOwnProfile || !selectedFile) return;
    const formData = new FormData();
    formData.append("avatar", selectedFile);
    dispatch(updateProfilePicture(formData))
      .then((res) => !res?.error && handleCloseAvatarModal())
      .catch((err) => console.error("Avatar upload err", err));
  };
  const avatarSrc = useMemo(() => {
    if (profileData?.avatarUrl)
      return profileData.avatarUrl.startsWith("http")
        ? profileData.avatarUrl
        : `${BACKEND_URL}/${profileData.avatarUrl}`;
    return "https://bootdey.com/img/Content/avatar/avatar7.png";
  }, [profileData?.avatarUrl]);

  const ReputationBadgeDisplay = ({ reputationLevelName, numericLevel }) => {
    // Use reputationLevelName from DB if available, otherwise determine from numericLevel
    const actualBadgeName =
      reputationLevelName ||
      determineReputationBadgeFrontend(numericLevel).name;
    const badgeDetails = determineReputationBadgeFrontend(numericLevel); // Still useful for icon & fallback color

    let iconToUse = badgeDetails.IconComponent ? (
      <badgeDetails.IconComponent />
    ) : (
      <FaQuestionCircle />
    );
    let finalBadgeClasses = "profile-badge-default";
    let iconColorToUse = badgeDetails.color || "#6c757d"; // Fallback color

    // Override based on the actualBadgeName (which might come from DB)
    switch (String(actualBadgeName).toLowerCase()) {
      case "novice":
        iconToUse = <FaStar />;
        finalBadgeClasses = "profile-badge-novice";
        iconColorToUse = "#6C757D";
        break;
      case "bronze":
        iconToUse = <FaAward />;
        finalBadgeClasses = "profile-badge-bronze";
        iconColorToUse = "#8c531b";
        break;
      case "silver":
        iconToUse = <FaMedal />;
        finalBadgeClasses = "profile-badge-silver";
        iconColorToUse = "#505050";
        break;
      case "gold":
        iconToUse = <FaTrophy />;
        finalBadgeClasses = "profile-badge-gold";
        iconColorToUse = "#a16c00";
        break;
      case "platinum":
        iconToUse = <FaShieldAlt />;
        finalBadgeClasses = "profile-badge-platinum";
        iconColorToUse = "#3e5660";
        break;
      case "diamond":
        iconToUse = <FaGem />;
        finalBadgeClasses = "profile-badge-diamond";
        iconColorToUse = "#1a6a73";
        break;
      case "master":
        iconToUse = <FaCrown />;
        finalBadgeClasses = "profile-badge-master";
        iconColorToUse = "#790079";
        break;
      case "grandmaster":
        iconToUse = (
          <FaCrown style={{ filter: "hue-rotate(280deg) saturate(1.5)" }} />
        );
        finalBadgeClasses = "profile-badge-grandmaster";
        iconColorToUse = "#d43a00";
        break;
      case "legend":
        iconToUse = <FaDragon />;
        finalBadgeClasses = "profile-badge-legend";
        iconColorToUse = "#b87300";
        break;
      case "mythic":
        iconToUse = <FaSkullCrossbones />;
        finalBadgeClasses = "profile-badge-mythic";
        iconColorToUse = "#3a0068";
        break;
      default:
        iconToUse = <FaQuestionCircle />;
        finalBadgeClasses = "profile-badge-info";
        iconColorToUse = "white"; // Default if unexpected name
    }

    const styledIcon = React.cloneElement(iconToUse, {
      style: {
        ...iconToUse.props.style,
        color: iconColorToUse,
        fontSize: "1em",
      },
      className: "me-1",
    });

    return (
      <div
        className={`d-inline-flex align-items-center reputation-badge ${finalBadgeClasses} px-3 py-1 mt-2 shadow-sm`}
      >
        <span>{styledIcon}</span>
        <span className="ms-1 badge-text">{actualBadgeName}</span>
      </div>
    );
  };

  const renderLevelSection = () => {
    if (!profileData) return null;
    const numericLevel = profileData.level || 1;
    const nextNumericLevel = numericLevel + 1;
    const rewardForNextLevelInfo =
      calculateRewardForLevelFrontend(nextNumericLevel);
    const nextLevelRewardText =
      numericLevel >= MAX_LEVEL_CAP_FRONTEND
        ? "Max Level Reached!"
        : rewardForNextLevelInfo.amount > 0
        ? `${rewardForNextLevelInfo.amount} ${rewardForNextLevelInfo.currency}`
        : "Next Perk";
    const hasClaimedRewardForNextLevelTarget = (
      profileData.claimedLevelRewards || []
    ).includes(nextNumericLevel);
    let rewardIconToShow = <FaGift className="text-warning me-1" />;
    if (
      rewardForNextLevelInfo.amount > 0 &&
      hasClaimedRewardForNextLevelTarget
    ) {
      rewardIconToShow = (
        <FaGift
          className="text-muted me-1"
          title={`Reward for Level ${nextNumericLevel} already claimed`}
        />
      );
    }
    let levelBackgroundClass = "level-bg-default";
    if (numericLevel >= 10) levelBackgroundClass = "level-bg-high";
    else if (numericLevel >= 7) levelBackgroundClass = "level-bg-advanced";
    else if (numericLevel >= 4) levelBackgroundClass = "level-bg-intermediate";
    else if (numericLevel >= 2) levelBackgroundClass = "level-bg-beginner";

    return (
      <div
        className={`level-section-widget-v2 mt-3 ${levelBackgroundClass}`}
        onClick={handleOpenLevelsModal}
        style={{ cursor: "pointer" }}
        title="Click to see all levels and rewards"
      >
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Badge bg={null} className="level-badge-main me-2 px-2 py-1">
            <FaStar className="me-1" /> Level {numericLevel}
          </Badge>
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip>Total Reputation Points</Tooltip>}
          >
            <span className="reputation-points">{currentPoints} pts</span>
          </OverlayTrigger>
        </div>
        {numericLevel < MAX_LEVEL_CAP_FRONTEND ? (
          <>
            <ProgressBar
              className="level-progress-bar-v2 mb-1"
              style={{ height: "12px" }}
            >
              <ProgressBar
                now={progressPercent}
                label={`${progressPercent}%`}
              />
            </ProgressBar>
            <div className="d-flex justify-content-between align-items-center small progress-labels">
              <span>
                {pointsProgress} / {pointsNeededForThisLevelStep} pts to Level
                {nextNumericLevel}
              </span>
              <OverlayTrigger
                placement="top"
                overlay={
                  <Tooltip>
                    Reward for reaching Level {nextNumericLevel}
                  </Tooltip>
                }
              >
                <span className="next-reward">
                  {rewardIconToShow} {nextLevelRewardText}
                </span>
              </OverlayTrigger>
            </div>
          </>
        ) : (
          <div className="text-center text-success small mt-3">
            <FaCheckCircle className="me-1" /> Max Level Reached!
          </div>
        )}
      </div>
    );
  };

  if (isLoadingProfile && !profileData)
    return (
      <Container
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "calc(100vh - 100px)" }}
      >
        <Spinner
          animation="border"
          variant="primary"
          style={{ width: "3rem", height: "3rem" }}
        />
        <p className="ms-3 fs-5">Loading profile...</p>
      </Container>
    );
  if (profileError || !profileData)
    return (
      <Container className="py-5">
        <Alert
          variant={profileError ? "danger" : "warning"}
          className="text-center fs-5"
        >
          {profileError || "Profile data is unavailable."}
        </Alert>
        {isViewingOwnProfile &&
          !currentUserState.isAuth &&
          !currentUserState.loading && (
            <Link
              to="/login"
              className="btn btn-primary d-block mx-auto mt-3 fs-5"
            >
              Login
            </Link>
          )}
        {isViewingOwnProfile &&
          currentUserState.error &&
          currentUserState.isAuth && (
            <Button
              onClick={() => dispatch(getProfile())}
              variant="primary"
              className="d-block mx-auto mt-3 fs-5"
            >
              Retry
            </Button>
          )}
      </Container>
    );

  return (
    <Container fluid className="profile-page-professional py-4 px-md-4">
      <Row>
        <Col lg={4} className="mb-4">
          <Card className="h-100 shadow-sm border-0 profile-widget">
            <Card.Body className="p-4 text-center d-flex flex-column">
              <div
                className={`profile-avatar-container position-relative mx-auto mb-3 ${
                  isViewingOwnProfile ? "editable-avatar" : ""
                }`}
                style={{ width: 120, height: 120 }}
                onClick={
                  isViewingOwnProfile ? handleOpenAvatarModal : undefined
                }
                title={isViewingOwnProfile ? "Click to change avatar" : ""}
              >
                <Image
                  src={avatarSrc}
                  roundedCircle
                  width={120}
                  height={120}
                  className="profile-avatar-lg"
                  alt={`${profileData.fullName || "User"}'s avatar`}
                />
                {isViewingOwnProfile && (
                  <div className="profile-avatar-overlay rounded-circle d-flex justify-content-center align-items-center">
                    <FaCamera size={24} color="white" />
                  </div>
                )}
              </div>
              <h3 className="profile-name-lg mb-1">
                {profileData.fullName || "N/A"}
              </h3>
              <p className="text-muted mb-2">{profileData.email}</p>
              <p className="text-muted small mb-3">
                <MapPin size={14} className="me-1" />
                {profileData.address || "Location not set"}
              </p>
              <div className="mb-1">
                <Badge
                  pill
                  bg={profileData.blocked ? "danger" : "success"}
                  className="status-badge-lg me-2 px-2 py-1"
                >
                  {profileData.blocked ? (
                    <XCircle size={14} className="me-1" />
                  ) : (
                    <FaCheckCircle size={14} className="me-1" />
                  )}
                  {profileData.blocked ? "Blocked" : "Active"}
                </Badge>
                <Badge
                  pill
                  bg="primary"
                  className="role-badge-lg me-2 px-2 py-1"
                >
                  <FaUserShield size={14} className="me-1" />
                  {profileData.userRole}
                </Badge>
              </div>
              {/* تمرير profileData.reputationLevel مباشرة */}
              <ReputationBadgeDisplay
                reputationLevelName={profileData.reputationLevel}
                numericLevel={profileData.level}
              />
              {profileData.isMediatorQualified && (
                <Badge
                  pill
                  bg="warning"
                  text="dark"
                  className="mediator-badge-lg mt-2 px-2 py-1 d-inline-block"
                  style={{ maxWidth: "fit-content" }}
                >
                  <Briefcase size={14} className="me-1" /> Mediator
                </Badge>
              )}
              <div className="mt-auto w-100">{renderLevelSection()}</div>
            </Card.Body>
            {positiveRatings > 0 || negativeRatings > 0 ? (
              <Card.Footer className="bg-light p-3 border-top">
                <h6 className="text-muted small mb-2 text-center">
                  User Rating
                </h6>
                <div className="d-flex justify-content-around align-items-center mb-2">
                  <div className="text-success small">
                    <FeatherThumbsUp size={16} className="me-1" />
                    {positiveRatings}
                  </div>
                  <div className="text-danger small">
                    <FeatherThumbsDown size={16} className="me-1" />
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
                  {negativeRatings > 0 && (
                    <ProgressBar
                      variant="danger"
                      now={negativeFeedbackPercent}
                      key={2}
                      label={
                        negativeFeedbackPercent > 0
                          ? `${negativeFeedbackPercent}%`
                          : ""
                      }
                    />
                  )}
                </ProgressBar>
              </Card.Footer>
            ) : (
              <Card.Footer className="bg-light p-3 border-top text-center text-muted small">
                No ratings yet.
              </Card.Footer>
            )}
          </Card>
        </Col>
        <Col lg={8}>
          <Card className="shadow-sm border-0 mb-4">
            <Card.Header className="bg-white p-3 border-0 d-flex justify-content-between align-items-center">
              <h5 className="mb-0 section-title-modern">
                <IoWalletOutline className="me-2 text-primary" /> Account
                Balances
              </h5>
              {isViewingOwnProfile && <CurrencySwitcher size="sm" />}
            </Card.Header>
            <Card.Body className="p-4">
              <Row className="g-3 text-center">
                <Col sm={6} md={4} className="mb-3">
                  <div className="balance-widget">
                    <FaPiggyBank className="icon text-primary" />
                    <span className="label">Principal</span>
                    <span className="value">
                      {principalBalanceDisplay.displayValue}
                    </span>
                    <span className="approx">
                      {principalBalanceDisplay.approxValue}
                    </span>
                  </div>
                </Col>
                <Col sm={6} md={4} className="mb-3">
                  <div className="balance-widget">
                    <FaUniversity className="icon text-info" />
                    <span className="label">Deposit</span>
                    <span className="value">
                      {depositBalanceDisplay.displayValue}
                    </span>
                    <span className="approx">
                      {depositBalanceDisplay.approxValue}
                    </span>
                  </div>
                </Col>
                <Col sm={6} md={4} className="mb-3">
                  <div className="balance-widget">
                    <FaDollarSign className="icon text-danger" />
                    <span className="label">Withdrawal</span>
                    <span className="value">
                      {withdrawalBalanceDisplay.displayValue}
                    </span>
                    <span className="approx">
                      {withdrawalBalanceDisplay.approxValue}
                    </span>
                  </div>
                </Col>
                {(profileData.userRole === "Vendor" ||
                  profileData.userRole === "Admin") && (
                  <>
                    <Col sm={6} md={6} className="mb-3 mb-md-0">
                      <div className="balance-widget">
                        <FaBalanceScale className="icon text-success" />
                        <span className="label">Seller Available</span>
                        <span className="value">
                          {sellerAvailableBalanceDisplay.displayValue}
                        </span>
                        <span className="approx">
                          {sellerAvailableBalanceDisplay.approxValue}
                        </span>
                      </div>
                    </Col>
                    <Col sm={6} md={6}>
                      <div className="balance-widget">
                        <FaHourglassHalf className="icon text-warning" />
                        <span className="label">Seller On Hold</span>
                        <span className="value">
                          {sellerPendingBalanceDisplay.displayValue}
                        </span>
                        <span className="approx">
                          {sellerPendingBalanceDisplay.approxValue}
                        </span>
                      </div>
                    </Col>
                  </>
                )}
              </Row>
            </Card.Body>
          </Card>
          <Card className="shadow-sm border-0 mb-4">
            <Card.Header className="bg-white p-3 border-0">
              <h5 className="mb-0 section-title-modern">
                <BarChart2 className="me-2 text-primary" /> User Statistics
              </h5>
            </Card.Header>
            <Card.Body className="p-4">
              <Row className="g-3">
                <Col md={6} className="statistic-entry-col">
                  <div className="statistic-entry">
                    <FeatherTag size={20} className="me-2 text-info" />
                    <div>
                      <span className="stat-value">{activeListingsCount}</span>
                      <span className="stat-label">Active Listings</span>
                    </div>
                  </div>
                </Col>
                <Col md={6} className="statistic-entry-col">
                  <div className="statistic-entry">
                    <FeatherCheck size={20} className="me-2 text-success" />
                    <div>
                      <span className="stat-value">{soldProductsCount}</span>
                      <span className="stat-label">Products Sold</span>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
          {isViewingOwnProfile && !profileData?.blocked && (
            <MediatorApplication />
          )}
        </Col>
      </Row>
      {isViewingOwnProfile && (
        <Modal show={showAvatarModal} onHide={handleCloseAvatarModal} centered>
          <Modal.Header closeButton>
            <Modal.Title>Update Profile Picture</Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center">
            {previewImage && (
              <Image
                src={previewImage}
                roundedCircle
                width={180}
                height={180}
                className="mb-3 d-block mx-auto"
                alt="Avatar preview"
                onError={(e) => {
                  e.target.src =
                    "https://bootdey.com/img/Content/avatar/avatar7.png";
                }}
              />
            )}
            <Form.Group controlId="formFileModalProfile" className="mb-3">
              <Form.Label>
                Select new image (JPG, PNG, GIF, WEBP - Max 2MB)
              </Form.Label>
              <Form.Control
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
              />
            </Form.Group>
            {currentUserState.errorUpdateAvatar && (
              <Alert variant="danger" className="mt-2">
                {typeof currentUserState.errorUpdateAvatar === "string"
                  ? currentUserState.errorUpdateAvatar
                  : JSON.stringify(currentUserState.errorUpdateAvatar)}
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseAvatarModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUploadAvatar}
              disabled={!selectedFile || currentUserState.loadingUpdateAvatar}
            >
              {currentUserState.loadingUpdateAvatar ? (
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                />
              ) : (
                "Upload Picture"
              )}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
      {profileData && (
        <LevelsModal
          show={showLevelsModal}
          handleClose={handleCloseLevelsModal}
          currentUserData={profileData}
        />
      )}
    </Container>
  );
};
export default Profile;
