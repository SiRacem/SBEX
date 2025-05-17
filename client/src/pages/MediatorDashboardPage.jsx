// client/src/pages/MediatorDashboardPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Spinner,
  Alert,
  Pagination,
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
} from "../redux/actions/mediationAction";
import { Link } from "react-router-dom";
import { BsImage } from "react-icons/bs";
import RejectAssignmentModal from "../components/mediator/RejectAssignmentModal";

// Helper: Currency Formatting (Keep as is)
const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    let safeCurrencyCode = currencyCode;
    if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
        safeCurrencyCode = "TND";
    }
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: safeCurrencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    } catch (error) {
        return `${num.toFixed(2)} ${safeCurrencyCode}`;
    }
};

const noProductImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16px" fill="%23aaa">No Image</text></svg>';
const fallbackProductImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e0e0e0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16px" fill="%23999">Error</text></svg>';

const MediatorDashboardPage = () => {
  const dispatch = useDispatch();
  const {
    pendingDecisionAssignments: pendingData,
    loadingPendingDecision,
    errorPendingDecision,
    acceptedAwaitingPartiesAssignments: activeData,
    loadingAcceptedAwaitingParties: loadingActiveMediations,
    errorAcceptedAwaitingParties: errorActiveMediations,
    actionLoading,
  } = useSelector((state) => state.mediationReducer);

  const currentUser = useSelector((state) => state.userReducer.user);

  const [activeTabKey, setActiveTabKey] = useState("pendingDecision");

  const pendingDecisionAssignments = pendingData?.list || [];
  const totalPagesPending = pendingData?.totalPages || 1;
  const currentPagePendingFromState = pendingData?.currentPage || 1;
  const totalPending = pendingData?.totalCount || 0;
  const [currentPagePendingLocal, setCurrentPagePendingLocal] = useState(1); // ابدأ دائماً بالصفحة 1 محلياً

  const activeMediationsList = activeData?.list || [];
  const totalPagesActive = activeData?.totalPages || 1;
  const currentPageActiveFromState = activeData?.currentPage || 1;
  const totalActive = activeData?.totalCount || 0;
  const [currentPageActiveLocal, setCurrentPageActiveLocal] = useState(1); // ابدأ دائماً بالصفحة 1 محلياً

  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedAssignmentImages, setSelectedAssignmentImages] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedAssignmentForReject, setSelectedAssignmentForReject] =
    useState(null);
  const [processingAssignmentId, setProcessingAssignmentId] = useState(null);

  // --- MODIFIED: useEffect for fetching data based on active tab and local page ---
  useEffect(() => {
    if (currentUser && currentUser.isMediatorQualified) {
        console.log("MediatorDashboardPage: Initial data fetch triggered.");
        dispatch(getMediatorAssignments(1)); 
        dispatch(getMediatorAcceptedAwaitingPartiesAction(1)); 
    }
}, [dispatch, currentUser]);

  // -----------------------------------------------------------------------------------

  // Sync local page with Redux state if needed, but fetching directly on local page change is often simpler
  useEffect(() => {
    // If Redux current page for pending changes (e.g. from initial load or other source)
    // and it's different from local, update local. This is mostly for initialization.
    if (
      currentPagePendingFromState !== currentPagePendingLocal &&
      activeTabKey === "pendingDecision"
    ) {
      // setCurrentPagePendingLocal(currentPagePendingFromState); // This might cause a loop if not careful
    }
  }, [currentPagePendingFromState, currentPagePendingLocal, activeTabKey]);

  useEffect(() => {
    if (
      currentPageActiveFromState !== currentPageActiveLocal &&
      activeTabKey === "activeMediations"
    ) {
      // setCurrentPageActiveLocal(currentPageActiveFromState);
    }
  }, [currentPageActiveFromState, currentPageActiveLocal, activeTabKey]);

  const handleShowImageModal = useCallback((images, index = 0) => {
    /* ... */
  }, []);
  const handleCloseImageModal = useCallback(() => setShowImageModal(false), []);
  const handleImageError = useCallback((e) => {
    /* ... */
  }, []);

  const handleAccept = useCallback(
    (assignmentId) => {
      if (actionLoading && processingAssignmentId === assignmentId) return;
      setProcessingAssignmentId(assignmentId);
      dispatch(mediatorAcceptAssignmentAction(assignmentId))
        .then(() => {
          // Refetch current page of pending, and first page of active
          dispatch(getMediatorAssignments(currentPagePendingLocal));
          dispatch(getMediatorAcceptedAwaitingPartiesAction(1)); // Fetch page 1 of active as item moves
          setActiveTabKey("activeMediations");
        })
        .catch(() => {})
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
        .catch(() => {})
        .finally(() => setProcessingAssignmentId(null));
    },
    [dispatch, actionLoading, currentPagePendingLocal, processingAssignmentId]
  );

  const handlePageChange = useCallback((tabKey, pageNumber) => {
    if (tabKey === "pendingDecision") {
      setCurrentPagePendingLocal(pageNumber);
    } else if (tabKey === "activeMediations") {
      setCurrentPageActiveLocal(pageNumber);
    }
  }, []);

  const renderAssignmentCard = useCallback(
    (assignment, isPendingDecisionTab = false) => {
      // ... (نفس الكود الممتاز الذي قدمته لـ renderAssignmentCard، مع Alert لـ InProgress) ...
      if (!assignment || !assignment.product)
        return <Alert variant="danger">Error displaying assignment.</Alert>;
      const productImages = assignment.product.imageUrls;
      const isCurrentlyProcessing =
        processingAssignmentId === assignment._id && actionLoading;
      let statusBadgeBg = "secondary";
      let statusText = assignment.status;
      switch (assignment.status) {
        case "MediatorAssigned":
          statusBadgeBg = "warning text-dark";
          break;
        case "MediationOfferAccepted":
          statusBadgeBg = "info text-dark";
          statusText = "Awaiting Parties";
          break;
        case "EscrowFunded":
          statusBadgeBg = "primary";
          statusText = "Buyer Confirmed";
          break;
        case "PartiesConfirmed":
          statusBadgeBg = "info";
          statusText = "Parties Confirmed";
          break;
        case "InProgress":
          statusBadgeBg = "success";
          statusText = "In Progress";
          break;
        default:
          break;
      }
      return (
        <Card key={assignment._id} className="mb-3 shadow-sm">
          <Card.Header as="h5">
            Product: {assignment.product.title || "N/A"}
          </Card.Header>
          <Card.Body>
            <Row>
              <Col
                md={3}
                className="text-center mb-2 mb-md-0 position-relative"
              >
                <Image
                  src={productImages?.[0] || noProductImageUrl}
                  alt={assignment.product.title || "Product Image"}
                  style={{
                    width: "100%",
                    height: "120px",
                    objectFit: "contain",
                    cursor: productImages?.length ? "pointer" : "default",
                  }}
                  className="rounded"
                  onError={handleImageError}
                  onClick={() =>
                    productImages?.length &&
                    handleShowImageModal(productImages, 0)
                  }
                />
                {productImages?.length && (
                  <Button
                    variant="dark"
                    size="sm"
                    onClick={() => handleShowImageModal(productImages, 0)}
                    className="position-absolute bottom-0 start-50 translate-middle-x mb-2"
                    style={{
                      opacity: 0.8,
                      fontSize: "0.8rem",
                      padding: "0.2rem 0.5rem",
                    }}
                  >
                    <BsImage /> View Gallery ({productImages.length})
                  </Button>
                )}
              </Col>
              <Col md={9}>
                <Card.Text as="div">
                  <strong>Transaction ID:</strong> {assignment._id} <br />
                  <strong>Seller:</strong>{" "}
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
                  <br />
                  <strong>Buyer:</strong>{" "}
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
                  <br />
                  <strong>Agreed Price:</strong>{" "}
                  {formatCurrency(assignment.bidAmount, assignment.bidCurrency)}
                  <br />
                  <strong>Status:</strong>{" "}
                  <Badge bg={statusBadgeBg}>{statusText}</Badge>
                  <br />
                  <strong>Assigned/Updated On:</strong>{" "}
                  {new Date(
                    assignment.updatedAt || assignment.createdAt
                  ).toLocaleDateString()}{" "}
                  At{" "}
                  {new Date(
                    assignment.updatedAt || assignment.createdAt
                  ).toLocaleTimeString()}
                </Card.Text>
                {isPendingDecisionTab && (
                  <div className="mt-3">
                    <Button
                      variant="success"
                      className="me-2 mb-2 mb-md-0"
                      onClick={() => handleAccept(assignment._id)}
                      disabled={isCurrentlyProcessing || actionLoading}
                    >
                      {isCurrentlyProcessing ? (
                        <Spinner as="span" animation="border" size="sm" />
                      ) : (
                        "Accept Assignment"
                      )}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => openRejectModal(assignment)}
                      disabled={isCurrentlyProcessing || actionLoading}
                    >
                      {isCurrentlyProcessing &&
                      selectedAssignmentForReject?._id === assignment._id ? (
                        <Spinner as="span" animation="border" size="sm" />
                      ) : (
                        "Reject Assignment"
                      )}
                    </Button>
                  </div>
                )}
                {!isPendingDecisionTab && (
                  <>
                    {assignment.status === "MediationOfferAccepted" && (
                      <Alert variant="info" className="mt-3 small p-2">
                        You accepted. Waiting for parties to confirm.
                      </Alert>
                    )}
                    {assignment.status === "EscrowFunded" && (
                      <Alert variant="primary" className="mt-3 small p-2">
                        Buyer confirmed & escrowed. Waiting for seller.
                      </Alert>
                    )}
                    {assignment.status === "PartiesConfirmed" && (
                      <Alert variant="info" className="mt-3 small p-2">
                        Parties confirmed. Chat will start soon.
                      </Alert>
                    )}
                    {assignment.status === "InProgress" && (
                      <Alert variant="success" className="mt-3 small p-2">
                        Mediation in progress.{" "}
                        <Button
                          className="mt-1 ms-2"
                          size="sm"
                          as={Link}
                          to={`/dashboard/mediation-chat/${assignment._id}`}
                        >
                          Open Chat
                        </Button>
                      </Alert>
                    )}
                  </>
                )}
              </Col>
            </Row>
          </Card.Body>
        </Card>
      );
    },
    [
      actionLoading,
      handleAccept,
      openRejectModal,
      handleShowImageModal,
      handleImageError,
      selectedAssignmentForReject,
      processingAssignmentId,
    ]
  );

  if (!currentUser)
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p>Loading user data...</p>
      </Container>
    );
  if (!currentUser.isMediatorQualified)
    return (
      <Container className="py-5 text-center">
        <Alert variant="danger">Access Denied.</Alert>
        <Link to="/">Homepage</Link>
      </Container>
    );

  return (
    <Container className="py-4 mediator-dashboard-page">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2>My Mediation Dashboard</h2>
        </Col>
      </Row>
      <Tabs
        activeKey={activeTabKey}
        onSelect={(k) => setActiveTabKey(k || "pendingDecision")}
        id="mediator-dashboard-tabs"
        className="mb-3"
        fill
      >
        <Tab
          eventKey="pendingDecision"
          title={
            <>
              Pending My Decision{" "}
              <Badge bg="warning" text="dark" pill>
                {totalPending}
              </Badge>
            </>
          }
        >
          {loadingPendingDecision &&
            pendingDecisionAssignments.length === 0 && (
              <div className="text-center my-5">
                <Spinner />
                <p>Loading...</p>
              </div>
            )}
          {errorPendingDecision && !loadingPendingDecision && (
            <Alert variant="danger">{errorPendingDecision}</Alert>
          )}
          {!loadingPendingDecision &&
            pendingDecisionAssignments.length === 0 &&
            !errorPendingDecision && (
              <Alert variant="info">
                No assignments pending your decision.
              </Alert>
            )}
          {pendingDecisionAssignments.map((assignment) =>
            renderAssignmentCard(assignment, true)
          )}
          {totalPagesPending > 1 && (
            <Pagination className="justify-content-center mt-4">
              {[...Array(totalPagesPending).keys()].map((num) => (
                <Pagination.Item
                  key={num + 1}
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
              Active Mediations{" "}
              <Badge bg="info" text="dark" pill>
                {totalActive}
              </Badge>
            </>
          }
        >
          {loadingActiveMediations && activeMediationsList.length === 0 && (
            <div className="text-center my-5">
              <Spinner />
              <p>Loading...</p>
            </div>
          )}
          {errorActiveMediations && !loadingActiveMediations && (
            <Alert variant="danger">{errorActiveMediations}</Alert>
          )}
          {!loadingActiveMediations &&
            activeMediationsList.length === 0 &&
            !errorActiveMediations && (
              <Alert variant="info">No active mediations.</Alert>
            )}
          {console.log(
            "[MediatorDashboardPage] Rendering 'Active Mediations' Tab. Data from Redux:",
            activeMediationsList
          )}
          {activeMediationsList.map((assignment) =>
            renderAssignmentCard(assignment, false)
          )}
          {totalPagesActive > 1 && (
            <Pagination className="justify-content-center mt-4">
              {[...Array(totalPagesActive).keys()].map((num) => (
                <Pagination.Item
                  key={num + 1}
                  active={num + 1 === currentPageActiveLocal}
                  onClick={() => handlePageChange("activeMediations", num + 1)}
                  disabled={loadingActiveMediations}
                >
                  {num + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          )}
        </Tab>
      </Tabs>

      {/* Modals (Image and Reject) */}
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
                    src={imgUrl || fallbackProductImageUrl}
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
              Image not available.
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
