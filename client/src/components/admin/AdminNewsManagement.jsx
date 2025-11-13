import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Container,
  Button,
  Modal,
  Form,
  Spinner,
  Alert,
  Table,
  Badge,
  Tabs,
  Tab,
  Card,
  Image,
} from "react-bootstrap";
import { useTranslation } from "react-i18next";
import {
  getNews,
  adminCreateNews,
  adminUpdateNews,
  adminDeleteNews,
} from "../../redux/actions/newsAction";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaThumbsUp,
  FaThumbsDown,
  FaUpload,
  FaTimes,
  FaEye,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { formatErrorMessage } from "../../utils/errorUtils";
import "./AdminNewsManagement.css"; // تأكد من إنشاء هذا الملف إذا كنت ستستخدمه

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const AdminNewsManagement = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const newsCategories = [
    "General",
    "Platform Update",
    "Promotion",
    "Security Alert",
  ];

  const { posts, loading, error, loadingCUD } = useSelector(
    (state) => state.newsReducer
  );

  const [modalShow, setModalShow] = useState(false);
  const [currentPost, setCurrentPost] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showImagePreviewModal, setShowImagePreviewModal] = useState(false);

  const initialFormState = {
    title: { en: "", ar: "", fr: "", tn: "" },
    content: { en: "", ar: "", fr: "", tn: "" },
    category: "General",
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    dispatch(getNews());
  }, [dispatch]);

  const handleClose = () => {
    setModalShow(false);
    setCurrentPost(null);
    setIsEditing(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setFormData(initialFormState);
  };

  const handleShow = (post = null) => {
    if (post) {
      setIsEditing(true);
      setCurrentPost(post);
      setFormData({
        title: { ...initialFormState.title, ...post.title },
        content: { ...initialFormState.content, ...post.content },
        category: post.category,
      });
    } else {
      setIsEditing(false);
      setCurrentPost(null);
      setFormData(initialFormState);
    }
    setModalShow(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const [field, lang] = name.split("_");
    if (lang) {
      setFormData((prev) => ({
        ...prev,
        [field]: { ...prev[field], [lang]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    const fileInput = document.getElementById("file-input-news");
    if (fileInput) fileInput.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.ar || !formData.content.ar) {
      toast.error(t("admin.news.errors.requiredFieldsAR"));
      return;
    }

    const dataToSend = new FormData();
    dataToSend.append("title", JSON.stringify(formData.title));
    dataToSend.append("content", JSON.stringify(formData.content));
    dataToSend.append("category", formData.category);
    if (selectedFile) {
      dataToSend.append("media", selectedFile);
    }

    try {
      if (isEditing) {
        await dispatch(adminUpdateNews(currentPost._id, dataToSend));
        toast.success(t("admin.news.updateSuccess"));
      } else {
        await dispatch(adminCreateNews(dataToSend));
        toast.success(t("admin.news.createSuccess"));
      }
      handleClose();
    } catch (err) {
      console.error("Failed to submit news post:", err);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t("admin.news.confirmDelete"))) {
      await dispatch(adminDeleteNews(id));
      toast.success(t("admin.news.deleteSuccess"));
    }
  };

  return (
    <Container fluid className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{t("admin.news.pageTitle")}</h1>
        <Button onClick={() => handleShow()}>
          <FaPlus className="me-2" /> {t("admin.news.addButton")}
        </Button>
      </div>

      {loading && (
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      )}
      {error && <Alert variant="danger">{formatErrorMessage(error, t)}</Alert>}

      <Card>
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>#</th>
              <th>{t("admin.news.table.title")}</th>
              <th>{t("admin.news.table.category")}</th>
              <th className="text-center">{t("admin.news.table.stats")}</th>
              <th>{t("admin.news.table.createdAt")}</th>
              <th>{t("admin.news.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {posts && posts.length > 0 ? (
              posts.map((post, index) => (
                <tr key={post._id}>
                  <td>{posts.length - index}</td>
                  <td>{post.title.ar || post.title.en}</td>
                  <td>
                    <Badge bg="secondary">
                      {t(`newsCategories.${post.category}`, post.category)}
                    </Badge>
                  </td>
                  <td className="text-center">
                    <span className="text-success me-3">
                      <FaThumbsUp className="me-1" /> {post.likes.length}
                    </span>
                    <span className="text-danger me-3">
                      <FaThumbsDown className="me-1" /> {post.dislikes.length}
                    </span>
                    <span className="text-muted">
                      <FaEye className="me-1" /> {post.readBy.length}
                    </span>
                  </td>
                  <td>{new Date(post.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Button
                      variant="primary"
                      size="sm"
                      className="me-2"
                      onClick={() => handleShow(post)}
                    >
                      <FaEdit />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(post._id)}
                    >
                      <FaTrash />
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center text-muted">
                  {t("admin.news.noPosts")}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Modal show={modalShow} onHide={handleClose} size="lg" backdrop="static">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>
              {isEditing
                ? t("admin.news.editTitle")
                : t("admin.news.createTitle")}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t("admin.news.form.media")}</Form.Label>
              {previewUrl ? (
                <div
                  className="position-relative text-center mb-2"
                  style={{ maxWidth: "200px" }}
                >
                  <Image
                    src={previewUrl}
                    thumbnail
                    onClick={() => setShowImagePreviewModal(true)} // [!] اجعل الصورة قابلة للنقر
                    style={{ cursor: "pointer" }} // [!] أضف مؤشر النقر
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    className="position-absolute top-0 end-0 m-1"
                    onClick={removeSelectedFile}
                    style={{ borderRadius: "50%", lineHeight: 1 }}
                  >
                    <FaTimes />
                  </Button>
                </div>
              ) : (
                isEditing &&
                currentPost?.mediaUrl && (
                  <div className="mb-2">
                    <small>
                      {t("admin.news.form.currentMedia")}:{" "}
                      <a
                        href={`${BACKEND_URL}/${currentPost.mediaUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {currentPost.mediaUrl.split("/").pop()}
                      </a>
                    </small>
                  </div>
                )
              )}
              <div
                className="file-drop-zone"
                onClick={() =>
                  document.getElementById("file-input-news").click()
                }
              >
                <input
                  id="file-input-news"
                  type="file"
                  name="media"
                  onChange={handleFileChange}
                  accept="image/*,video/*"
                  style={{ display: "none" }}
                />
                <div>
                  <FaUpload className="icon" />
                  <p className="mb-0">{t("admin.news.form.dragOrClick")}</p>
                  <small className="text-muted">
                    {t("admin.news.form.fileConstraints")}
                  </small>
                </div>
              </div>
            </Form.Group>

            <Tabs defaultActiveKey="ar" id="news-lang-tabs" className="mb-3">
              <Tab eventKey="ar" title="العربية">
                <Form.Group className="mb-3">
                  <Form.Label>
                    {t("admin.news.form.titleAR")}{" "}
                    <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    name="title_ar"
                    value={formData.title.ar}
                    onChange={handleChange}
                    required
                    dir="rtl"
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>
                    {t("admin.news.form.contentAR")}{" "}
                    <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={8}
                    name="content_ar"
                    value={formData.content.ar}
                    onChange={handleChange}
                    required
                    dir="rtl"
                  />
                </Form.Group>
              </Tab>
              <Tab eventKey="en" title="English (Optional)">
                <Form.Group className="mb-3">
                  <Form.Label>{t("admin.news.form.titleEN")}</Form.Label>
                  <Form.Control
                    name="title_en"
                    value={formData.title.en}
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>{t("admin.news.form.contentEN")}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={8}
                    name="content_en"
                    value={formData.content.en}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Tab>
              <Tab eventKey="fr" title="Français (Optionnel)">
                <Form.Group className="mb-3">
                  <Form.Label>{t("admin.news.form.titleFR")}</Form.Label>
                  <Form.Control
                    name="title_fr"
                    value={formData.title.fr}
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>{t("admin.news.form.contentFR")}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={8}
                    name="content_fr"
                    value={formData.content.fr}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Tab>
              <Tab eventKey="tn" title="تونسي (Optionnel)">
                <Form.Group className="mb-3">
                  <Form.Label>{t("admin.news.form.titleTN")}</Form.Label>
                  <Form.Control
                    name="title_tn"
                    value={formData.title.tn}
                    onChange={handleChange}
                    dir="rtl"
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>{t("admin.news.form.contentTN")}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={8}
                    name="content_tn"
                    value={formData.content.tn}
                    onChange={handleChange}
                    dir="rtl"
                  />
                </Form.Group>
              </Tab>
            </Tabs>
            <hr />
            <Form.Group>
              <Form.Label>{t("admin.news.form.category")}</Form.Label>
              <Form.Select
                name="category"
                value={formData.category}
                onChange={handleChange}
              >
                {newsCategories.map((category) => (
                  <option key={category} value={category}>
                    {t(`newsCategories.${category}`, category)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" type="submit" disabled={loadingCUD}>
              {loadingCUD ? (
                <Spinner as="span" size="sm" />
              ) : isEditing ? (
                t("common.saveChanges")
              ) : (
                t("admin.news.createButton")
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal
        show={showImagePreviewModal}
        onHide={() => setShowImagePreviewModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {t("admin.news.form.previewTitle", "Image Preview")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <Image src={previewUrl} fluid />
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default AdminNewsManagement;
