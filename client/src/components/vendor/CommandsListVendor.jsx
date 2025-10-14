// client/src/components/vendor/CommandsListVendor.jsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Container,
  Row,
  Col,
  Button,
  Spinner,
  Alert,
  Modal,
  Form,
  Badge,
  Tabs,
  Tab,
  Carousel,
  Image,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import {
  FaCheck,
  FaHourglassHalf,
  FaDollarSign,
  FaTimesCircle,
  FaHandshake,
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
import ProductEntry from "./ProductEntry";
import "./CountdownCircle.css";

const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';
const fallbackImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23cccccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23ffffff">Error</text></svg>';

const CommandsListVendor = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

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

  const {
    approvedProducts,
    pendingProducts,
    mediationProducts,
    soldProducts,
    completedProducts,
    rejectedProducts,
    disputedProducts,
  } = useMemo(
    () => ({
      approvedProducts: myProducts.filter(
        (p) => p && p.status === "approved" && !p.currentMediationRequest
      ),
      pendingProducts: myProducts.filter((p) => p && p.status === "pending"),
      mediationProducts: myProducts.filter(
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
      soldProducts: myProducts.filter((p) => p && p.status === "sold"),
      completedProducts: myProducts.filter(
        (p) => p && p.status === "Completed"
      ),
      rejectedProducts: myProducts.filter((p) => p && p.status === "rejected"),
      disputedProducts: myProducts.filter(
        (p) => p && (p.status === "Disputed" || p.status === "UnderDispute")
      ),
    }),
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

  // [!!!] START: إضافة الدالة الناقصة هنا [!!!]
  const handleImageError = useCallback((e) => {
    if (e.target.src !== fallbackImageUrl) {
      e.target.onerror = null;
      e.target.src = fallbackImageUrl;
    }
  }, []);
  // [!!!] END: نهاية الإضافة

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
    async (currentProductData) => {
      const mediationRequestId =
        currentProductData?.currentMediationRequest?._id;
      if (!mediationRequestId) {
        toast.error(t("myProductsPage.mediatorModal.errorIdMissing"));
        return;
      }
      setLoadingMediators(true);
      const url = `/mediation/available-random/${mediationRequestId}`;
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error(t("myProductsPage.mediatorModal.errorNotAuthenticated"));
          return;
        }
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get(url, config);
        if (response.data && Array.isArray(response.data.mediators)) {
          if (response.data.mediators.length > 0) {
            setAvailableMediators(response.data.mediators);
          } else {
            setAvailableMediators([]);
            if (response.data.message) {
              toast.info(t(response.data.message));
            }
          }
        }
      } catch (error) {
        toast.error(
          error.response?.data?.msg ||
            t("myProductsPage.mediatorModal.errorLoadFailed")
        );
        setAvailableMediators([]);
      } finally {
        setLoadingMediators(false);
      }
    },
    [t]
  );

  const handleOpenSelectMediatorModal = useCallback(
    (product) => {
      if (!product || !product.currentMediationRequest?._id) {
        toast.error(t("myProductsPage.mediatorModal.errorIdMissing"));
        return;
      }
      setProductForMediationAction(product);
      setShowSelectMediatorModal(true);
      fetchRandomMediators(product);
    },
    [fetchRandomMediators, t]
  );

  const handleAssignMediator = useCallback(
    (mediatorIdToAssign) => {
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
          toast.success(t("myProductsPage.mediatorModal.assignSuccess"));
        })
        .catch(() => {})
        .finally(() => setLoadingMediators(false));
    },
    [dispatch, productForMediationAction, t]
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

  const commonProductProps = {
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
  };

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
            approvedProducts.map((product) => (
              <ProductEntry
                key={product._id}
                product={product}
                {...commonProductProps}
              />
            ))
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
            pendingProducts.map((product) => (
              <ProductEntry
                key={product._id}
                product={product}
                {...commonProductProps}
              />
            ))
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
            mediationProducts.map((product) => (
              <ProductEntry
                key={product._id}
                product={product}
                {...commonProductProps}
              />
            ))
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
              <FaExclamationTriangle className="me-1" />{" "}
              {t("myProductsPage.tabs.disputed")}{" "}
              <Badge pill bg="danger" className="ms-1">
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
            disputedProducts.map((product) => (
              <ProductEntry
                key={product._id}
                product={product}
                {...commonProductProps}
              />
            ))
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
              .map((product) => (
                <ProductEntry
                  key={product._id}
                  product={product}
                  {...commonProductProps}
                />
              ))
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
            rejectedProducts.map((product) => (
              <ProductEntry
                key={product._id}
                product={product}
                {...commonProductProps}
              />
            ))
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
              fetchRandomMediators(productForMediationAction);
            }}
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