// client/src/components/vendor/CommandsListVendor.jsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Spinner,
  Alert,
  ListGroup,
  Modal,
  Form,
  Tooltip,
  OverlayTrigger,
  Badge,
  Image,
  Tabs,
  Tab,
  Carousel,
} from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import {
  FaEdit,
  FaTrashAlt,
  FaCheck,
  FaTimes,
  FaHourglassHalf,
  FaDollarSign,
  FaTimesCircle,
  FaHandshake,
  FaEye,
  FaUserFriends,
  FaUndo,
  FaCommentDots,
  FaExclamationTriangle,
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  getProducts,
  deleteProduct,
  acceptBid,
  rejectBid,
} from "../../redux/actions/productAction";
import {
  assignSelectedMediator,
  sellerConfirmReadinessAction,
} from "../../redux/actions/mediationAction";
import SelectMediatorModal from "./SelectMediatorModal";
import MediationDetailsModal from "./MediationDetailsModal";
import { calculateMediatorFeeDetails } from "./feeCalculator";
import axios from "axios";

const fallbackImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23cccccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23ffffff">Error</text></svg>';
const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

const CommandsListVendor = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const userId = useSelector((state) => state.userReducer.user?._id);
  const allProducts = useSelector(
    (state) => state.productReducer?.Products ?? []
  );
  const loadingProducts = useSelector(
    (state) => state.productReducer?.loading ?? false
  );
  const errors = useSelector((state) => state.productReducer?.errors ?? null);
  const acceptingBid = useSelector(
    (state) => state.productReducer?.acceptingBid || {}
  );
  const rejectingBid = useSelector(
    (state) => state.productReducer?.rejectingBid || {}
  );
  const loadingDelete = useSelector(
    (state) => state.productReducer?.loadingDelete || {}
  );

  const [showRejectReasonModal, setShowRejectReasonModal] = useState(false);
  const [bidToReject, setBidToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [activeTab, setActiveTab] = useState("approved");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSelectMediatorModal, setShowSelectMediatorModal] = useState(false);
  const [showMediationDetailsModal, setShowMediationDetailsModal] =
    useState(false);
  const [productForMediationAction, setProductForMediationAction] =
    useState(null);
  const [availableMediators, setAvailableMediators] = useState([]);
  const [loadingMediators, setLoadingMediators] = useState(false);
  const [mediatorSuggestionsUsedOnce, setMediatorSuggestionsUsedOnce] =
    useState(false);
  const [refreshCountRemaining, setRefreshCountRemaining] = useState(1);
  const [sellerConfirmLoading, setSellerConfirmLoading] = useState({});
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedProductImages, setSelectedProductImages] = useState([]);

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

  useEffect(() => {
    if (userId) {
      setIsRefreshing(true);
      dispatch(getProducts()).finally(() => setIsRefreshing(false));
    }
  }, [dispatch, userId]);

  const myProducts = useMemo(() => {
    if (!userId || !Array.isArray(allProducts)) return [];
    return allProducts
      .filter((p) => String(p.user?._id || p.user) === userId)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [allProducts, userId]);

  const approvedProducts = useMemo(
    () =>
      myProducts.filter(
        (p) => p && p.status === "approved" && !p.currentMediationRequest
      ),
    [myProducts]
  );
  const pendingProducts = useMemo(
    () => myProducts.filter((p) => p && p.status === "pending"),
    [myProducts]
  );
  const mediationProducts = useMemo(
    () =>
      myProducts.filter(
        (p) =>
          p &&
          [
            "PendingMediatorSelection",
            "MediatorAssigned",
            "InProgress",
            "MediationOfferAccepted",
            "EscrowFunded",
            "PartiesConfirmed",
          ].includes(String(p.status).trim())
      ),
    [myProducts]
  );
  const soldProducts = useMemo(
    () => myProducts.filter((p) => p && p.status === "sold"),
    [myProducts]
  );
  const completedProducts = useMemo(
    () => myProducts.filter((p) => p && p.status === "Completed"),
    [myProducts]
  );
  const rejectedProducts = useMemo(
    () => myProducts.filter((p) => p && p.status === "rejected"),
    [myProducts]
  );
  const disputedProducts = useMemo(
    () =>
      myProducts.filter(
        (p) => p && (p.status === "Disputed" || p.status === "UnderDispute")
      ),
    [myProducts]
  );

  const handleShowImageModal = useCallback((images, index = 0) => {
    setSelectedProductImages(
      Array.isArray(images) && images.length > 0 ? images : [noImageUrl]
    );
    setCurrentImageIndex(index);
    setShowImageModal(true);
  }, []);

  const handleCloseImageModal = useCallback(() => setShowImageModal(false), []);
  const handleImageError = useCallback((e) => {
    if (e.target.src !== fallbackImageUrl) {
      e.target.onerror = null;
      e.target.src = fallbackImageUrl;
    }
  }, []);

  const openRejectModal = useCallback((productId, bid) => {
    setBidToReject({ productId, bid });
    setRejectReason("");
    setShowRejectReasonModal(true);
  }, []);

  const handleConfirmReject = useCallback(() => {
    if (bidToReject) {
      const bidderId = bidToReject.bid.user?._id || bidToReject.bid.user;
      if (!bidderId) {
        toast.error(t("myProductsPage.rejectModal.errorNoBidder"));
        return;
      }
      if (!rejectReason.trim()) {
        toast.warn(t("myProductsPage.rejectModal.errorNoReason"));
        return;
      }
      dispatch(rejectBid(bidToReject.productId, bidderId, rejectReason));
      setShowRejectReasonModal(false);
    }
  }, [dispatch, bidToReject, rejectReason, t]);

  const handleDeleteProduct = useCallback(
    (productId) => {
      if (
        productId &&
        window.confirm(t("myProductsPage.productCard.deleteConfirm"))
      ) {
        dispatch(deleteProduct(productId));
      }
    },
    [dispatch, t]
  );

  const handleAcceptBid = useCallback(
    (productId, bid) => {
      const bidderId = bid.user?._id || bid.user;
      const bidAmount = bid.amount;
      if (!bidderId || bidAmount == null || isNaN(Number(bidAmount))) {
        toast.error("Invalid bid data. Cannot accept.");
        return;
      }
      if (
        window.confirm(
          t("myProductsPage.productCard.acceptConfirm", {
            amount: formatCurrency(bidAmount, bid.currency),
            name: bid.user?.fullName || "this user",
          })
        )
      ) {
        dispatch(acceptBid(productId, bidderId, bidAmount)).then(() =>
          setActiveTab("mediation")
        );
      }
    },
    [dispatch, t, formatCurrency]
  );

  const handleOpenViewMediationDetails = useCallback((product) => {
    setProductForMediationAction(product);
    setShowMediationDetailsModal(true);
  }, []);

  const fetchRandomMediators = useCallback(
    async (currentProductData, isRefresh = false) => {
      const mediationRequestId =
        currentProductData?.currentMediationRequest?._id;
      if (!mediationRequestId) {
        toast.error(t("myProductsPage.mediatorModal.errorIdMissing"));
        setLoadingMediators(false);
        setAvailableMediators([]);
        return;
      }
      setLoadingMediators(true);
      let url = `/mediation/available-random/${mediationRequestId}`;
      const params = new URLSearchParams();
      if (isRefresh) {
        params.append("refresh", "true");
        if (availableMediators.length > 0)
          params.append(
            "exclude",
            availableMediators.map((m) => m._id).join(",")
          );
      }
      if (params.toString()) url += `?${params.toString()}`;
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error(t("myProductsPage.mediatorModal.errorNotAuthenticated"));
          setLoadingMediators(false);
          return;
        }
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(url, config);
        if (response.data && Array.isArray(response.data.mediators)) {
          setAvailableMediators(response.data.mediators);
          setRefreshCountRemaining(response.data.refreshCountRemaining ?? 0);
          if (isRefresh) {
            setMediatorSuggestionsUsedOnce(
              response.data.refreshCountRemaining <= 0
            );
            if (response.data.mediators.length === 0 && response.data.message)
              toast.info(response.data.message);
            else if (response.data.mediators.length > 0)
              toast.success(
                t("myProductsPage.mediatorModal.successSuggestions")
              );
          }
        } else {
          setAvailableMediators([]);
          setRefreshCountRemaining(0);
          toast.info(
            response.data.message ||
              t("myProductsPage.mediatorModal.infoNoMediators")
          );
        }
      } catch (error) {
        toast.error(
          error.response?.data?.msg ||
            t("myProductsPage.mediatorModal.errorLoadFailed")
        );
        setAvailableMediators([]);
        setRefreshCountRemaining(0);
      } finally {
        setLoadingMediators(false);
      }
    },
    [availableMediators, t]
  );

  const handleOpenSelectMediatorModal = useCallback(
    (product) => {
      if (!product || !product.currentMediationRequest?._id) {
        toast.error(t("myProductsPage.mediatorModal.errorIdMissing"));
        return;
      }
      setProductForMediationAction(product);
      setShowSelectMediatorModal(true);
      setMediatorSuggestionsUsedOnce(false);
      setRefreshCountRemaining(1);
      fetchRandomMediators(product, false);
    },
    [fetchRandomMediators, t]
  );

  const handleAssignMediator = useCallback(
    async (mediatorIdToAssign) => {
      if (
        !productForMediationAction ||
        !productForMediationAction.currentMediationRequest?._id ||
        !mediatorIdToAssign
      )
        return;
      const mediationRequestId =
        productForMediationAction.currentMediationRequest._id;
      setLoadingMediators(true);
      dispatch(assignSelectedMediator(mediationRequestId, mediatorIdToAssign))
        .then(() => {
          setShowSelectMediatorModal(false);
          setAvailableMediators([]);
          setActiveTab("mediation");
        })
        .finally(() => setLoadingMediators(false));
    },
    [dispatch, productForMediationAction]
  );

  const handleSellerConfirmReadiness = useCallback(
    (mediationRequestId) => {
      if (!mediationRequestId || sellerConfirmLoading[mediationRequestId])
        return;
      setSellerConfirmLoading((prev) => ({
        ...prev,
        [mediationRequestId]: true,
      }));
      dispatch(sellerConfirmReadinessAction(mediationRequestId))
        .then(() => dispatch(getProducts()))
        .finally(() =>
          setSellerConfirmLoading((prev) => ({
            ...prev,
            [mediationRequestId]: false,
          }))
        );
    },
    [dispatch, sellerConfirmLoading]
  );

  const renderProductEntry = useCallback(
    (product) => {
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
        productStatus === "InProgress" ||
        mediationRequestStatus === "InProgress";
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
        statusBadgeText = t(
          "myProductsPage.productCard.status.awaitingMediator"
        );
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
        statusBadgeText = t(
          "myProductsPage.productCard.status.partiesConfirmed"
        );
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
        statusBadgeText = t(
          "myProductsPage.productCard.status.pendingApproval"
        );
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
                    <h5 className="mb-1 product-entry-title">
                      {product.title}
                    </h5>
                    <div className="mb-1">
                      <Badge bg={statusBadgeBg}>{statusBadgeText}</Badge>
                      <small className="text-muted ms-2">
                        {t("myProductsPage.productCard.listPrice")}{" "}
                        {formatCurrency(product.price, product.currency)}
                      </small>
                      {agreedPriceForDisplay != null &&
                        mediationRequestData && (
                          <small className="text-primary ms-2 fw-bold">
                            {t("myProductsPage.productCard.agreedPrice")}{" "}
                            {formatCurrency(
                              agreedPriceForDisplay,
                              product.currency
                            )}
                          </small>
                        )}
                    </div>
                    {isPendingMediatorSelection &&
                      !isMediatorAssignedBySeller && (
                        <Alert
                          variant="info"
                          className="p-1 px-2 small mt-1 d-inline-block"
                        >
                          <FaHandshake size={12} className="me-1" />
                          {t(
                            "myProductsPage.productCard.alerts.selectMediator"
                          )}
                        </Alert>
                      )}
                    {isMediatorAssignedBySeller && (
                      <Alert
                        variant="primary"
                        className="p-1 px-2 small mt-1 d-inline-block"
                      >
                        <FaHourglassHalf size={12} className="me-1" />
                        {t(
                          "myProductsPage.productCard.alerts.awaitingMediator"
                        )}
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
                            components={{
                              small: <small className="text-muted" />,
                            }}
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
                                {t(
                                  "myProductsPage.productCard.alerts.communicate"
                                )}
                              </small>
                            </span>
                            <Button
                              variant={
                                isDisputedProduct ? "warning" : "primary"
                              }
                              size="sm"
                              as={Link}
                              to={`/dashboard/mediation-chat/${currentMediationRequestId}`}
                              title={
                                isDisputedProduct
                                  ? t(
                                      "myProductsPage.productCard.buttons.openDisputeChat"
                                    )
                                  : t(
                                      "myProductsPage.productCard.buttons.openChat"
                                    )
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
                    {(isPendingMediatorSelection &&
                      !isMediatorAssignedBySeller) ||
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
                              {t(
                                "myProductsPage.productCard.buttons.viewDetails"
                              )}
                            </Tooltip>
                          }
                        >
                          <Button
                            variant="link"
                            size="sm"
                            className="p-1 text-info"
                            onClick={() =>
                              handleOpenViewMediationDetails(product)
                            }
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
                                onClick={() => {}}
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
                            onClick={() => navigate("/dashboard/comptes")}
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
                                  overlay={
                                    <Tooltip>{t("common.accept")}</Tooltip>
                                  }
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
                                  overlay={
                                    <Tooltip>{t("common.reject")}</Tooltip>
                                  }
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
                {(product.status === "sold" ||
                  product.status === "Completed") &&
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
                            to={`/profile/${
                              product.buyer._id || product.buyer
                            }`}
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
    },
    [
      /* ...dependencies... */
    ]
  );

  if (loadingProducts && myProducts.length === 0)
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p>{t("myProductsPage.loading")}</p>
      </Container>
    );
  if (errors)
    return (
      <Container className="py-5">
        <Alert
          variant="danger"
          dismissible
          onClose={() => dispatch({ type: "CLEAR_PRODUCT_ERRORS" })}
        >
          {t("myProductsPage.error")}{" "}
          {typeof errors === "string"
            ? errors
            : errors.msg || t("myProductsPage.genericError")}
        </Alert>
      </Container>
    );

  return (
    <Container fluid className="py-4 commands-list-vendor-page">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 className="page-title mb-0">{t("myProductsPage.title")}</h2>
        </Col>
        <Col xs="auto">
          <Button as={Link} to="/dashboard/comptes" variant="primary" size="sm">
            {t("myProductsPage.addNewButton")}
          </Button>
        </Col>
      </Row>
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k || "approved")}
        className="mb-3 product-tabs"
        fill
      >
        <Tab
          eventKey="approved"
          title={
            <>
              <FaCheck className="me-1" /> {t("myProductsPage.tabs.approved")}{" "}
              <Badge pill bg="success" className="ms-1">
                {approvedProducts.length}
              </Badge>
            </>
          }
        >
          {isRefreshing ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" />
              <p className="mt-2 mb-0">{t("myProductsPage.refreshing")}</p>
            </div>
          ) : approvedProducts.length > 0 ? (
            approvedProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              {t("myProductsPage.noProducts.approved")}
            </Alert>
          )}
        </Tab>
        <Tab
          eventKey="pending"
          title={
            <>
              <FaHourglassHalf className="me-1" />{" "}
              {t("myProductsPage.tabs.pending")}{" "}
              <Badge pill bg="warning" text="dark" className="ms-1">
                {pendingProducts.length}
              </Badge>
            </>
          }
        >
          {isRefreshing ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" />
              <p className="mt-2 mb-0">{t("myProductsPage.refreshing")}</p>
            </div>
          ) : pendingProducts.length > 0 ? (
            pendingProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              {t("myProductsPage.noProducts.pending")}
            </Alert>
          )}
        </Tab>
        <Tab
          eventKey="mediation"
          title={
            <>
              <FaHandshake className="me-1" />{" "}
              {t("myProductsPage.tabs.mediation")}{" "}
              <Badge pill bg="primary" className="ms-1">
                {mediationProducts.length}
              </Badge>
            </>
          }
        >
          {isRefreshing ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" />
              <p className="mt-2 mb-0">{t("myProductsPage.refreshing")}</p>
            </div>
          ) : mediationProducts.length > 0 ? (
            mediationProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              {t("myProductsPage.noProducts.mediation")}
            </Alert>
          )}
        </Tab>
        <Tab
          eventKey="disputed"
          title={
            <>
              <FaExclamationTriangle className="me-1 text-primary" />{" "}
              {t("myProductsPage.tabs.disputed")}{" "}
              <Badge pill bg="info" className="ms-1">
                {disputedProducts.length}
              </Badge>
            </>
          }
        >
          {isRefreshing ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" />
              <p className="mt-2 mb-0">{t("myProductsPage.refreshing")}</p>
            </div>
          ) : disputedProducts.length > 0 ? (
            disputedProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              {t("myProductsPage.noProducts.disputed")}
            </Alert>
          )}
        </Tab>
        <Tab
          eventKey="sold"
          title={
            <>
              <FaDollarSign className="me-1" /> {t("myProductsPage.tabs.sold")}{" "}
              <Badge pill bg="secondary" className="ms-1">
                {soldProducts.length + completedProducts.length}
              </Badge>
            </>
          }
        >
          {isRefreshing ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" />
              <p className="mt-2 mb-0">{t("myProductsPage.refreshing")}</p>
            </div>
          ) : soldProducts.length + completedProducts.length > 0 ? (
            [...soldProducts, ...completedProducts]
              .sort(
                (a, b) =>
                  new Date(b.soldAt || b.updatedAt || 0) -
                  new Date(a.soldAt || a.updatedAt || 0)
              )
              .map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              {t("myProductsPage.noProducts.sold")}
            </Alert>
          )}
        </Tab>
        <Tab
          eventKey="rejected"
          title={
            <>
              <FaTimesCircle className="me-1" />{" "}
              {t("myProductsPage.tabs.rejected")}{" "}
              <Badge pill bg="danger" className="ms-1">
                {rejectedProducts.length}
              </Badge>
            </>
          }
        >
          {isRefreshing ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" />
              <p className="mt-2 mb-0">{t("myProductsPage.refreshing")}</p>
            </div>
          ) : rejectedProducts.length > 0 ? (
            rejectedProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              {t("myProductsPage.noProducts.rejected")}
            </Alert>
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
          {selectedProductImages.length > 0 ? (
            <Carousel
              activeIndex={currentImageIndex}
              onSelect={(idx) => setCurrentImageIndex(idx)}
              interval={null}
              indicators={selectedProductImages.length > 1}
              controls={selectedProductImages.length > 1}
            >
              {selectedProductImages.map((imgUrl, index) => (
                <Carousel.Item key={index}>
                  <Image
                    src={imgUrl || fallbackImageUrl}
                    fluid
                    className="lightbox-image"
                    onError={handleImageError}
                    alt={t("myProductsPage.imageModal.title", {
                      index: index + 1,
                    })}
                    style={{ maxHeight: "80vh", objectFit: "contain" }}
                  />
                </Carousel.Item>
              ))}
            </Carousel>
          ) : (
            <Alert variant="dark" className="m-5">
              {t("myProductsPage.imageModal.unavailable")}
            </Alert>
          )}
          <Button
            variant="light"
            onClick={handleCloseImageModal}
            className="position-absolute top-0 end-0 m-2"
            aria-label={t("myProductsPage.imageModal.close")}
            style={{ zIndex: 1056 }}
          >
            ×
          </Button>
        </Modal.Body>
      </Modal>
      {productForMediationAction && (
        <>
          <SelectMediatorModal
            show={showSelectMediatorModal}
            onHide={() => {
              setShowSelectMediatorModal(false);
              setAvailableMediators([]);
            }}
            product={productForMediationAction}
            availableMediators={availableMediators}
            loading={loadingMediators}
            onSelectMediator={handleAssignMediator}
            onRequestNewSuggestions={() => {
              /* logic here */
            }}
            suggestionsUsedOnce={
              mediatorSuggestionsUsedOnce || refreshCountRemaining <= 0
            }
          />
          <MediationDetailsModal
            show={showMediationDetailsModal}
            onHide={() => setShowMediationDetailsModal(false)}
            product={productForMediationAction}
            calculateFee={calculateMediatorFeeDetails}
          />
        </>
      )}
      <Modal
        show={showRejectReasonModal}
        onHide={() => setShowRejectReasonModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{t("myProductsPage.rejectModal.title")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <Trans
              i18nKey="myProductsPage.rejectModal.reasonFor"
              values={{
                name: bidToReject?.bid?.user?.fullName || "Bidder",
                amount: formatCurrency(
                  bidToReject?.bid?.amount,
                  bidToReject?.bid?.currency
                ),
              }}
              components={{ strong: <strong /> }}
            />
          </p>
          <Form.Control
            as="textarea"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t("myProductsPage.rejectModal.placeholder")}
            required
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowRejectReasonModal(false)}
          >
            {t("myProductsPage.rejectModal.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmReject}
            disabled={
              !rejectReason.trim() ||
              rejectingBid[
                `${bidToReject?.productId}_${bidToReject?.bid?.user?._id}`
              ]
            }
          >
            {rejectingBid[
              `${bidToReject?.productId}_${bidToReject?.bid?.user?._id}`
            ] ? (
              <Spinner size="sm" />
            ) : (
              t("myProductsPage.rejectModal.confirm")
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default CommandsListVendor;
