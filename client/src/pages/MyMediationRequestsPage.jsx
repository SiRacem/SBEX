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
  Tooltip,
  OverlayTrigger,
} from "react-bootstrap";
import { useTranslation, Trans } from "react-i18next";
import {
  getBuyerMediationRequestsAction,
  buyerConfirmReadinessAndEscrowAction,
  buyerRejectMediationAction,
} from "../redux/actions/mediationAction";
import { getProfile } from "../redux/actions/userAction";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { BsImage } from "react-icons/bs";
import {
  FaCheck,
  FaHourglassHalf,
  FaHandshake,
  FaCommentDots,
  FaEye,
  FaInfoCircle,
} from "react-icons/fa";
import { calculateMediatorFeeDetails } from "../components/vendor/feeCalculator";
import RejectMediationByBuyerModal from "./RejectMediationByBuyerModal";
import ViewMediationDetailsModal from "./ViewMediationDetailsModal";
import FeeExplanationModal from "../components/commun/FeeExplanationModal";

const noProductImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="120" viewBox="0 0 150 120"><rect width="150" height="120" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">No Image</text></svg>';
const fallbackProductImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e9ecef"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%236c757d">Error</text></svg>';

const MyMediationRequestsPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const formatCurrency = useCallback(
    (amount, currencyCode = "TND") => {
      const num = Number(amount);
      if (isNaN(num) || amount == null) return "N/A";
      let options = {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
      };
      let locale = i18n.language;
      if (currencyCode === "USD") {
        locale = "en-US";
        options.currencyDisplay = "symbol";
      }
      return new Intl.NumberFormat(locale, options).format(num);
    },
    [i18n.language]
  );

  const [showViewDetailsModal, setShowViewDetailsModal] = useState(false);
  const [selectedRequestForDetails, setSelectedRequestForDetails] =
    useState(null);

  const {
    buyerRequests,
    loadingBuyerRequests,
    errorBuyerRequests,
    confirmingReadiness,
    actionLoading,
  } = useSelector((state) => state.mediationReducer || {});
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
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeDetailsForModal, setFeeDetailsForModal] = useState(null);
  const [priceForModal, setPriceForModal] = useState(0);

  useEffect(() => {
    if (currentUser?._id) {
      // [!!!] استدعاء الأكشن الذي يجلب جميع طلبات المشتري فقط
      dispatch(getBuyerMediationRequestsAction(currentPageLocal, 10));
    }
  }, [dispatch, currentUser, currentPageLocal]);

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
        .then(() => {
          dispatch(getProfile());
          dispatch(getBuyerMediationRequestsAction(currentPageLocal));
        })
        .catch((error) => {
          const errorMessage = error || {
            key: "apiErrors.unknownError",
            fallback: "An unknown error occurred",
          };
          toast.error(
            t(errorMessage.key, {
              ...errorMessage.params,
              defaultValue: errorMessage.fallback,
            })
          );
          console.error("Failed to confirm and escrow:", errorMessage);
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
      t,
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
      if (!reason || reason.trim() === "") {
        toast.warn(t("mediationRequestsPage.rejectModal.noReason"));
        return;
      }
      setSelectedRequestIdForAction(mediationRequestId);
      dispatch(buyerRejectMediationAction(mediationRequestId, reason))
        .then(() => {
          toast.success(t("mediationRequestsPage.rejectModal.cancelSuccess"));
          setShowBuyerRejectModal(false);
          setSelectedRequestToRejectByBuyer(null);
          dispatch(getBuyerMediationRequestsAction(currentPageLocal));
        })
        .finally(() => {
          setSelectedRequestIdForAction(null);
        });
    },
    [dispatch, actionLoading, selectedRequestIdForAction, currentPageLocal, t]
  );

  const handleOpenViewDetailsModal = useCallback((request) => {
    setSelectedRequestForDetails(request);
    setShowViewDetailsModal(true);
  }, []);

  const handleShowFeeModal = useCallback((request) => {
        const details = calculateMediatorFeeDetails(request.bidAmount, request.bidCurrency);
        setFeeDetailsForModal(details);
        setPriceForModal(request.bidAmount);
        setShowFeeModal(true);
    }, []);

  if (!currentUser) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />{" "}
        <p>{t("mediationRequestsPage.loadingUser")}</p>
      </Container>
    );
  }

  if (
    loadingBuyerRequests &&
    (!buyerRequests || buyerRequests.list.length === 0) &&
    !errorBuyerRequests
  ) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />{" "}
        <p>{t("mediationRequestsPage.loadingRequests")}</p>
      </Container>
    );
  }

  if (
    errorBuyerRequests &&
    (!buyerRequests || buyerRequests.list.length === 0)
  ) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          {t("mediationRequestsPage.errorTitle")}{" "}
          {typeof errorBuyerRequests === "string"
            ? errorBuyerRequests
            : errorBuyerRequests.message ||
              t("mediationRequestsPage.unknownError")}
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4 my-mediation-requests-page">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2>{t("mediationRequestsPage.title")}</h2>
          <p className="text-muted">
            {t("mediationRequestsPage.subtitle", {
              count: buyerRequests?.totalCount || 0,
            })}
          </p>
        </Col>
      </Row>

      {loadingBuyerRequests &&
        buyerRequests &&
        buyerRequests.list.length > 0 && (
          <div className="text-center mb-3">
            <Spinner animation="border" size="sm" variant="primary" />{" "}
            {t("mediationRequestsPage.updatingList")}
          </div>
        )}

      {!loadingBuyerRequests &&
        buyerRequests &&
        buyerRequests.list.length === 0 &&
        !errorBuyerRequests && (
          <Alert variant="info" className="text-center">
            {t("mediationRequestsPage.noRequestsFound")}
          </Alert>
        )}

      {errorBuyerRequests && buyerRequests && buyerRequests.list.length > 0 && (
        <Alert variant="warning" className="mb-3">
          {t("mediationRequestsPage.updateWarning", {
            error:
              typeof errorBuyerRequests === "string"
                ? errorBuyerRequests
                : errorBuyerRequests.message ||
                  t("mediationRequestsPage.updateError"),
          })}
        </Alert>
      )}

      {(buyerRequests?.list || []).map((request) => {
        if (!request?._id || !request.product?._id) return null;
        const { product, seller, mediator } = request;
        const isProcessingThisRequest =
          (confirmingReadiness || actionLoading) &&
          selectedRequestIdForAction === request._id;
        const feeDisplayDetails = calculateMediatorFeeDetails(
          request.bidAmount,
          request.bidCurrency
        );
        const productImages = product?.imageUrls;

        const statusBadgeText = t(
          `mediationRequestsPage.statuses.${request.status}`,
          { defaultValue: request.status }
        );
        let statusBadgeBg = "light text-dark";
        // ... Logic to set statusBadgeBg based on request.status ...

        return (
          <Card key={request._id} className="mb-3 shadow-sm">
            <Card.Header
              as="h5"
              className="d-flex justify-content-between align-items-center"
            >
              <span>
                {t("mediationRequestsPage.card.productTitle", {
                  title: product.title || "N/A",
                })}
              </span>
              <OverlayTrigger
                placement="top"
                overlay={
                  <Tooltip>
                    {t("mediationRequestsPage.card.viewDetailsTooltip")}
                  </Tooltip>
                }
              >
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenViewDetailsModal(request);
                  }}
                >
                  <FaEye size={16} />
                </Button>
              </OverlayTrigger>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col
                  md={3}
                  className="text-center mb-3 mb-md-0 position-relative"
                >
                  <Image
                    src={productImages?.[0] || noProductImageUrl}
                    alt={product.title || "Product Image"}
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
                  {productImages?.length > 1 && (
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
                      <BsImage />{" "}
                      {t("mediationRequestsPage.card.galleryButton", {
                        count: productImages.length,
                      })}
                    </Button>
                  )}
                </Col>
                <Col md={9}>
                  <p className="mb-1">
                    <strong>
                      {t("mediationRequestsPage.card.transactionId")}
                    </strong>{" "}
                    {request._id}
                  </p>
                  <p className="mb-1">
                    <strong>{t("mediationRequestsPage.card.seller")}</strong>{" "}
                    {seller?.fullName ? (
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
                    <p className="mb-1">
                      <strong>
                        {t("mediationRequestsPage.card.mediator")}
                      </strong>{" "}
                      {mediator.fullName ? (
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
                  <p className="mb-1">
                    <strong>
                      {t("mediationRequestsPage.card.agreedPrice")}
                    </strong>{" "}
                    {formatCurrency(request.bidAmount, request.bidCurrency)}
                  </p>
                  {currentUser?._id === request.buyer?._id?.toString() &&
                    request.status === "MediationOfferAccepted" &&
                    !request.buyerConfirmedStart &&
                    feeDisplayDetails &&
                    !feeDisplayDetails.error && (
                      <Alert
                        variant="light"
                        className="small p-2 mt-2 mb-3 border fee-details-alert"
                      >
                        <div>
                          <strong>
                            {t("mediationRequestsPage.card.escrowTitle")}
                          </strong>
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>{t("feeModal.title")}</Tooltip>}
                          >
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 ms-2"
                              onClick={() => handleShowFeeModal(request)}
                            >
                              <FaInfoCircle />
                            </Button>
                          </OverlayTrigger>
                        </div>
                        <div>
                          {t("mediationRequestsPage.card.escrowPrice")}{" "}
                          {formatCurrency(
                            feeDisplayDetails.priceOriginal,
                            feeDisplayDetails.currencyUsed
                          )}
                        </div>
                        <div>
                          {t("mediationRequestsPage.card.escrowFee")}{" "}
                          {formatCurrency(
                            feeDisplayDetails.buyerShare,
                            feeDisplayDetails.currencyUsed
                          )}
                        </div>
                        <hr className="my-1" />
                        <div>
                          <strong>
                            {t("mediationRequestsPage.card.escrowTotal")}{" "}
                            {formatCurrency(
                              feeDisplayDetails.totalForBuyer,
                              feeDisplayDetails.currencyUsed
                            )}
                          </strong>
                        </div>
                      </Alert>
                    )}
                  <p className="mb-1">
                    <strong>{t("mediationRequestsPage.card.status")}</strong>{" "}
                    <Badge bg={statusBadgeBg}>{statusBadgeText}</Badge>
                  </p>
                  <p className="mb-0">
                    <strong>
                      {t("mediationRequestsPage.card.lastUpdated")}
                    </strong>{" "}
                    {new Date(
                      request.updatedAt || request.createdAt
                    ).toLocaleString()}
                  </p>
                  {request.status === "MediationOfferAccepted" &&
                    !request.buyerConfirmedStart && (
                      <div className="mt-3">
                        <Alert variant="warning" className="small p-2">
                          <FaHourglassHalf className="me-1" />
                          <Trans
                            i18nKey="mediationRequestsPage.card.actionRequiredAlert"
                            values={{ name: mediator?.fullName || "N/A" }}
                            components={{ strong: <strong /> }}
                          />
                        </Alert>
                        <Button
                          variant="success"
                          className="me-2"
                          onClick={() => handleConfirmAndEscrow(request._id)}
                          disabled={isProcessingThisRequest}
                        >
                          {isProcessingThisRequest ? (
                            <>
                              <Spinner size="sm" /> {t("common.processing")}
                            </>
                          ) : (
                            t("mediationRequestsPage.card.confirmButton")
                          )}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => openBuyerRejectModal(request)}
                          disabled={isProcessingThisRequest}
                        >
                          {t("mediationRequestsPage.card.cancelButton")}
                        </Button>
                      </div>
                    )}
                  {request.buyerConfirmedStart &&
                    request.status === "EscrowFunded" &&
                    !request.sellerConfirmedStart && (
                      <Alert variant="info" className="small p-2 mt-3">
                        <FaCheck className="me-1 text-success" />{" "}
                        {t("mediationRequestsPage.card.fundsEscrowedAlert")}
                      </Alert>
                    )}
                  {(request.status === "InProgress" ||
                    request.status === "PartiesConfirmed" ||
                    request.status === "Disputed") && (
                    <div className="mt-3">
                      <Alert
                        variant={
                          request.status === "InProgress"
                            ? "success"
                            : request.status === "Disputed"
                            ? "danger"
                            : "info"
                        }
                        className="p-2 small d-flex justify-content-between align-items-center"
                      >
                        <span>
                          <FaHandshake className="me-1" />
                          {request.status === "PartiesConfirmed"
                            ? t(
                                "mediationRequestsPage.card.partiesConfirmedAlert"
                              )
                            : request.status === "Disputed"
                            ? t("mediationRequestsPage.card.disputeActiveAlert")
                            : t(
                                "mediationRequestsPage.card.mediationInProgressAlert"
                              )}
                        </span>
                        <Button
                          variant={
                            request.status === "Disputed"
                              ? "warning"
                              : "primary"
                          }
                          size="sm"
                          onClick={() =>
                            navigate(`/dashboard/mediation-chat/${request._id}`)
                          }
                          title={
                            request.status === "Disputed"
                              ? t(
                                  "mediationRequestsPage.card.openDisputeChatButton"
                                )
                              : t("mediationRequestsPage.card.openChatButton")
                          }
                        >
                          <FaCommentDots className="me-1 d-none d-sm-inline" />{" "}
                          {t("mediationRequestsPage.card.openChatButton")}
                        </Button>
                      </Alert>
                    </div>
                  )}
                  {request.status === "Completed" && (
                    <Alert variant="secondary" className="small p-2 mt-3">
                      <FaCheck className="me-1" />{" "}
                      {t("mediationRequestsPage.card.completedAlert")}
                    </Alert>
                  )}
                  {request.status === "Cancelled" && (
                    <Alert variant="danger" className="small p-2 mt-3">
                      <div>
                        <strong>
                          {t("mediationRequestsPage.card.cancelledAlertTitle")}
                        </strong>
                      </div>
                      {request.product?.title && (
                        <div>
                          {t("mediationRequestsPage.card.productTitle", {
                            title: request.product.title,
                          })}
                        </div>
                      )}
                      <div>
                        {request.resolutionDetails ||
                        request.cancellationDetails?.reason
                          ? t("mediationRequestsPage.card.cancelledReason", {
                              reason:
                                request.resolutionDetails ||
                                request.cancellationDetails.reason,
                            })
                          : t("mediationRequestsPage.card.cancelledNoReason")}
                      </div>
                    </Alert>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        );
      })}

      {buyerRequests?.totalPages > 1 && (
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
              onSelect={(idx) => setCurrentImageIndex(idx)}
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
                    alt={t("mediationRequestsPage.imageModal.title", {
                      index: index + 1,
                    })}
                    style={{ maxHeight: "80vh", objectFit: "contain" }}
                  />
                </Carousel.Item>
              ))}
            </Carousel>
          ) : (
            <Alert variant="dark" className="m-5">
              {t("mediationRequestsPage.imageModal.unavailable")}
            </Alert>
          )}
          <Button
            variant="light"
            onClick={handleCloseImageModal}
            className="position-absolute top-0 end-0 m-2"
            aria-label={t("mediationRequestsPage.imageModal.close")}
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
      {selectedRequestForDetails && (
        <ViewMediationDetailsModal
          show={showViewDetailsModal}
          onHide={() => {
            setShowViewDetailsModal(false);
            setSelectedRequestForDetails(null);
          }}
          request={selectedRequestForDetails}
        />
      )}
      <FeeExplanationModal
        show={showFeeModal}
        onHide={() => setShowFeeModal(false)}
        feeDetails={feeDetailsForModal}
        agreedPrice={priceForModal}
        userRole="Buyer"
      />
    </Container>
  );
};

export default MyMediationRequestsPage;
