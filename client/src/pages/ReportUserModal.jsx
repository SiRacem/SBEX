// src/components/pages/ReportUserModal.jsx
import React, { useState, useRef, useEffect } from "react";
import { Modal, Button, Form, Spinner, Alert, Image } from "react-bootstrap";
import { toast } from "react-toastify";
import axios from "axios";
import {
  FaTimesCircle,
  FaFileUpload,
  FaImages,
  FaExpand,
} from "react-icons/fa"; // أضف FaExpand

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
  const [reasonCategory, setReasonCategory] = useState("");
  const [details, setDetails] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // --- حالة جديدة للـ Lightbox ---
  const [showLightbox, setShowLightbox] = useState(false);
  const [currentImageInLightbox, setCurrentImageInLightbox] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // لتتبع الصورة الحالية في المعرض

  const reportCategories = [
    { value: "", label: "Select a reason..." },
    {
      value: "INAPPROPRIATE_BEHAVIOR",
      label: "Inappropriate Behavior (Chat)",
    },
    { value: "SCAM", label: "Scam Attempt" },
    { value: "IMPERSONATION", label: "Impersonation / Fake Profile" },
    { value: "POLICY_VIOLATION", label: "Site Policy Violation (General)" },
    { value: "OTHER", label: "Other (Please specify in details)" },
  ];

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // تنظيف عند إلغاء تحميل المكون فقط لمنع التنظيف المبكر

  const handleFileChange = (event) => {
    setError("");
    const filesFromInput = Array.from(event.target.files);
    let newValidFiles = [];
    let newValidPreviews = [];
    let currentTotalFiles = selectedFiles.length;

    for (const file of filesFromInput) {
      if (currentTotalFiles >= MAX_FILES) {
        setError(`You can upload a maximum of ${MAX_FILES} images.`);
        toast.warn(`Maximum of ${MAX_FILES} images reached.`);
        break;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(
          `File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`
        );
        toast.warn(`File "${file.name}" is too large.`);
        continue;
      }
      if (!file.type.startsWith("image/")) {
        setError(
          `File "${file.name}" is not a valid image type (e.g., JPG, PNG, GIF).`
        );
        toast.warn(`File "${file.name}" is not an image.`);
        continue;
      }
      newValidFiles.push(file);
      newValidPreviews.push(URL.createObjectURL(file));
      currentTotalFiles++;
    }

    // تنظيف الـ Object URLs القديمة قبل إضافة الجديدة إذا كنا سنستبدل بدلاً من الإضافة
    // previewUrls.forEach(url => URL.revokeObjectURL(url)); // إذا أردت مسح القديمة دائمًا
    // لكن بما أننا نضيف، سننظف فقط عند الحذف أو إلغاء تحميل المكون

    setSelectedFiles((prevFiles) =>
      [...prevFiles, ...newValidFiles].slice(0, MAX_FILES)
    );
    setPreviewUrls((prevUrls) => {
      // تنظيف الـ URLs القديمة من مجموعة الـ previews قبل إضافة الجديد
      const oldUrlsToKeep = prevUrls.filter(
        (url) => !newValidPreviews.includes(url)
      ); // هذا قد لا يكون ضروريًا إذا كان التنظيف يتم فقط عند الحذف
      return [...oldUrlsToKeep, ...newValidPreviews].slice(0, MAX_FILES);
    });

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
      setError("Please select a reason category.");
      return;
    }
    if (details.trim().length < 10) {
      setError("Details must be at least 10 characters.");
      return;
    }
    setError("");
    setLoading(true);
    const formData = new FormData();
    formData.append("reportedUserId", reportedUserId);
    formData.append("reasonCategory", reasonCategory);
    formData.append("details", details);
    selectedFiles.forEach((file) => {
      formData.append("reportImages", file, file.name);
    });

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required. Please login again.");
      }
      const config = { headers: { Authorization: `Bearer ${token}` } }; // Axios يضبط Content-Type لـ FormData
      const response = await axios.post("/reports/user", formData, config);
      toast.success(response.data.msg || "Report submitted successfully!");
      if (onReportSuccess) {
        onReportSuccess();
      }
      resetModalStateAndClose(true);
    } catch (err) {
      const errMsg =
        err.response?.data?.msg || err.message || "Failed to submit report.";
      setError(errMsg);
      toast.error(errMsg);
      setLoading(false);
    }
  };

  const resetModalStateAndClose = (submittedSuccessfully = false) => {
    // تنظيف الـ Object URLs دائمًا عند إغلاق المودال
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

  // --- دوال الـ Lightbox ---
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
            Report User: {reportedUserFullName || "User"}
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
                Reason for reporting <span className="text-danger">*</span>
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
                Details <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                placeholder={`Provide specific details about your report concerning ${
                  reportedUserFullName || "this user"
                }... What happened, when, and where?`}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                disabled={loading}
                minLength={10}
                required
              />
              <Form.Text className="text-muted">
                Min 10 characters. Be specific and provide context.
              </Form.Text>
            </Form.Group>
            <Form.Group controlId="reportImagesUploadModal" className="mb-3">
              <Form.Label className="d-flex align-items-center">
                <FaImages className="me-2" /> Attach Evidence (Optional)
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
                Max {MAX_FILES} images. Each file up to {MAX_FILE_SIZE_MB}MB.
                (JPG, PNG, GIF, WEBP)
              </Form.Text>
            </Form.Group>
            {previewUrls.length > 0 && (
              <div className="mb-3 p-2 border rounded report-image-previews">
                <small className="d-block mb-2 text-muted">
                  Selected images ({selectedFiles.length}/{MAX_FILES}):
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
                      title="Click to enlarge"
                    >
                      <Image
                        src={url}
                        alt={`Preview ${index + 1}`}
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
                          title="Remove image"
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
                Maximum number of images ({MAX_FILES}) has been selected.
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
            Cancel
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
                Submitting...
              </>
            ) : (
              <>
                <FaFileUpload className="me-1" /> Submit Report
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* --- Lightbox Modal --- */}
      <Modal
        show={showLightbox}
        onHide={closeLightbox}
        centered
        size="lg"
        dialogClassName="report-lightbox-modal"
      >
        <Modal.Header closeButton className="report-lightbox-header">
          <Modal.Title>
            Image Preview ({currentImageIndex + 1} of {previewUrls.length})
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 text-center report-lightbox-body">
          {currentImageInLightbox && (
            <Image
              src={currentImageInLightbox}
              fluid
              style={{ maxHeight: "80vh", objectFit: "contain", width: "100%" }}
              alt="Enlarged report evidence"
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
              Previous
            </Button>
            <Button
              variant="light"
              onClick={showNextImage}
              disabled={previewUrls.length <= 1}
            >
              Next
            </Button>
          </Modal.Footer>
        )}
      </Modal>
    </>
  );
};

export default ReportUserModal;
