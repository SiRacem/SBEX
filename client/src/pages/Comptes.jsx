// src/pages/Compts.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Button,
  Row,
  Col,
  Card,
  Form,
  FloatingLabel,
  Alert,
  Spinner,
  Modal,
  Carousel,
  Image,
} from "react-bootstrap";
import { useTranslation } from "react-i18next";
import {
  FaPlus,
  FaTrash,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaEdit,
  FaRegTrashAlt,
} from "react-icons/fa";
import axios from "axios";
import { useSelector, useDispatch } from "react-redux";
import {
  getProducts,
  addProduct,
  deleteProduct,
  updateProduct,
} from "../redux/actions/productAction";
import "./Comptes.css";

// --- مكون بطاقة الحساب مع التعديل لعرض نوع الربط الكامل ---
const AccountCard = React.memo(({ product, onDelete, onEdit }) => {
  const { t, i18n } = useTranslation();

  // [!] إضافة خريطة الترجمة لأنواع الربط
  const linkTypeMap = useMemo(
    () => ({
      "k&m": t("comptes.linkTypes.k&m", "Konami ID ✅ Gmail ❌ Mail ✅"),
      k: t("comptes.linkTypes.k", "Konami ID ✅ Gmail ❌ Mail ❌"),
      "k&g&m": t("comptes.linkTypes.k&g&m", "Konami ID ✅ Gmail ✅ Mail ✅"),
      "k&g": t("comptes.linkTypes.k&g", "Konami ID ✅ Gmail ✅ Mail ❌"),
      "g&m": t("comptes.linkTypes.g&m", "Konami ID ❌ Gmail ✅ Mail ✅"),
      g: t("comptes.linkTypes.g", "Konami ID ❌ Gmail ✅ Mail ❌"),
    }),
    [t]
  );

  const displayLinkType =
    linkTypeMap[product.linkType] ||
    product.linkType ||
    t("comptes.notAvailable");

  const fallbackImageUrl = useMemo(
    () =>
      `data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23cccccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23ffffff">${t(
        "comptes.imageError"
      )}</text></svg>`,
    [t]
  );
  const noImageUrl = useMemo(
    () =>
      `data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">${t(
        "comptes.noImage"
      )}</text></svg>`,
    [t]
  );
  const formatCurrency = useCallback(
    (amount, currencyCode = "TND") => {
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) return t("comptes.notAvailable");
      return new Intl.NumberFormat(i18n.language, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(numericAmount);
    },
    [i18n.language, t]
  );
  const handleImageError = (e) => {
    if (e.target.src !== fallbackImageUrl) {
      e.target.onerror = null;
      e.target.src = fallbackImageUrl;
    }
  };
  const triggerEdit = () => onEdit(product);
  const triggerDelete = () => onDelete(product?._id);
  if (!product || !product._id) return null;
  const images = Array.isArray(product.imageUrls) ? product.imageUrls : [];
  return (
    <Col md={6} lg={4} className="mb-4">
      <Card className={`shadow-sm h-100 status-${product.status || "unknown"}`}>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0 card-title-truncate">
            {product.title || t("comptes.untitled")}
          </h5>
          <span>
            {product.status === "approved" && (
              <FaCheckCircle
                className="text-success"
                title={t("comptes.status.approved")}
              />
            )}
            {product.status === "pending" && (
              <FaHourglassHalf
                className="text-warning"
                title={t("comptes.status.pending")}
              />
            )}
            {product.status === "rejected" && (
              <FaTimesCircle
                className="text-danger"
                title={t("comptes.status.rejected")}
              />
            )}
          </span>
        </Card.Header>
        {images.length > 0 ? (
          <Carousel
            interval={null}
            indicators={images.length > 1}
            controls={images.length > 1}
            className="account-card-carousel"
          >
            {images.map((url, index) => (
              <Carousel.Item key={`${product._id}-img-${index}`}>
                <img
                  className="d-block w-100 account-card-img"
                  src={url || noImageUrl}
                  alt={`${product.title || t("comptes.account")} - ${t(
                    "comptes.slide"
                  )} ${index + 1}`}
                  onError={handleImageError}
                />
              </Carousel.Item>
            ))}
          </Carousel>
        ) : (
          <Card.Img
            variant="top"
            src={noImageUrl}
            className="account-card-img"
          />
        )}
        <Card.Body className="d-flex flex-column">
          <Card.Text className="text-muted small flex-grow-1 mb-2">
            {product.description || t("comptes.noDescription")}
          </Card.Text>
          <p className="small mb-1">
            <strong>{t("comptes.link")}:</strong>{" "}
            {/* [!] استخدام المتغير الجديد هنا لعرض النص الكامل */}
            {displayLinkType}
          </p>
          <p className="fw-bold mb-0">
            {formatCurrency(product.price, product.currency)}
          </p>
        </Card.Body>
        <Card.Footer className="d-flex justify-content-end bg-light border-top-0 pt-2">
          {product.status !== "rejected" && (
            <Button
              variant="outline-secondary"
              size="sm"
              className="me-2 action-btn"
              onClick={triggerEdit}
              title={t("comptes.editAccount")}
            >
              <FaEdit />
            </Button>
          )}
          <Button
            variant="outline-danger"
            size="sm"
            className="action-btn"
            onClick={triggerDelete}
            title={t("comptes.deleteAccount")}
          >
            <FaTrash />
          </Button>
        </Card.Footer>
      </Card>
    </Col>
  );
});

