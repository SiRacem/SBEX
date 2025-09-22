// client/src/pages/MediatorDashboardPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Spinner,
  Alert,
  Pagination, // تم التأكد من استيراده
  Image,
  Modal,
  Carousel,
  Tabs,
  Tab,
  Badge,
} from "react-bootstrap";
import {
  getMediatorAssignments,
  mediatorAcceptAssignmentAction,
  mediatorRejectAssignmentAction,
  getMediatorAcceptedAwaitingPartiesAction,
  getMediatorDisputedCasesAction,
} from "../redux/actions/mediationAction";
import { Link } from "react-router-dom";
import { BsImage, BsChatDotsFill } from "react-icons/bs";
import RejectAssignmentModal from "../components/mediator/RejectAssignmentModal";
import {
  FaExclamationTriangle,
  FaGavel,
  FaCheck,
  FaTimes,
  FaHourglassHalf,
} from "react-icons/fa";
import "./MediatorDashboardPage.css";
import { useTranslation } from "react-i18next";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
    safeCurrencyCode = "TND";
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch (error) {
    console.warn(`Currency formatting error for ${safeCurrencyCode}:`, error);
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};

const noProductImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16px" fill="%23aaa">No Image</text></svg>';
const fallbackProductImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e0e0e0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16px" fill="%23999">Error</text></svg>';

