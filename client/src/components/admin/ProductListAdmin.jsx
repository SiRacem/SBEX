// src/components/admin/ProductListAdmin.jsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useContext,
} from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Table,
  Button,
  Modal,
  Form,
  Spinner,
  Alert,
  Badge,
  Image,
  Container,
  Row,
  Col,
  Carousel,
  Card,
  FloatingLabel,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { FaCheck, FaTimes, FaEye } from "react-icons/fa";
import {
  getPendingProducts,
  approveProduct,
  rejectProduct,
} from "../../redux/actions/productAction";
import { toast } from "react-toastify";
import ImageGalleryModal from "./ImageGalleryModal"; // <--- استيراد المودال الجديد
import "./ProductListAdmin.css";
import { SocketContext } from "../../App";

const fallbackImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23cccccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23ffffff">Error</text></svg>';
const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

const ProductDetailsModal = ({ show, onHide, product }) => {
  const formatCurrency = useCallback((amount, currencyCode = "TND") => {
    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      return "N/A";
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(numericAmount);
  }, []);

  const handleImageError = useCallback((e) => {
    if (e.target.src !== fallbackImageUrl) {
      e.target.onerror = null;
      e.target.src = fallbackImageUrl;
    }
  }, []);

  if (!product) return null;
  const images = Array.isArray(product.imageUrls) ? product.imageUrls : [];

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Product Details: {product.title || "N/A"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          <Col md={6} className="mb-3 mb-md-0">
            {images.length > 0 ? (
              <Carousel
                interval={null}
                indicators={images.length > 1}
                controls={images.length > 1}
              >
                {images.map((url, index) => (
                  <Carousel.Item key={`${product._id}-modal-img-${index}`}>
                    <Image
                      src={url || noImageUrl}
                      alt={`Slide ${index + 1}`}
                      fluid
                      rounded
                      onError={handleImageError}
                      style={{
                        maxHeight: "400px",
                        width: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </Carousel.Item>
                ))}
              </Carousel>
            ) : (
              <Image
                src={noImageUrl}
                fluid
                rounded
                style={{
                  maxHeight: "400px",
                  width: "100%",
                  objectFit: "contain",
                }}
              />
            )}
          </Col>
          <Col md={6}>
            <h4>{product.title || "N/A"}</h4>
            <p className="text-muted small">
              By: {product.user?.fullName || "N/A"} (
              {product.user?.email || "N/A"})
            </p>
            <hr />
            <p>
              <strong>Description:</strong>
            </p>
            <div
              style={{
                maxHeight: "150px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              <p>{product.description || "N/A"}</p>
            </div>
            <p className="mt-2">
              <strong>Link Type:</strong> {product.linkType || "N/A"}
            </p>
            <p>
              <strong>Price:</strong>{" "}
              <span className="fw-bold">
                {formatCurrency(product.price, product.currency)}
              </span>
            </p>
            <p>
              <strong>Quantity:</strong> {product.quantity ?? 1}
            </p>
            <p className="small text-muted">
              Submitted:{" "}
              {product.date_added
                ? new Date(product.date_added).toLocaleString()
                : "N/A"}
            </p>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

const ProductListAdmin = ({ search }) => {
  const dispatch = useDispatch();
  const socket = useContext(SocketContext);

  const pendingProducts = useSelector(
    (state) => state.productReducer?.pendingProducts ?? []
  );
  const loading = useSelector(
    (state) => state.productReducer?.loadingPending ?? false
  );
  const error = useSelector((state) => state.productReducer?.errors ?? null);
  const loadingApprove = useSelector(
    (state) => state.productReducer?.loadingApprove || {}
  );
  const loadingReject = useSelector(
    (state) => state.productReducer?.loadingReject || {}
  );

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryProductName, setGalleryProductName] = useState("");

  useEffect(() => {
    dispatch(getPendingProducts());
  }, [dispatch]);

  useEffect(() => {
    if (!socket) return;

    const handleNewProduct = (newProductData) => {
      console.log(
        "[Socket] Received 'new_product_for_approval':",
        newProductData
      );
      // Add the new product to the Redux store
      dispatch({ type: "ADD_PENDING_PRODUCT_SOCKET", payload: newProductData });
      toast.info(
        `🔔 New product "${newProductData.title}" is awaiting approval.`
      );
    };

    const handleProductUpdated = (updatedProductData) => {
      // This listener handles when a product is approved/rejected elsewhere,
      // removing it from this component's list.
      if (updatedProductData.status !== "pending") {
        dispatch({
          type: "REMOVE_PENDING_PRODUCT_SOCKET",
          payload: { productId: updatedProductData._id },
        });
      }
    };

    socket.on("new_product_for_approval", handleNewProduct);
    socket.on("product_updated", handleProductUpdated); // To remove when action taken by another admin

    return () => {
      socket.off("new_product_for_approval", handleNewProduct);
      socket.off("product_updated", handleProductUpdated);
    };
  }, [socket, dispatch]);

  const handleApprove = useCallback(
    (productId) => {
      if (loadingApprove[productId] || loadingReject[productId] || !productId)
        return;
      if (window.confirm("Are you sure you want to approve this product?")) {
        dispatch(approveProduct(productId));
      }
    },
    [dispatch, loadingApprove, loadingReject]
  );

  const openRejectModal = useCallback((product) => {
    setSelectedProduct(product);
    setRejectReason("");
    setShowRejectModal(true);
  }, []);

  const handleReject = useCallback(() => {
    if (!rejectReason.trim()) {
      toast.warn("Rejection reason is required.");
      return;
    }
    if (
      selectedProduct?._id &&
      !loadingReject[selectedProduct._id] &&
      !loadingApprove[selectedProduct._id]
    ) {
      dispatch(rejectProduct(selectedProduct._id, rejectReason));
      setShowRejectModal(false);
      setRejectReason(""); // Clear reason after submission
    }
  }, [dispatch, selectedProduct, rejectReason, loadingReject, loadingApprove]);

  const openDetailsModal = useCallback((product) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  }, []);

  const closeDetailsModal = useCallback(() => {
    setShowDetailsModal(false);
    setSelectedProduct(null); // Clear selected product
  }, []);

  const openImageGallery = useCallback((product) => {
    setGalleryImages(Array.isArray(product.imageUrls) ? product.imageUrls : []);
    setGalleryProductName(product.title || "Product");
    setShowImageGallery(true);
  }, []);

  const closeImageGallery = useCallback(() => {
    setShowImageGallery(false);
  }, []);

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(pendingProducts)) return [];
    const currentSearch = search !== undefined ? search : "";
    if (!currentSearch) return pendingProducts;
    const searchTerm = currentSearch.toLowerCase();
    return pendingProducts.filter(
      (p) =>
        p?.title?.toLowerCase().includes(searchTerm) ||
        p?.user?.fullName?.toLowerCase().includes(searchTerm) ||
        p?.user?.email?.toLowerCase().includes(searchTerm)
    );
  }, [pendingProducts, search]);

  return (
    <Container fluid className="product-list-admin py-4">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 className="page-title mb-0">
            Pending Approvals{" "}
            <Badge bg="warning" text="dark" pill className="align-middle ms-2">
              {filteredProducts.length}
            </Badge>
          </h2>
        </Col>
      </Row>

      {loading && (
        <div className="text-center my-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2 text-muted">Loading pending products...</p>
        </div>
      )}

      {!loading && error && (
        <Alert variant="danger" className="text-center">
          Error loading products:{" "}
          {typeof error === "string" ? error : JSON.stringify(error)}
        </Alert>
      )}

      {!loading && !error && (
        <Card className="shadow-sm">
          <Card.Body className="p-0">
            <Table
              striped
              hover
              responsive
              className="admin-product-table mb-0"
            >
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Image</th>
                  <th>Title</th>
                  <th>Vendor</th>
                  <th>Price</th>
                  <th>Date Added</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product, index) => {
                    const isApproving = loadingApprove[product._id] ?? false;
                    const isRejecting = loadingReject[product._id] ?? false;
                    const isProcessing = isApproving || isRejecting;
                    return (
                      <tr
                        key={product._id}
                        className={`align-middle ${
                          isProcessing ? "processing-row" : ""
                        }`}
                      >
                        <td>{index + 1}</td>
                        <td>
                          <Image
                            src={product.imageUrls?.[0] || noImageUrl}
                            alt={product.title || "Product image"}
                            width={45}
                            height={45}
                            rounded
                            className="table-product-image clickable-image"
                            style={{ objectFit: "cover", cursor: "pointer" }}
                            onClick={() => openImageGallery(product)}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = fallbackImageUrl;
                            }}
                          />
                        </td>
                        <td
                          title={product.title}
                          style={{
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {product.title}
                        </td>
                        <td>{product.user?.fullName || "N/A"}</td>
                        <td>
                          {product.price} {product.currency}
                        </td>
                        <td>
                          {product.date_added
                            ? new Date(product.date_added).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="text-center action-cell">
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>View Details</Tooltip>}
                          >
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="me-2 action-btn"
                              onClick={() => openDetailsModal(product)}
                              disabled={isProcessing}
                            >
                              <FaEye />
                            </Button>
                          </OverlayTrigger>
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Approve Product</Tooltip>}
                          >
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="me-2 action-btn"
                              onClick={() => handleApprove(product._id)}
                              disabled={isProcessing}
                            >
                              {isApproving ? (
                                <Spinner size="sm" animation="border" />
                              ) : (
                                <FaCheck />
                              )}
                            </Button>
                          </OverlayTrigger>
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Reject Product</Tooltip>}
                          >
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="action-btn"
                              onClick={() => openRejectModal(product)}
                              disabled={isProcessing}
                            >
                              {isRejecting ? (
                                <Spinner size="sm" animation="border" />
                              ) : (
                                <FaTimes />
                              )}
                            </Button>
                          </OverlayTrigger>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No pending products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      <Modal
        show={showRejectModal}
        onHide={() => {
          setShowRejectModal(false);
          setSelectedProduct(null); // Clear selected product on close
          setRejectReason(""); // Clear reason on close
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Reject: {selectedProduct?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId="rejectReason">
            <FloatingLabel
              controlId="rejectReasonInput"
              label="Reason (Required)"
              className="mb-3"
            >
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
                autoFocus
              />
            </FloatingLabel>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowRejectModal(false);
              setSelectedProduct(null);
              setRejectReason("");
            }}
            disabled={loadingReject[selectedProduct?._id]}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleReject}
            disabled={
              !rejectReason.trim() || loadingReject[selectedProduct?._id]
            }
          >
            {loadingReject[selectedProduct?._id] ? (
              <>
                <Spinner size="sm" animation="border" /> Rejecting...
              </>
            ) : (
              "Confirm Rejection"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <ProductDetailsModal
        show={showDetailsModal}
        onHide={closeDetailsModal}
        product={selectedProduct}
      />

      <ImageGalleryModal
        show={showImageGallery}
        onHide={closeImageGallery}
        images={galleryImages}
        productName={galleryProductName}
      />
    </Container>
  );
};

export default ProductListAdmin;
