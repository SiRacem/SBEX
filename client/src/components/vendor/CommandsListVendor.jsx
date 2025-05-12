// client/src/components/vendor/CommandsListVendor.jsx
// *** نسخة كاملة مع كل التعديلات الأخيرة للبائع ***

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
} from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
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
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  getProducts,
  deleteProduct,
  acceptBid,
  rejectBid,
} from "../../redux/actions/productAction";
import {
  assignSelectedMediator, // لتعيين الوسيط
  sellerConfirmReadinessAction, // لتأكيد استعداد البائع
} from "../../redux/actions/mediationAction"; // تأكد من المسار الصحيح
import { getProfile } from "../../redux/actions/userAction";
import SelectMediatorModal from "./SelectMediatorModal";
import MediationDetailsModal from "./MediationDetailsModal";
import { calculateMediatorFeeDetails } from "./feeCalculator";
import axios from "axios";

const fallbackImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23cccccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23ffffff">Error</text></svg>';
const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

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

const CommandsListVendor = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const userId = useSelector((state) => state.userReducer?.user?._id);
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
  const [confirmingSellerReadiness, setConfirmingSellerReadiness] = useState(
    {}
  );

  useEffect(() => {
    if (userId) {
      dispatch(getProducts());
    }
  }, [dispatch, userId]);

  const myProducts = useMemo(() => {
    if (!userId || !Array.isArray(allProducts)) return [];
    return allProducts
      .filter((p) => String(p.user?._id || p.user) === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.date_added || 0) -
          new Date(a.createdAt || a.date_added || 0)
      );
  }, [allProducts, userId]);

  const approvedProducts = useMemo(
    () => myProducts.filter((p) => p && p.status === "approved"),
    [myProducts]
  );
  const pendingProducts = useMemo(
    () => myProducts.filter((p) => p && p.status === "pending"),
    [myProducts]
  );
  const mediationProducts = useMemo(() => {
    if (!myProducts || myProducts.length === 0) return [];
    return myProducts.filter((p) => {
      if (!p || !p.status) return false;
      const statusValue = String(p.status).trim();
      const mediationRequestStatus = p.currentMediationRequest?.status; // حالة طلب الوساطة
      return (
        statusValue === "PendingMediatorSelection" ||
        statusValue === "MediatorAssigned" ||
        mediationRequestStatus === "MediationOfferAccepted" || // تحقق من حالة طلب الوساطة أيضًا
        statusValue === "InProgress" ||
        mediationRequestStatus === "InProgress"
      );
    });
  }, [myProducts]);
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

  const openRejectModal = useCallback((productId, bid) => {
    setBidToReject({ productId, bid });
    setRejectReason("");
    setShowRejectReasonModal(true);
  }, []);

  const handleConfirmReject = useCallback(() => {
    if (bidToReject) {
      const bidderId = bidToReject.bid.user?._id || bidToReject.bid.user;
      if (bidderId) {
        if (!rejectReason.trim()) {
          toast.warn("Please provide a rejection reason.");
          return;
        }
        dispatch(rejectBid(bidToReject.productId, bidderId, rejectReason))
          .then(() => {
            /* toast handled by action */
          })
          .catch(() => {
            /* toast handled by action */
          });
        setShowRejectReasonModal(false);
      } else {
        toast.error("Could not identify bidder ID.");
      }
    }
  }, [dispatch, bidToReject, rejectReason]);

  const handleDeleteProduct = useCallback(
    (productId) => {
      if (
        productId &&
        window.confirm("Are you sure you want to delete this product?")
      ) {
        dispatch(deleteProduct(productId))
          .then(() => {
            /* toast handled by action */
          })
          .catch(() => {
            /* toast handled by action */
          });
      }
    },
    [dispatch]
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
          `Accept bid of ${formatCurrency(bidAmount, bid.currency)} from ${
            bid.user?.fullName || "this user"
          }? This will move the product to mediation.`
        )
      ) {
        dispatch(acceptBid(productId, bidderId, bidAmount))
          .then(() => {
            setActiveTab("mediation");
          })
          .catch((err) => {
            console.error(
              "Accept bid failed in component:",
              err
            ); /* toast handled by action */
          });
      }
    },
    [dispatch, setActiveTab]
  );

  const handleOpenViewMediationDetails = useCallback((product) => {
    if (!product || (!product.agreedPrice && !product.price)) {
      toast.error("Product details or price is missing.");
      return;
    }
    setProductForMediationAction(product);
    setShowMediationDetailsModal(true);
  }, []);

  const fetchRandomMediators = useCallback(
    async (currentProductData, isRefresh = false) => {
      const mediationRequestId =
        currentProductData?.currentMediationRequest?._id;
      if (!mediationRequestId) {
        toast.error("Mediation request ID is missing. Cannot fetch mediators.");
        setAvailableMediators([]);
        setLoadingMediators(false);
        return;
      }
      setLoadingMediators(true);
      let url = `/api/mediation/available-random/${mediationRequestId}`; // تأكد أن /api/ موجود إذا كنت تستخدمه في server.js
      const params = new URLSearchParams();
      if (isRefresh) {
        params.append("refresh", "true");
        if (availableMediators.length > 0) {
          params.append(
            "exclude",
            availableMediators.map((m) => m._id).join(",")
          );
        }
      }
      if (params.toString()) url += `?${params.toString()}`;
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error("Authentication token not found. Please log in.");
          setLoadingMediators(false);
          return;
        }
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(url, config);
        if (response.data && Array.isArray(response.data.mediators)) {
          setAvailableMediators(response.data.mediators);
          setRefreshCountRemaining(response.data.refreshCountRemaining || 0);
          if (isRefresh) {
            setMediatorSuggestionsUsedOnce(
              response.data.refreshCountRemaining <= 0
            );
            if (response.data.mediators.length === 0 && response.data.message)
              toast.info(response.data.message);
            else if (response.data.mediators.length > 0)
              toast.success("New mediator suggestions loaded!");
          }
        } else {
          setAvailableMediators([]);
          setRefreshCountRemaining(0);
          toast.info(
            response.data.message ||
              "No mediators found or unexpected response."
          );
        }
      } catch (error) {
        toast.error(
          error.response?.data?.msg ||
            "Could not load mediators. Please try again."
        );
        setAvailableMediators([]);
        setRefreshCountRemaining(0);
      } finally {
        setLoadingMediators(false);
      }
    },
    [availableMediators]
  );

  const handleOpenSelectMediatorModal = useCallback(
    (product) => {
      if (!product || !product.currentMediationRequest?._id) {
        toast.error(
          "Cannot open mediator selection: Mediation request ID is missing. Please ensure product data is up-to-date."
        );
        dispatch(getProducts());
        return;
      }
      setProductForMediationAction(product);
      setShowSelectMediatorModal(true);
      setMediatorSuggestionsUsedOnce(false);
      setRefreshCountRemaining(1);
      fetchRandomMediators(product, false);
    },
    [dispatch, fetchRandomMediators]
  );

  const handleRequestReturnToSale = useCallback((product) => {
    const mediationRequestId =
      product.currentMediationRequest?._id || product._id;
    if (
      window.confirm(
        "Are you sure you want to request to return this product to sale? This can be used if the buyer is unresponsive. The request will be reviewed by administration."
      )
    ) {
      toast.info(
        "Your request to return the product to sale has been submitted for review (Feature in development)."
      );
    }
  }, []);

  const handleRequestNewMediatorSuggestions = useCallback(() => {
    if (
      productForMediationAction &&
      refreshCountRemaining > 0 &&
      !mediatorSuggestionsUsedOnce
    ) {
      fetchRandomMediators(productForMediationAction, true);
    } else if (mediatorSuggestionsUsedOnce || refreshCountRemaining <= 0) {
      toast.warn(
        "You have already used the new suggestions option, or no more suggestions are allowed for this item."
      );
    }
  }, [
    productForMediationAction,
    mediatorSuggestionsUsedOnce,
    refreshCountRemaining,
    fetchRandomMediators,
  ]);

  const handleAssignMediator = useCallback(
    async (mediatorIdToAssign) => {
      if (
        !productForMediationAction ||
        !productForMediationAction.currentMediationRequest?._id
      ) {
        toast.error(
          "Cannot assign mediator: Product or Mediation Request details are missing."
        );
        return;
      }
      if (!mediatorIdToAssign) {
        toast.error("Cannot assign mediator: No mediator ID provided.");
        return;
      }
      const currentProduct = productForMediationAction;
      const mediationRequestId = currentProduct.currentMediationRequest._id;
      setLoadingMediators(true);
      dispatch(assignSelectedMediator(mediationRequestId, mediatorIdToAssign))
        .then((actionResponse) => {
          setShowSelectMediatorModal(false);
          setAvailableMediators([]);
          const updatedMediationApiRequest = actionResponse?.mediationRequest; // الـ mediationRequest المحدث من الـ API
          const productFromApi = updatedMediationApiRequest?.product; // المنتج داخل الـ mediationRequest المحدث

          dispatch({
            type: "UPDATE_SINGLE_PRODUCT_IN_STORE",
            payload: {
              _id: currentProduct._id, // استخدم معرف المنتج الأصلي
              status: productFromApi?.status || "MediatorAssigned", // تحديث حالة المنتج الرئيسية
              currentMediationRequest: updatedMediationApiRequest
                ? {
                    _id: updatedMediationApiRequest._id,
                    status: updatedMediationApiRequest.status,
                    mediator: updatedMediationApiRequest.mediator,
                    sellerConfirmedStart:
                      updatedMediationApiRequest.sellerConfirmedStart,
                    buyerConfirmedStart:
                      updatedMediationApiRequest.buyerConfirmedStart,
                  }
                : {
                    ...(currentProduct.currentMediationRequest || {}),
                    status: "MediatorAssigned",
                  },
            },
          });
          setActiveTab("mediation");
        })
        .catch(() => {})
        .finally(() => {
          setLoadingMediators(false);
          dispatch(getProducts());
        });
    },
    [dispatch, productForMediationAction, setActiveTab]
  );

  const handleSellerConfirmReadiness = useCallback(
    (mediationRequestId, productId) => {
      if (!mediationRequestId) {
        toast.error("Mediation Request ID is missing for confirmation.");
        return;
      }
      if (confirmingSellerReadiness[mediationRequestId]) return;
      setConfirmingSellerReadiness((prev) => ({
        ...prev,
        [mediationRequestId]: true,
      }));
      dispatch(sellerConfirmReadinessAction(mediationRequestId))
        .then((actionResponse) => {
          const updatedApiMediationRequest = actionResponse?.mediationRequest;
          const productInState = allProducts.find((p) => p._id === productId);

          if (productInState) {
            dispatch({
              type: "UPDATE_SINGLE_PRODUCT_IN_STORE",
              payload: {
                _id: productId,
                currentMediationRequest: updatedApiMediationRequest
                  ? {
                      _id: updatedApiMediationRequest._id,
                      status: updatedApiMediationRequest.status,
                      sellerConfirmedStart:
                        updatedApiMediationRequest.sellerConfirmedStart,
                      buyerConfirmedStart:
                        updatedApiMediationRequest.buyerConfirmedStart,
                      mediator: updatedApiMediationRequest.mediator,
                    }
                  : {
                      ...(productInState.currentMediationRequest || {}),
                      sellerConfirmedStart: true,
                    },
                status:
                  updatedApiMediationRequest?.product?.status ||
                  productInState.status,
              },
            });
          }
        })
        .catch(() => {})
        .finally(() => {
          setConfirmingSellerReadiness((prev) => ({
            ...prev,
            [mediationRequestId]: false,
          }));
          dispatch(getProducts());
        });
    },
    [dispatch, confirmingSellerReadiness, allProducts]
  );

  const renderProductEntry = useCallback(
    (product) => {
      if (!product || !product._id) return null;
      const sortedBids = [...(product.bids || [])].sort(
        (a, b) => b.amount - a.amount
      );
      const productLoadingDelete = loadingDelete[product._id] ?? false;

      const productStatus = product.status;
      const mediationRequestData = product.currentMediationRequest; // قد يكون null أو كائن
      const mediationRequestStatus = mediationRequestData?.status;

      const isPendingMediatorSelection =
        productStatus === "PendingMediatorSelection";
      const isMediatorAssigned =
        productStatus === "MediatorAssigned" &&
        mediationRequestStatus === "MediatorAssigned";
      const isMediationOfferAccepted =
        mediationRequestStatus === "MediationOfferAccepted";
      const isActualMediationInProgress =
        productStatus === "InProgress" ||
        mediationRequestStatus === "InProgress";

      const sellerHasConfirmed = mediationRequestData?.sellerConfirmedStart;
      const buyerHasConfirmed = mediationRequestData?.buyerConfirmedStart;

      const isSold = productStatus === "sold";
      const isCompleted = productStatus === "Completed";
      const isApproved = productStatus === "approved";

      const canEditOrDelete =
        isApproved &&
        !isPendingMediatorSelection &&
        !isMediatorAssigned &&
        !isMediationOfferAccepted &&
        !isActualMediationInProgress &&
        !isSold &&
        !isCompleted;

      const agreedPriceForDisplay = product.agreedPrice;
      const currentMediationRequestId = mediationRequestData?._id;
      const isLoadingThisSellerConfirm = currentMediationRequestId
        ? confirmingSellerReadiness[currentMediationRequestId]
        : false;

      let statusBadgeText = productStatus
        ? productStatus.charAt(0).toUpperCase() + productStatus.slice(1)
        : "Unknown";
      let statusBadgeBg = "secondary";

      if (
        isApproved &&
        !isPendingMediatorSelection &&
        !isMediatorAssigned &&
        !isMediationOfferAccepted &&
        !isActualMediationInProgress
      )
        statusBadgeBg = "success";
      else if (isPendingMediatorSelection) {
        statusBadgeText = "Pending Mediator Selection";
        statusBadgeBg = "info text-dark";
      } else if (isMediatorAssigned) {
        statusBadgeText = "Mediator Assigned";
        statusBadgeBg = "primary";
      } else if (isMediationOfferAccepted) {
        statusBadgeText = "Awaiting Party Confirmations";
        statusBadgeBg = "info";
      } // لون مختلف
      else if (isActualMediationInProgress) {
        statusBadgeText = "Mediation In Progress";
        statusBadgeBg = "success";
      } else if (isCompleted) {
        statusBadgeText = "Completed";
        statusBadgeBg = "dark";
      } else if (isSold) {
        statusBadgeText = "Sold";
        statusBadgeBg = "secondary";
      } else if (productStatus === "pending") {
        statusBadgeText = "Pending Admin Approval";
        statusBadgeBg = "warning text-dark";
      } else if (productStatus === "rejected") {
        statusBadgeText = "Rejected by Admin";
        statusBadgeBg = "danger";
      }

      return (
        <Card
          key={product._id}
          className={`mb-3 product-entry shadow-sm ${
            isPendingMediatorSelection ||
            isMediatorAssigned ||
            isMediationOfferAccepted ||
            isActualMediationInProgress
              ? "border-primary"
              : ""
          }`}
        >
          <Row className="g-0">
            <Col
              md={3}
              lg={2}
              className="text-center p-2 product-entry-img-col"
            >
              <Image
                src={product.imageUrls?.[0] || noImageUrl}
                fluid
                rounded
                style={{ maxHeight: "100px", objectFit: "contain" }}
                alt={product.title || "Product Image"}
                onError={(e) => {
                  e.target.src = fallbackImageUrl;
                }}
              />
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
                        Listed Price:
                        {formatCurrency(product.price, product.currency)}
                      </small>
                      {(isPendingMediatorSelection ||
                        isMediatorAssigned ||
                        isMediationOfferAccepted ||
                        isActualMediationInProgress) &&
                        agreedPriceForDisplay != null && (
                          <small className="text-primary ms-2 fw-bold">
                            Agreed:
                            {formatCurrency(
                              agreedPriceForDisplay,
                              product.currency
                            )}
                          </small>
                        )}
                    </div>
                    {isPendingMediatorSelection && !isMediatorAssigned && (
                      <Alert
                        variant="info"
                        className="p-1 px-2 small mt-1 d-inline-block"
                      >
                        <FaHandshake size={12} className="me-1" /> Please Select
                        a Mediator
                      </Alert>
                    )}
                    {isMediatorAssigned &&
                      !isMediationOfferAccepted &&
                      !isActualMediationInProgress && (
                        <Alert
                          variant="primary"
                          className="p-1 px-2 small mt-1 d-inline-block"
                        >
                          <FaHourglassHalf size={12} className="me-1" />
                          Mediator Assigned. Waiting for their response.
                        </Alert>
                      )}
                    {isMediationOfferAccepted &&
                      !isActualMediationInProgress && (
                        <div className="mt-2">
                          <Alert variant="info" className="p-2 small d-block">
                            Mediator
                            <strong>
                              {mediationRequestData?.mediator?.fullName ||
                                "N/A"}
                            </strong>
                            has accepted.
                            <br />
                            {sellerHasConfirmed &&
                            buyerHasConfirmed &&
                            mediationRequestStatus === "EscrowFunded" ? (
                              <span className="text-success fw-bold d-block mt-1">
                                <FaCheck /> All parties confirmed, funds
                                secured. Mediation will start soon.
                              </span>
                            ) : sellerHasConfirmed ? (
                              <span className="text-success fw-bold d-block mt-1">
                                <FaCheck /> You've confirmed. Waiting for buyer
                                to confirm & deposit funds.
                              </span>
                            ) : (
                              <span className="text-warning fw-bold d-block mt-1">
                                Action Required: Confirm your readiness.
                              </span>
                            )}
                            {!buyerHasConfirmed && (
                              <span className="d-block mt-1 text-muted small">
                                Buyer needs to confirm and deposit funds.
                              </span>
                            )}
                          </Alert>
                          {!sellerHasConfirmed && currentMediationRequestId && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="mt-1"
                              onClick={() =>
                                handleSellerConfirmReadiness(
                                  currentMediationRequestId,
                                  product._id
                                )
                              }
                              disabled={isLoadingThisSellerConfirm}
                            >
                              {isLoadingThisSellerConfirm ? (
                                <Spinner
                                  as="span"
                                  animation="border"
                                  size="sm"
                                />
                              ) : (
                                "Confirm My Readiness"
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    {isActualMediationInProgress && (
                      <Alert
                        variant="success"
                        className="p-1 px-2 small mt-1 d-inline-block"
                      >
                        <FaHandshake size={12} className="me-1" /> Mediation In
                        Progress.
                      </Alert>
                    )}
                  </div>
                  <div className="product-entry-actions">
                    {isPendingMediatorSelection && !isMediatorAssigned ? (
                      <>
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>View Details</Tooltip>}
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
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Select Mediator</Tooltip>}
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
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip> Request Return to Sale </Tooltip>}
                        >
                          <Button
                            variant="link"
                            size="sm"
                            className="p-1 text-warning"
                            onClick={() => handleRequestReturnToSale(product)}
                          >
                            <FaUndo />
                          </Button>
                        </OverlayTrigger>
                      </>
                    ) : isMediatorAssigned ||
                      isMediationOfferAccepted ||
                      isActualMediationInProgress ? (
                      <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>View Mediation Details</Tooltip>}
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
                    ) : canEditOrDelete ? (
                      <>
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Edit Product</Tooltip>}
                        >
                          <Button
                            variant="link"
                            size="sm"
                            className="p-1 text-secondary"
                            onClick={() =>
                              navigate(`/edit-product/${product._id}`)
                            }
                          >
                            <FaEdit />
                          </Button>
                        </OverlayTrigger>
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Delete Product</Tooltip>}
                        >
                          <Button
                            variant="link"
                            size="sm"
                            className="p-1 text-danger"
                            onClick={() => handleDeleteProduct(product._id)}
                            disabled={productLoadingDelete}
                          >
                            {productLoadingDelete ? (
                              <Spinner size="sm" animation="border" />
                            ) : (
                              <FaTrashAlt />
                            )}
                          </Button>
                        </OverlayTrigger>
                      </>
                    ) : null}
                  </div>
                </div>
                {isApproved &&
                  !isPendingMediatorSelection &&
                  !isMediatorAssigned &&
                  !isMediationOfferAccepted &&
                  !isActualMediationInProgress && (
                    <div className="bids-section-vendor mt-3">
                      <h6 className="bids-title small text-muted">
                        Received Bids ({sortedBids.length})
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
                              acceptingBid[bidActionKey] ?? false;
                            const isRejectingCurrent =
                              rejectingBid[bidActionKey] ?? false;
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
                                    title="View Profile"
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
                                    overlay={<Tooltip>Accept Bid</Tooltip>}
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
                                        <Spinner size="sm" animation="border" />
                                      ) : (
                                        <FaCheck />
                                      )}
                                    </Button>
                                  </OverlayTrigger>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={<Tooltip>Reject Bid</Tooltip>}
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
                                        <Spinner size="sm" animation="border" />
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
                              ...and {sortedBids.length - 5} more bids.
                            </small>
                          )}
                        </ListGroup>
                      ) : (
                        <p className="text-muted small mb-0">
                          No bids received yet.
                        </p>
                      )}
                    </div>
                  )}
                {(isSold || isCompleted) && product.buyer && (
                  <Alert variant="info" className="mt-3 p-2 small">
                    {isCompleted
                      ? "Transaction Completed with Buyer: "
                      : "Sold to "}
                    <Link
                      to={`/profile/${product.buyer._id || product.buyer}`}
                      className="fw-bold"
                    >
                      {product.buyer.fullName || "a user"}
                    </Link>
                    on
                    {new Date(
                      product.soldAt || product.updatedAt
                    ).toLocaleDateString()}
                    .
                  </Alert>
                )}
              </Card.Body>
            </Col>
          </Row>
        </Card>
      );
    },
    [
      loadingDelete,
      acceptingBid,
      rejectingBid,
      navigate,
      dispatch,
      handleAcceptBid,
      openRejectModal,
      handleOpenViewMediationDetails,
      handleOpenSelectMediatorModal,
      handleRequestReturnToSale,
      handleDeleteProduct,
      setActiveTab,
      confirmingSellerReadiness,
      handleSellerConfirmReadiness,
      allProducts,
    ]
  );

  if (loadingProducts && myProducts.length === 0 && !userId) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2 text-muted">Loading your products...</p>
      </Container>
    );
  }
  if (errors) {
    const messageToDisplay =
      typeof errors === "string"
        ? errors
        : errors.msg || errors.message || "An error occurred";
    return (
      <Container className="py-5">
        <Alert
          variant="danger"
          dismissible
          onClose={() => dispatch({ type: "CLEAR_PRODUCT_ERRORS" })}
        >
          Error: {messageToDisplay}
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 commands-list-vendor-page">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 className="page-title mb-0">My Products & Bids</h2>
        </Col>
        <Col xs="auto">
          <Button as={Link} to="/dashboard/comptes" variant="primary" size="sm">
            + Add New Product
          </Button>
        </Col>
      </Row>
      <Tabs
        id="product-status-tabs"
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k || "approved")}
        className="mb-3 product-tabs"
        fill
      >
        <Tab
          eventKey="approved"
          title={
            <>
              <FaCheck className="me-1" /> Approved
              <Badge pill bg="success" className="ms-1">
                {approvedProducts.length}
              </Badge>
            </>
          }
        >
          {loadingProducts && approvedProducts.length === 0 ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" /> Loading...
            </div>
          ) : approvedProducts.length > 0 ? (
            approvedProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              No approved products.
            </Alert>
          )}
        </Tab>
        <Tab
          eventKey="mediation"
          title={
            <>
              <FaHandshake className="me-1" /> In Mediation
              <Badge pill bg="primary" className="ms-1">
                {mediationProducts.length}
              </Badge>
            </>
          }
        >
          {loadingProducts && mediationProducts.length === 0 ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" /> Loading...
            </div>
          ) : mediationProducts.length > 0 ? (
            mediationProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              No products currently in mediation process.
            </Alert>
          )}
        </Tab>
        <Tab
          eventKey="pending"
          title={
            <>
              <FaHourglassHalf className="me-1" /> Pending
              <Badge pill bg="warning" text="dark" className="ms-1">
                {pendingProducts.length}
              </Badge>
            </>
          }
        >
          {loadingProducts && pendingProducts.length === 0 ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" /> Loading...
            </div>
          ) : pendingProducts.length > 0 ? (
            pendingProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              No products pending approval.
            </Alert>
          )}
        </Tab>
        <Tab
          eventKey="sold"
          title={
            <>
              <FaDollarSign className="me-1" /> Sold
              <Badge pill bg="secondary" className="ms-1">
                {soldProducts.length + completedProducts.length}
              </Badge>
            </>
          }
        >
          {loadingProducts &&
          soldProducts.length + completedProducts.length === 0 ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" /> Loading...
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
              No sold or completed products yet.
            </Alert>
          )}
        </Tab>
        <Tab
          eventKey="rejected"
          title={
            <>
              <FaTimesCircle className="me-1" /> Rejected
              <Badge pill bg="danger" className="ms-1">
                {rejectedProducts.length}
              </Badge>
            </>
          }
        >
          {loadingProducts && rejectedProducts.length === 0 ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" /> Loading...
            </div>
          ) : rejectedProducts.length > 0 ? (
            rejectedProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              No rejected products.
            </Alert>
          )}
        </Tab>
      </Tabs>
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
            onRequestNewSuggestions={handleRequestNewMediatorSuggestions}
            suggestionsUsedOnce={
              mediatorSuggestionsUsedOnce || refreshCountRemaining <= 0
            }
          />
          <MediationDetailsModal
            show={showMediationDetailsModal}
            onHide={() => {
              setShowMediationDetailsModal(false);
            }}
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
          <Modal.Title>Reject Bid</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Reason for rejecting bid from
            <strong>{bidToReject?.bid?.user?.fullName || "Bidder"}</strong> for
            <strong>
              {formatCurrency(
                bidToReject?.bid?.amount,
                bidToReject?.bid?.currency
              )}
            </strong>
            :
          </p>
          <Form.Control
            as="textarea"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (required to notify user)"
            required
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowRejectReasonModal(false)}
          >
            Cancel
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
              <Spinner size="sm" animation="border" />
            ) : (
              "Confirm Rejection"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default CommandsListVendor;