const MediatorDashboardPage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const {
    pendingDecisionAssignments: pendingData,
    loadingPendingDecision,
    errorPendingDecision,
    acceptedAwaitingPartiesAssignments: activeData,
    loadingAcceptedAwaitingParties,
    errorAcceptedAwaitingParties,
    actionLoading,
    disputedCases: disputedData,
    loadingDisputedCases,
    errorDisputedCases,
  } = useSelector((state) => state.mediationReducer);

  const currentUser = useSelector((state) => state.userReducer.user);
  const [activeTabKey, setActiveTabKey] = useState("pendingDecision");

  const pendingDecisionAssignments = useMemo(
    () => pendingData?.list || [],
    [pendingData]
  );
  const totalPagesPending = useMemo(
    () => pendingData?.totalPages || 1,
    [pendingData]
  );
  const totalPending = useMemo(
    () => pendingData?.totalCount || 0,
    [pendingData]
  );
  const [currentPagePendingLocal, setCurrentPagePendingLocal] = useState(1);

  const activeMediationsList = useMemo(
    () => activeData?.list || [],
    [activeData]
  );
  const totalPagesActive = useMemo(
    () => activeData?.totalPages || 1,
    [activeData]
  );
  const totalActive = useMemo(() => activeData?.totalCount || 0, [activeData]);
  const [currentPageActiveLocal, setCurrentPageActiveLocal] = useState(1);

  const disputedCasesList = useMemo(
    () => disputedData?.list || [],
    [disputedData]
  );
  const totalPagesDisputed = useMemo(
    () => disputedData?.totalPages || 1,
    [disputedData]
  );
  const totalDisputed = useMemo(
    () => disputedData?.totalCount || 0,
    [disputedData]
  );
  const [currentPageDisputedLocal, setCurrentPageDisputedLocal] = useState(1);

  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedAssignmentImages, setSelectedAssignmentImages] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedAssignmentForReject, setSelectedAssignmentForReject] =
    useState(null);
  const [processingAssignmentId, setProcessingAssignmentId] = useState(null);

  useEffect(() => {
    if (currentUser && currentUser.isMediatorQualified) {
      // --- [!!!] جلب بيانات جميع التبويبات عند التحميل الأول أو عند تغير المستخدم [!!!] ---
      // هذا الجزء سيعمل مرة واحدة عند تحميل المكون (أو عند تغير currentUser)
      // ويمكنك الاحتفاظ به إذا أردت تحديثًا دوريًا لجميع الأعداد.
      // أو يمكنك نقله إلى useEffect منفصل بمصفوفة اعتماديات [dispatch, currentUser] فقط.

      console.log(
        "[MediatorDashboardPage Effect] Fetching initial counts for all tabs..."
      );
      dispatch(getMediatorAssignments(1)); // جلب الصفحة الأولى دائمًا للعدد
      dispatch(getMediatorAcceptedAwaitingPartiesAction(1)); // جلب الصفحة الأولى دائمًا للعدد
      dispatch(getMediatorDisputedCasesAction(1)); // جلب الصفحة الأولى دائمًا للعدد
    }
  }, [dispatch, currentUser]); // <--- اعتماديات هذا الـ useEffect

  useEffect(() => {
    if (currentUser && currentUser.isMediatorQualified) {
      console.log(
        `[MediatorDashboardPage Effect] Fetching data for active tab: ${activeTabKey}`
      );
      if (activeTabKey === "pendingDecision") {
        dispatch(getMediatorAssignments(currentPagePendingLocal));
      } else if (activeTabKey === "activeMediations") {
        dispatch(
          getMediatorAcceptedAwaitingPartiesAction(currentPageActiveLocal)
        );
      } else if (activeTabKey === "disputedCases") {
        dispatch(getMediatorDisputedCasesAction(currentPageDisputedLocal));
      }
    }
    // الاعتماديات يجب أن تكون ما يُشغل هذا الـ Effect بشكل صحيح
    // عندما يتغير التبويب النشط، أو عندما تتغير الصفحة المحلية للتبويب النشط.
  }, [
    dispatch,
    currentUser,
    activeTabKey,
    activeTabKey === "pendingDecision" ? currentPagePendingLocal : undefined,
    activeTabKey === "activeMediations" ? currentPageActiveLocal : undefined,
    activeTabKey === "disputedCases" ? currentPageDisputedLocal : undefined,
  ]);

  const handleShowImageModal = useCallback((images, index = 0) => {
    setSelectedAssignmentImages(
      images && images.length > 0 ? images : [noProductImageUrl]
    );
    setCurrentImageIndex(index);
    setShowImageModal(true);
  }, []);

  const handleCloseImageModal = useCallback(() => setShowImageModal(false), []);

  const handleImageError = useCallback((e) => {
    if (e.target.src !== fallbackProductImageUrl) {
      e.target.onerror = null;
      e.target.src = fallbackProductImageUrl;
    }
  }, []);

  const handleAccept = useCallback(
    (assignmentId) => {
      if (actionLoading && processingAssignmentId === assignmentId) return;
      setProcessingAssignmentId(assignmentId);
      dispatch(mediatorAcceptAssignmentAction(assignmentId))
        .then(() => {
          dispatch(getMediatorAssignments(currentPagePendingLocal));
          dispatch(getMediatorAcceptedAwaitingPartiesAction(1));
          setActiveTabKey("activeMediations");
        })
        .catch((err) =>
          console.error("Error accepting assignment in component:", err)
        )
        .finally(() => setProcessingAssignmentId(null));
    },
    [dispatch, actionLoading, currentPagePendingLocal, processingAssignmentId]
  );

  const openRejectModal = useCallback((assignment) => {
    setSelectedAssignmentForReject(assignment);
    setShowRejectModal(true);
  }, []);

  const handleConfirmRejectAssignment = useCallback(
    (assignmentId, reason) => {
      if (actionLoading && processingAssignmentId === assignmentId) return;
      setProcessingAssignmentId(assignmentId);
      dispatch(mediatorRejectAssignmentAction(assignmentId, reason))
        .then(() => {
          setShowRejectModal(false);
          setSelectedAssignmentForReject(null);
          dispatch(getMediatorAssignments(currentPagePendingLocal));
        })
        .catch((err) =>
          console.error("Error rejecting assignment in component:", err)
        )
        .finally(() => setProcessingAssignmentId(null));
    },
    [dispatch, actionLoading, currentPagePendingLocal, processingAssignmentId]
  );

  const handlePageChange = useCallback((tabKey, pageNumber) => {
    if (tabKey === "pendingDecision") {
      setCurrentPagePendingLocal(pageNumber);
    } else if (tabKey === "activeMediations") {
      setCurrentPageActiveLocal(pageNumber);
    } else if (tabKey === "disputedCases") {
      setCurrentPageDisputedLocal(pageNumber);
    }
  }, []);

  const renderAssignmentCard = useCallback(
    (assignment, isPendingDecisionTab = false, isDisputedTab = false) => {
      if (!assignment || !assignment.product) {
        console.warn(
          "RenderAssignmentCard: Invalid assignment data provided.",
          assignment
        );
        return (
          <Alert variant="warning" className="my-3">
            {t(
              "mediatorDashboard.incompleteData",
              "Assignment data is incomplete."
            )}
          </Alert>
        );
      }

      let statusBadgeBg = "secondary";
      let statusText = assignment.status
        ? assignment.status.replace(/([A-Z])/g, " $1").trim()
        : t("mediatorDashboard.unknown", "Unknown");
      const currentStatus = assignment.status;

      if (currentStatus === "Disputed") {
        statusBadgeBg = "danger";
        statusText = t("mediatorDashboard.disputeActive", "Dispute Active");
      } else {
        switch (currentStatus) {
          case "MediatorAssigned":
            statusBadgeBg = "warning";
            statusText = t(
              "mediatorDashboard.pendingDecision",
              "Pending Your Decision"
            );
            break;
          case "MediationOfferAccepted":
            statusBadgeBg = "info";
            statusText = t(
              "mediatorDashboard.awaitingParties",
              "Awaiting Parties' Confirmation"
            );
            break;
          case "EscrowFunded":
            statusBadgeBg = "primary";
            statusText = t(
              "mediatorDashboard.buyerConfirmed",
              "Buyer Confirmed & Escrowed"
            );
            break;
          case "PartiesConfirmed":
            statusBadgeBg = "info";
            statusText = t(
              "mediatorDashboard.allPartiesConfirmed",
              "All Parties Confirmed"
            );
            break;
          case "InProgress":
            statusBadgeBg = "success";
            statusText = t(
              "mediatorDashboard.inProgress",
              "Mediation In Progress"
            );
            break;
          default:
            break;
        }
      }

      const productImages = assignment.product.imageUrls;
      const isCurrentlyProcessing =
        processingAssignmentId === assignment._id && actionLoading;

      return (
        <Card key={assignment._id} className="mb-3 shadow-sm assignment-card">
          <Card.Header
            as="h5"
            className="d-flex justify-content-between align-items-center assignment-card-header"
          >
            <span>
              {t("mediatorDashboard.product", "Product:")}{" "}
              {assignment.product.title || "N/A"}
            </span>
            <Badge
              bg={statusBadgeBg}
              text={
                (statusBadgeBg === "warning" || statusBadgeBg === "info") &&
                !statusBadgeBg.includes("dark")
                  ? "dark"
                  : undefined
              }
            >
              {statusText}
            </Badge>
          </Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col
                md={4}
                lg={3}
                className="text-center mb-3 mb-md-0 position-relative"
              >
                <Image
                  src={
                    productImages && productImages[0]
                      ? productImages[0].startsWith("http")
                        ? productImages[0]
                        : `${BACKEND_URL}/${productImages[0]}`
                      : noProductImageUrl
                  }
                  alt={assignment.product.title || "Product Image"}
                  style={{
                    width: "100%",
                    maxHeight: "150px",
                    objectFit: "contain",
                    cursor: productImages?.length ? "pointer" : "default",
                  }}
                  className="rounded border"
                  onError={handleImageError}
                  onClick={() =>
                    productImages?.length &&
                    handleShowImageModal(productImages, 0)
                  }
                />
                {productImages && productImages.length > 1 && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => handleShowImageModal(productImages, 0)}
                    className="position-absolute bottom-0 start-50 translate-middle-x mb-2 view-gallery-btn"
                  >
                    <BsImage className="me-1" />{" "}
                    {t("mediatorDashboard.view", "View")} (
                    {productImages.length})
                  </Button>
                )}
              </Col>
              <Col md={8} lg={9}>
                <div className="assignment-details">
                  <p className="mb-1">
                    <small className="text-muted">
                      {t("mediatorDashboard.transactionId", "Transaction ID:")}
                    </small>{" "}
                    {assignment._id}
                  </p>
                  <p className="mb-1">
                    <small className="text-muted">
                      {t("mediatorDashboard.seller", "Seller:")}
                    </small>{" "}
                    {assignment.seller?.fullName ? (
                      <Link
                        to={`/profile/${assignment.seller._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {assignment.seller.fullName}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </p>
                  <p className="mb-1">
                    <small className="text-muted">
                      {t("mediatorDashboard.buyer", "Buyer:")}
                    </small>{" "}
                    {assignment.buyer?.fullName ? (
                      <Link
                        to={`/profile/${assignment.buyer._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {assignment.buyer.fullName}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </p>
                  <p className="mb-1">
                    <small className="text-muted">
                      {t("mediatorDashboard.agreedPrice", "Agreed Price:")}
                    </small>{" "}
                    <strong>
                      {formatCurrency(
                        assignment.bidAmount,
                        assignment.bidCurrency
                      )}
                    </strong>
                  </p>
                  <p className="mb-0">
                    <small className="text-muted">
                      {t("mediatorDashboard.lastUpdate", "Last Update:")}
                    </small>{" "}
                    {new Date(
                      assignment.updatedAt || assignment.createdAt
                    ).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>

                {isPendingDecisionTab && (
                  <div className="mt-3 pt-3 border-top">
                    <Button
                      variant="success"
                      className="me-2 mb-2 mb-md-0"
                      onClick={() => handleAccept(assignment._id)}
                      disabled={isCurrentlyProcessing || actionLoading}
                    >
                      {isCurrentlyProcessing &&
                      processingAssignmentId === assignment._id ? (
                        <Spinner as="span" animation="border" size="sm" />
                      ) : (
                        <FaCheck />
                      )}{" "}
                      {t("mediatorDashboard.accept", "Accept")}
                    </Button>
                    <Button
                      variant="outline-danger"
                      onClick={() => openRejectModal(assignment)}
                      disabled={isCurrentlyProcessing || actionLoading}
                    >
                      {isCurrentlyProcessing &&
                      processingAssignmentId === assignment._id &&
                      selectedAssignmentForReject?._id === assignment._id ? (
                        <Spinner as="span" animation="border" size="sm" />
                      ) : (
                        <FaTimes />
                      )}{" "}
                      {t("mediatorDashboard.reject", "Reject")}
                    </Button>
                  </div>
                )}

                {!isPendingDecisionTab && ( // For Active and Disputed Tabs
                  <div className="mt-3 pt-3 border-top">
                    {currentStatus === "MediationOfferAccepted" && (
                      <Alert variant="light" className="small p-2">
                        <FaHourglassHalf className="me-1" />
                        {t(
                          "mediatorDashboard.waitingForParties",
                          "You accepted. Waiting for parties to confirm."
                        )}
                      </Alert>
                    )}
                    {currentStatus === "EscrowFunded" && (
                      <Alert variant="light" className="small p-2">
                        <FaHourglassHalf className="me-1" />
                        {t(
                          "mediatorDashboard.waitingForSeller",
                          "Buyer confirmed & escrowed. Waiting for seller."
                        )}
                      </Alert>
                    )}
                    {currentStatus === "PartiesConfirmed" && (
                      <Alert variant="light" className="small p-2">
                        <FaCheck className="me-1" />
                        {t(
                          "mediatorDashboard.startingSoon",
                          "Parties confirmed. Chat starting soon."
                        )}
                      </Alert>
                    )}

                    {(currentStatus === "InProgress" ||
                      currentStatus === "Disputed") && (
                      <Button
                        size="sm"
                        as={Link}
                        to={`/dashboard/mediation-chat/${assignment._id}`}
                        variant={
                          currentStatus === "Disputed" ? "warning" : "primary"
                        } // أو outline-danger للنزاع
                      >
                        <BsChatDotsFill className="me-1" />
                        {currentStatus === "Disputed"
                          ? t(
                              "mediatorDashboard.reviewDispute",
                              "Review Dispute"
                            )
                          : t("mediatorDashboard.openChat", "Open Chat")}
                      </Button>
                    )}
                  </div>
                )}
              </Col>
            </Row>
          </Card.Body>
        </Card>
      );
    },
    [
      actionLoading,
      processingAssignmentId,
      selectedAssignmentForReject,
      handleAccept,
      openRejectModal,
      handleShowImageModal,
      handleImageError,
      t,
      // لا تحتاج لإضافة dispatch هنا إذا كانت الدوال أعلاه لا تستدعي dispatch مباشرةً في هذا الـ useCallback
      // وإنما dispatch يتم داخل الدوال نفسها (handleAccept, openRejectModal)
    ]
  );

  if (!currentUser)
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p>{t("mediatorDashboard.loadingUserData", "Loading user data...")}</p>
      </Container>
    );
  if (!currentUser.isMediatorQualified)
    return (
      <Container className="py-5 text-center">
        <Alert variant="danger">
          {t(
            "mediatorDashboard.accessDenied",
            "Access Denied. You are not a qualified mediator."
          )}
        </Alert>
        <Link to="/dashboard">
          {t("mediatorDashboard.goToDashboard", "Go to Dashboard")}
        </Link>
      </Container>
    );

  return (
    <Container fluid className="py-4 mediator-dashboard-page px-md-4">
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="page-title mb-0">
            {t("mediatorDashboard.title", "Mediator Hub")}
          </h2>
        </Col>
      </Row>
      <Tabs
        activeKey={activeTabKey}
        onSelect={(k) => setActiveTabKey(k || "pendingDecision")}
        id="mediator-dashboard-tabs"
        className="mb-3 nav-tabs-custom"
        fill
      >
        <Tab
          eventKey="pendingDecision"
          title={
            <>
              <FaHourglassHalf className="me-1" />{" "}
              {t("mediatorDashboard.pendingTab", "Pending My Decision")}{" "}
              <Badge bg="warning" text="dark" pill className="ms-1">
                {totalPending}
              </Badge>
            </>
          }
        >
          {loadingPendingDecision &&
            pendingDecisionAssignments.length === 0 && (
              <div className="text-center my-5">
                <Spinner />
                <p>
                  {t(
                    "mediatorDashboard.loadingPending",
                    "Loading pending assignments..."
                  )}
                </p>
              </div>
            )}
          {!loadingPendingDecision && errorPendingDecision && (
            <Alert variant="danger" className="mt-3">
              {errorPendingDecision}
            </Alert>
          )}
          {!loadingPendingDecision &&
            pendingDecisionAssignments.length === 0 &&
            !errorPendingDecision && (
              <Alert variant="light" className="text-center mt-3 py-4">
                {t(
                  "mediatorDashboard.noPending",
                  "No assignments currently pending your decision."
                )}
              </Alert>
            )}
          {pendingDecisionAssignments.map((assignment) =>
            renderAssignmentCard(assignment, true, false)
          )}
          {totalPagesPending > 1 && (
            <Pagination className="justify-content-center mt-4">
              {[...Array(totalPagesPending).keys()].map((num) => (
                <Pagination.Item
                  key={`pending-${num + 1}`}
                  active={num + 1 === currentPagePendingLocal}
                  onClick={() => handlePageChange("pendingDecision", num + 1)}
                  disabled={loadingPendingDecision}
                >
                  {num + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          )}
        </Tab>
        <Tab
          eventKey="activeMediations"
          title={
            <>
              <FaCheck className="me-1" />{" "}
              {t("mediatorDashboard.activeTab", "Active Mediations")}{" "}
              <Badge bg="primary" pill className="ms-1">
                {totalActive}
              </Badge>
            </>
          }
        >
          {loadingAcceptedAwaitingParties &&
            activeMediationsList.length === 0 && (
              <div className="text-center my-5">
                <Spinner />
                <p>
                  {t(
                    "mediatorDashboard.loadingActive",
                    "Loading active mediations..."
                  )}
                </p>
              </div>
            )}
          {!loadingAcceptedAwaitingParties && errorAcceptedAwaitingParties && (
            <Alert variant="danger" className="mt-3">
              {errorAcceptedAwaitingParties}
            </Alert>
          )}
          {!loadingAcceptedAwaitingParties &&
            activeMediationsList.length === 0 &&
            !errorAcceptedAwaitingParties && (
              <Alert variant="light" className="text-center mt-3 py-4">
                {t(
                  "mediatorDashboard.noActive",
                  "No active mediations assigned to you."
                )}
              </Alert>
            )}
          {activeMediationsList.map((assignment) =>
            renderAssignmentCard(assignment, false, false)
          )}
          {totalPagesActive > 1 && (
            <Pagination className="justify-content-center mt-4">
              {[...Array(totalPagesActive).keys()].map((num) => (
                <Pagination.Item
                  key={`active-${num + 1}`}
                  active={num + 1 === currentPageActiveLocal}
                  onClick={() => handlePageChange("activeMediations", num + 1)}
                  disabled={loadingAcceptedAwaitingParties}
                >
                  {num + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          )}
        </Tab>
        <Tab
          eventKey="disputedCases"
          title={
            <>
              <FaGavel className="me-1" />{" "}
              {t("mediatorDashboard.disputedTab", "Disputed Cases")}{" "}
              <Badge bg="danger" pill className="ms-1">
                {totalDisputed}
              </Badge>
            </>
          }
        >
          {loadingDisputedCases && disputedCasesList.length === 0 && (
            <div className="text-center my-5">
              <Spinner />
              <p>
                {t(
                  "mediatorDashboard.loadingDisputed",
                  "Loading disputed cases..."
                )}
              </p>
            </div>
          )}
          {!loadingDisputedCases && errorDisputedCases && (
            <Alert variant="danger" className="mt-3">
              {errorDisputedCases}
            </Alert>
          )}
          {!loadingDisputedCases &&
            disputedCasesList.length === 0 &&
            !errorDisputedCases && (
              <Alert variant="light" className="text-center mt-3 py-4">
                {t(
                  "mediatorDashboard.noDisputed",
                  "No disputed cases assigned to you currently."
                )}
              </Alert>
            )}
          {disputedCasesList.map((assignment) =>
            renderAssignmentCard(assignment, false, true)
          )}
          {totalPagesDisputed > 1 && (
            <Pagination className="justify-content-center mt-4">
              {[...Array(totalPagesDisputed).keys()].map((num) => (
                <Pagination.Item
                  key={`disputed-${num + 1}`}
                  active={num + 1 === currentPageDisputedLocal}
                  onClick={() => handlePageChange("disputedCases", num + 1)}
                  disabled={loadingDisputedCases}
                >
                  {num + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          )}
        </Tab>
      </Tabs>

      {/* Modals */}
      <Modal
        show={showImageModal}
        onHide={handleCloseImageModal}
        centered
        size="lg"
        dialogClassName="lightbox-modal"
      >
        <Modal.Body className="p-0 text-center bg-dark position-relative">
          {selectedAssignmentImages.length > 0 ? (
            <Carousel
              activeIndex={currentImageIndex}
              onSelect={(idx) => setCurrentImageIndex(idx)}
              interval={null}
              indicators={selectedAssignmentImages.length > 1}
              controls={selectedAssignmentImages.length > 1}
            >
              {selectedAssignmentImages.map((imgUrl, index) => (
                <Carousel.Item key={index}>
                  <Image
                    src={
                      imgUrl.startsWith("http")
                        ? imgUrl
                        : `${BACKEND_URL}/${imgUrl}` || fallbackProductImageUrl
                    }
                    fluid
                    className="lightbox-image"
                    onError={handleImageError}
                    alt={`Image ${index + 1}`}
                    style={{ maxHeight: "80vh", objectFit: "contain" }}
                  />
                </Carousel.Item>
              ))}
            </Carousel>
          ) : (
            <Alert variant="dark" className="m-5">
              {t("mediatorDashboard.imageNotAvailable", "Image not available.")}
            </Alert>
          )}
          <Button
            variant="light"
            onClick={handleCloseImageModal}
            className="position-absolute top-0 end-0 m-2"
            aria-label="Close"
            style={{ zIndex: 1056 }}
          >
            ×
          </Button>
        </Modal.Body>
      </Modal>
      {selectedAssignmentForReject && (
        <RejectAssignmentModal
          show={showRejectModal}
          onHide={() => {
            setShowRejectModal(false);
            setSelectedAssignmentForReject(null);
          }}
          assignment={selectedAssignmentForReject}
          onConfirmReject={handleConfirmRejectAssignment}
          loading={
            actionLoading &&
            processingAssignmentId === selectedAssignmentForReject?._id
          }
        />
      )}
    </Container>
  );
};

export default MediatorDashboardPage;