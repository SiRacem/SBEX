// src/pages/CreateTicketPage.jsx
import React, { useState, useEffect, useRef } from "react";
// [!!!] START OF THE FIX [!!!]
import { useDispatch, useSelector } from "react-redux"; //  <--- تم تغيير المصدر هنا
// [!!!] END OF THE FIX [!!!]
import { useNavigate, Link } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  ListGroup,
  Badge,
} from "react-bootstrap";
import { useTranslation } from "react-i18next";
import {
  createTicketAction,
  resetCreateTicketStatus,
} from "../redux/actions/ticketAction";
import { toast } from "react-toastify";
import {
  FaTicketAlt,
  FaTag,
  FaExclamationTriangle,
  FaInfoCircle,
  FaPaperclip,
  FaTimesCircle,
  FaFileUpload,
  FaFileAlt,
} from "react-icons/fa";
import { FiType, FiMessageSquare } from "react-icons/fi";
import "./CreateTicketPage.css";

const MAX_FILE_SIZE_MB = 15;
const MAX_FILES_COUNT = 5;
const ALLOWED_FILE_TYPES_FRONTEND = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/zip",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "video/mp4",
  "video/webm",
  "video/mov",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/mp3",
];
const ALLOWED_EXTENSIONS_FRONTEND =
  /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|mp4|webm|mov|mp3|wav)$/i;

