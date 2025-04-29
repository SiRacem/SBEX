// src/components/vendor/CommandsListVendor.jsx
// *** نسخة كاملة ونهائية بدون أي اختصارات ***

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
  FaGavel,
  FaUserCircle,
} from "react-icons/fa";
import { toast } from "react-toastify";
// استيراد actions المنتجات (تأكد من المسارات)
import {
  getProducts,
  deleteProduct,
  acceptBid,
  rejectBid,
} from "../../redux/actions/productAction";
// استيراد action جلب البروفايل (لتحديث الرصيد بعد القبول)
import { getProfile } from "../../redux/actions/userAction";
// يمكنك استيراد CSS مخصص لهذه الصفحة
// import './CommandsListVendor.css';

// --- تعريف الصور البديلة ---
const fallbackImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23cccccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23ffffff">Error</text></svg>';
const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

// دالة تنسيق العملة (يمكن وضعها في ملف helpers)
const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(num);
};

// --- المكون الرئيسي للصفحة ---
const CommandsListVendor = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // --- Selectors ---
  const userId = useSelector((state) => state.userReducer?.user?._id);
  const allProducts = useSelector(
    (state) => state.productReducer?.Products ?? []
  );
  const loading = useSelector(
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

  // --- State المحلي ---
  const [showRejectReasonModal, setShowRejectReasonModal] = useState(false);
  const [bidToReject, setBidToReject] = useState(null); // { productId, bid }
  const [rejectReason, setRejectReason] = useState("");
  const [activeTab, setActiveTab] = useState("approved"); // الحالة الافتراضية للتاب

  // --- جلب المنتجات ---
  useEffect(() => {
    if (userId) {
      dispatch(getProducts());
    }
  }, [dispatch, userId]);

  // --- فلترة منتجات البائع الحالي ---
  const myProducts = useMemo(() => {
    if (!userId || !Array.isArray(allProducts)) return [];
    return allProducts
      .filter((p) => String(p.user?._id || p.user) === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.date_added || 0) -
          new Date(a.createdAt || a.date_added || 0)
      ); // فرز بالأحدث
  }, [allProducts, userId]);

  // تقسيم المنتجات حسب الحالة للعرض في التابات
  const approvedProducts = useMemo(
    () => myProducts.filter((p) => p.status === "approved"),
    [myProducts]
  );
  const pendingProducts = useMemo(
    () => myProducts.filter((p) => p.status === "pending"),
    [myProducts]
  );
  const soldProducts = useMemo(
    () => myProducts.filter((p) => p.status === "sold"),
    [myProducts]
  );
  const rejectedProducts = useMemo(
    () => myProducts.filter((p) => p.status === "rejected"),
    [myProducts]
  );

  // --- Handlers لمودال الرفض ---
  const openRejectModal = useCallback((productId, bid) => {
    setBidToReject({ productId, bid });
    setRejectReason("");
    setShowRejectReasonModal(true);
  }, []);

  const handleConfirmReject = useCallback(() => {
    if (bidToReject) {
      const bidderId = bidToReject.bid.user?._id || bidToReject.bid.user;
      if (bidderId) {
        // سبب الرفض مطلوب لإرسال الإشعار
        if (!rejectReason.trim()) {
          toast.warn("Please provide a rejection reason to notify the bidder.");
          return;
        }
        dispatch(rejectBid(bidToReject.productId, bidderId, rejectReason));
        setShowRejectReasonModal(false);
      } else {
        toast.error("Could not identify bidder ID.");
      }
    }
  }, [dispatch, bidToReject, rejectReason]);

  // --- Handler للحذف ---
  const handleDeleteProduct = useCallback(
    (productId) => {
      if (productId) {
        dispatch(deleteProduct(productId));
      }
    },
    [dispatch]
  );

  // --- Handler للقبول ---
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
          }? This marks the product as SOLD.`
        )
      ) {
        dispatch(acceptBid(productId, bidderId, bidAmount))
          .then(() => {
            dispatch(getProfile());
          })
          .catch((err) => {
            console.error("Accept bid failed:", err);
          });
      }
    },
    [dispatch]
  );

  // --- Handler للتعديل ---
  const handleEditProduct = useCallback(
    (productId) => {
      if (productId) {
        navigate(`/edit-product/${productId}`);
      }
    },
    [navigate]
  );

  // --- دالة لعرض بطاقة المنتج مع مزايداته ---
  const renderProductEntry = (product) => {
    if (!product || !product._id) return null;
    const sortedBids = [...(product.bids || [])].sort(
      (a, b) => b.amount - a.amount
    );
    const productLoadingDelete = loadingDelete[product._id] ?? false;

    return (
      <Card key={product._id} className="mb-3 product-entry shadow-sm">
        <Row className="g-0">
          {/* صورة وعنوان المنتج */}
          <Col md={3} lg={2} className="text-center p-2 product-entry-img-col">
            <Image
              src={product.imageUrls?.[0] || noImageUrl}
              fluid
              rounded
              style={{ maxHeight: "100px", objectFit: "contain" }}
            />
          </Col>
          <Col md={9} lg={10}>
            <Card.Body className="p-3 position-relative">
              {/* معلومات المنتج الأساسية */}
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h5 className="mb-1 product-entry-title">{product.title}</h5>
                  <div className="mb-1">
                    <Badge
                      bg={
                        product.status === "approved"
                          ? "success"
                          : product.status === "pending"
                          ? "warning text-dark"
                          : product.status === "sold"
                          ? "secondary"
                          : "danger"
                      }
                    >
                      {product.status.charAt(0).toUpperCase() +
                        product.status.slice(1)}
                    </Badge>
                    <small className="text-muted ms-2">
                      Price: {formatCurrency(product.price, product.currency)}
                    </small>
                  </div>
                </div>
                {product.status !== "sold" && (
                  <div className="product-entry-actions">
                    <OverlayTrigger
                      placement="top"
                      overlay={
                        <Tooltip>Edit Product (Go to My Accounts)</Tooltip>
                      }
                    >
                      <Button
                        variant="link"
                        size="sm"
                        className="p-1 text-secondary"
                        onClick={() => navigate("/dashboard/comptes")}
                      >
                        {" "}
                        {/* <-- تغيير الوجهة */}
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
                  </div>
                )}
              </div>

              {/* عرض المزايدات فقط للمنتجات المعتمدة */}
              {product.status === "approved" && (
                <div className="bids-section-vendor mt-3">
                  <h6 className="bids-title small text-muted">
                    Received Bids ({sortedBids.length})
                  </h6>
                  {sortedBids.length > 0 ? (
                    <ListGroup variant="flush" className="bids-list-vendor">
                      {sortedBids.slice(0, 5).map((bid, index) => {
                        // عرض أول 5
                        const bidderId = bid.user?._id || bid.user;
                        const uniqueBidKey = `${product._id}-${
                          bidderId || "unknown"
                        }-${bid.amount}-${index}`;
                        const bidActionKey = `${product._id}_${bidderId}`;
                        const isAccepting = acceptingBid[bidActionKey] ?? false;
                        const isRejecting = rejectingBid[bidActionKey] ?? false;
                        const isProcessing = isAccepting || isRejecting;
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
                                  {isAccepting ? (
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
                                  {isRejecting ? (
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
              {/* عرض معلومات البيع إذا كان المنتج مباعاً */}
              {product.status === "sold" && product.buyer && (
                <Alert variant="info" className="mt-3 p-2 small">
                  Sold to{" "}
                  <Link
                    to={`/profile/${product.buyer._id || product.buyer}`}
                    className="fw-bold"
                  >
                    {product.buyer.fullName || "a user"}
                  </Link>{" "}
                  on{" "}
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
  };

  // --- العرض الرئيسي للصفحة ---
  // حالة التحميل الأولية
  if (loading && myProducts.length === 0 && !userId) {
    // تأكد من وجود userId قبل الحكم على عدم وجود منتجات
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2 text-muted">Loading your products...</p>
      </Container>
    );
  }

  // حالة الخطأ
  if (errors) {
    return (
      <Container className="py-5">
        <Alert variant="danger">Error loading products: {errors}</Alert>
      </Container>
    );
  }

  // العرض الأساسي مع التابات
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
        onSelect={(k) => setActiveTab(k)}
        className="mb-3 product-tabs"
        fill
      >
        <Tab
          eventKey="approved"
          title={
            <>
              <FaCheck className="me-1" /> Approved{" "}
              <Badge pill bg="success">
                {approvedProducts.length}
              </Badge>
            </>
          }
        >
          {approvedProducts.length > 0 ? (
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
              <FaHourglassHalf className="me-1" /> Pending{" "}
              <Badge pill bg="warning" text="dark">
                {pendingProducts.length}
              </Badge>
            </>
          }
        >
          {pendingProducts.length > 0 ? (
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
              <FaDollarSign className="me-1" /> Sold{" "}
              <Badge pill bg="secondary">
                {soldProducts.length}
              </Badge>
            </>
          }
        >
          {soldProducts.length > 0 ? (
            soldProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              No sold products yet.
            </Alert>
          )}
        </Tab>
        <Tab
          eventKey="rejected"
          title={
            <>
              <FaTimesCircle className="me-1" /> Rejected{" "}
              <Badge pill bg="danger">
                {rejectedProducts.length}
              </Badge>
            </>
          }
        >
          {rejectedProducts.length > 0 ? (
            rejectedProducts.map(renderProductEntry)
          ) : (
            <Alert variant="light" className="text-center py-4">
              No rejected products.
            </Alert>
          )}
        </Tab>
      </Tabs>

      {/* مودال سبب الرفض */}
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
            Reason for rejecting bid from{" "}
            <strong>{bidToReject?.bid?.user?.fullName || "Bidder"}</strong> for{" "}
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
