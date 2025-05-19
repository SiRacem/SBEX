// client/src/pages/MyMediationRequestsPage.jsx
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
  Badge,
  Modal,
  Carousel,
  Form,
} from "react-bootstrap";
import {
  getBuyerMediationRequestsAction,
  buyerConfirmReadinessAndEscrowAction,
  buyerRejectMediationAction,
} from "../redux/actions/mediationAction";
import { getProfile } from "../redux/actions/userAction";
import { Link, useNavigate } from "react-router-dom"; // useNavigate مضافة
import { toast } from "react-toastify";
import { BsImage } from "react-icons/bs";
import {
  FaCheck,
  FaHourglassHalf,
  FaHandshake,
  FaCommentDots,
} from "react-icons/fa";
import { calculateMediatorFeeDetails } from "../components/vendor/feeCalculator"; // تأكد من صحة هذا المسار
import RejectMediationByBuyerModal from "./RejectMediationByBuyerModal"; // تأكد من وجود هذا المكون

// Helper: Currency Formatting
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
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="120" viewBox="0 0 150 120"><rect width="150" height="120" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">No Image</text></svg>';
const fallbackProductImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e9ecef"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%236c757d">Error</text></svg>';

const MyMediationRequestsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    buyerRequests,
    loadingBuyerRequests,
    errorBuyerRequests,
    confirmingReadiness,
    actionLoading,
  } = useSelector(
    (state) =>
      state.mediationReducer || {
        buyerRequests: {
          list: [],
          totalPages: 1,
          currentPage: 1,
          totalCount: 0,
        },
        loadingBuyerRequests: false,
        errorBuyerRequests: null,
        confirmingReadiness: false,
        actionLoading: false,
      }
  );

  const currentUser = useSelector((state) => state.userReducer.user);
  const [currentPageLocal, setCurrentPageLocal] = useState(
    buyerRequests?.currentPage || 1
  );
  const [selectedRequestIdForAction, setSelectedRequestIdForAction] =
    useState(null);

  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedRequestImages, setSelectedRequestImages] = useState([]);
  const [showBuyerRejectModal, setShowBuyerRejectModal] = useState(false);
  const [selectedRequestToRejectByBuyer, setSelectedRequestToRejectByBuyer] =
    useState(null);

  useEffect(() => {
    if (currentUser?._id) {
      dispatch(getBuyerMediationRequestsAction(currentPageLocal, 10)); // افترض limit 10
    }
  }, [dispatch, currentUser, currentPageLocal]);

  useEffect(() => {
    if (
      buyerRequests?.currentPage &&
      buyerRequests.currentPage !== currentPageLocal
    ) {
      setCurrentPageLocal(buyerRequests.currentPage);
    }
  }, [buyerRequests?.currentPage, currentPageLocal]);

  const handleConfirmAndEscrow = useCallback(
    (mediationRequestId) => {
      if (
        (confirmingReadiness &&
          selectedRequestIdForAction === mediationRequestId) ||
        actionLoading
      )
        return;
      setSelectedRequestIdForAction(mediationRequestId);
      dispatch(buyerConfirmReadinessAndEscrowAction(mediationRequestId))
        .then((actionResponse) => {
          if (
            actionResponse &&
            actionResponse.responseData?.updatedBuyerBalance !== undefined
          ) {
            // Check inside responseData
            dispatch(getProfile());
          }
          dispatch(getBuyerMediationRequestsAction(currentPageLocal));
        })
        .catch((err) => {
          // toast error is usually handled in action, log if needed
          console.error("Error confirming and escrowing:", err);
        })
        .finally(() => {
          setSelectedRequestIdForAction(null);
        });
    },
    [
      dispatch,
      confirmingReadiness,
      actionLoading,
      selectedRequestIdForAction,
      currentPageLocal,
    ]
  );

  const handlePageChange = useCallback(
    (pageNumber) => {
      if (currentUser?._id && pageNumber !== currentPageLocal) {
        setCurrentPageLocal(pageNumber);
      }
    },
    [currentUser, currentPageLocal]
  );

  const handleShowImageModal = useCallback((images, index = 0) => {
    setSelectedRequestImages(
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

  const openBuyerRejectModal = useCallback((request) => {
    setSelectedRequestToRejectByBuyer(request);
    setShowBuyerRejectModal(true);
  }, []);

  const handleConfirmBuyerReject = useCallback(
    (mediationRequestId, reason) => {
      if (actionLoading && selectedRequestIdForAction === mediationRequestId)
        return;
      setSelectedRequestIdForAction(mediationRequestId);
      dispatch(buyerRejectMediationAction(mediationRequestId, reason))
        .then(() => {
          setShowBuyerRejectModal(false);
          setSelectedRequestToRejectByBuyer(null);
          // Refresh the list
          dispatch(getBuyerMediationRequestsAction(currentPageLocal));
        })
        .catch(() => {})
        .finally(() => {
          setSelectedRequestIdForAction(null);
        });
    },
    [dispatch, actionLoading, currentPageLocal]
  ); // Removed buyerRequests dependencies, rely on refetch

  if (!currentUser)
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p>Loading user...</p>
      </Container>
    );
  if (
    loadingBuyerRequests &&
    buyerRequests.list.length === 0 &&
    !errorBuyerRequests
  )
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p>Loading requests...</p>
      </Container>
    );
  if (errorBuyerRequests && buyerRequests.list.length === 0)
    return (
      <Container className="py-5">
        <Alert variant="danger">
          Error:
          {typeof errorBuyerRequests === "string"
            ? errorBuyerRequests
            : errorBuyerRequests.message || "Could not load requests."}
        </Alert>
      </Container>
    );

  return (
    <Container className="py-4">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2>My Mediation Requests</h2>
          <p className="text-muted">
            You have {buyerRequests.totalCount || 0} mediation request(s).
          </p>
        </Col>
      </Row>

      {loadingBuyerRequests && buyerRequests.list.length > 0 && (
        <div className="text-center mb-3">
          <Spinner animation="border" size="sm" variant="primary" /> Updating...
        </div>
      )}
      {!loadingBuyerRequests &&
        buyerRequests.list.length === 0 &&
        !errorBuyerRequests && (
          <Alert variant="info" className="text-center">
            You have no active mediation requests at the moment.
          </Alert>
        )}

      {buyerRequests.list.map((request) => {
        if (!request || !request.product) return null;
        console.log("Current request status from DB:", request.status);
        const product = request.product;
        const seller = request.seller;
        const mediator = request.mediator;
        const isProcessingThisRequest =
          (confirmingReadiness || actionLoading) &&
          selectedRequestIdForAction === request._id;
        const feeDisplayDetails = calculateMediatorFeeDetails(
          request.bidAmount,
          request.bidCurrency
        );
        console.log("Request bidAmount:", request.bidAmount, "bidCurrency:", request.bidCurrency);
        console.log("Calculated feeDisplayDetails:", feeDisplayDetails); // <--- اطبع هذا

        const productImages = product?.imageUrls;

        let statusBadgeText = request.status
          ? request.status.replace(/([A-Z])/g, " $1").trim()
          : "Unknown";
        let statusBadgeBg = "light text-dark";

        if (request.status === "PendingMediatorSelection") {
          statusBadgeText = "Awaiting Mediator Selection";
          statusBadgeBg = "secondary";
        } else if (request.status === "MediatorAssigned") {
          statusBadgeText = `Mediator Assigned`;
          statusBadgeBg = "info text-dark";
        } else if (request.status === "MediationOfferAccepted") {
          statusBadgeText = `Mediator Accepted - Awaiting Confirmations`;
          statusBadgeBg = "warning text-dark";
        } else if (request.status === "EscrowFunded") {
          statusBadgeText = "Funds Escrowed - Awaiting Seller";
          statusBadgeBg = "primary";
        } else if (request.status === "PartiesConfirmed") {
          statusBadgeText = "Parties Confirmed";
          statusBadgeBg = "info";
        } else if (request.status === "InProgress") {
          statusBadgeText = "Mediation In Progress";
          statusBadgeBg = "success";
        } else if (request.status === "Completed") {
          statusBadgeText = "Completed";
          statusBadgeBg = "dark";
        } else if (request.status === "Cancelled") {
          statusBadgeText = "Cancelled";
          statusBadgeBg = "danger";
        }

        return (
          <Card key={request._id} className="mb-3 shadow-sm">
            <Card.Header as="h5">Product: {product.title || "N/A"}</Card.Header>
            <Card.Body>
              <Row>
                <Col
                  md={3}
                  className="text-center mb-3 mb-md-0 position-relative"
                >
                  <Image
                    src={productImages?.[0] || noProductImageUrl}
                    alt={product.title || "Product"}
                    fluid
                    rounded
                    style={{
                      maxHeight: "150px",
                      objectFit: "contain",
                      cursor: productImages?.length ? "pointer" : "default",
                    }}
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
                      <BsImage /> View ({productImages.length})
                    </Button>
                  )}
                </Col>
                <Col md={9}>
                  <p>
                    <strong>Transaction ID :</strong> {request._id}
                  </p>
                  <p>
                    <strong>Seller :</strong> {seller?.fullName ? (
                      <Link
                        to={`/profile/${seller._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {seller.fullName}
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </p>
                  {mediator && (
                    <p>
                      <strong>Mediator :</strong> {mediator.fullName ? (
                        <Link
                          to={`/profile/${mediator._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {mediator.fullName}
                        </Link>
                      ) : (
                        "N/A"
                      )}
                    </p>
                  )}
                  <p>
                    <strong>Agreed Price :</strong> {formatCurrency(request.bidAmount, request.bidCurrency)}
                  </p>
                  {request.status === "MediationOfferAccepted" &&
                    !request.buyerConfirmedStart &&
                    feeDisplayDetails &&
                    !feeDisplayDetails.error && (
                      <Alert
                        variant="light"
                        className="small p-2 mt-2 mb-3 border"
                      >
                        <div>
                          <strong>Estimated Cost of Escrow :</strong>
                        </div>
                        <div>
                          Agreed Price : + {formatCurrency(
                            feeDisplayDetails.priceOriginal,
                            feeDisplayDetails.currencyUsed
                          )}
                        </div>
                        <div>
                          Your Fee Share : + {formatCurrency(
                            feeDisplayDetails.buyerShare,
                            feeDisplayDetails.currencyUsed
                          )}
                        </div>
                        <hr className="my-1" />
                        <div>
                          <strong>
                            Total to Escrow : {formatCurrency(
                              feeDisplayDetails.totalForBuyer,
                              feeDisplayDetails.currencyUsed
                            )}
                          </strong>
                        </div>
                      </Alert>
                    )}
                  <p>
                    <strong>Status :</strong> <Badge bg={statusBadgeBg}>{statusBadgeText}</Badge>
                  </p>
                  <p>
                    <strong>Last Updated :</strong> {new Date(
                      request.updatedAt || request.createdAt
                    ).toLocaleString()}
                  </p>

                  {request.status === "MediationOfferAccepted" &&
                    !request.buyerConfirmedStart && (
                      <div className="mt-3">
                        <Alert variant="warning" className="small p-2">
                          <FaHourglassHalf className="me-1" /> Action Required : Mediator
                          <strong> {mediator?.fullName || "N/A"} </strong> accepted. Confirm & deposit funds.
                        </Alert>
                        <Button
                          variant="success"
                          className="me-2"
                          onClick={() => handleConfirmAndEscrow(request._id)}
                          disabled={isProcessingThisRequest}
                        >
                          {isProcessingThisRequest ? (
                            <>
                              <Spinner size="sm" /> Processing...
                            </>
                          ) : (
                            "Confirm & Deposit"
                          )}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => openBuyerRejectModal(request)}
                          disabled={isProcessingThisRequest}
                        >
                          Cancel Mediation
                        </Button>
                      </div>
                    )}
                  {request.buyerConfirmedStart &&
                    request.status === "EscrowFunded" &&
                    !request.sellerConfirmedStart && (
                      <Alert variant="info" className="small p-2 mt-3">
                        <FaCheck className="me-1 text-success" /> Funds
                        escrowed. Waiting for seller.
                      </Alert>
                    )}

                  {(request.status === "PartiesConfirmed" ||
                    request.status === "InProgress") && (
                    <div className="mt-3">
                      <Alert
                        variant={
                          request.status === "InProgress" ? "success" : "info"
                        }
                        className="p-2 small d-flex justify-content-between align-items-center"
                      >
                        <span>
                          <FaHandshake className="me-1" />
                          {request.status === "PartiesConfirmed"
                            ? "Parties confirmed. Chat starting."
                            : "Mediation is in progress."}
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          as={Link}
                          to={`/dashboard/mediation-chat/${request._id}`}
                          title="Open Mediation Chat"
                        >
                          <FaCommentDots className="me-1 d-none d-sm-inline" />
                          Open Chat
                        </Button>
                      </Alert>
                    </div>
                  )}

                  {request.status === "Completed" && (
                    <Alert variant="secondary" className="small p-2 mt-3">
                      <FaCheck className="me-1" /> Mediation completed.
                    </Alert>
                  )}
                  {request.status === "Cancelled" && (
                    <Alert variant="danger" className="small p-2 mt-3">
                      Mediation cancelled.
                    </Alert>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        );
      })}

      {buyerRequests.totalPages > 1 && (
        <Pagination className="justify-content-center mt-4">
          {[...Array(buyerRequests.totalPages).keys()].map((num) => (
            <Pagination.Item
              key={num + 1}
              active={num + 1 === currentPageLocal}
              onClick={() => handlePageChange(num + 1)}
              disabled={loadingBuyerRequests}
            >
              {num + 1}
            </Pagination.Item>
          ))}
        </Pagination>
      )}

      <Modal
        show={showImageModal}
        onHide={handleCloseImageModal}
        centered
        size="lg"
        dialogClassName="lightbox-modal"
      >
        <Modal.Body className="p-0 text-center bg-dark position-relative">
          {selectedRequestImages.length > 0 ? (
            <Carousel
              activeIndex={currentImageIndex}
              onSelect={(selectedIndex) => setCurrentImageIndex(selectedIndex)}
              interval={null}
              indicators={selectedRequestImages.length > 1}
              controls={selectedRequestImages.length > 1}
            >
              {selectedRequestImages.map((imgUrl, index) => (
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

      {selectedRequestToRejectByBuyer && (
        <RejectMediationByBuyerModal
          show={showBuyerRejectModal}
          onHide={() => {
            setShowBuyerRejectModal(false);
            setSelectedRequestToRejectByBuyer(null);
          }}
          request={selectedRequestToRejectByBuyer}
          onConfirmReject={handleConfirmBuyerReject}
          loading={
            actionLoading &&
            selectedRequestIdForAction === selectedRequestToRejectByBuyer._id
          }
        />
      )}
    </Container>
  );
};

export default MyMediationRequestsPage;