const formatFileSize = (bytes, t) => {
  if (bytes === 0) return t("fileUtils.zeroBytes");
  const k = 1024;
  const dm = 2;
  const sizes = [
    t("fileUtils.sizes.bytes"),
    t("fileUtils.sizes.kb"),
    t("fileUtils.sizes.mb"),
    t("fileUtils.sizes.gb"),
    t("fileUtils.sizes.tb"),
  ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const CreateTicketPage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const TICKET_CATEGORIES = [
    { value: "", label: t("createTicket.categories.select") },
    {
      value: "TechnicalIssue",
      label: t("createTicket.categories.TechnicalIssue"),
    },
    {
      value: "TransactionInquiry",
      label: t("createTicket.categories.TransactionInquiry"),
    },
    { value: "AccountIssue", label: t("createTicket.categories.AccountIssue") },
    { value: "PaymentIssue", label: t("createTicket.categories.PaymentIssue") },
    {
      value: "MediationIssue",
      label: t("createTicket.categories.MediationIssue"),
    },
    { value: "BugReport", label: t("createTicket.categories.BugReport") },
    {
      value: "FeatureRequest",
      label: t("createTicket.categories.FeatureRequest"),
    },
    {
      value: "GeneralInquiry",
      label: t("createTicket.categories.GeneralInquiry"),
    },
    { value: "Complaint", label: t("createTicket.categories.Complaint") },
    { value: "Other", label: t("createTicket.categories.Other") },
  ];

  const TICKET_PRIORITIES = [
    { value: "Medium", label: t("createTicket.priorities.Medium") },
    { value: "Low", label: t("createTicket.priorities.Low") },
    { value: "High", label: t("createTicket.priorities.High") },
    { value: "Urgent", label: t("createTicket.priorities.Urgent") },
  ];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [attachments, setAttachments] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  const { loadingCreate, successCreate, errorCreate, createdTicket } =
    useSelector((state) => state.ticketReducer);
  const {
    user,
    isAuth,
    loading: userLoading,
  } = useSelector((state) => state.userReducer);

  useEffect(() => {
    dispatch(resetCreateTicketStatus());
  }, [dispatch]);

  useEffect(() => {
    if (successCreate || (!loadingCreate && !errorCreate && !createdTicket)) {
      setTitle("");
      setDescription("");
      setCategory("");
      setPriority("Medium");
      setAttachments([]);
      setFormErrors({});
    }
  }, [successCreate, loadingCreate, errorCreate, createdTicket]);

  useEffect(() => {
    if (!userLoading && !isAuth) {
      toast.error(t("createTicket.loginRequired"));
      navigate("/login", { replace: true });
    }
  }, [isAuth, userLoading, navigate, t]);

  useEffect(() => {
    if (successCreate && createdTicket) {
      toast.success(t("createTicket.successToast"));
      const ticketIdentifier = createdTicket.ticketId || createdTicket._id;
      if (ticketIdentifier)
        navigate(`/dashboard/support/tickets/${ticketIdentifier}`);
      else navigate("/dashboard/tickets");
    }
    if (errorCreate) {
      setFormErrors((prev) => ({
        ...prev,
        submit: t(errorCreate.key, {
          ...errorCreate.params,
          defaultValue: errorCreate.fallback,
        }),
      }));
    }
  }, [successCreate, errorCreate, createdTicket, navigate, dispatch, t]);

  const validateForm = () => {
    const errors = {};
    if (!title.trim()) errors.title = t("createTicket.errors.titleRequired");
    else if (title.trim().length < 5)
      errors.title = t("createTicket.errors.titleMin");
    else if (title.trim().length > 150)
      errors.title = t("createTicket.errors.titleMax");

    if (!description.trim())
      errors.description = t("createTicket.errors.descriptionRequired");
    else if (description.trim().length < 20)
      errors.description = t("createTicket.errors.descriptionMin");
    else if (description.trim().length > 5000)
      errors.description = t("createTicket.errors.descriptionMax");

    if (!category) errors.category = t("createTicket.errors.categoryRequired");

    let attachmentErrorMessages = [];
    attachments.forEach((att) => {
      if (att.file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        attachmentErrorMessages.push(
          t("createTicket.errors.fileSize", {
            name: att.file.name,
            size: MAX_FILE_SIZE_MB,
          })
        );
      }
      const fileExtension = "." + att.file.name.split(".").pop().toLowerCase();
      const isTypeAllowed = ALLOWED_FILE_TYPES_FRONTEND.includes(att.file.type);
      const isExtensionAllowed =
        ALLOWED_EXTENSIONS_FRONTEND.test(fileExtension);

      if (!isTypeAllowed && !isExtensionAllowed && att.file.type !== "") {
        attachmentErrorMessages.push(
          t("createTicket.errors.fileType", { name: att.file.name })
        );
      }
    });
    if (attachments.length > MAX_FILES_COUNT) {
      attachmentErrorMessages.push(
        t("createTicket.errors.fileCount", { count: MAX_FILES_COUNT })
      );
    }
    if (attachmentErrorMessages.length > 0)
      errors.attachments = attachmentErrorMessages.join(" ");

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = (e) => {
    const newFilesArray = Array.from(e.target.files);
    let currentAttachmentObjects = [...attachments];
    let localFileErrors = [];

    for (let i = 0; i < newFilesArray.length; i++) {
      const file = newFilesArray[i];
      if (currentAttachmentObjects.length < MAX_FILES_COUNT) {
        const fileExtension = "." + file.name.split(".").pop().toLowerCase();
        const isTypeAllowed = ALLOWED_FILE_TYPES_FRONTEND.includes(file.type);
        const isExtensionAllowed =
          ALLOWED_EXTENSIONS_FRONTEND.test(fileExtension);

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          localFileErrors.push(
            t("createTicket.errors.fileSize", {
              name: file.name,
              size: MAX_FILE_SIZE_MB,
            })
          );
        } else if (!isTypeAllowed && !isExtensionAllowed && file.type !== "") {
          localFileErrors.push(
            t("createTicket.errors.fileType", { name: file.name })
          );
        } else if (
          !currentAttachmentObjects.some(
            (att) => att.file.name === file.name && att.file.size === file.size
          )
        ) {
          currentAttachmentObjects.push({
            file,
            id: `${file.name}-${file.lastModified}-${
              file.size
            }-${Math.random()}`,
          });
        } else {
          localFileErrors.push(
            t("createTicket.errors.fileExists", { name: file.name })
          );
        }
      } else {
        localFileErrors.push(
          t("createTicket.errors.fileCount", { count: MAX_FILES_COUNT })
        );
        break;
      }
    }

    setAttachments(currentAttachmentObjects.slice(0, MAX_FILES_COUNT));

    if (localFileErrors.length > 0) {
      const errorString = localFileErrors.join("\n");
      setFormErrors((prev) => ({ ...prev, attachments: errorString }));
      toast.error(errorString, { autoClose: 5000 });
    } else if (formErrors.attachments && newFilesArray.length > 0) {
      setFormErrors((prev) => ({ ...prev, attachments: null }));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (fileIdToRemove) => {
    setAttachments((prev) => prev.filter((att) => att.id !== fileIdToRemove));
    if (
      attachments.length - 1 < MAX_FILES_COUNT &&
      formErrors.attachments?.includes("maximum")
    ) {
      setFormErrors((prev) => ({ ...prev, attachments: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    if (!validateForm()) {
      toast.error(t("createTicket.errors.formInvalid"));
      return;
    }

    const ticketData = { title, description, category, priority };
    const filesToUpload = attachments.map((att) => att.file);

    setFormErrors((prev) => ({ ...prev, submit: null }));

    try {
      await dispatch(createTicketAction(ticketData, filesToUpload));
    } catch (submitError) {
      console.error(
        "Submission error caught in component handleSubmit:",
        submitError
      );
      setFormErrors((prev) => ({
        ...prev,
        submit: submitError.message || t("apiErrors.unknownError"),
      }));
    }
  };

  if (userLoading)
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">{t("createTicket.loadingUser")}</p>
      </Container>
    );
  if (!isAuth)
    return (
      <Container className="py-5 text-center">
        <Alert variant="warning">{t("createTicket.loginRequiredAlert")}</Alert>
        <Button as={Link} to="/login" variant="primary">
          {t("app.goToLogin")}
        </Button>
      </Container>
    );

  return (
    <Container className="create-ticket-page py-lg-5 py-4">
      <Row className="justify-content-center">
        <Col md={10} lg={8} xl={7}>
          <Card className="shadow-lg border-0 ticket-form-card">
            <Card.Header className="bg-gradient-primary text-white ticket-form-header">
              <h3 className="mb-0 d-flex align-items-center">
                <FaTicketAlt className="me-2" />{" "}
                {t("createTicket.header.title")}
              </h3>
              <p className="mb-0 small">{t("createTicket.header.subtitle")}</p>
            </Card.Header>
            <Card.Body className="p-4 p-md-5">
              <Form onSubmit={handleSubmit} noValidate>
                <Row>
                  <Col md={12}>
                    <Form.Group
                      className="mb-4 position-relative"
                      controlId="ticketTitle"
                    >
                      <Form.Label className="fw-semibold d-flex align-items-center">
                        <FiType className="me-2 form-icon" />{" "}
                        {t("createTicket.labels.title")}{" "}
                        <span className="text-danger ms-1">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder={t("createTicket.placeholders.title")}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        isInvalid={!!formErrors.title}
                        maxLength={150}
                        required
                        size="lg"
                      />
                      <Form.Control.Feedback type="invalid" className="d-block">
                        {formErrors.title}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group
                      className="mb-4 position-relative"
                      controlId="ticketCategoryControl"
                    >
                      <Form.Label className="fw-semibold d-flex align-items-center">
                        <FaTag className="me-2 form-icon" />{" "}
                        {t("createTicket.labels.category")}{" "}
                        <span className="text-danger ms-1">*</span>
                      </Form.Label>
                      <Form.Select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        isInvalid={!!formErrors.category}
                        required
                        size="lg"
                      >
                        {TICKET_CATEGORIES.map((cat) => (
                          <option
                            key={cat.value}
                            value={cat.value}
                            disabled={cat.value === ""}
                          >
                            {cat.label}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Control.Feedback type="invalid" className="d-block">
                        {formErrors.category}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group
                      className="mb-4"
                      controlId="ticketPriorityControl"
                    >
                      <Form.Label className="fw-semibold d-flex align-items-center">
                        <FaExclamationTriangle className="me-2 form-icon" />{" "}
                        {t("createTicket.labels.priority")}
                      </Form.Label>
                      <Form.Select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        size="lg"
                      >
                        {TICKET_PRIORITIES.map((prio) => (
                          <option key={prio.value} value={prio.value}>
                            {prio.label}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group
                  className="mb-4 position-relative"
                  controlId="ticketDescription"
                >
                  <Form.Label className="fw-semibold d-flex align-items-center">
                    <FiMessageSquare className="me-2 form-icon" />{" "}
                    {t("createTicket.labels.description")}{" "}
                    <span className="text-danger ms-1">*</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={7}
                    placeholder={t("createTicket.placeholders.description")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    isInvalid={!!formErrors.description}
                    maxLength={5000}
                    required
                    size="lg"
                  />
                  <Form.Control.Feedback type="invalid" className="d-block">
                    {formErrors.description}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group controlId="ticketAttachmentsGroup" className="mb-4">
                  <Form.Label className="fw-semibold d-flex align-items-center">
                    <FaPaperclip className="me-2 form-icon" />{" "}
                    {t("createTicket.labels.attachments")}
                  </Form.Label>
                  <div
                    className={`custom-file-upload p-3 border rounded text-center ${
                      formErrors.attachments ? "is-invalid" : ""
                    }`}
                    onClick={() =>
                      fileInputRef.current && fileInputRef.current.click()
                    }
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleFileChange({
                        target: { files: e.dataTransfer.files },
                      });
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <FaFileUpload size={30} className="text-muted mb-2" />
                    <p className="mb-1 small text-muted">
                      {t("createTicket.fileUpload.dragAndDrop")}
                    </p>
                    <p className="mb-2 x-small text-muted">
                      {t("createTicket.fileUpload.constraints", {
                        count: MAX_FILES_COUNT,
                        size: MAX_FILE_SIZE_MB,
                      })}
                    </p>
                    <Form.Control
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      accept={ALLOWED_FILE_TYPES_FRONTEND.join(",")}
                      className="d-none"
                    />
                  </div>
                  {attachments.length > 0 && (
                    <ListGroup variant="flush" className="mt-3 attachment-list">
                      {attachments.map((att) => (
                        <ListGroup.Item
                          key={att.id}
                          className="d-flex justify-content-between align-items-center px-0 py-2"
                        >
                          <div className="d-flex align-items-center">
                            <FaFileAlt className="me-2 text-muted flex-shrink-0" />
                            <span className="file-name me-2">
                              {att.file.name}
                            </span>
                            <Badge
                              bg="light"
                              text="dark"
                              pill
                              className="flex-shrink-0"
                            >
                              {formatFileSize(att.file.size, t)}
                            </Badge>
                          </div>
                          <Button
                            variant="link"
                            className="text-danger p-0 remove-attachment-btn"
                            onClick={() => removeAttachment(att.id)}
                            title={t("createTicket.fileUpload.remove")}
                          >
                            <FaTimesCircle size={18} />
                          </Button>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                  {formErrors.attachments && (
                    <Form.Text className="text-danger small mt-1 d-block">
                      {formErrors.attachments}
                    </Form.Text>
                  )}
                </Form.Group>

                {formErrors.submit && (
                  <Alert variant="danger" className="mt-3 py-2">
                    {formErrors.submit}
                  </Alert>
                )}
                {errorCreate && !formErrors.submit && (
                  <Alert variant="danger" className="mt-3 py-2">
                    {t(errorCreate.key, {
                      ...errorCreate.params,
                      defaultValue: errorCreate.fallback,
                    })}
                  </Alert>
                )}

                <Button
                  variant="primary"
                  type="submit"
                  disabled={loadingCreate}
                  className="w-100 mt-3 py-2 fs-5 ticket-submit-btn"
                >
                  {loadingCreate ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      {t("createTicket.submitting")}
                    </>
                  ) : (
                    t("createTicket.submitButton")
                  )}
                </Button>
              </Form>
            </Card.Body>
            <Card.Footer className="text-center py-3 bg-light">
              <p className="mb-0 small text-muted">
                <FaInfoCircle className="me-1" /> {t("createTicket.footerNote")}
              </p>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};
export default CreateTicketPage;