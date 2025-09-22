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
} from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import {
  FaEdit,
  FaTrashAlt,
  FaCheck,
  FaTimes,
  FaGavel,
  FaEye,
  FaUserCircle,
} from "react-icons/fa";
import { toast } from "react-toastify";
// استيراد actions المنتجات (تأكد من المسارات)
import {
  getProducts,
  deleteProduct,
  acceptBid,
  rejectBid,
} from "../redux/actions/productAction";
// استيراد action جلب البروفايل (لتحديث الرصيد بعد القبول)
import { getProfile } from "../redux/actions/userAction";
import OfflineProdCard from "../components/commun/OfflineProdCard"; // قد تعرض المنتجات المعتمدة هنا أيضاً
import { useTranslation } from "react-i18next";
// import './Comptes.css'; // ملف CSS الخاص بالصفحة

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

// Default image URL for products without an image
const noImageUrl = "/path/to/default-image.jpg"; // Replace with the actual path to your default image

const MyProducts = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // --- Selectors ---
  const userId = useSelector((state) => state.userReducer?.user?._id); // ID المستخدم الحالي
  const allProducts = useSelector(
    (state) => state.productReducer?.Products ?? []
  ); // جميع المنتجات (للفلترة)
  const loading = useSelector(
    (state) => state.productReducer?.loading ?? false
  ); // التحميل العام
  const errors = useSelector((state) => state.productReducer?.errors ?? null);
  // حالات التحميل الخاصة بقبول/رفض المزايدات
  const acceptingBid = useSelector(
    (state) => state.productReducer?.acceptingBid || {}
  );
  const rejectingBid = useSelector(
    (state) => state.productReducer?.rejectingBid || {}
  );
  // حالة تحميل الحذف
  const loadingDelete = useSelector(
    (state) => state.productReducer?.loadingDelete || {}
  );

  // --- State المحلي ---
  const [showRejectReasonModal, setShowRejectReasonModal] = useState(false);
  const [bidToReject, setBidToReject] = useState(null); // { productId, bid }
  const [rejectReason, setRejectReason] = useState("");

  // --- جلب المنتجات عند تحميل المكون ---
  useEffect(() => {
    // قد تحتاج لجلب منتجات المستخدم فقط، أو جلب الكل والفلترة
    dispatch(getProducts());
  }, [dispatch]);

  // --- فلترة منتجات المستخدم الحالي ---
  const myProducts = useMemo(() => {
    if (!userId || !Array.isArray(allProducts)) return [];
    // فرز حسب الأحدث أولاً
    return allProducts
      .filter((p) => String(p.user?._id || p.user) === userId)
      .sort(
        (a, b) =>
          new Date(b.date_added || b.createdAt || 0) -
          new Date(a.date_added || a.createdAt || 0)
      );
  }, [allProducts, userId]);

  // تقسيم المنتجات حسب الحالة
  const pendingProducts = useMemo(
    () => myProducts.filter((p) => p.status === "pending"),
    [myProducts]
  );
  const approvedProducts = useMemo(
    () => myProducts.filter((p) => p.status === "approved"),
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
    if (bidToReject && rejectReason.trim()) {
      // تأكد من أن bidToReject.bid.user يحتوي على _id أو هو الـ _id مباشرة
      const bidderId = bidToReject.bid.user?._id || bidToReject.bid.user;
      if (bidderId) {
        dispatch(rejectBid(bidToReject.productId, bidderId, rejectReason));
        setShowRejectReasonModal(false);
      } else {
        toast.error(t("couldNotIdentifyBidder"));
      }
    } else {
      toast.warn(t("pleaseProvideRejectionReason"));
    }
  }, [dispatch, bidToReject, rejectReason, t]);

  // --- Handler للحذف ---
  const handleDeleteProduct = useCallback(
    (productId) => {
      // التأكيد تم داخل الـ action الآن
      dispatch(deleteProduct(productId));
    },
    [dispatch]
  );

  // --- Handler للقبول ---
  const handleAcceptBid = useCallback(
    (productId, bid) => {
      const bidderId = bid.user?._id || bid.user;
      if (!bidderId) {
        toast.error(t("couldNotIdentifyBidder"));
        return;
      }
      if (
        window.confirm(
          t("acceptBidConfirmation", {
            amount: formatCurrency(bid.amount, bid.currency),
            user: bid.user?.fullName || t("thisUser"),
          })
        )
      ) {
        dispatch(acceptBid(productId, bidderId, bid.amount))
          .then(() => {
            // يمكنك اختياريًا تحديث البروفايل هنا أيضًا إذا لم يحدث تلقائيًا
            // dispatch(getProfile());
          })
          .catch((err) => {
            // الخطأ تم عرضه بواسطة toast في الـ action
            console.error("Accept bid failed:", err);
          });
      }
    },
    [dispatch, t]
  );

  // --- العرض ---
  if (loading && myProducts.length === 0) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">{t("loadingYourProducts")}</p>
      </Container>
    );
  }

  if (errors) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          {t("errorLoadingProducts")} {errors}
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 comptes-page">
      <h2 className="page-title mb-4">{t("myAccountsProducts")}</h2>

      {/* --- قسم المنتجات المعتمدة (مع المزايدات) --- */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-success text-white">
          <h4 className="mb-0">
            {t("approvedProducts")} ({approvedProducts.length})
          </h4>
        </Card.Header>
        <Card.Body>
          {approvedProducts.length === 0 ? (
            <p className="text-muted text-center py-3">
              {t("noApprovedProductsYet")}
            </p>
          ) : (
            approvedProducts.map((product) => {
              // فرز المزايدات لهذا المنتج
              const sortedBids = [...(product.bids || [])].sort(
                (a, b) => b.amount - a.amount
              );
              return (
                <Card key={product._id} className="mb-3 product-entry">
                  <Row className="g-0">
                    <Col md={2} className="text-center p-2">
                      <Image
                        src={product.imageUrls?.[0] || noImageUrl}
                        fluid
                        rounded
                        style={{ maxHeight: "100px", objectFit: "contain" }}
                      />
                    </Col>
                    <Col md={4} className="p-3">
                      <h5 className="mb-1">{product.title}</h5>
                      <p className="mb-1 small text-muted">
                        {t("basePrice")}{" "}
                        {formatCurrency(product.price, product.currency)}
                      </p>
                      <p className="mb-0 small text-muted">
                        {t("status")}:{" "}
                        <Badge bg="success">{product.status}</Badge>
                      </p>
                    </Col>
                    <Col md={6} className="p-3 bids-section">
                      <h6>
                        {t("receivedBids")} ({sortedBids.length})
                      </h6>
                      {sortedBids.length > 0 ? (
                        <ListGroup
                          variant="flush"
                          style={{ maxHeight: "150px", overflowY: "auto" }}
                        >
                          {sortedBids.map((bid) => {
                            const bidderId = bid.user?._id || bid.user;
                            const bidActionKey = `${product._id}_${bidderId}`;
                            const isAccepting =
                              acceptingBid[bidActionKey] ?? false;
                            const isRejecting =
                              rejectingBid[bidActionKey] ?? false;
                            const isProcessing = isAccepting || isRejecting;
                            return (
                              <ListGroup.Item
                                key={bidActionKey}
                                className="d-flex justify-content-between align-items-center px-0 py-1"
                              >
                                <div>
                                  <Link
                                    to={`/profile/${bidderId}`}
                                    className="text-decoration-none me-2"
                                    target="_blank"
                                  >
                                    {bid.user?.fullName || t("bidder")}
                                  </Link>
                                  <Badge bg="info">
                                    {formatCurrency(bid.amount, bid.currency)}
                                  </Badge>
                                </div>
                                <div className="bid-actions">
                                  <Button
                                    variant="outline-success"
                                    size="sm"
                                    className="me-1 py-0 px-1"
                                    onClick={() =>
                                      handleAcceptBid(product._id, bid)
                                    }
                                    disabled={isProcessing}
                                    title={t("acceptBid")}
                                  >
                                    {isAccepting ? (
                                      <Spinner size="sm" animation="border" />
                                    ) : (
                                      <FaCheck />
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline-danger"
                                    size="sm"
                                    className="py-0 px-1"
                                    onClick={() =>
                                      openRejectModal(product._id, bid)
                                    }
                                    disabled={isProcessing}
                                    title={t("rejectBid")}
                                  >
                                    {isRejecting ? (
                                      <Spinner size="sm" animation="border" />
                                    ) : (
                                      <FaTimes />
                                    )}
                                  </Button>
                                </div>
                              </ListGroup.Item>
                            );
                          })}
                        </ListGroup>
                      ) : (
                        <p className="text-muted small">
                          {t("noBidsReceivedYet")}
                        </p>
                      )}
                    </Col>
                  </Row>
                  <Card.Footer className="text-end bg-light">
                    {/* أزرار تعديل وحذف للمنتج المعتمد */}
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="me-2"
                      onClick={() => navigate(`/edit-product/${product._id}`)}
                      title={t("editProduct")}
                    >
                      {" "}
                      {/* افترض وجود مسار للتعديل */}
                      <FaEdit /> {t("edit")}
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeleteProduct(product._id)}
                      disabled={loadingDelete[product._id]}
                      title={t("deleteProduct")}
                    >
                      {loadingDelete[product._id] ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        <FaTrashAlt />
                      )}{" "}
                      {t("delete")}
                    </Button>
                  </Card.Footer>
                </Card>
              );
            })
          )}
        </Card.Body>
      </Card>

      {/* --- قسم المنتجات المعلقة --- */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-warning text-dark">
          <h4 className="mb-0">
            {t("pendingApproval")} ({pendingProducts.length})
          </h4>
        </Card.Header>
        <Card.Body>
          {pendingProducts.length === 0 ? (
            <p className="text-muted text-center py-3">
              {t("noProductsPendingApproval")}
            </p>
          ) : (
            pendingProducts.map((product) => (
              <Card key={product._id} className="mb-3 product-entry-simple">
                <Row className="g-0 align-items-center">
                  <Col xs={2} md={1} className="text-center">
                    <Image
                      src={product.imageUrls?.[0] || noImageUrl}
                      width={50}
                      height={50}
                      style={{ objectFit: "cover" }}
                      rounded
                    />
                  </Col>
                  <Col xs={7} md={8} className="ps-3">
                    <h6 className="mb-0">{product.title}</h6>
                    <small className="text-muted">
                      {t("submitted")}:{" "}
                      {new Date(
                        product.date_added || product.createdAt
                      ).toLocaleDateString()}
                    </small>
                  </Col>
                  <Col xs={3} md={3} className="text-end pe-3">
                    {/* أزرار تعديل وحذف للمنتج المعلق */}
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="me-2"
                      onClick={() => navigate(`/edit-product/${product._id}`)}
                      title={t("editProduct")}
                    >
                      <FaEdit />
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeleteProduct(product._id)}
                      disabled={loadingDelete[product._id]}
                      title={t("deleteProduct")}
                    >
                      {loadingDelete[product._id] ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        <FaTrashAlt />
                      )}
                    </Button>
                  </Col>
                </Row>
              </Card>
            ))
          )}
        </Card.Body>
      </Card>

      {/* --- أقسام المنتجات المباعة والمرفوضة (عرض مبسط) --- */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-secondary text-white">
          <h4 className="mb-0">
            {t("soldProducts")} ({soldProducts.length})
          </h4>
        </Card.Header>
        <Card.Body>
          {soldProducts.length === 0 ? (
            <p className="text-muted text-center py-3">
              {t("noSoldProductsYet")}
            </p>
          ) : (
            soldProducts.map((product) => (
              <p key={product._id}>{product.title}</p> // Replace with your desired JSX for sold products
            ))
          )}
        </Card.Body>
      </Card>
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-danger text-white">
          <h4 className="mb-0">
            {t("rejectedProducts")} ({rejectedProducts.length})
          </h4>
        </Card.Header>
        <Card.Body>
          {rejectedProducts.length === 0 ? (
            <p className="text-muted text-center py-3">
              {t("noRejectedProducts")}
            </p>
          ) : (
            rejectedProducts.map((product) => (
              <p key={product._id}>{product.title}</p> // Replace with your desired JSX for rejected products
            ))
          )}
        </Card.Body>
      </Card>

      {/* مودال سبب الرفض */}
      <Modal
        show={showRejectReasonModal}
        onHide={() => setShowRejectReasonModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{t("rejectBid")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {t("reasonForRejectingBid")}
            <strong>{bidToReject?.bid?.user?.fullName}</strong> {t("for")}{" "}
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
            placeholder={t("rejectionReasonRequired")}
            required
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowRejectReasonModal(false)}
          >
            {t("cancel")}
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
              t("confirmRejection")
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default MyProducts;