// src/components/admin/AdminPaymentMethods.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Spinner,
  Alert,
  Table,
  Badge,
  Modal,
  Form,
  FloatingLabel,
  ButtonGroup,
  Tooltip,
  OverlayTrigger,
  Image,
} from "react-bootstrap";
import {
  FaPlus,
  FaEdit,
  FaTrashAlt,
  FaToggleOn,
  FaToggleOff,
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  adminGetAllPaymentMethods,
  adminAddPaymentMethod,
  adminUpdatePaymentMethod,
  adminDeletePaymentMethod,
  clearPaymentMethodError,
} from "../../redux/actions/paymentMethodAction";
import "./AdminPaymentMethods.css";

const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

const MethodFormModal = ({ show, onHide, methodToEdit, onSave }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({});
  const [validated, setValidated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const initializeForm = (method) => ({
      name: method?.name || "",
      type: method?.type || "both",
      displayName: method?.displayName || "",
      description: method?.description || "",
      logoUrl: method?.logoUrl || "",
      depositTargetInfo: method?.depositTargetInfo || "",
      minDepositTND:
        method?.minDepositTND != null ? String(method.minDepositTND) : "5",
      minDepositUSD:
        method?.minDepositUSD != null ? String(method.minDepositUSD) : "2",
      minWithdrawalTND:
        method?.minWithdrawalTND != null
          ? String(method.minWithdrawalTND)
          : "5",
      minWithdrawalUSD:
        method?.minWithdrawalUSD != null
          ? String(method.minWithdrawalUSD)
          : "2",
      depositCommissionPercent:
        method?.depositCommissionPercent != null
          ? String(method.depositCommissionPercent)
          : "0",
      withdrawalCommissionPercent:
        method?.withdrawalCommissionPercent != null
          ? String(method.withdrawalCommissionPercent)
          : "0",
      requiredWithdrawalInfo: method?.requiredWithdrawalInfo || "",
      isActive: method?.isActive !== undefined ? method.isActive : true,
      notes: method?.notes || "",
    });

    setFormData(initializeForm(methodToEdit));
    setValidated(false);
  }, [methodToEdit, show]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.checkValidity() === false) {
      event.stopPropagation();
      setValidated(true);
      toast.warn(t("admin.methods.modal.validationWarning"));
      return;
    }
    setIsSaving(true);

    const dataToSave = {
      name: formData.name,
      type: formData.type,
      displayName: formData.displayName || formData.name,
      description: formData.description || null,
      logoUrl: formData.logoUrl || null,
      depositTargetInfo: formData.depositTargetInfo || null,
      requiredWithdrawalInfo: formData.requiredWithdrawalInfo || null,
      isActive: formData.isActive,
      notes: formData.notes || null,
      minDepositTND: parseFloat(formData.minDepositTND || "0"),
      minDepositUSD: parseFloat(formData.minDepositUSD || "0"),
      minWithdrawalTND: parseFloat(formData.minWithdrawalTND || "0"),
      minWithdrawalUSD: parseFloat(formData.minWithdrawalUSD || "0"),
      depositCommissionPercent: parseFloat(
        formData.depositCommissionPercent || "0"
      ),
      withdrawalCommissionPercent: parseFloat(
        formData.withdrawalCommissionPercent || "0"
      ),
    };

    Object.keys(dataToSave).forEach((key) => {
      if (typeof dataToSave[key] === "number" && isNaN(dataToSave[key])) {
        dataToSave[key] = 0;
      }
    });

    try {
      await onSave(dataToSave);
      onHide();
    } catch (err) {
      // Error toast is handled by the action
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          {methodToEdit
            ? t("admin.methods.modal.editTitle", {
                name: formData.displayName || formData.name,
              })
            : t("admin.methods.modal.addTitle")}
        </Modal.Title>
      </Modal.Header>
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Modal.Body>
          <Row>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodName"
                label={t("admin.methods.modal.nameLabel")}
              >
                <Form.Control
                  type="text"
                  name="name"
                  placeholder="e.g., D17_Wallet"
                  value={formData.name || ""}
                  onChange={handleChange}
                  required
                  disabled={!!methodToEdit}
                />
                <Form.Control.Feedback type="invalid">
                  {t("admin.methods.modal.nameInvalid")}
                </Form.Control.Feedback>
              </FloatingLabel>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodDisplayName"
                label={t("admin.methods.modal.displayNameLabel")}
              >
                <Form.Control
                  type="text"
                  name="displayName"
                  placeholder="e.g., محفظة D17"
                  value={formData.displayName || ""}
                  onChange={handleChange}
                  required
                />
                <Form.Control.Feedback type="invalid">
                  {t("admin.methods.modal.displayNameInvalid")}
                </Form.Control.Feedback>
              </FloatingLabel>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodType"
                label={t("admin.methods.modal.typeLabel")}
              >
                <Form.Select
                  name="type"
                  value={formData.type || "both"}
                  onChange={handleChange}
                  required
                  disabled={!!methodToEdit}
                >
                  <option value="both">
                    {t("admin.methods.modal.typeBoth")}
                  </option>
                  <option value="deposit">
                    {t("admin.methods.modal.typeDeposit")}
                  </option>
                  <option value="withdrawal">
                    {t("admin.methods.modal.typeWithdrawal")}
                  </option>
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  {t("admin.methods.modal.typeInvalid")}
                </Form.Control.Feedback>
              </FloatingLabel>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodLogoUrl"
                label={t("admin.methods.modal.logoUrlLabel")}
              >
                <Form.Control
                  type="url"
                  name="logoUrl"
                  placeholder="https://..."
                  value={formData.logoUrl || ""}
                  onChange={handleChange}
                />
                <Form.Control.Feedback type="invalid">
                  {t("admin.methods.modal.logoUrlInvalid")}
                </Form.Control.Feedback>
              </FloatingLabel>
            </Col>
            <Col xs={12} className="mb-3">
              <FloatingLabel
                controlId="methodDescription"
                label={t("admin.methods.modal.descriptionLabel")}
              >
                <Form.Control
                  as="textarea"
                  rows={2}
                  name="description"
                  placeholder="..."
                  value={formData.description || ""}
                  onChange={handleChange}
                />
              </FloatingLabel>
            </Col>
            <Col xs={12} className="mb-3">
              <FloatingLabel
                controlId="methodDepositTarget"
                label={t("admin.methods.modal.depositInfoLabel")}
              >
                <Form.Control
                  type="text"
                  name="depositTargetInfo"
                  placeholder="..."
                  value={formData.depositTargetInfo || ""}
                  onChange={handleChange}
                  disabled={formData.type === "withdrawal"}
                />
              </FloatingLabel>
            </Col>
            <Col xs={12} className="mb-3">
              <FloatingLabel
                controlId="methodReqInfo"
                label={t("admin.methods.modal.withdrawalInfoLabel")}
              >
                <Form.Control
                  type="text"
                  name="requiredWithdrawalInfo"
                  placeholder="..."
                  value={formData.requiredWithdrawalInfo || ""}
                  onChange={handleChange}
                  disabled={formData.type === "deposit"}
                />
              </FloatingLabel>
            </Col>
            <Col xs={12}>
              <hr />
            </Col>
            <Col xs={12}>
              <h6 className="mb-3 text-muted">
                {t("admin.methods.modal.limitsHeader")}
              </h6>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodMinDepTND"
                label={t("admin.methods.modal.minDepositTND")}
              >
                <Form.Control
                  type="number"
                  name="minDepositTND"
                  placeholder="0"
                  step="0.01"
                  min="0"
                  value={formData.minDepositTND ?? ""}
                  onChange={handleChange}
                />
              </FloatingLabel>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodMinDepUSD"
                label={t("admin.methods.modal.minDepositUSD")}
              >
                <Form.Control
                  type="number"
                  name="minDepositUSD"
                  placeholder="0"
                  step="0.01"
                  min="0"
                  value={formData.minDepositUSD ?? ""}
                  onChange={handleChange}
                />
              </FloatingLabel>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodMinWdrTND"
                label={t("admin.methods.modal.minWithdrawalTND")}
              >
                <Form.Control
                  type="number"
                  name="minWithdrawalTND"
                  placeholder="0"
                  step="0.01"
                  min="0"
                  value={formData.minWithdrawalTND ?? ""}
                  onChange={handleChange}
                />
              </FloatingLabel>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodMinWdrUSD"
                label={t("admin.methods.modal.minWithdrawalUSD")}
              >
                <Form.Control
                  type="number"
                  name="minWithdrawalUSD"
                  placeholder="0"
                  step="0.01"
                  min="0"
                  value={formData.minWithdrawalUSD ?? ""}
                  onChange={handleChange}
                />
              </FloatingLabel>
            </Col>
            <Col xs={12}>
              <hr />
            </Col>
            <Col xs={12}>
              <h6 className="mb-3 text-muted">
                {t("admin.methods.modal.commissionHeader")}
              </h6>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodDepositCommPercent"
                label={t("admin.methods.modal.depositCommission")}
              >
                <Form.Control
                  type="number"
                  name="depositCommissionPercent"
                  placeholder="0"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.depositCommissionPercent ?? ""}
                  onChange={handleChange}
                  disabled={formData.type === "withdrawal"}
                />
              </FloatingLabel>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodWithdrawalCommPercent"
                label={t("admin.methods.modal.withdrawalCommission")}
              >
                <Form.Control
                  type="number"
                  name="withdrawalCommissionPercent"
                  placeholder="0"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.withdrawalCommissionPercent ?? ""}
                  onChange={handleChange}
                  disabled={formData.type === "deposit"}
                />
              </FloatingLabel>
            </Col>
            <Col xs={12}>
              <hr />
            </Col>
            <Col xs={12}>
              <h6 className="mb-3 text-muted">
                {t("admin.methods.modal.otherSettingsHeader")}
              </h6>
            </Col>
            <Col md={6} className="mb-3">
              <Form.Check
                type="switch"
                id={`methodIsActive-${methodToEdit?._id || "new"}`}
                name="isActive"
                label={t("admin.methods.modal.activeLabel")}
                checked={formData.isActive ?? true}
                onChange={handleChange}
              />
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodNotes"
                label={t("admin.methods.modal.notesLabel")}
              >
                <Form.Control
                  as="textarea"
                  rows={1}
                  name="notes"
                  value={formData.notes || ""}
                  onChange={handleChange}
                />
              </FloatingLabel>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? (
              <Spinner as="span" animation="border" size="sm" />
            ) : methodToEdit ? (
              t("common.saveChanges")
            ) : (
              t("admin.methods.modal.addButton")
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

const AdminPaymentMethods = ({ search }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const allMethods = useSelector(
    (state) => state.paymentMethodReducer?.allMethods ?? []
  );
  const loading = useSelector(
    (state) => state.paymentMethodReducer?.loadingAdmin ?? false
  );
  const error = useSelector(
    (state) => state.paymentMethodReducer?.error ?? null
  );
  const loadingUpdate = useSelector(
    (state) => state.paymentMethodReducer?.loadingUpdate || {}
  );
  const loadingDelete = useSelector(
    (state) => state.paymentMethodReducer?.loadingDelete || {}
  );

  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const currentSearch = search !== undefined ? search : "";

  useEffect(() => {
    dispatch(adminGetAllPaymentMethods());
    return () => {
      dispatch(clearPaymentMethodError());
    };
  }, [dispatch]);

  const handleShowAddModal = useCallback(() => {
    setEditingMethod(null);
    setShowModal(true);
  }, []);

  const handleShowEditModal = useCallback((method) => {
    setEditingMethod(method);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditingMethod(null);
  }, []);

  const filteredMethods = useMemo(() => {
    if (!currentSearch) return allMethods;
    const searchTerm = currentSearch.toLowerCase();
    return allMethods.filter(
      (u) =>
        u.name?.toLowerCase().includes(searchTerm) ||
        u.displayName?.toLowerCase().includes(searchTerm) ||
        u.type?.toLowerCase().includes(searchTerm)
    );
  }, [allMethods, currentSearch]);

  const handleSaveMethod = useCallback(
    async (formData) => {
      if (editingMethod) {
        await dispatch(adminUpdatePaymentMethod(editingMethod._id, formData));
      } else {
        await dispatch(adminAddPaymentMethod(formData));
      }
    },
    [dispatch, editingMethod]
  );

  const handleDeleteMethod = useCallback(
    (methodId) => {
      if (window.confirm(t("admin.methods.deleteConfirm"))) {
        dispatch(adminDeletePaymentMethod(methodId));
      }
    },
    [dispatch, t]
  );

  const handleToggleActive = useCallback(
    (method) => {
      dispatch(
        adminUpdatePaymentMethod(method._id, { isActive: !method.isActive })
      );
    },
    [dispatch]
  );

  return (
    <Container fluid className="py-4 admin-payment-methods-page">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 className="page-title mb-0">
            {t("admin.methods.page.title")}
            <Badge bg="secondary" className="ms-2" pill>
              {filteredMethods.length}
            </Badge>
          </h2>
        </Col>
        <Col xs="auto">
          <Button variant="primary" onClick={handleShowAddModal}>
            <FaPlus className="me-1" /> {t("admin.methods.page.addButton")}
          </Button>
        </Col>
      </Row>

      {loading && (
        <div className="text-center my-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">{t("admin.methods.page.loading")}</p>
        </div>
      )}
      {!loading && error && (
        <Alert
          variant="danger"
          onClose={() => dispatch(clearPaymentMethodError())}
          dismissible
        >
          {t(error.key, {
            ...error.params,
            defaultValue: error.fallback || error,
          })}
        </Alert>
      )}

      {!loading && !error && (
        <Card className="shadow-sm">
          <Card.Body className="p-0">
            <Table
              striped
              hover
              responsive
              className="admin-methods-table mb-0 align-middle"
            >
              <thead className="table-light">
                <tr>
                  <th style={{ width: "60px" }}>
                    {t("admin.methods.table.logo")}
                  </th>
                  <th>{t("admin.methods.table.name")}</th>
                  <th style={{ width: "100px" }}>
                    {t("admin.methods.table.type")}
                  </th>
                  <th>{t("admin.methods.table.depositInfo")}</th>
                  <th>{t("admin.methods.table.commission")}</th>
                  <th>{t("admin.methods.table.minDeposit")}</th>
                  <th style={{ width: "100px" }}>
                    {t("admin.methods.table.status")}
                  </th>
                  <th className="text-center" style={{ width: "150px" }}>
                    {t("admin.methods.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMethods.length > 0 ? (
                  filteredMethods.map((method) => {
                    const isUpdating = loadingUpdate[method._id] ?? false;
                    const isDeleting = loadingDelete[method._id] ?? false;
                    const isProcessing = isUpdating || isDeleting;
                    return (
                      <tr key={method._id}>
                        <td>
                          <Image
                            src={method.logoUrl || noImageUrl}
                            alt={method.name}
                            width={35}
                            height={35}
                            style={{ objectFit: "contain" }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = noImageUrl;
                            }}
                          />
                        </td>
                        <td>
                          {method.displayName}
                          <small className="text-muted d-block">
                            ({method.name})
                          </small>
                        </td>
                        <td>
                          <Badge
                            bg={
                              method.type === "both"
                                ? "primary"
                                : method.type === "deposit"
                                ? "success"
                                : "warning"
                            }
                            className="text-capitalize"
                          >
                            {t(`admin.methods.types.${method.type}`)}
                          </Badge>
                        </td>
                        <td className="small text-muted deposit-info-cell">
                          {method.depositTargetInfo ? (
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip>{method.depositTargetInfo}</Tooltip>
                              }
                            >
                              <span>
                                {method.depositTargetInfo.length > 20
                                  ? method.depositTargetInfo.substring(0, 18) +
                                    "..."
                                  : method.depositTargetInfo}
                              </span>
                            </OverlayTrigger>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          {method.depositCommissionPercent ?? 0}% /{" "}
                          {method.withdrawalCommissionPercent ?? 0}%
                        </td>
                        <td>
                          {method.minDepositTND ?? "-"} /{" "}
                          {method.minDepositUSD ?? "-"}
                        </td>
                        <td>
                          <Badge bg={method.isActive ? "success" : "secondary"}>
                            {method.isActive
                              ? t("common.statuses.active")
                              : t("common.statuses.inactive")}
                          </Badge>
                        </td>
                        <td className="text-center action-cell">
                          <ButtonGroup size="sm">
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip>
                                  {method.isActive
                                    ? t("admin.methods.actions.deactivate")
                                    : t("admin.methods.actions.activate")}
                                </Tooltip>
                              }
                            >
                              <Button
                                variant={
                                  method.isActive
                                    ? "outline-secondary"
                                    : "outline-success"
                                }
                                onClick={() => handleToggleActive(method)}
                                disabled={isProcessing}
                              >
                                {isUpdating ? (
                                  <Spinner size="sm" animation="border" />
                                ) : method.isActive ? (
                                  <FaToggleOn />
                                ) : (
                                  <FaToggleOff />
                                )}
                              </Button>
                            </OverlayTrigger>
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip>
                                  {t("admin.methods.actions.edit")}
                                </Tooltip>
                              }
                            >
                              <Button
                                variant="outline-primary"
                                onClick={() => handleShowEditModal(method)}
                                disabled={isProcessing}
                              >
                                <FaEdit />
                              </Button>
                            </OverlayTrigger>
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip>
                                  {t("admin.methods.actions.delete")}
                                </Tooltip>
                              }
                            >
                              <Button
                                variant="outline-danger"
                                onClick={() => handleDeleteMethod(method._id)}
                                disabled={isProcessing}
                              >
                                {isDeleting ? (
                                  <Spinner size="sm" animation="border" />
                                ) : (
                                  <FaTrashAlt />
                                )}
                              </Button>
                            </OverlayTrigger>
                          </ButtonGroup>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      {t("admin.methods.page.noMethods")}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      <MethodFormModal
        show={showModal}
        onHide={handleCloseModal}
        methodToEdit={editingMethod}
        onSave={handleSaveMethod}
      />
    </Container>
  );
};

export default AdminPaymentMethods;