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
import { toast } from "react-toastify";
import { BsImage } from "react-icons/bs";
import RejectAssignmentModal from "../components/mediator/RejectAssignmentModal";

const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
    safeCurrencyCode = "TND";
  }
  try {
    return num.toLocaleString("fr-TN", {
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  } catch (error) {
    return `${num.toFixed(3)} ${safeCurrencyCode}`;
  }
};

const noProductImageUrl =
  "data:image/svg+xml;charset=UTF8,<svg...>?</text></svg>";
const fallbackProductImageUrl =
  "data:image/svg+xml;charset=UTF8,<svg...>Error</text></svg>";

const MediatorDashboardPage = () => {
  const dispatch = useDispatch();
  const mediationState = useSelector((state) => state.mediationReducer);
  const currentUser = useSelector((state) => state.userReducer.user);

  const [activeTabKey, setActiveTabKey] = useState("pendingDecision");

  const pendingDecisionAssignments =
    mediationState?.pendingDecisionAssignments?.list || [];
  const loadingPendingDecision =
    mediationState?.loadingPendingDecision || false;
  const errorPendingDecision = mediationState?.errorPendingDecision || null;
  const totalPagesPending =
    mediationState?.pendingDecisionAssignments?.totalPages || 1;
  const currentPagePendingFromState =
    mediationState?.pendingDecisionAssignments?.currentPage || 1;
  const totalPending =
    mediationState?.pendingDecisionAssignments?.totalCount || 0;
  const [currentPagePendingLocal, setCurrentPagePendingLocal] = useState(
    currentPagePendingFromState
  );

  const acceptedAwaitingPartiesAssignments =
    mediationState?.acceptedAwaitingPartiesAssignments?.list || [];
  const loadingAcceptedAwaitingParties =
    mediationState?.loadingAcceptedAwaitingParties || false;
  const errorAcceptedAwaitingParties =
    mediationState?.errorAcceptedAwaitingParties || null;
  const totalPagesAccepted =
    mediationState?.acceptedAwaitingPartiesAssignments?.totalPages || 1;
  const currentPageAcceptedFromState =
    mediationState?.acceptedAwaitingPartiesAssignments?.currentPage || 1;
  const totalAccepted =
    mediationState?.acceptedAwaitingPartiesAssignments?.totalCount || 0;
  const [currentPageAcceptedLocal, setCurrentPageAcceptedLocal] = useState(
    currentPageAcceptedFromState
  );

  const actionLoading = mediationState?.actionLoading || false;

  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedAssignmentImages, setSelectedAssignmentImages] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedAssignmentForReject, setSelectedAssignmentForReject] =
    useState(null);

  useEffect(() => {
    if (currentUser && currentUser.isMediatorQualified) {
        console.log("MediatorDashboardPage: Initial data fetch for all relevant tabs.");
        dispatch(getMediatorAssignments(1)); // جلب الصفحة الأولى لـ Pending Decision
        dispatch(getMediatorAcceptedAwaitingPartiesAction(1)); // جلب الصفحة الأولى لـ Accepted - Awaiting Parties
        // أضف استدعاءات لـ Tabs الأخرى هنا عند إنشائها
    }
}, [dispatch, currentUser]); // يتم التشغيل فقط عند تغيير dispatch أو currentUser

