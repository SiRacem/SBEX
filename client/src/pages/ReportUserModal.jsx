import React, { useState, useRef, useEffect } from "react";
import { Modal, Button, Form, Spinner, Alert, Image } from "react-bootstrap";
import { toast } from "react-toastify";
import axios from "axios";
import { useTranslation } from "react-i18next";
import {
  FaTimesCircle,
  FaFileUpload,
  FaImages,
  FaExpand,
} from "react-icons/fa";

const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ReportUserModal = ({
  show,
  handleClose,
  reportedUserId,
  reportedUserFullName,
  onReportSuccess,
}) => {
  const { t } = useTranslation();
  const [reasonCategory, setReasonCategory] = useState("");
  const [details, setDetails] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const [showLightbox, setShowLightbox] = useState(false);
  const [currentImageInLightbox, setCurrentImageInLightbox] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const reportCategories = [
    { value: "", label: t("reportUserModal.selectReason") },
    {
      value: "INAPPROPRIATE_BEHAVIOR",
      label: t("reportUserModal.inappropriateBehavior"),
    },
    { value: "SCAM", label: t("reportUserModal.scam") },
    {
      value: "IMPERSONATION",
      label: t("reportUserModal.impersonation"),
    },
    {
      value: "POLICY_VIOLATION",
      label: t("reportUserModal.policyViolation"),
    },
    { value: "OTHER", label: t("reportUserModal.other") },
  ];

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleFileChange = (event) => {
    setError("");
    const filesFromInput = Array.from(event.target.files);
    let newValidFiles = [];
    let newValidPreviews = [];
    let currentTotalFiles = selectedFiles.length;

    for (const file of filesFromInput) {
      if (currentTotalFiles >= MAX_FILES) {
        setError(t("reportUserModal.maxFilesError", { count: MAX_FILES }));
        toast.warn(t("reportUserModal.maxFilesError", { count: MAX_FILES }));
        break;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(
          t("reportUserModal.fileSizeError", {
            name: file.name,
            size: MAX_FILE_SIZE_MB,
          })
        );
        toast.warn(
          t("reportUserModal.fileSizeError", {
            name: file.name,
            size: MAX_FILE_SIZE_MB,
          })
        );
        continue;
      }
      if (!file.type.startsWith("image/")) {
        setError(t("reportUserModal.fileTypeError", { name: file.name }));
        toast.warn(t("reportUserModal.fileTypeError", { name: file.name }));
        continue;
      }
      newValidFiles.push(file);
      newValidPreviews.push(URL.createObjectURL(file));
      currentTotalFiles++;
    }

    setSelectedFiles((prevFiles) =>
      [...prevFiles, ...newValidFiles].slice(0, MAX_FILES)
    );
    setPreviewUrls((prevUrls) =>
      [...prevUrls, ...newValidPreviews].slice(0, MAX_FILES)
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (indexToRemove) => {
    const urlToRemove = previewUrls[indexToRemove];
    if (urlToRemove) {
      URL.revokeObjectURL(urlToRemove);
    }
    setSelectedFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== indexToRemove)
    );
    setPreviewUrls((prevUrls) =>
      prevUrls.filter((_, index) => index !== indexToRemove)
    );
    setError("");
  };

  const handleSubmitReport = async () => {
    if (!reasonCategory) {
      setError(t("reportUserModal.reasonRequired"));
      return;
    }
    if (details.trim().length < 10) {
      setError(t("reportUserModal.detailsMinLength"));
      return;
    }
    setError("");
    setLoading(true);

    // بناء FormData بدون reportedUserId
    const formData = new FormData();
    formData.append("reasonCategory", reasonCategory);
    formData.append("details", details);
    selectedFiles.forEach((file) => {
      formData.append("reportImages", file, file.name);
    });

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error(t("reportUserModal.authError"));
      }
      const config = { headers: { Authorization: `Bearer ${token}` } };

      // [!!!] استخدام المسار الصحيح مع تمرير الـ ID في الـ URL [!!!]
      const response = await axios.post(
        `/reports/${reportedUserId}`,
        formData,
        config
      );

      // استخدام مفاتيح الترجمة للاستجابة
      const successMsg = response.data.successMessage;
      toast.success(
        t(successMsg?.key || "reportUserModal.submitSuccess", {
          fallback: response.data.msg,
        })
      );

      if (onReportSuccess) {
        onReportSuccess();
      }
      resetModalStateAndClose(true);
    } catch (err) {
      const errorMsgObj = err.response?.data?.errorMessage;
      const fallbackMsg =
        err.response?.data?.msg || t("reportUserModal.submitError");
      const finalErrorMsg = errorMsgObj
        ? t(errorMsgObj.key, { fallback: errorMsgObj.fallback || fallbackMsg })
        : fallbackMsg;

      setError(finalErrorMsg);
      toast.error(finalErrorMsg);
      setLoading(false);
    }
  };

  const resetModalStateAndClose = (submittedSuccessfully = false) => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setReasonCategory("");
    setDetails("");
    setSelectedFiles([]);
    setPreviewUrls([]);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(false);
    handleClose();
  };

  const openLightbox = (index) => {
    setCurrentImageIndex(index);
    setCurrentImageInLightbox(previewUrls[index]);
    setShowLightbox(true);
  };

  const closeLightbox = () => {
    setShowLightbox(false);
    setCurrentImageInLightbox(null);
  };

  const showNextImage = () => {
    const nextIndex = (currentImageIndex + 1) % previewUrls.length;
    setCurrentImageIndex(nextIndex);
    setCurrentImageInLightbox(previewUrls[nextIndex]);
  };

  const showPrevImage = () => {
    const prevIndex =
      (currentImageIndex - 1 + previewUrls.length) % previewUrls.length;
    setCurrentImageIndex(prevIndex);
    setCurrentImageInLightbox(previewUrls[prevIndex]);
  };

  return (
    <>
      <Modal
        show={show}
        onHide={() => resetModalStateAndClose(false)}
        centered
        size="lg"
        backdrop="static"
        keyboard={!loading}
      >
        <Modal.Header closeButton={!loading}>
          <Modal.Title>
            {t("reportUserModal.title", {
              name: reportedUserFullName || "User",
            })}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert
              variant="danger"
              onClose={() => setError("")}
              dismissible
              className="mb-3"
            >
              {error}
            </Alert>
          )}
          <Form
            id="reportUserForm"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmitReport();
            }}
          >
            <Form.Group className="mb-3" controlId="reportReasonCategoryModal">
              <Form.Label>
                {t("reportUserModal.reasonLabel")}{" "}
                <span className="text-danger">*</span>
              </Form.Label>
              <Form.Select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                disabled={loading}
                required
              >
                {reportCategories.map((cat) => (
                  <option
                    key={cat.value}
                    value={cat.value}
                    disabled={cat.value === ""}
                  >
                    {cat.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="reportDetailsModal">
              <Form.Label>
                {t("reportUserModal.detailsLabel")}{" "}
                <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                placeholder={t("reportUserModal.detailsPlaceholder", {
                  name: reportedUserFullName || "this user",
                })}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                disabled={loading}
                minLength={10}
                required
              />
              <Form.Text className="text-muted">
                {t("reportUserModal.detailsHelp")}
              </Form.Text>
            </Form.Group>
            <Form.Group controlId="reportImagesUploadModal" className="mb-3">
              <Form.Label className="d-flex align-items-center">
                <FaImages className="me-2" />{" "}
                {t("reportUserModal.attachEvidence")}
              </Form.Label>
              <Form.Control
                type="file"
                multiple
                accept="image/jpeg, image/png, image/gif, image/webp"
                onChange={handleFileChange}
                disabled={loading || selectedFiles.length >= MAX_FILES}
                ref={fileInputRef}
                aria-describedby="imageHelpBlock"
              />
              <Form.Text id="imageHelpBlock" muted>
                {t("reportUserModal.imageHelp", {
                  maxFiles: MAX_FILES,
                  maxSize: MAX_FILE_SIZE_MB,
                })}
              </Form.Text>
            </Form.Group>
            {previewUrls.length > 0 && (
              <div className="mb-3 p-2 border rounded report-image-previews">
                <small className="d-block mb-2 text-muted">
                  {t("reportUserModal.selectedImages", {
                    count: selectedFiles.length,
                    max: MAX_FILES,
                  })}
                </small>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {previewUrls.map((url, index) => (
                    <div
                      key={index}
                      className="position-relative report-image-preview-item"
                      style={{
                        width: "80px",
                        height: "80px",
                        cursor: "pointer",
                      }}
                      onClick={() => openLightbox(index)}
                      title={t("reportUserModal.enlarge")}
                    >
                      <Image
                        src={url}
                        alt={`${t("reportUserModal.preview")} ${index + 1}`}
                        thumbnail
                        fluid
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      <div className="report-image-overlay">
                        <FaExpand size="1.2em" color="white" />
                      </div>
                      {!loading && (
                        <Button
                          variant="danger"
                          size="sm"
                          className="position-absolute top-0 end-0 m-1 report-image-remove-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(index);
                          }}
                          disabled={loading}
                          title={t("reportUserModal.remove")}
                        >
                          <FaTimesCircle />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedFiles.length >= MAX_FILES && (
              <Alert variant="info" className="small py-2 mt-2">
                {t("reportUserModal.maxImagesSelected", { count: MAX_FILES })}
              </Alert>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => resetModalStateAndClose(false)}
            disabled={loading}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            type="submit"
            form="reportUserForm"
            disabled={loading || !reasonCategory || details.trim().length < 10}
          >
            {loading ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-1"
                />{" "}
                {t("reportUserModal.submitting")}
              </>
            ) : (
              <>
                <FaFileUpload className="me-1" />{" "}
                {t("reportUserModal.submitButton")}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showLightbox}
        onHide={closeLightbox}
        centered
        size="lg"
        dialogClassName="report-lightbox-modal"
      >
        <Modal.Header closeButton className="report-lightbox-header">
          <Modal.Title>
            {t("reportUserModal.imagePreviewTitle", {
              current: currentImageIndex + 1,
              total: previewUrls.length,
            })}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 text-center report-lightbox-body">
          {currentImageInLightbox && (
            <Image
              src={currentImageInLightbox}
              fluid
              style={{ maxHeight: "80vh", objectFit: "contain", width: "100%" }}
              alt={t("reportUserModal.enlargedEvidence")}
            />
          )}
        </Modal.Body>
        {previewUrls.length > 1 && (
          <Modal.Footer className="d-flex justify-content-between report-lightbox-footer">
            <Button
              variant="light"
              onClick={showPrevImage}
              disabled={previewUrls.length <= 1}
            >
              {t("reportUserModal.previous")}
            </Button>
            <Button
              variant="light"
              onClick={showNextImage}
              disabled={previewUrls.length <= 1}
            >
              {t("reportUserModal.next")}
            </Button>
          </Modal.Footer>
        )}
      </Modal>
    </>
  );
};

export default ReportUserModal;