const Comptes = () => {
  const { t } = useTranslation();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editImageFiles, setEditImageFiles] = useState([]);
  const [editImagePreviews, setEditImagePreviews] = useState([]);

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageToShow, setImageToShow] = useState("");

  const CLOUD_NAME = "draghygoj";
  const UPLOAD_PRESET = "react_upload_images";
  const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const fallbackImageUrl = useMemo(
    () =>
      'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23cccccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23ffffff">Error</text></svg>',
    []
  );

  const linkOptions = useMemo(() => {
    const options = [
      {
        key: "k&m",
        konami: "✅",
        gmail: "❌",
        mail: "✅",
      },
      {
        key: "k",
        konami: "✅",
        gmail: "❌",
        mail: "❌",
      },
      {
        key: "k&g&m",
        konami: "✅",
        gmail: "✅",
        mail: "✅",
      },
      {
        key: "k&g",
        konami: "✅",
        gmail: "✅",
        mail: "❌",
      },
      {
        key: "g&m",
        konami: "❌",
        gmail: "✅",
        mail: "✅",
      },
      {
        key: "g",
        konami: "❌",
        gmail: "✅",
        mail: "❌",
      },
    ];

    return options.map((opt) => {
      const parts = [
        {
          text: t("comptes.linkOptions.konamiId"),
          icon: opt.konami,
        },
        {
          text: t("comptes.linkOptions.gmail"),
          icon: opt.gmail,
        },
        {
          text: t("comptes.linkOptions.mail"),
          icon: opt.mail,
        },
      ];
      const value = parts.map((p) => `${p.text} ${p.icon}`).join(" ");
      return {
        key: opt.key,
        value: value,
        parts: parts,
      };
    });
  }, [t]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    linkType: linkOptions[0]?.key || "",
    price: "",
    currency: "TND",
    quantity: 1,
  });

  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.userReducer);
  const {
    Products,
    loading: productsLoading,
    errors: productErrors,
  } = useSelector((state) => {
    const productState = state.productReducer || {
      Products: [],
      loading: false,
      errors: null,
    };
    return {
      Products: Array.isArray(productState.Products)
        ? productState.Products
        : [],
      loading: productState.loading ?? false,
      errors: productState.errors ?? null,
    };
  });

  const getDisplayError = (errorObject) => {
    if (!errorObject) return null;
    if (typeof errorObject === "string") {
      return errorObject;
    }
    if (errorObject.errorMessage) {
      if (
        typeof errorObject.errorMessage === "object" &&
        errorObject.errorMessage.key
      ) {
        return t(
          errorObject.errorMessage.key,
          errorObject.errorMessage.fallback || "An unknown error occurred."
        );
      }
      if (typeof errorObject.errorMessage === "string") {
        return errorObject.errorMessage;
      }
    }
    return t("comptes.errors.addError", "Failed to perform the operation.");
  };

  useEffect(() => {
    if (user?._id) dispatch(getProducts());
  }, [dispatch, user?._id]);

  useEffect(() => {
    const urlsToRevoke = [...imagePreviews, ...editImagePreviews]
      .map((p) => p.url)
      .filter((url) => typeof url === "string" && url.startsWith("blob:"));
    return () => urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
  }, [imagePreviews, editImagePreviews]);

  const userProducts = useMemo(
    () => Products.filter((p) => p?.user?._id === user?._id),
    [Products, user?._id]
  );
  const pendingProducts = useMemo(
    () => userProducts.filter((p) => p?.status === "pending"),
    [userProducts]
  );
  const approvedProducts = useMemo(
    () => userProducts.filter((p) => p?.status === "approved"),
    [userProducts]
  );
  const rejectedProducts = useMemo(
    () => userProducts.filter((p) => p?.status === "rejected"),
    [userProducts]
  );

  const uploadImages = useCallback(
    async (filesToUpload) => {
      if (!filesToUpload || filesToUpload.length === 0) return [];
      const uploadPromises = filesToUpload.map((file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        return axios
          .post(CLOUDINARY_URL, formData)
          .then((response) => response.data.secure_url)
          .catch((uploadError) => {
            setFormError(
              t("comptes.errors.uploadError", {
                fileName: file.name,
                error:
                  uploadError.response?.data?.error?.message ||
                  "Unknown upload error",
              })
            );
            return null;
          });
      });
      const results = await Promise.all(uploadPromises);
      return results.filter((url) => url !== null);
    },
    [CLOUDINARY_URL, UPLOAD_PRESET, t]
  );

  const handleInputChange = useCallback(
    (e) =>
      setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value })),
    []
  );
  const handleImageChange = useCallback(
    (e) => {
      const files = Array.from(e.target.files);
      const uniqueNewFiles = files.filter(
        (file) =>
          !imageFiles.some((f) => f.name === file.name && f.size === file.size)
      );
      if (uniqueNewFiles.length === 0 && files.length > 0) {
        alert(t("comptes.alerts.imageAlreadyAdded"));
        e.target.value = null;
        return;
      }
      setImageFiles((prev) => [...prev, ...uniqueNewFiles]);
      const newPreviews = uniqueNewFiles.map((file) => ({
        url: URL.createObjectURL(file),
        fileObject: file,
      }));
      setImagePreviews((prev) => [...prev, ...newPreviews]);
      e.target.value = null;
    },
    [imageFiles, t]
  );

  const handleRemoveImagePreview = useCallback(
    (indexToRemove) => {
      if (window.confirm(t("comptes.alerts.removeImageConfirm"))) {
        const removed = imagePreviews[indexToRemove];
        if (removed.url.startsWith("blob:")) URL.revokeObjectURL(removed.url);
        setImagePreviews((prev) => prev.filter((_, i) => i !== indexToRemove));
        setImageFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
      }
    },
    [imagePreviews, t]
  );

  const handleAddSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (imageFiles.length === 0) {
        setFormError(t("comptes.errors.atLeastOneImage"));
        return;
      }
      setFormError(null);
      setFormSuccess(null);
      setIsSubmittingAdd(true);
      try {
        const uploadedImageUrls = await uploadImages(imageFiles);
        if (uploadedImageUrls.length === 0)
          throw new Error(t("comptes.errors.uploadFailed"));
        if (uploadedImageUrls.length < imageFiles.length)
          setFormError(t("comptes.errors.someUploadsFailed"));
        const productData = {
          ...formData,
          imageUrls: uploadedImageUrls,
          price: parseFloat(formData.price),
          quantity: 1,
        };
        if (
          !productData.title ||
          !productData.description ||
          !productData.linkType ||
          isNaN(productData.price) ||
          !productData.currency
        )
          throw new Error(t("comptes.errors.fillAllFields"));

        await dispatch(addProduct(productData));

        setFormSuccess(t("comptes.alerts.addSuccess"));
        setFormData({
          title: "",
          description: "",
          linkType: linkOptions[0]?.key || "",
          price: "",
          currency: "TND",
          quantity: 1,
        });
        setImageFiles([]);
        setImagePreviews([]);
        setShowAddForm(false);
      } catch (error) {
        const errorFromState = productErrors || error;
        setFormError(errorFromState);
      } finally {
        setIsSubmittingAdd(false);
      }
    },
    [
      dispatch,
      formData,
      imageFiles,
      uploadImages,
      t,
      linkOptions,
      productErrors,
    ]
  );

  const handleEditClick = useCallback((product) => {
    if (!product || !product._id) return;
    setEditingProduct(product);
    setEditFormData({
      _id: product._id,
      title: product.title,
      description: product.description,
      linkType: product.linkType,
      price: product.price,
      currency: product.currency,
    });
    setEditImagePreviews(
      Array.isArray(product.imageUrls)
        ? product.imageUrls.map((url) => ({ url, isExisting: true }))
        : []
    );
    setEditImageFiles([]);
    setFormError(null);
    setShowEditModal(true);
  }, []);

  const handleEditModalClose = useCallback(() => {
    setShowEditModal(false);
    setEditingProduct(null);
    setEditImagePreviews([]);
    setEditImageFiles([]);
  }, []);

  const handleEditInputChange = useCallback(
    (e) =>
      setEditFormData((prev) => ({ ...prev, [e.target.name]: e.target.value })),
    []
  );

  const handleEditImageChange = useCallback(
    (e) => {
      const files = Array.from(e.target.files);
      const uniqueNewFiles = files.filter(
        (file) =>
          !editImageFiles.some(
            (f) => f.name === file.name && f.size === file.size
          ) &&
          !editImagePreviews.some(
            (p) =>
              p.fileObject?.name === file.name &&
              p.fileObject?.size === file.size
          )
      );
      if (uniqueNewFiles.length === 0 && files.length > 0) {
        alert(t("comptes.alerts.imageAlreadyAdded"));
        e.target.value = null;
        return;
      }
      setEditImageFiles((prev) => [...prev, ...uniqueNewFiles]);
      const newPreviews = uniqueNewFiles.map((file) => ({
        url: URL.createObjectURL(file),
        fileObject: file,
        isNew: true,
      }));
      setEditImagePreviews((prev) => [
        ...prev.filter((p) => p.isExisting),
        ...newPreviews,
      ]);
      e.target.value = null;
    },
    [editImageFiles, editImagePreviews, t]
  );

  const handleRemoveEditImagePreview = useCallback(
    (indexToRemove) => {
      if (window.confirm(t("comptes.alerts.removeImageConfirm"))) {
        const newPreviews = [...editImagePreviews];
        const removed = newPreviews.splice(indexToRemove, 1)[0];
        setEditImagePreviews(newPreviews);
        if (removed.isNew) {
          if (removed.url.startsWith("blob:")) URL.revokeObjectURL(removed.url);
          setEditImageFiles((prev) =>
            prev.filter((file) => file !== removed.fileObject)
          );
        }
      }
    },
    [editImagePreviews, t]
  );

  // [!!!] الدالة المُعدلة بالكامل مع إصلاح خطأ .match
  const handleEditSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setFormError(null);
      setIsSubmittingEdit(true);
      try {
        const keptExistingUrls = editImagePreviews
          .filter((p) => p.isExisting)
          .map((p) => p.url);
        let newlyUploadedUrls = [];
        if (editImageFiles.length > 0) {
          newlyUploadedUrls = await uploadImages(editImageFiles);
          if (newlyUploadedUrls.length !== editImageFiles.length)
            setFormError(t("comptes.errors.someUploadsFailed"));
        }
        const finalImageUrls = [...keptExistingUrls, ...newlyUploadedUrls];
        if (finalImageUrls.length === 0)
          throw new Error(t("comptes.errors.atLeastOneImage"));
        const price = parseFloat(editFormData.price);
        if (isNaN(price)) throw new Error(t("comptes.errors.invalidPrice"));
        const updateData = {
          ...editFormData,
          imageUrls: finalImageUrls,
          price,
        };
        const { _id, ...dataToSend } = updateData;
        if (
          !_id ||
          !dataToSend.title ||
          !dataToSend.description ||
          !dataToSend.linkType ||
          !dataToSend.currency
        )
          throw new Error(t("comptes.errors.fillAllFields"));

        await dispatch(updateProduct(_id, dataToSend));

        handleEditModalClose();
      } catch (error) {
        const errorFromState = productErrors || error;
        setFormError(errorFromState);
      } finally {
        setIsSubmittingEdit(false);
      }
    },
    [
      dispatch,
      editFormData,
      editImageFiles,
      editImagePreviews,
      handleEditModalClose,
      uploadImages,
      t,
      productErrors,
    ]
  );

  const handleDelete = useCallback(
    (productId) => {
      if (!productId) return;
      if (window.confirm(t("comptes.alerts.deleteConfirm")))
        dispatch(deleteProduct(productId));
    },
    [dispatch, t]
  );
  const handleShowImageModal = useCallback((imageUrl) => {
    setImageToShow(imageUrl);
    setShowImageModal(true);
  }, []);
  const handleCloseImageModal = useCallback(() => setShowImageModal(false), []);
  const toggleAddForm = useCallback(() => {
    setShowAddForm((prev) => !prev);
    if (!showAddForm) {
      setFormError(null);
      setFormSuccess(null);
      setFormData({
        title: "",
        description: "",
        linkType: linkOptions[0]?.key || "",
        price: "",
        currency: "TND",
        quantity: 1,
      });
      setImageFiles([]);
      setImagePreviews([]);
    }
  }, [showAddForm, linkOptions]);

  useEffect(() => {
    if (productErrors) {
      setFormError(productErrors);
    }
  }, [productErrors]);

  return (
    <div className="comptes-page container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <h2 className="page-title mb-0">
          {t("comptes.title")} ({userProducts.length})
        </h2>
        <Button
          variant="primary"
          onClick={toggleAddForm}
          className="add-account-btn shadow-sm"
        >
          <FaPlus className="me-1" />{" "}
          {showAddForm ? t("comptes.cancelAdd") : t("comptes.addAccount")}
        </Button>
      </div>

      {showAddForm && (
        <Card className="shadow-sm mb-4 add-form-card">
          <Card.Body>
            <h4 className="mb-3 text-center">{t("comptes.addForm.title")}</h4>
            {formError && (
              <Alert
                variant="danger"
                onClose={() => setFormError(null)}
                dismissible
              >
                {getDisplayError(formError)}
              </Alert>
            )}
            {formSuccess && <Alert variant="success">{formSuccess}</Alert>}
            <Form onSubmit={handleAddSubmit}>
              <Row>
                <Col md={12}>
                  <FloatingLabel
                    controlId="titleInput"
                    label={t("comptes.addForm.accountTitle")}
                    className="mb-3"
                  >
                    <Form.Control
                      type="text"
                      placeholder="."
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                    />
                  </FloatingLabel>
                </Col>
                <Col md={12}>
                  <Form.Group controlId="imageInput" className="mb-3">
                    <Form.Label>{t("comptes.addForm.images")}</Form.Label>
                    <Form.Control
                      type="file"
                      multiple
                      onChange={handleImageChange}
                      accept="image/*"
                    />
                    <div className="image-preview-container large-preview mt-2">
                      {imagePreviews.map((preview, index) => (
                        <div
                          key={`add-preview-${index}`}
                          className="preview-item"
                          onClick={() => handleShowImageModal(preview.url)}
                          title={t("comptes.viewImage")}
                        >
                          <img
                            src={preview.url}
                            alt={`Preview ${index + 1}`}
                            className="preview-image-lg"
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            className="remove-preview-btn"
                            title={t("comptes.removeImage")}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImagePreview(index);
                            }}
                          >
                            <FaRegTrashAlt />
                          </Button>
                        </div>
                      ))}
                      {imagePreviews.length === 0 && (
                        <div className="text-muted p-3 fst-italic small">
                          {t("comptes.addForm.selectImages")}
                        </div>
                      )}
                    </div>
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <FloatingLabel
                    controlId="descriptionInput"
                    label={t("comptes.addForm.description")}
                    className="mb-3"
                  >
                    <Form.Control
                      as="textarea"
                      placeholder="."
                      style={{ height: "100px" }}
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      required
                    />
                  </FloatingLabel>
                </Col>
                <Col md={12} className="mb-3">
                  <Form.Label>{t("comptes.addForm.linkType")}</Form.Label>
                  <Row xs={1} md={2} className="g-2">
                    {linkOptions.map((option) => (
                      <Col key={option.key}>
                        <Card
                          className={`link-type-card ${
                            formData.linkType === option.key ? "selected" : ""
                          }`}
                          onClick={() =>
                            handleInputChange({
                              target: { name: "linkType", value: option.key },
                            })
                          }
                        >
                          <Card.Body>
                            {formData.linkType === option.key && (
                              <FaCheckCircle className="selected-check" />
                            )}
                            <div className="link-type-content">
                              {option.parts.map((part, idx) => (
                                <span key={idx}>
                                  {part.icon} {part.text}
                                </span>
                              ))}
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </Col>
                <Col md={6}>
                  <FloatingLabel
                    controlId="priceInput"
                    label={t("comptes.addForm.price")}
                    className="mb-3"
                  >
                    <Form.Control
                      type="number"
                      placeholder="."
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.01"
                    />
                  </FloatingLabel>
                </Col>
                <Col md={6}>
                  <FloatingLabel
                    controlId="currencyInput"
                    label={t("comptes.addForm.currency")}
                    className="mb-3"
                  >
                    <Form.Select
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="TND">TND</option>
                      <option value="USD">USD</option>
                    </Form.Select>
                  </FloatingLabel>
                </Col>
              </Row>
              <Button
                type="submit"
                variant="success"
                className="w-100 mt-2"
                disabled={isSubmittingAdd}
              >
                {isSubmittingAdd ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" />{" "}
                    {t("comptes.submitting")}
                  </>
                ) : (
                  t("comptes.submitAccount")
                )}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      )}

      {productsLoading && (
        <div className="text-center my-4">
          <Spinner animation="border" variant="primary" />{" "}
          {t("comptes.loading")}
        </div>
      )}

      {!productsLoading && (
        <>
          <div className="account-section mb-4">
            <h4 className="section-title pending-title">
              {t("comptes.pendingTitle")} ({pendingProducts.length})
            </h4>
            <Row className="g-4">
              {pendingProducts.length > 0 ? (
                pendingProducts.map((p) => (
                  <AccountCard
                    key={p._id}
                    product={p}
                    onDelete={handleDelete}
                    onEdit={handleEditClick}
                  />
                ))
              ) : (
                <Col>
                  <Alert variant="info" className="text-center py-2">
                    {t("comptes.noPending")}
                  </Alert>
                </Col>
              )}
            </Row>
          </div>
          <div className="account-section mb-4">
            <h4 className="section-title approved-title">
              {t("comptes.approvedTitle")} ({approvedProducts.length})
            </h4>
            <Row className="g-4">
              {approvedProducts.length > 0 ? (
                approvedProducts.map((p) => (
                  <AccountCard
                    key={p._id}
                    product={p}
                    onDelete={handleDelete}
                    onEdit={handleEditClick}
                  />
                ))
              ) : (
                <Col>
                  <Alert variant="secondary" className="text-center py-2">
                    {t("comptes.noApproved")}
                  </Alert>
                </Col>
              )}
            </Row>
          </div>
          <div className="account-section">
            <h4 className="section-title rejected-title">
              {t("comptes.rejectedTitle")} ({rejectedProducts.length})
            </h4>
            <Row className="g-4">
              {rejectedProducts.length > 0 ? (
                rejectedProducts.map((p) => (
                  <AccountCard
                    key={p._id}
                    product={p}
                    onDelete={handleDelete}
                    onEdit={handleEditClick}
                  />
                ))
              ) : (
                <Col>
                  <Alert
                    variant="light"
                    className="text-center text-muted py-2"
                  >
                    {t("comptes.noRejected")}
                  </Alert>
                </Col>
              )}
            </Row>
          </div>
        </>
      )}

      <Modal
        show={showEditModal}
        onHide={handleEditModalClose}
        centered
        size="lg"
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {t("comptes.editModal.title")}: {editingProduct?.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && (
            <Alert
              variant="danger"
              onClose={() => setFormError(null)}
              dismissible
            >
              {getDisplayError(formError)}
            </Alert>
          )}
          <Form onSubmit={handleEditSubmit}>
            <Row>
              <Col md={12}>
                <FloatingLabel
                  controlId="editTitleInput"
                  label={t("comptes.addForm.accountTitle")}
                  className="mb-3"
                >
                  <Form.Control
                    type="text"
                    placeholder="."
                    name="title"
                    value={editFormData.title || ""}
                    onChange={handleEditInputChange}
                    required
                  />
                </FloatingLabel>
              </Col>
              <Col md={12}>
                <Form.Group controlId="editImageInput" className="mb-3">
                  <Form.Label>{t("comptes.editModal.images")}</Form.Label>
                  <Form.Control
                    type="file"
                    multiple
                    onChange={handleEditImageChange}
                    accept="image/*"
                  />
                  <div className="image-preview-container large-preview mt-2">
                    {editImagePreviews.map((preview, index) => (
                      <div
                        key={
                          preview.isExisting
                            ? `existing-${index}`
                            : `new-${index}`
                        }
                        className="preview-item"
                        onClick={() => handleShowImageModal(preview.url)}
                        title={t("comptes.viewImage")}
                      >
                        <img
                          src={preview.url}
                          alt={`Preview ${index + 1}`}
                          className="preview-image-lg"
                          onError={(e) => (e.target.src = fallbackImageUrl)}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          className="remove-preview-btn"
                          title={t("comptes.removeImage")}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveEditImagePreview(index);
                          }}
                        >
                          <FaRegTrashAlt />
                        </Button>
                        {preview.isExisting && (
                          <span className="existing-badge">
                            {t("comptes.editModal.current")}
                          </span>
                        )}
                      </div>
                    ))}
                    {editImagePreviews.length === 0 && (
                      <div className="text-muted p-3 fst-italic small">
                        {t("comptes.editModal.noImages")}
                      </div>
                    )}
                  </div>
                </Form.Group>
              </Col>
              <Col md={12}>
                <FloatingLabel
                  controlId="editDescriptionInput"
                  label={t("comptes.addForm.description")}
                  className="mb-3"
                >
                  <Form.Control
                    as="textarea"
                    placeholder="."
                    style={{ height: "100px" }}
                    name="description"
                    value={editFormData.description || ""}
                    onChange={handleEditInputChange}
                    required
                  />
                </FloatingLabel>
              </Col>
              <Col md={12} className="mb-3">
                <Form.Label>{t("comptes.addForm.linkType")}</Form.Label>
                <Row xs={1} md={2} className="g-2">
                  {linkOptions.map((option) => (
                    <Col key={option.key}>
                      <Card
                        className={`link-type-card ${
                          editFormData.linkType === option.key ? "selected" : ""
                        }`}
                        onClick={() =>
                          handleEditInputChange({
                            target: { name: "linkType", value: option.key },
                          })
                        }
                      >
                        <Card.Body>
                          {editFormData.linkType === option.key && (
                            <FaCheckCircle className="selected-check" />
                          )}
                          <div className="link-type-content">
                            {option.parts.map((part, idx) => (
                              <span key={idx}>
                                {part.icon} {part.text}
                              </span>
                            ))}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Col>
              <Col md={6}>
                <FloatingLabel
                  controlId="editPriceInput"
                  label={t("comptes.addForm.price")}
                  className="mb-3"
                >
                  <Form.Control
                    type="number"
                    placeholder="."
                    name="price"
                    value={editFormData.price || ""}
                    onChange={handleEditInputChange}
                    required
                    min="0"
                    step="0.01"
                  />
                </FloatingLabel>
              </Col>
              <Col md={6}>
                <FloatingLabel
                  controlId="editCurrencyInput"
                  label={t("comptes.addForm.currency")}
                  className="mb-3"
                >
                  <Form.Select
                    name="currency"
                    value={editFormData.currency || "TND"}
                    onChange={handleEditInputChange}
                    required
                  >
                    <option value="TND">TND</option>
                    <option value="USD">USD</option>
                  </Form.Select>
                </FloatingLabel>
              </Col>
            </Row>
            <div className="d-flex justify-content-end mt-3 border-top pt-3">
              <Button
                variant="secondary"
                onClick={handleEditModalClose}
                className="me-2"
                disabled={isSubmittingEdit}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmittingEdit}
              >
                {isSubmittingEdit ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" />{" "}
                    {t("comptes.saving")}
                  </>
                ) : (
                  t("comptes.saveChanges")
                )}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal
        show={showImageModal}
        onHide={handleCloseImageModal}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>{t("comptes.imagePreview")}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <Image
            src={imageToShow}
            fluid
            rounded
            onError={(e) => (e.target.src = fallbackImageUrl)}
          />
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Comptes;