// useEffect منفصل لجلب البيانات عند تغيير التبويب أو الصفحة
useEffect(() => {
    if (currentUser && currentUser.isMediatorQualified) {
        if (activeTabKey === 'pendingDecision') {
            // لا حاجة لاستدعاء dispatch(getMediatorAssignments(currentPagePendingLocal)) هنا إذا كان التحميل الأولي قد جلبه بالفعل
            // إلا إذا كنت تريد إعادة الجلب عند كل تغيير تبويب حتى لو كانت نفس الصفحة.
            // إذا كان currentPagePendingLocal مختلفًا عن 1 (يعني المستخدم نقر على صفحة أخرى)، عندها قم بالجلب.
            if (currentPagePendingLocal !== 1 || pendingDecisionAssignments.length === 0) { // أو شرط آخر لتحديد متى تعيد الجلب
                 dispatch(getMediatorAssignments(currentPagePendingLocal));
            }
        } else if (activeTabKey === 'acceptedAwaitingParties') {
            if (currentPageAcceptedLocal !== 1 || acceptedAwaitingPartiesAssignments.length === 0) {
                dispatch(getMediatorAcceptedAwaitingPartiesAction(currentPageAcceptedLocal));
            }
        }
    }
}, [dispatch, currentUser, activeTabKey, currentPagePendingLocal, currentPageAcceptedLocal, pendingDecisionAssignments.length, acceptedAwaitingPartiesAssignments.length]); // أضفت طول المصفوفات كاعتمادية

  useEffect(() => {
    setCurrentPagePendingLocal(currentPagePendingFromState);
  }, [currentPagePendingFromState]);
  useEffect(() => {
    setCurrentPageAcceptedLocal(currentPageAcceptedFromState);
  }, [currentPageAcceptedFromState]);

  const handleShowImageModal = useCallback((images, index = 0) => {
    setSelectedAssignmentImages(
      Array.isArray(images) && images.length > 0 ? images : [noProductImageUrl]
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
      if (actionLoading) return;
      dispatch(mediatorAcceptAssignmentAction(assignmentId))
        .then(() => {
          // الـ Reducer يزيل المهمة من pendingDecisionAssignments
          // إذا كانت هذه آخر مهمة في الصفحة الحالية من تبويب pendingDecision
          if (
            pendingDecisionAssignments.length === 1 &&
            currentPagePendingLocal > 1 &&
            totalPending > 1
          ) {
            setCurrentPagePendingLocal((prev) => prev - 1);
          } else if (
            pendingDecisionAssignments.length === 1 &&
            totalPending === 1
          ) {
            // إذا كانت آخر مهمة على الإطلاق، قد تحتاج لإعادة جلب الصفحة الأولى أو لا شيء
            // لأن الـ reducer سيجعل القائمة فارغة.
            // dispatch(getMediatorAssignments(1)); // أو لا تفعل شيئًا إذا كان الـ reducer يعالجها
          }
          // جلب بيانات التبويب الذي انتقلت إليه المهمة
          dispatch(getMediatorAcceptedAwaitingPartiesAction(1)); // جلب الصفحة الأولى
        })
        .catch(() => {
          /* Error toast handled by action */
        });
    },
    [
      dispatch,
      actionLoading,
      pendingDecisionAssignments,
      currentPagePendingLocal,
      totalPending,
    ]
  );

  const openRejectModal = useCallback((assignment) => {
    setSelectedAssignmentForReject(assignment);
    setShowRejectModal(true);
  }, []);

  const handleConfirmRejectAssignment = useCallback(
    (assignmentId, reason) => {
      if (actionLoading) return;
      dispatch(mediatorRejectAssignmentAction(assignmentId, reason))
        .then(() => {
          setShowRejectModal(false);
          setSelectedAssignmentForReject(null);
          if (
            pendingDecisionAssignments.length === 1 &&
            currentPagePendingLocal > 1 &&
            totalPending > 1
          ) {
            setCurrentPagePendingLocal((prev) => prev - 1);
          } else if (
            pendingDecisionAssignments.length === 1 &&
            totalPending === 1
          ) {
            // dispatch(getMediatorAssignments(1));
          }
        })
        .catch(() => {
          /* Error toast handled by action */
        });
    },
    [
      dispatch,
      actionLoading,
      pendingDecisionAssignments,
      currentPagePendingLocal,
      totalPending,
    ]
  );

  const handlePageChange = useCallback(
    (tabKey, pageNumber) => {
      if (currentUser && currentUser.isMediatorQualified) {
        if (
          tabKey === "pendingDecision" &&
          pageNumber !== currentPagePendingLocal
        ) {
          setCurrentPagePendingLocal(pageNumber);
        } else if (
          tabKey === "acceptedAwaitingParties" &&
          pageNumber !== currentPageAcceptedLocal
        ) {
          setCurrentPageAcceptedLocal(pageNumber);
        }
      }
    },
    [currentUser, currentPagePendingLocal, currentPageAcceptedLocal]
  );

  const renderAssignmentCard = useCallback(
    (assignment, isPendingDecisionTab = false) => {
      const productImages = assignment.product?.imageUrls;
      // تحديد ما إذا كان الزر الحالي لهذه المهمة هو الذي يتم تحميله
      const currentActionSpecificLoading =
        actionLoading && selectedAssignmentForReject?._id === assignment._id;
      // يمكنك إضافة حالة مشابهة لـ selectedAssignmentForAccept إذا أردت
      return (
        <Card key={assignment._id} className="mb-3 shadow-sm">
          <Card.Header as="h5">
            
            Product: {assignment.product?.title || "N/A"}
          </Card.Header>
          <Card.Body>
            <Row>
              <Col
                md={3}
                className="text-center mb-2 mb-md-0 position-relative"
              >
                <Image
                  src={productImages?.[0] || noProductImageUrl}
                  alt={assignment.product?.title || "Product Image"}
                  style={{
                    width: "100%",
                    height: "120px",
                    objectFit: "contain",
                    cursor:
                      productImages && productImages.length > 0
                        ? "pointer"
                        : "default",
                  }}
                  className="rounded"
                  onError={handleImageError}
                  onClick={() =>
                    productImages &&
                    productImages.length > 0 &&
                    handleShowImageModal(productImages, 0)
                  }
                />
                {productImages && productImages.length > 0 && (
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
                  <strong>Transaction ID :</strong> {assignment._id} <br />
                  <strong>Seller :</strong> {assignment.seller?.fullName ? (
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
                  <strong>Buyer :</strong> {assignment.buyer?.fullName ? (
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
                  <strong>Agreed Price :</strong> {formatCurrency(assignment.bidAmount, assignment.bidCurrency)}
                  <br />
                  <strong>Status :</strong> <Badge
                    bg={
                      assignment.status === "MediatorAssigned"
                        ? "warning text-dark"
                        : assignment.status === "MediationOfferAccepted"
                        ? "info text-dark"
                        : "secondary"
                    }
                  >
                    {assignment.status}
                  </Badge>
                  <br />
                  <strong>Assigned/Updated On :</strong> {new Date(
                    assignment.updatedAt || assignment.createdAt
                  ).toLocaleDateString()} At {new Date(
                    assignment.updatedAt || assignment.createdAt
                  ).toLocaleTimeString()}
                </Card.Text>
                {isPendingDecisionTab && (
                  <div className="mt-3">
                    <Button
                      variant="success"
                      className="me-2 mb-2 mb-md-0"
                      onClick={() => handleAccept(assignment._id)}
                      disabled={actionLoading}
                    >
                      {actionLoading && !currentActionSpecificLoading ? (
                        <Spinner as="span" animation="border" size="sm" />
                      ) : (
                        "Accept Assignment"
                      )}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => openRejectModal(assignment)}
                      disabled={actionLoading}
                    >
                      {actionLoading && currentActionSpecificLoading ? (
                        <Spinner as="span" animation="border" size="sm" />
                      ) : (
                        "Reject Assignment"
                      )}
                    </Button>
                  </div>
                )}
                {assignment.status === "MediationOfferAccepted" && (
                  <Alert variant="info" className="mt-3 small p-2">
                    You have accepted this assignment. Waiting for both parties
                    (seller and buyer) to confirm their readiness to proceed.
                  </Alert>
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
    ]
  );

  if (!currentUser) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">Loading user data...</p>
      </Container>
    );
  }
  if (!currentUser.isMediatorQualified) {
    return (
      <Container className="py-5 text-center">
        <Alert variant="danger">
          Access Denied. You are not authorized to view this page.
        </Alert>
        <Link to="/">Go to Homepage</Link>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2>My Mediation Dashboard</h2>
        </Col>
      </Row>
      <Tabs activeKey={activeTabKey} onSelect={(k) => setActiveTabKey(k)} id="mediator-dashboard-tabs" className="mb-3" fill >
    <Tab eventKey="pendingDecision" title={<>Pending My Decision <Badge bg="warning" text="dark" pill>{totalPending}</Badge></>}>
          {loadingPendingDecision &&
            pendingDecisionAssignments.length === 0 && (
              <div className="text-center my-5">
                <Spinner animation="border" />
                <p>Loading pending assignments...</p>
              </div>
            )}
          {errorPendingDecision && !loadingPendingDecision && (
            <Alert variant="danger" className="text-center">
              Error: {errorPendingDecision}
            </Alert>
          )}
          {!loadingPendingDecision &&
            pendingDecisionAssignments.length === 0 &&
            !errorPendingDecision && (
              <Alert variant="info" className="text-center">
                No assignments pending your decision.
              </Alert>
            )}
          {pendingDecisionAssignments.length > 0 &&
            pendingDecisionAssignments.map((assignment) =>
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
        <Tab eventKey="acceptedAwaitingParties" title={<>Accepted - Awaiting Parties <Badge bg="info" text="dark" pill>{totalAccepted}</Badge></>}>
          {loadingAcceptedAwaitingParties &&
            acceptedAwaitingPartiesAssignments.length === 0 && (
              <div className="text-center my-5">
                <Spinner animation="border" />
                <p>Loading accepted assignments...</p>
              </div>
            )}
          {errorAcceptedAwaitingParties && !loadingAcceptedAwaitingParties && (
            <Alert variant="danger" className="text-center">
              Error: {errorAcceptedAwaitingParties}
            </Alert>
          )}
          {!loadingAcceptedAwaitingParties &&
            acceptedAwaitingPartiesAssignments.length === 0 &&
            !errorAcceptedAwaitingParties && (
              <Alert variant="info" className="text-center">
                No assignments are currently awaiting party confirmation.
              </Alert>
            )}
          {acceptedAwaitingPartiesAssignments.length > 0 &&
            acceptedAwaitingPartiesAssignments.map((assignment) =>
              renderAssignmentCard(assignment, false)
            )}
          {totalPagesAccepted > 1 && (
            <Pagination className="justify-content-center mt-4">
              {[...Array(totalPagesAccepted).keys()].map((num) => (
                <Pagination.Item
                  key={num + 1}
                  active={num + 1 === currentPageAcceptedLocal}
                  onClick={() =>
                    handlePageChange("acceptedAwaitingParties", num + 1)
                  }
                  disabled={loadingAcceptedAwaitingParties}
                >
                  {num + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          )}
        </Tab>
      </Tabs>

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
              onSelect={(selectedIndex) => setCurrentImageIndex(selectedIndex)}
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
                    alt={`Product Image ${index + 1}`}
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
            selectedAssignmentForReject?._id ===
              (mediationState?.processingAssignmentId || null)
          } // يمكنك تحسين هذا لاحقًا
        />
      )}
    </Container>
  );
};

export default MediatorDashboardPage;