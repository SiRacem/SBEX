// src/components/commun/Profile.jsx
import React, { useEffect, useMemo, useState } from "react";
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
import { Link } from "react-router-dom";
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

// --- Helper Functions (Keep them as they were) ---
const calculatePositiveFeedbackPercent = (positive, negative) => {
  const total = positive + negative;
  if (total === 0) return 0;
  return Math.round((positive / total) * 100);
};

const pointsForNextLevel = (currentLevel) => {
  if (currentLevel < 1) return 10;
  return ((currentLevel * (currentLevel + 1)) / 2) * 10;
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
// --- End Helper Functions ---

// --- Define Backend URL ---
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const Profile = () => {
  const dispatch = useDispatch();
  const { user, loading, isAuth, errorUpdateAvatar, loadingUpdateAvatar } =
    useSelector((state) => state.userReducer);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const principalBalanceDisplay = useCurrencyDisplay(user?.balance);
  const depositBalanceDisplay = useCurrencyDisplay(user?.depositBalance);
  const withdrawalBalanceDisplay = useCurrencyDisplay(user?.withdrawalBalance);
  const sellerAvailableBalanceDisplay = useCurrencyDisplay(
    user?.sellerAvailableBalance
  );
  const sellerPendingBalanceDisplay = useCurrencyDisplay(
    user?.sellerPendingBalance
  );

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
  );
  const progressPercent = useMemo(
    () =>
      nextLevelPoints > 0
        ? Math.min(100, Math.round((pointsProgress / nextLevelPoints) * 100))
        : 0,
    [pointsProgress, nextLevelPoints]
  );
  const approvedProductsCount = user?.approvedProducts ?? 0;
  const soldProductsCount = user?.productsSoldCount ?? 0;

  useEffect(() => {
    if (isAuth && !user && !loading) {
      dispatch(getProfile());
    }
  }, [dispatch, isAuth, user, loading]);

  const handleOpenAvatarModal = () => {
    setPreviewImage(
      user?.avatarUrl
        ? `${BACKEND_URL}/${user.avatarUrl}`
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
        toast.error("File is too large. Maximum size is 2MB.");
        return;
      }
      if (
        !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
          file.type
        )
      ) {
        toast.error(
          "Invalid file type. Please upload a JPG, PNG, GIF or WEBP image."
        );
        return;
      }
      setSelectedFile(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const handleUploadAvatar = () => {
    if (selectedFile) {
      const formData = new FormData();
      formData.append("avatar", selectedFile);
      dispatch(updateProfilePicture(formData))
        .then((actionResponse) => {
          // Check if the action was successful (no error in payload or not rejected)
          // The action itself now returns a promise, so we can check its resolution.
          if (actionResponse && !actionResponse.error) {
            // Assuming action returns { error: ... } on failure
            handleCloseAvatarModal();
            // getProfile is dispatched within updateProfilePicture action on success
          }
        })
        .catch((error) => {
          // Errors are handled by toast in the action, but you can add more here if needed
          console.error("Avatar upload failed in component:", error);
        });
    } else {
      toast.info("Please select an image file first.");
    }
  };

  const avatarSrc = useMemo(() => {
    if (user?.avatarUrl) {
      if (user.avatarUrl.startsWith("http")) {
        return user.avatarUrl;
      }
      return `${BACKEND_URL}/${user.avatarUrl}`;
    }
    return "https://bootdey.com/img/Content/avatar/avatar7.png";
  }, [user?.avatarUrl]);

  if (loading && !user)
    return (
      <Container className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  if (!isAuth || !user)
    return (
      <Container className="py-5">
        <Alert variant="warning" className="text-center">
          Please <Link to="/login">login</Link> to view your profile.
        </Alert>
      </Container>
    );

  const renderLevelSection = () => {
    const nextLevelReward =
      currentLevel === 1
        ? "2 TND"
        : currentLevel === 2
        ? "5 TND"
        : currentLevel === 3
        ? "Mediator Badge"
        : "Exclusive Offer";
    const isMaxLevel = nextLevelPoints <= 0 || currentLevel >= 10;

    return (
      <div className="level-section-widget-v2 mt-4">
        <div className="level-info mb-2">
          <Badge bg="info" className="level-badge-main me-2">
            <FaStar className="me-1" />
            Level {currentLevel}
          </Badge>
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip id="tooltip-reputation">
                Reputation points earned...
              </Tooltip>
            }
          >
            <span className="reputation-points">{currentPoints} pts</span>
          </OverlayTrigger>
        </div>
        {!isMaxLevel ? (
          <>
            <ProgressBar
              className="level-progress-bar-v2 mb-1"
              style={{ height: "12px" }}
            >
              <ProgressBar variant="info" now={progressPercent} />
            </ProgressBar>
            <div className="d-flex justify-content-between align-items-center small text-muted progress-labels">
              <span>
                {pointsProgress} / {nextLevelPoints} pts
              </span>
              <OverlayTrigger
                placement="top"
                overlay={
                  <Tooltip id="tooltip-reward">
                    Reward for reaching Level {currentLevel + 1}
                  </Tooltip>
                }
              >
                <span className="next-reward">
                  <FaGift className="text-warning me-1" /> {nextLevelReward}
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

  return (
    <Container fluid className="profile-page-professional py-4 px-md-4">
      <Row>
        <Col lg={4} className="mb-4">
          <Card className="h-100 shadow-sm border-0 profile-widget">
            <Card.Body className="p-4 text-center">
              <div
                className="profile-avatar-container position-relative mx-auto mb-3"
                style={{ width: 120, height: 120 }}
                onClick={handleOpenAvatarModal}
              >
                <Image
                  src={avatarSrc}
                  roundedCircle
                  width={120}
                  height={120}
                  className="profile-avatar-lg"
                  alt={`${user.fullName || "User"}'s avatar`}
                />
                <div className="profile-avatar-overlay rounded-circle d-flex justify-content-center align-items-center">
                  <FaCamera size={24} color="white" />
                </div>
              </div>
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
                    <FaCheckCircle size={14} className="me-1" />
                  )}
                  {user.blocked ? "Blocked" : "Active"}
                </Badge>
                <Badge pill bg="primary" className="role-badge-lg me-2">
                  <FaUserShield size={14} className="me-1" />
                  {user.userRole}
                </Badge>
                {user.isMediatorQualified && (
                  <Badge
                    pill
                    bg="warning"
                    text="dark"
                    className="mediator-badge-lg mb-1"
                  >
                    <Briefcase size={16} className="me-1" /> Mediator
                  </Badge>
                )}
              </div>
              {renderLevelSection()}
            </Card.Body>
            {positiveRatings > 0 || negativeRatings > 0 ? (
              <Card.Footer className="bg-light p-3 border-0">
                <h6 className="text-muted small mb-2 text-center">
                  Seller Rating
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
        <Col lg={8}>
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
                {(user.userRole === "Vendor" || user.userRole === "Admin") && (
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
                      <span className="stat-value">
                        {approvedProductsCount}
                      </span>
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
          {!user.blocked && <MediatorApplication />}
        </Col>
      </Row>

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
          <Form.Group controlId="formFile" className="mb-3">
            <Form.Label>
              Select new image (JPG, PNG, GIF, WEBP - Max 2MB)
            </Form.Label>
            <Form.Control
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
            />
          </Form.Group>
          {errorUpdateAvatar && (
            <Alert variant="danger" className="mt-2">
              {typeof errorUpdateAvatar === "string"
                ? errorUpdateAvatar
                : JSON.stringify(errorUpdateAvatar)}
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
            disabled={!selectedFile || loadingUpdateAvatar}
          >
            {loadingUpdateAvatar ? (
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
    </Container>
  );
};

export default Profile;
