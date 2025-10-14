// client/src/components/vendor/ProductEntry.jsx

import React, { useCallback } from "react";
import { useDispatch } from "react-redux";
import {
  Card,
  Row,
  Col,
  Image,
  Button,
  Tooltip,
  OverlayTrigger,
  Badge,
  Alert,
  Spinner,
  ListGroup,
} from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { toast } from "react-toastify";
import {
  FaEdit,
  FaTrashAlt,
  FaCheck,
  FaTimes,
  FaHourglassHalf,
  FaHandshake,
  FaEye,
  FaUserFriends,
  FaUndo,
  FaCommentDots,
  FaExclamationTriangle,
} from "react-icons/fa";

import { updateProductLocally } from "../../redux/actions/productAction";
import CountdownCircle from "./CountdownCircle";

const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';
const fallbackImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23cccccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23ffffff">Error</text></svg>';

const ProductEntry = ({
  product,
  loadingDelete,
  acceptingBid,
  rejectingBid,
  sellerConfirmLoading,
  handleDeleteProduct,
  handleAcceptBid,
  openRejectModal,
  handleOpenViewMediationDetails,
  handleOpenSelectMediatorModal,
  handleSellerConfirmReadiness,
  handleShowImageModal,
}) => {
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

  const handleImageError = useCallback((e) => {
    if (e.target.src !== fallbackImageUrl) {
      e.target.onerror = null;
      e.target.src = fallbackImageUrl;
    }
  }, []);

  const handleCountdownComplete = useCallback(
    (productIdToReset) => {
      console.log(
        `Countdown complete for product ${productIdToReset}. Resetting UI.`
      );
      dispatch(
        updateProductLocally(productIdToReset, {
          status: "PendingMediatorSelection",
          currentMediationRequest: {
            ...product.currentMediationRequest,
            status: "PendingMediatorSelection",
            mediator: null,
          },
        })
      );
      toast.info(t("myProductsPage.countdown.expiredToast"));
    },
    [dispatch, product.currentMediationRequest, t]
  );

  const handleReturnToSale = () => {
    // هنا يمكنك إضافة منطق استدعاء API لإعادة المنتج للبيع
    // حالياً، سنقوم بتحديث محلي كحل مؤقت
    if (product && product._id) {
      dispatch(
        updateProductLocally(product._id, {
          status: "approved",
          currentMediationRequest: null,
          buyer: null,
          agreedPrice: null,
        })
      );
      toast.info("Product has been returned to sale. (Local Update)");
    }
  };

  if (!product || !product._id) return null;

  const sortedBids = [...(product.bids || [])].sort(
    (a, b) => b.amount - a.amount
  );
  const productLoadingDeleteState = loadingDelete[product._id] || false;
  const productStatus = product.status;
  const mediationRequestData = product.currentMediationRequest;
  const mediationRequestStatus = mediationRequestData?.status;
  const currentMediationRequestId = mediationRequestData?._id;
  const productImages = product.imageUrls;

  const isPendingMediatorSelection =
    productStatus === "PendingMediatorSelection" &&
    (!mediationRequestStatus ||
      mediationRequestStatus === "PendingMediatorSelection");
  const isMediatorAssignedBySeller =
    productStatus === "MediatorAssigned" &&
    mediationRequestStatus === "MediatorAssigned";
  const isMediationOfferAcceptedByMediator =
    mediationRequestStatus === "MediationOfferAccepted";
  const isEscrowFundedByBuyer = mediationRequestStatus === "EscrowFunded";
  const isPartiesConfirmed = mediationRequestStatus === "PartiesConfirmed";
  const isActualMediationInProgress =
    productStatus === "InProgress" || mediationRequestStatus === "InProgress";
  const sellerHasConfirmed = mediationRequestData?.sellerConfirmedStart;
  const isApproved = productStatus === "approved";
  const canEditOrDelete =
    isApproved && !mediationRequestData && product.bids?.length === 0;
  const agreedPriceForDisplay = product.agreedPrice;
  const isLoadingThisSellerConfirmButton =
    sellerConfirmLoading[currentMediationRequestId] || false;
  const isDisputedProduct =
    productStatus === "Disputed" || productStatus === "UnderDispute";

  let statusBadgeText;
  let statusBadgeBg = "secondary";

  if (isApproved && !mediationRequestData) {
    statusBadgeBg = "success";
    statusBadgeText = t("myProductsPage.productCard.status.approved");
  } else if (isPendingMediatorSelection) {
    statusBadgeText = t("myProductsPage.productCard.status.selectMediator");
    statusBadgeBg = "info";
  } else if (isMediatorAssignedBySeller) {
    statusBadgeText = t("myProductsPage.productCard.status.awaitingMediator");
    statusBadgeBg = "primary";
  } else if (isMediationOfferAcceptedByMediator) {
    statusBadgeText = t(
      "myProductsPage.productCard.status.awaitingConfirmations"
    );
    statusBadgeBg = "warning text-dark";
  } else if (isEscrowFundedByBuyer && !sellerHasConfirmed) {
    statusBadgeText = t("myProductsPage.productCard.status.buyerConfirmed");
    statusBadgeBg = "info";
  } else if (isPartiesConfirmed) {
    statusBadgeText = t("myProductsPage.productCard.status.partiesConfirmed");
    statusBadgeBg = "info";
  } else if (isActualMediationInProgress) {
    statusBadgeText = t("myProductsPage.productCard.status.inProgress");
    statusBadgeBg = "success";
  } else if (isDisputedProduct) {
    statusBadgeText = t("myProductsPage.productCard.status.disputeOpened");
    statusBadgeBg = "danger";
  } else if (product.status === "sold") {
    statusBadgeText = t("myProductsPage.productCard.status.sold");
    statusBadgeBg = "dark";
  } else if (product.status === "Completed") {
    statusBadgeText = t("myProductsPage.productCard.status.completed");
    statusBadgeBg = "dark";
  } else if (product.status === "pending") {
    statusBadgeText = t("myProductsPage.productCard.status.pendingApproval");
    statusBadgeBg = "warning text-dark";
  } else if (product.status === "rejected") {
    statusBadgeText = t("myProductsPage.productCard.status.adminRejected");
    statusBadgeBg = "danger";
  } else {
    statusBadgeText = productStatus
      ? productStatus.charAt(0).toUpperCase() + productStatus.slice(1)
      : "Unknown";
  }

  return (
    <Card
      key={product._id}
      className={`mb-3 product-entry shadow-sm ${
        isPartiesConfirmed || isActualMediationInProgress
          ? "border-success"
          : mediationRequestData
          ? "border-primary"
          : ""
      }`}
    >
      <Row className="g-0">
        <Col
          md={3}
          lg={2}
          className="text-center p-2 product-entry-img-col position-relative"
        >
          <Image
            src={productImages?.[0] || noImageUrl}
            fluid
            rounded
            style={{
              maxHeight: "100px",
              objectFit: "contain",
              cursor: productImages?.length > 0 ? "pointer" : "default",
            }}
            alt={product.title || "Product Image"}
            onError={handleImageError}
            onClick={() =>
              productImages?.length > 0 &&
              handleShowImageModal(productImages, 0)
            }
          />
          {productImages && productImages.length > 1 && (
            <Button
              variant="dark"
              size="sm"
              onClick={() => handleShowImageModal(productImages, 0)}
              className="position-absolute bottom-0 start-50 translate-middle-x mb-2"
              style={{
                opacity: 0.8,
                fontSize: "0.75rem",
                padding: "0.1rem 0.4rem",
              }}
              title={t("myProductsPage.productCard.buttons.viewGallery", {
                count: productImages.length,
              })}
            >
              <FaEye size={10} className="me-1" /> {productImages.length}
            </Button>
          )}
        </Col>
        <Col md={9} lg={10}>
          <Card.Body className="p-3 position-relative">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div>
                <h5 className="mb-1 product-entry-title">{product.title}</h5>
                <div className="mb-1">
                  <Badge bg={statusBadgeBg}>{statusBadgeText}</Badge>
                  <small className="text-muted ms-2">
                    {t("myProductsPage.productCard.listPrice")}{" "}
                    {formatCurrency(product.price, product.currency)}
                  </small>
                  {agreedPriceForDisplay != null && mediationRequestData && (
                    <small className="text-primary ms-2 fw-bold">
                      {t("myProductsPage.productCard.agreedPrice")}{" "}
                      {formatCurrency(agreedPriceForDisplay, product.currency)}
                    </small>
                  )}
                </div>
                {isPendingMediatorSelection && !isMediatorAssignedBySeller && (
                  <Alert
                    variant="info"
                    className="p-1 px-2 small mt-1 d-inline-block"
                  >
                    <FaHandshake size={12} className="me-1" />
                    {t("myProductsPage.productCard.alerts.selectMediator")}
                  </Alert>
                )}
                {isMediatorAssignedBySeller && mediationRequestData && (
                  <Alert
                    variant="primary"
                    className="p-1 px-2 small mt-1 d-flex align-items-center"
                  >
                    <div className="me-2">
                      <CountdownCircle
                        assignmentTime={
                          mediationRequestData.updatedAt || product.updatedAt
                        }
                        onComplete={() => handleCountdownComplete(product._id)}
                      />
                    </div>
                    <span>
                      <FaHourglassHalf size={12} className="me-1" />
                      {t("myProductsPage.productCard.alerts.awaitingMediator")}
                    </span>
                  </Alert>
                )}
                {!sellerHasConfirmed &&
                  (isMediationOfferAcceptedByMediator ||
                    isEscrowFundedByBuyer) &&
                  !isPartiesConfirmed &&
                  !isActualMediationInProgress && (
                    <div className="mt-2">
                      <Alert variant="info" className="p-2 small d-block">
                        <strong>
                          {t(
                            "myProductsPage.productCard.alerts.sellerActionRequired"
                          )}
                        </strong>
                        <br />
                        <small className="text-muted">
                          {isEscrowFundedByBuyer
                            ? t(
                                "myProductsPage.productCard.alerts.buyerActionInfo"
                              )
                            : t(
                                "myProductsPage.productCard.alerts.sellerActionInfo"
                              )}
                        </small>
                      </Alert>
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-1"
                        onClick={() =>
                          handleSellerConfirmReadiness(
                            currentMediationRequestId
                          )
                        }
                        disabled={isLoadingThisSellerConfirmButton}
                      >
                        {isLoadingThisSellerConfirmButton ? (
                          <Spinner as="span" animation="border" size="sm" />
                        ) : (
                          t(
                            "myProductsPage.productCard.buttons.confirmReadiness"
                          )
                        )}
                      </Button>
                    </div>
                  )}
                {sellerHasConfirmed &&
                  productStatus !== "sold" &&
                  productStatus !== "Completed" &&
                  productStatus !== "Disputed" &&
                  productStatus !== "UnderDispute" &&
                  !isActualMediationInProgress &&
                  !isPartiesConfirmed &&
                  mediationRequestStatus !== "Completed" &&
                  mediationRequestStatus !== "Cancelled" &&
                  mediationRequestStatus !== "Disputed" && (
                    <Alert variant="success" className="p-2 small mt-2">
                      <FaCheck className="me-1" />
                      <Trans
                        i18nKey="myProductsPage.productCard.alerts.sellerConfirmed"
                        components={{ small: <small className="text-muted" /> }}
                      />
                    </Alert>
                  )}
                {(isPartiesConfirmed ||
                  isActualMediationInProgress ||
                  isDisputedProduct) &&
                  currentMediationRequestId &&
                  productStatus !== "sold" &&
                  productStatus !== "Completed" && (
                    <div className="mt-2">
                      <Alert
                        variant={
                          isActualMediationInProgress
                            ? "success"
                            : isDisputedProduct
                            ? "danger"
                            : "info"
                        }
                        className="p-2 small d-flex justify-content-between align-items-center"
                      >
                        <span>
                          {isDisputedProduct ? (
                            <FaExclamationTriangle className="me-1" />
                          ) : (
                            <FaHandshake className="me-1" />
                          )}
                          {isActualMediationInProgress
                            ? t(
                                "myProductsPage.productCard.alerts.mediationInProgress"
                              )
                            : isDisputedProduct
                            ? t(
                                "myProductsPage.productCard.alerts.disputeActive"
                              )
                            : "Parties confirmed. Chat starting."}
                          <br />
                          <small className="text-muted">
                            {t("myProductsPage.productCard.alerts.communicate")}
                          </small>
                        </span>
                        <Button
                          variant={isDisputedProduct ? "warning" : "primary"}
                          size="sm"
                          as={Link}
                          to={`/dashboard/mediation-chat/${currentMediationRequestId}`}
                          title={
                            isDisputedProduct
                              ? t(
                                  "myProductsPage.productCard.buttons.openDisputeChat"
                                )
                              : t("myProductsPage.productCard.buttons.openChat")
                          }
                        >
                          <FaCommentDots className="me-1 d-none d-sm-inline" />{" "}
                          {t("myProductsPage.productCard.buttons.openChat")}
                        </Button>
                      </Alert>
                    </div>
                  )}
              </div>
              <div className="product-entry-actions">
                {(isPendingMediatorSelection && !isMediatorAssignedBySeller) ||
                isMediatorAssignedBySeller ||
                isMediationOfferAcceptedByMediator ||
                isEscrowFundedByBuyer ||
                isPartiesConfirmed ||
                isActualMediationInProgress ? (
                  <>
                    <OverlayTrigger
                      placement="top"
                      overlay={
                        <Tooltip>
                          {t("myProductsPage.productCard.buttons.viewDetails")}
                        </Tooltip>
                      }
                    >
                      <Button
                        variant="link"
                        size="sm"
                        className="p-1 text-info"
                        onClick={() => handleOpenViewMediationDetails(product)}
                      >
                        <FaEye />
                      </Button>
                    </OverlayTrigger>
                    {isPendingMediatorSelection &&
                      !isMediatorAssignedBySeller && (
                        <OverlayTrigger
                          placement="top"
                          overlay={
                            <Tooltip>
                              {t(
                                "myProductsPage.productCard.buttons.selectMediator"
                              )}
                            </Tooltip>
                          }
                        >
                          <Button
                            variant="link"
                            size="sm"
                            className="p-1 text-success"
                            onClick={() =>
                              handleOpenSelectMediatorModal(product)
                            }
                          >
                            <FaUserFriends />
                          </Button>
                        </OverlayTrigger>
                      )}
                    {isPendingMediatorSelection &&
                      !isMediatorAssignedBySeller && (
                        <OverlayTrigger
                          placement="top"
                          overlay={
                            <Tooltip>
                              {t(
                                "myProductsPage.productCard.buttons.requestReturnToSale"
                              )}
                            </Tooltip>
                          }
                        >
                          <Button
                            variant="link"
                            size="sm"
                            className="p-1 text-warning"
                            onClick={handleReturnToSale}
                          >
                            <FaUndo />
                          </Button>
                        </OverlayTrigger>
                      )}
                  </>
                ) : canEditOrDelete ? (
                  <>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>{t("common.edit")}</Tooltip>}
                    >
                      <Button
                        variant="link"
                        size="sm"
                        className="p-1 text-secondary"
                        onClick={() =>
                          navigate(`/dashboard/edit-product/${product._id}`)
                        }
                      >
                        <FaEdit />
                      </Button>
                    </OverlayTrigger>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>{t("common.delete")}</Tooltip>}
                    >
                      <Button
                        variant="link"
                        size="sm"
                        className="p-1 text-danger"
                        onClick={() => handleDeleteProduct(product._id)}
                        disabled={productLoadingDeleteState}
                      >
                        {productLoadingDeleteState ? (
                          <Spinner size="sm" />
                        ) : (
                          <FaTrashAlt />
                        )}
                      </Button>
                    </OverlayTrigger>
                  </>
                ) : null}
              </div>
            </div>
            {isApproved && !mediationRequestData && (
              <div className="bids-section-vendor mt-3">
                <h6 className="bids-title small text-muted">
                  {t("myProductsPage.productCard.bids.title", {
                    count: sortedBids.length,
                  })}
                </h6>
                {sortedBids.length > 0 ? (
                  <ListGroup variant="flush" className="bids-list-vendor">
                    {sortedBids.slice(0, 5).map((bid, index) => {
                      const bidderId = bid.user?._id || bid.user;
                      const uniqueBidKey = `${product._id}-${
                        bidderId || "unknown"
                      }-${bid.amount}-${index}`;
                      const bidActionKey = `${product._id}_${bidderId}`;
                      const isAcceptingCurrent =
                        acceptingBid[bidActionKey] || false;
                      const isRejectingCurrent =
                        rejectingBid[bidActionKey] || false;
                      const isProcessing =
                        isAcceptingCurrent || isRejectingCurrent;
                      return (
                        <ListGroup.Item
                          key={uniqueBidKey}
                          className="d-flex justify-content-between align-items-center px-0 py-1 bid-list-item-vendor"
                        >
                          <div>
                            <Link
                              to={`/profile/${bidderId}`}
                              className="text-decoration-none me-2 bidder-name"
                              target="_blank"
                              title={t("common.viewProfile")}
                            >
                              {bid.user?.fullName || "Bidder"}
                            </Link>
                            <Badge bg="primary" pill>
                              {formatCurrency(bid.amount, bid.currency)}
                            </Badge>
                          </div>
                          <div className="bid-actions-vendor">
                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>{t("common.accept")}</Tooltip>}
                            >
                              <Button
                                variant="outline-success"
                                size="sm"
                                className="me-1 action-btn-vendor"
                                onClick={() =>
                                  handleAcceptBid(product._id, bid)
                                }
                                disabled={isProcessing}
                              >
                                {isAcceptingCurrent ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <FaCheck />
                                )}
                              </Button>
                            </OverlayTrigger>
                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>{t("common.reject")}</Tooltip>}
                            >
                              <Button
                                variant="outline-danger"
                                size="sm"
                                className="action-btn-vendor"
                                onClick={() =>
                                  openRejectModal(product._id, bid)
                                }
                                disabled={isProcessing}
                              >
                                {isRejectingCurrent ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <FaTimes />
                                )}
                              </Button>
                            </OverlayTrigger>
                          </div>
                        </ListGroup.Item>
                      );
                    })}
                    {sortedBids.length > 5 && (
                      <small className="text-muted d-block mt-1">
                        {t("myProductsPage.productCard.bids.moreBids", {
                          count: sortedBids.length - 5,
                        })}
                      </small>
                    )}
                  </ListGroup>
                ) : (
                  <p className="text-muted small mb-0">
                    {t("myProductsPage.productCard.bids.noBids")}
                  </p>
                )}
              </div>
            )}
            {(product.status === "sold" || product.status === "Completed") &&
              product.buyer && (
                <Alert variant="info" className="mt-3 p-2 small">
                  <Trans
                    i18nKey={
                      product.status === "Completed"
                        ? "myProductsPage.productCard.completedWith"
                        : "myProductsPage.productCard.soldTo"
                    }
                    values={{
                      name: product.buyer.fullName || "a user",
                      date: new Date(product.soldAt).toLocaleDateString(),
                    }}
                    components={[
                      <Link
                        to={`/profile/${product.buyer._id || product.buyer}`}
                        className="fw-bold"
                      />,
                    ]}
                  />
                </Alert>
              )}
          </Card.Body>
        </Col>
      </Row>
    </Card>
  );
};

export default ProductEntry;