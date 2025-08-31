// src/components/admin/AdminFAQManagement.jsx
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Container,
  Table,
  Button,
  Modal,
  Form,
  Spinner,
  Alert,
  Badge,
  Row,
  Col,
} from "react-bootstrap";
import {
  adminGetAllFAQs,
  adminCreateFAQ,
  adminUpdateFAQ,
  adminDeleteFAQ,
  resetCreateFaqStatus,
  resetUpdateFaqStatus,
} from "../../redux/actions/faqAction";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";

const AdminFAQManagement = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Dynamically generate categories from translation file
  const FAQ_CATEGORIES = Object.keys(
    t("faqCategories", { returnObjects: true })
  );

  const {
    adminFaqList,
    loadingAdmin,
    errorAdmin,
    loadingCUD,
    successCreate,
    successUpdate,
  } = useSelector((state) => state.faqReducer);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentFaq, setCurrentFaq] = useState(null);
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: FAQ_CATEGORIES[0] || "General",
    isActive: true,
    displayOrder: 0,
  });

  useEffect(() => {
    dispatch(adminGetAllFAQs());
  }, [dispatch]);

  useEffect(() => {
    if (successCreate || successUpdate) {
      handleCloseModal();
      if (successCreate) dispatch(resetCreateFaqStatus());
      if (successUpdate) dispatch(resetUpdateFaqStatus());
    }
  }, [successCreate, successUpdate, dispatch]);

  const handleCloseModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setCurrentFaq(null);
    setFormData({
      question: "",
      answer: "",
      category: FAQ_CATEGORIES[0] || "General",
      isActive: true,
      displayOrder: 0,
    });
  };

  const handleShowCreateModal = () => {
    setIsEditing(false);
    setFormData({
      question: "",
      answer: "",
      category: FAQ_CATEGORIES[0] || "General",
      isActive: true,
      displayOrder: 0,
    });
    setShowModal(true);
  };

  const handleShowEditModal = (faq) => {
    setIsEditing(true);
    setCurrentFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      isActive: faq.isActive,
      displayOrder: faq.displayOrder || 0,
    });
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isEditing) {
      dispatch(adminUpdateFAQ(currentFaq._id, formData));
    } else {
      dispatch(adminCreateFAQ(formData));
    }
  };

  const handleDelete = (id) => {
    if (window.confirm(t("admin.faq.deleteConfirm"))) {
      dispatch(adminDeleteFAQ(id));
    }
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{t("admin.faq.page.title")}</h1>
        <Button variant="primary" onClick={handleShowCreateModal}>
          <FaPlus className="me-2" /> {t("admin.faq.page.addButton")}
        </Button>
      </div>

      {loadingAdmin ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : errorAdmin ? (
        <Alert variant="danger">
          {t(errorAdmin.key, {
            ...errorAdmin.params,
            defaultValue: errorAdmin.fallback,
          })}
        </Alert>
      ) : adminFaqList.length > 0 ? (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>#</th>
              <th>{t("admin.faq.table.question")}</th>
              <th>{t("admin.faq.table.category")}</th>
              <th>{t("admin.faq.table.status")}</th>
              <th>{t("admin.faq.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {adminFaqList.map((faq, index) => (
              <tr key={faq._id}>
                <td>{index + 1}</td>
                <td>
                  {faq.question.substring(0, 70)}
                  {faq.question.length > 70 && "..."}
                </td>
                <td>
                  {t(`faqCategories.${faq.category}.title`, {
                    defaultValue: faq.category,
                  })}
                </td>
                <td>
                  <Badge bg={faq.isActive ? "success" : "secondary"}>
                    {faq.isActive
                      ? t("common.statuses.active")
                      : t("common.statuses.inactive")}
                  </Badge>
                </td>
                <td className="text-center">
                  <Button
                    variant="outline-info"
                    size="sm"
                    className="me-2"
                    onClick={() => handleShowEditModal(faq)}
                    title={t("admin.faq.actions.edit")}
                  >
                    <FaEdit />
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleDelete(faq._id)}
                    title={t("admin.faq.actions.delete")}
                  >
                    <FaTrash />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Alert variant="info">{t("admin.faq.page.noFaqs")}</Alert>
      )}

      <Modal
        show={showModal}
        onHide={handleCloseModal}
        size="lg"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing
              ? t("admin.faq.modal.editTitle")
              : t("admin.faq.modal.createTitle")}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="formQuestion">
              <Form.Label>{t("admin.faq.modal.questionLabel")}</Form.Label>
              <Form.Control
                type="text"
                name="question"
                value={formData.question}
                onChange={handleChange}
                required
                placeholder={t("admin.faq.modal.questionPlaceholder")}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="formAnswer">
              <Form.Label>{t("admin.faq.modal.answerLabel")}</Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                name="answer"
                value={formData.answer}
                onChange={handleChange}
                required
                placeholder={t("admin.faq.modal.answerPlaceholder")}
              />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="formCategory">
                  <Form.Label>{t("admin.faq.modal.categoryLabel")}</Form.Label>
                  <Form.Select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                  >
                    {FAQ_CATEGORIES.map((catKey) => (
                      <option key={catKey} value={catKey}>
                        {t(`faqCategories.${catKey}.title`, {
                          defaultValue: catKey,
                        })}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="formDisplayOrder">
                  <Form.Label>{t("admin.faq.modal.orderLabel")}</Form.Label>
                  <Form.Control
                    type="number"
                    name="displayOrder"
                    value={formData.displayOrder}
                    onChange={handleChange}
                  />
                  <Form.Text className="text-muted">
                    {t("admin.faq.modal.orderHelpText")}
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            <Form.Check
              type="switch"
              id="faq-is-active-switch"
              label={t("admin.faq.modal.activeLabel")}
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={handleCloseModal}
              disabled={loadingCUD}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={loadingCUD}>
              {loadingCUD ? (
                <>
                  <Spinner as="span" size="sm" className="me-2" />{" "}
                  {t("common.saving")}
                </>
              ) : (
                t("common.saveChanges")
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default AdminFAQManagement;