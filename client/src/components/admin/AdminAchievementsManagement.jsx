// src/components/admin/AdminAchievementsManagement.jsx

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
  Card,
  Tabs,
  Tab,
} from "react-bootstrap";
import { useTranslation } from "react-i18next";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { formatErrorMessage } from "../../utils/errorUtils";
import {
  adminGetAllAchievements,
  adminCreateAchievement,
  adminUpdateAchievement,
  adminDeleteAchievement,
} from "../../redux/actions/achievementAction";
import * as achievementTypes from "../../redux/actionTypes/achievementActionTypes";

const AdminAchievementsManagement = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  const achievementState = useSelector((state) => state.achievementReducer);
  const { achievements, loading, error, loadingCUD, pagination } =
    achievementState;

  const [modalShow, setModalShow] = useState(false);
  const [currentAchievement, setCurrentAchievement] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const achievementCategories = ["SALES", "PURCHASES", "COMMUNITY", "SPECIAL"];

  const initialFormState = {
    title: { en: "", ar: "", fr: "", tn: "" },
    description: { en: "", ar: "", fr: "", tn: "" },
    icon: "",
    category: "COMMUNITY",
    criteria: "{}", // Store as string for easy editing in textarea
    pointsAwarded: 0,
    isEnabled: true,
    secret: false,
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    dispatch(adminGetAllAchievements());
  }, [dispatch]);

  const handleClose = () => {
    setModalShow(false);
    setCurrentAchievement(null);
    setIsEditing(false);
    setFormData(initialFormState);
    dispatch({ type: achievementTypes.ADMIN_CREATE_ACHIEVEMENT_RESET });
    dispatch({ type: achievementTypes.ADMIN_UPDATE_ACHIEVEMENT_RESET });
  };

  const handleShow = (achievement = null) => {
    if (achievement) {
      setIsEditing(true);
      setCurrentAchievement(achievement);
      setFormData({
        title: { ...initialFormState.title, ...achievement.title },
        description: {
          ...initialFormState.description,
          ...achievement.description,
        },
        icon: achievement.icon,
        category: achievement.category,
        criteria: JSON.stringify(achievement.criteria, null, 2), // Pretty format JSON for readability
        pointsAwarded: achievement.pointsAwarded,
        isEnabled: achievement.isEnabled,
        secret: achievement.secret,
      });
    } else {
      setIsEditing(false);
      setCurrentAchievement(null);
      setFormData(initialFormState);
    }
    setModalShow(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const [field, lang] = name.split("_");

    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (lang) {
      setFormData((prev) => ({
        ...prev,
        [field]: { ...prev[field], [lang]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.ar || !formData.description.ar) {
      toast.error(t("admin.achievements.errors.requiredFieldsAR"));
      return;
    }

    let parsedCriteria;
    try {
      parsedCriteria = JSON.parse(formData.criteria);
    } catch (err) {
      toast.error(t("admin.achievements.errors.invalidJson"));
      return;
    }

    // قم ببناء كائن البيانات الذي سيتم إرساله.
    // لا حاجة لـ FormData لأننا لا نرفع ملفات.
    const dataToSend = {
      title: formData.title, // أرسل الكائن كما هو
      description: formData.description, // أرسل الكائن كما هو
      criteria: parsedCriteria, // أرسل الكائن المحلل
      icon: formData.icon,
      category: formData.category,
      pointsAwarded: formData.pointsAwarded,
      isEnabled: formData.isEnabled,
      secret: formData.secret,
    };

    try {
      if (isEditing) {
        // في حالة التعديل، أرسل الكائن مباشرة
        await dispatch(
          adminUpdateAchievement(currentAchievement._id, dataToSend)
        );
        toast.success(t("admin.achievements.updateSuccess"));
      } else {
        // في حالة الإنشاء، قم بتحويل الحقول المعقدة إلى JSON string كما يتوقعها الخادم
        const createData = {
          ...dataToSend,
          title: JSON.stringify(dataToSend.title),
          description: JSON.stringify(dataToSend.description),
          criteria: JSON.stringify(dataToSend.criteria),
        };
        await dispatch(adminCreateAchievement(createData));
        toast.success(t("admin.achievements.createSuccess"));
      }
      handleClose();
    } catch (err) {
      toast.error(t("admin.achievements.errors.genericSubmit"));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t("admin.achievements.confirmDelete"))) {
      try {
        await dispatch(adminDeleteAchievement(id));
        toast.success(t("admin.achievements.deleteSuccess"));
      } catch (err) {
        // Global error handling will catch this
      }
    }
  };

  return (
    <Container fluid className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{t("admin.achievements.pageTitle")}</h1>
        <Button onClick={() => handleShow()}>
          <FaPlus className="me-2" /> {t("admin.achievements.addButton")}
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
              <th>{t("admin.achievements.table.icon")}</th>
              <th>{t("admin.achievements.table.title")}</th>
              <th>{t("admin.achievements.table.category")}</th>
              <th>{t("admin.achievements.table.criteria")}</th>
              <th>{t("admin.achievements.table.status")}</th>
              <th>{t("admin.achievements.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {achievements && achievements.length > 0 ? (
              achievements.map((ach) => (
                <tr key={ach._id}>
                  <td className="text-center">
                    <i className={ach.icon} style={{ fontSize: "1.5rem" }}></i>
                  </td>
                  <td>{ach.title[i18n.language] || ach.title.ar}</td>
                  <td>
                    <Badge bg="info">
                      {t(
                        `admin.achievements.categories.${ach.category}`,
                        ach.category
                      )}
                    </Badge>
                  </td>
                  <td>
                    <code>{JSON.stringify(ach.criteria)}</code>
                  </td>
                  <td className="text-center">
                    {ach.isEnabled ? (
                      <FaCheckCircle
                        className="text-success"
                        title={t("admin.achievements.statuses.enabled")}
                      />
                    ) : (
                      <FaTimesCircle
                        className="text-danger"
                        title={t("admin.achievements.statuses.disabled")}
                      />
                    )}
                  </td>
                  <td>
                    <Button
                      variant="primary"
                      size="sm"
                      className="me-2"
                      onClick={() => handleShow(ach)}
                    >
                      <FaEdit />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(ach._id)}
                    >
                      <FaTrash />
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center text-muted">
                  {t("admin.achievements.noAchievements")}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Modal show={modalShow} onHide={handleClose} size="lg" backdrop="static" style={{ marginRight: "5%" }}>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>
              {isEditing
                ? t("admin.achievements.modal.editTitle")
                : t("admin.achievements.modal.createTitle")}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Tabs defaultActiveKey="ar" id="ach-lang-tabs" className="mb-3">
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
                    rows={3}
                    name="description_ar"
                    value={formData.description.ar}
                    onChange={handleChange}
                    required
                    dir="rtl"
                  />
                </Form.Group>
              </Tab>
              <Tab eventKey="en" title="English">
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
                    rows={3}
                    name="description_en"
                    value={formData.description.en}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Tab>
              {/* Add other language tabs similarly if needed */}
            </Tabs>
            <hr />
            <Form.Group className="mb-3">
              <Form.Label>{t("admin.achievements.modal.iconLabel")}</Form.Label>
              <Form.Control
                name="icon"
                value={formData.icon}
                onChange={handleChange}
                placeholder={t("admin.achievements.modal.iconPlaceholder")}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>
                {t("admin.achievements.modal.categoryLabel")}
              </Form.Label>
              <Form.Select
                name="category"
                value={formData.category}
                onChange={handleChange}
              >
                {achievementCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`admin.achievements.categories.${cat}`, cat)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>
                {t("admin.achievements.modal.criteriaLabel")}
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                name="criteria"
                value={formData.criteria}
                onChange={handleChange}
                placeholder={t("admin.achievements.modal.criteriaPlaceholder")}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>
                {t("admin.achievements.modal.pointsLabel")}
              </Form.Label>
              <Form.Control
                type="number"
                name="pointsAwarded"
                value={formData.pointsAwarded}
                onChange={handleChange}
                min="0"
              />
            </Form.Group>
            <Card body className="mb-3">
              <Card.Title as="h6">
                {t("admin.achievements.modal.settingsTitle")}
              </Card.Title>
              <Form.Check
                type="switch"
                id="isEnabled-switch"
                name="isEnabled"
                label={t("admin.achievements.modal.enabledLabel")}
                checked={formData.isEnabled}
                onChange={handleChange}
              />
              <Form.Check
                type="switch"
                id="isSecret-switch"
                name="secret"
                label={t("admin.achievements.modal.secretLabel")}
                checked={formData.secret}
                onChange={handleChange}
              />
            </Card>
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
                t("admin.achievements.addButton")
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default AdminAchievementsManagement;