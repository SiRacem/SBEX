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
// import { getProfile } from "../../redux/actions/userAction"; // Assuming not directly used
import SelectMediatorModal from "./SelectMediatorModal";
import MediationDetailsModal from "./MediationDetailsModal";
import { calculateMediatorFeeDetails } from "./feeCalculator"; // Assuming this path is correct
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
      maximumFractionDigits: 2,
    });
  } catch (error) {
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};

const CommandsListVendor = () => {
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
  const [activeTab, setActiveTab] = useState("approved"); // Default tab

  const [showSelectMediatorModal, setShowSelectMediatorModal] = useState(false);
  const [showMediationDetailsModal, setShowMediationDetailsModal] =
    useState(false);
  const [productForMediationAction, setProductForMediationAction] =
    useState(null);
  const [availableMediators, setAvailableMediators] = useState([]);
  const [loadingMediators, setLoadingMediators] = useState(false);
  const [mediatorSuggestionsUsedOnce, setMediatorSuggestionsUsedOnce] =
    useState(false);
  const [refreshCountRemaining, setRefreshCountRemaining] = useState(1); // Max 1 refresh for example
  const [sellerConfirmLoading, setSellerConfirmLoading] = useState({});

  useEffect(() => {
    if (userId) {
      dispatch(getProducts()); // Fetch all products initially or when userId changes
    }
  }, [dispatch, userId]);

  // Filter products based on current user and sort them
  const myProducts = useMemo(() => {
    if (!userId || !Array.isArray(allProducts)) return [];
    return allProducts
      .filter((p) => String(p.user?._id || p.user) === userId)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [allProducts, userId]);

  // Memoized lists for different tabs
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
  const mediationProducts = useMemo(() => {
    return myProducts.filter((p) => {
      
      if (!p) return false;
      const productStatus = String(p.status).trim();
      const mediationRequestStatus = p.currentMediationRequest?.status;
      return (
        productStatus === "PendingMediatorSelection" ||
        productStatus === "MediatorAssigned" ||
        // mediationRequestStatus === "MediationOfferAccepted" || // هذه الحالات تُغطى بـ productStatus
        // mediationRequestStatus === "EscrowFunded" ||
        // mediationRequestStatus === "PartiesConfirmed" ||
        productStatus === "InProgress" || // <--- هذا مهم
        // mediationRequestStatus === "InProgress" // productStatus يجب أن يكون هو المصدر الأساسي لحالة المنتج هنا

        // --- [!!!] أضف هذه الحالات إذا كانت product.status هي التي تتغير لها [!!!] ---
        productStatus === "MediationOfferAccepted" ||
        productStatus === "EscrowFunded" ||
        productStatus === "PartiesConfirmed"
        // --------------------------------------------------------------------
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
  ); // Assuming 'Completed' is a final state post-mediation
  const rejectedProducts = useMemo(
    () => myProducts.filter((p) => p && p.status === "rejected"),
    [myProducts]
  );
    // --- [!!!] useMemo جديد للمنتجات المتنازع عليها [!!!] ---
  const disputedProducts = useMemo(
    () => myProducts.filter((p) => p && (p.status === "Disputed" || p.status === "UnderDispute")),
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
      if (!bidderId) {
        toast.error("Could not identify bidder ID.");
        return;
      }
      if (!rejectReason.trim()) {
        toast.warn("Please provide a rejection reason.");
        return;
      }
      dispatch(rejectBid(bidToReject.productId, bidderId, rejectReason));
      setShowRejectReasonModal(false);
    }
  }, [dispatch, bidToReject, rejectReason]);

  const handleDeleteProduct = useCallback(
    (productId) => {
      if (
        productId &&
        window.confirm("Are you sure you want to delete this product?")
      ) {
        dispatch(deleteProduct(productId));
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
            setActiveTab("mediation"); // Switch to mediation tab
            dispatch(getProducts()); // getProducts will be called by useEffect if needed, or by successful action reducing state
          })
          .catch((err) =>
            console.error("Accept bid failed in component:", err)
          );
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
        toast.error("Mediation request ID is missing.");
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
          toast.error("Not authenticated.");
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
              toast.success("New suggestions loaded!");
          }
        } else {
          setAvailableMediators([]);
          setRefreshCountRemaining(0);
          toast.info(response.data.message || "No mediators found.");
        }
      } catch (error) {
        toast.error(error.response?.data?.msg || "Could not load mediators.");
        setAvailableMediators([]);
        setRefreshCountRemaining(0);
      } finally {
        setLoadingMediators(false);
      }
    },
    [availableMediators]
  ); // Added availableMediators as dependency

  const handleOpenSelectMediatorModal = useCallback(
    (product) => {
      if (!product || !product.currentMediationRequest?._id) {
        toast.error("Mediation ID missing.");
        return;
      }
      setProductForMediationAction(product);
      setShowSelectMediatorModal(true);
      setMediatorSuggestionsUsedOnce(false);
      setRefreshCountRemaining(1);
      fetchRandomMediators(product, false);
    },
    [fetchRandomMediators]
  );

  const handleRequestReturnToSale = useCallback((product) => {
    // const mediationRequestId = product.currentMediationRequest?._id || product._id; // Not used directly in toast
    if (
      window.confirm(
        "Request admin to return product to sale? (e.g., buyer unresponsive)"
      )
    ) {
      toast.info("Request submitted for review (Feature in development).");
    }
  }, []);

  const handleRequestNewMediatorSuggestions = useCallback(() => {
    if (
      productForMediationAction &&
      refreshCountRemaining > 0 &&
      !mediatorSuggestionsUsedOnce
    ) {
      fetchRandomMediators(productForMediationAction, true);
    } else {
      toast.warn("New suggestions option already used or not available.");
    }
  }, [
    productForMediationAction,
    refreshCountRemaining,
    mediatorSuggestionsUsedOnce,
    fetchRandomMediators,
  ]);

  const handleAssignMediator = useCallback(
    async (mediatorIdToAssign) => {
      if (
        !productForMediationAction ||
        !productForMediationAction.currentMediationRequest?._id ||
        !mediatorIdToAssign
      ) {
        toast.error("Missing data for assignment.");
        return;
      }
      const mediationRequestId =
        productForMediationAction.currentMediationRequest._id;
      setLoadingMediators(true); // Consider a more specific loading state for this action
      dispatch(assignSelectedMediator(mediationRequestId, mediatorIdToAssign))
        .then(() => {
          // Assuming assignSelectedMediator returns a promise
          setShowSelectMediatorModal(false);
          setAvailableMediators([]);
          dispatch(getProducts()); // Data will be updated via Redux state changes from the action
          setActiveTab("mediation");
        })
        .catch(() => {
          /* Error is handled by toast in action */
        })
        .finally(() => setLoadingMediators(false));
    },
    [dispatch, productForMediationAction, setActiveTab]
  );

  const handleSellerConfirmReadiness = useCallback(
    (mediationRequestId) => {
      if (!mediationRequestId) {
        toast.error("Mediation Request ID is missing.");
        return;
      }
      if (sellerConfirmLoading[mediationRequestId]) return;

      setSellerConfirmLoading((prev) => ({
        ...prev,
        [mediationRequestId]: true,
      }));
      dispatch(sellerConfirmReadinessAction(mediationRequestId))
        .then(() => {
          // toast.success("Readiness confirmed successfully!"); // Toast from action is usually enough
          dispatch(getProducts()); // Let Redux update handle the product list re-render
        })
        .catch((error) => {
          // Toast is already handled in the action for failure
          // console.error("Error confirming readiness in component:", error);
        })
        .finally(() => {
          setSellerConfirmLoading((prev) => ({
            ...prev,
            [mediationRequestId]: false,
          }));
        });
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
        isApproved && !mediationRequestData && product.bids?.length === 0; // Can only edit/delete if no bids and not in mediation

      const agreedPriceForDisplay = product.agreedPrice;
      const isLoadingThisSellerConfirmButton =
        sellerConfirmLoading[currentMediationRequestId] || false;
      
        const isDisputedProduct = productStatus === "Disputed" || productStatus === "UnderDispute";

      let statusBadgeText = productStatus
        ? productStatus.charAt(0).toUpperCase() + productStatus.slice(1)
        : "Unknown";
      let statusBadgeBg = "secondary";

      if (isApproved && !mediationRequestData) {
        statusBadgeBg = "success";
        statusBadgeText = "Approved";
      } else if (isPendingMediatorSelection) {
        statusBadgeText = "Select Mediator";
        statusBadgeBg = "info";
      } else if (isMediatorAssignedBySeller) {
        statusBadgeText = "Awaiting Mediator";
        statusBadgeBg = "primary";
      } else if (isMediationOfferAcceptedByMediator) {
        statusBadgeText = "Awaiting Confirmations";
        statusBadgeBg = "warning text-dark";
      } else if (isEscrowFundedByBuyer && !sellerHasConfirmed) {
        statusBadgeText = "Buyer Confirmed";
        statusBadgeBg = "info";
      } else if (isPartiesConfirmed) {
        statusBadgeText = "Parties Confirmed";
        statusBadgeBg = "info";
      } else if (isActualMediationInProgress) {
        statusBadgeText = "In Progress";
        statusBadgeBg = "success";
      } else if (productStatus === "Disputed" || productStatus === "UnderDispute") {
        statusBadgeText = "Dispute Opened";
        statusBadgeBg = "danger";
      } else if (product.status === "sold") {
        statusBadgeText = "Sold";
        statusBadgeBg = "dark";
      } else if (product.status === "Completed") {
        statusBadgeText = "Completed";
        statusBadgeBg = "dark";
      } else if (product.status === "pending") {
        statusBadgeText = "Pending Approval";
        statusBadgeBg = "warning text-dark";
      } else if (product.status === "rejected") {
        statusBadgeText = "Admin Rejected";
        statusBadgeBg = "danger";
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
                        List Price:
                        {formatCurrency(product.price, product.currency)}
                      </small>
                      {agreedPriceForDisplay != null &&
                        mediationRequestData && (
                          <small className="text-primary ms-2 fw-bold">
                            Agreed:
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
                          <FaHandshake size={12} className="me-1" /> Please
                          Select a Mediator
                        </Alert>
                      )}
                    {isMediatorAssignedBySeller && (
                      <Alert
                        variant="primary"
                        className="p-1 px-2 small mt-1 d-inline-block"
                      >
                        <FaHourglassHalf size={12} className="me-1" /> Awaiting
                        Mediator's Response.
                      </Alert>
                    )}

                    {!sellerHasConfirmed &&
                      (isMediationOfferAcceptedByMediator ||
                        isEscrowFundedByBuyer) &&
                      !isPartiesConfirmed &&
                      !isActualMediationInProgress && (
                        <div className="mt-2">
                          <Alert variant="info" className="p-2 small d-block">
                            <strong>Action Required:</strong> Confirm your
                            readiness.
                            <br />
                            <small className="text-muted">
                              {isEscrowFundedByBuyer
                                ? "Buyer confirmed & paid."
                                : "After you confirm, buyer will confirm & pay."}
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
                              "Confirm My Readiness"
                            )}
                          </Button>
                        </div>
                      )}

                    {sellerHasConfirmed &&
                      productStatus !== "sold" && // <--- إضافة هذا الشرط
                      productStatus !== "Completed" && // <--- إضافة هذا الشرط
                      productStatus !== 'Disputed' && // <--- [!!!] إضافة هذا الشرط [!!!]
                      productStatus !== 'UnderDispute' && // <--- (إذا كنت تستخدم هذه الحالة أيضًا)
                      !isActualMediationInProgress && // لم تعد "InProgress"
                      !isPartiesConfirmed && // لم تعد "PartiesConfirmed"
                      mediationRequestStatus !== "Completed" && // حالة الوساطة نفسها ليست مكتملة
                      mediationRequestStatus !== "Cancelled" && ( // وليست ملغاة
                      mediationRequestStatus !== 'Disputed' &&
                        <Alert variant="success" className="p-2 small mt-2">
                          <FaCheck className="me-1" /> You confirmed.
                          <small className="text-muted">
                            Waiting for buyer to confirm & pay.
                          </small>
                        </Alert>
                      )}

                    {(isPartiesConfirmed || isActualMediationInProgress || isDisputedProduct) &&
                      currentMediationRequestId &&
                      productStatus !== "sold" && // لا تعرض زر "Open Chat" إذا بيع
                      productStatus !== "Completed" && (
                        <div className="mt-2">
      <Alert
        variant={
          isActualMediationInProgress ? "success" : (isDisputedProduct ? "danger" : "info")
        }
        className="p-2 small d-flex justify-content-between align-items-center"
      >
        <span>
          {isDisputedProduct ? <FaExclamationTriangle className="me-1" /> : <FaHandshake className="me-1" />}
          {isActualMediationInProgress
            ? "Mediation is in progress."
            : isDisputedProduct
            ? "Dispute is active."
            : "Parties confirmed. Chat starting."}
                              <br />
                              <small className="text-muted">
                                Communicate with buyer and mediator.
                              </small>
                            </span>
                            <Button
          variant={isDisputedProduct ? "warning" : "primary"} // تغيير لون الزر إذا كان في نزاع
          size="sm"
          as={Link}
          to={`/dashboard/mediation-chat/${currentMediationRequestId}`}
          title={isDisputedProduct ? "Open Dispute Chat" : "Open Mediation Chat"}
        >
          <FaCommentDots className="me-1 d-none d-sm-inline" />
          Open Chat
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
                        {isPendingMediatorSelection &&
                          !isMediatorAssignedBySeller && (
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
                          )}
                        {isPendingMediatorSelection &&
                          !isMediatorAssignedBySeller && (
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip>Request Return to Sale</Tooltip>
                              }
                            >
                              <Button
                                variant="link"
                                size="sm"
                                className="p-1 text-warning"
                                onClick={() =>
                                  handleRequestReturnToSale(product)
                                }
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
                          overlay={<Tooltip>Edit Product</Tooltip>}
                        >
                          <Button
                            variant="link"
                            size="sm"
                            className="p-1 text-secondary"
                            onClick={() =>
                              navigate("/dashboard/comptes")
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
                                      <Spinner size="sm" />
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
                {(product.status === "sold" ||
                  product.status === "Completed") &&
                  product.buyer && (
                    <Alert variant="info" className="mt-3 p-2 small">
                      {product.status === "Completed"
                        ? "Transaction Completed with Buyer: "
                        : "Sold to "}
                      <Link
                        to={`/profile/${product.buyer._id || product.buyer}`}
                        className="fw-bold"
                      >
                        {product.buyer.fullName || "a user"}
                      </Link>
                      {product.soldAt &&
                        ` on ${new Date(product.soldAt).toLocaleDateString()}`}
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
      navigate,
      dispatch,
      loadingDelete,
      acceptingBid,
      rejectingBid,
      handleAcceptBid,
      openRejectModal,
      handleOpenViewMediationDetails,
      handleOpenSelectMediatorModal,
      handleRequestReturnToSale,
      handleDeleteProduct,
      sellerConfirmLoading,
      handleSellerConfirmReadiness,
    ]
  );

  if (loadingProducts && myProducts.length === 0 && !userId)
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p>Loading...</p>
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
          Error:
          {typeof errors === "string"
            ? errors
            : errors.msg || "An error occurred"}
        </Alert>
      </Container>
    );

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
          {loadingProducts && !approvedProducts.length ? (
            <div className="text-center py-4">
              <Spinner size="sm" /> Loading...
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
          {loadingProducts && !pendingProducts.length ? (
            <div className="text-center py-4">
              <Spinner size="sm" /> Loading...
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
          {loadingProducts && !mediationProducts.length ? (
            <div className="text-center py-4">
              <Spinner size="sm" /> Loading...
            </div>
          ) : mediationProducts.length > 0 ? (
            mediationProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              No products in mediation process.
            </Alert>
          )}
        </Tab>
        <Tab
          eventKey="disputed"
          title={
            <>
              <FaExclamationTriangle className="me-1 text-primary" /> Disputed
              <Badge pill bg="info" className="ms-1">
                {disputedProducts.length}
              </Badge>
            </>
          }
        >
          {loadingProducts && !disputedProducts.length ? (
            <div className="text-center py-4"><Spinner size="sm" /> Loading...</div>
          ) : disputedProducts.length > 0 ? (
            disputedProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              No products currently in dispute.
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
          !(soldProducts.length + completedProducts.length) ? (
            <div className="text-center py-4">
              <Spinner size="sm" /> Loading...
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
          {loadingProducts && !rejectedProducts.length ? (
            <div className="text-center py-4">
              <Spinner size="sm" /> Loading...
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
              <Spinner size="sm" />
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
