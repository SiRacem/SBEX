// src/pages/admin/AdminPaymentMethods.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
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
} from "../../redux/actions/paymentMethodAction"; // تأكد من المسار الصحيح
import "./AdminPaymentMethods.css";

const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14px" fill="%23aaaaaa">?</text></svg>';

// --- مكون مودال الإضافة/التعديل (معدل) ---
const MethodFormModal = ({ show, onHide, methodToEdit, onSave }) => {
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
      // --- [معدل] استخدام الحقول الجديدة ---
      depositCommissionPercent:
        method?.depositCommissionPercent != null
          ? String(method.depositCommissionPercent)
          : "0",
      withdrawalCommissionPercent:
        method?.withdrawalCommissionPercent != null
          ? String(method.withdrawalCommissionPercent)
          : "0",
      // --- تمت إزالة الحقول القديمة للعمولة ---
      requiredWithdrawalInfo: method?.requiredWithdrawalInfo || "",
      isActive: method?.isActive !== undefined ? method.isActive : true,
      notes: method?.notes || "",
    });

    if (methodToEdit) {
      console.log("MethodFormModal: Editing method data:", methodToEdit);
      setFormData(initializeForm(methodToEdit));
    } else {
      console.log("MethodFormModal: Adding new method, setting defaults.");
      setFormData(initializeForm(null));
    }
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
      toast.warn("Please fill all required fields correctly.");
      return;
    }
    setIsSaving(true);

    const dataToSave = {
      // الحقول النصية والمنطقية
      name: formData.name,
      type: formData.type,
      displayName: formData.displayName || formData.name,
      description: formData.description || null,
      logoUrl: formData.logoUrl || null,
      depositTargetInfo: formData.depositTargetInfo || null,
      requiredWithdrawalInfo: formData.requiredWithdrawalInfo || null,
      isActive: formData.isActive,
      notes: formData.notes || null,

      // الحقول الرقمية
      minDepositTND: parseFloat(formData.minDepositTND || "0"),
      minDepositUSD: parseFloat(formData.minDepositUSD || "0"),
      minWithdrawalTND: parseFloat(formData.minWithdrawalTND || "0"),
      minWithdrawalUSD: parseFloat(formData.minWithdrawalUSD || "0"),
      // --- [معدل] استخدام الحقول الجديدة ---
      depositCommissionPercent: parseFloat(
        formData.depositCommissionPercent || "0"
      ),
      withdrawalCommissionPercent: parseFloat(
        formData.withdrawalCommissionPercent || "0"
      ),
      // --- تمت إزالة الحقول القديمة للعمولة ---
    };

    // التأكد من أن القيم الرقمية ليست NaN
    Object.keys(dataToSave).forEach((key) => {
      if (typeof dataToSave[key] === "number" && isNaN(dataToSave[key])) {
        dataToSave[key] = 0; // تعيين قيمة افتراضية إذا كانت NaN
      }
    });

    try {
      console.log("ADMIN SAVE - Data being sent:", dataToSave);
      await onSave(dataToSave);
      onHide();
    } catch (err) {
      console.error("Save failed:", err);
      // Toast للخطأ يتم عرضه من الأكشن غالبًا
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          {methodToEdit
            ? `Edit: ${formData.displayName || formData.name}`
            : "Add New Payment Method"}
        </Modal.Title>
      </Modal.Header>
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Modal.Body>
          <Row>
            {/* ... (حقول الاسم، الاسم المعروض، النوع، الشعار، الوصف، معلومات الإيداع، معلومات السحب المطلوبة) ... تبقى كما هي */}
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodName"
                label="Method Name (Internal, Unique)"
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
                  Name is required and must be unique.
                </Form.Control.Feedback>
              </FloatingLabel>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodDisplayName"
                label="Display Name (for Users)"
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
                  Display name is required.
                </Form.Control.Feedback>
              </FloatingLabel>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel controlId="methodType" label="Method Type">
                <Form.Select
                  name="type"
                  value={formData.type || "both"}
                  onChange={handleChange}
                  required
                  disabled={!!methodToEdit}
                >
                  <option value="both">Deposit & Withdrawal</option>
                  <option value="deposit">Deposit Only</option>
                  <option value="withdrawal">Withdrawal Only</option>
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  Type is required.
                </Form.Control.Feedback>
              </FloatingLabel>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodLogoUrl"
                label="Logo URL (Optional)"
              >
                <Form.Control
                  type="url"
                  name="logoUrl"
                  placeholder="https://..."
                  value={formData.logoUrl || ""}
                  onChange={handleChange}
                />
                <Form.Control.Feedback type="invalid">
                  Please enter a valid URL.
                </Form.Control.Feedback>
              </FloatingLabel>
            </Col>
            <Col xs={12} className="mb-3">
              <FloatingLabel
                controlId="methodDescription"
                label="Description / Instructions (Optional)"
              >
                <Form.Control
                  as="textarea"
                  rows={2}
                  name="description"
                  placeholder="Short description for user..."
                  value={formData.description || ""}
                  onChange={handleChange}
                />
              </FloatingLabel>
            </Col>
            <Col xs={12} className="mb-3">
              <FloatingLabel
                controlId="methodDepositTarget"
                label="Deposit Target Info (ID, Address, Number - for Copy Button)"
              >
                <Form.Control
                  type="text"
                  name="depositTargetInfo"
                  placeholder="e.g., P1234567, 0xABC..., YOUR_PAY_ID"
                  value={formData.depositTargetInfo || ""}
                  onChange={handleChange}
                  disabled={formData.type === "withdrawal"}
                />
              </FloatingLabel>
            </Col>
            <Col xs={12} className="mb-3">
              <FloatingLabel
                controlId="methodReqInfo"
                label="Required Info for Withdrawal (if applicable)"
              >
                <Form.Control
                  type="text"
                  name="requiredWithdrawalInfo"
                  placeholder="e.g., Your D17 Phone Number"
                  value={formData.requiredWithdrawalInfo || ""}
                  onChange={handleChange}
                  disabled={formData.type === "deposit"}
                />
              </FloatingLabel>
            </Col>

            {/* --- Limits (TND & USD) --- */}
            <Col xs={12}>
              <hr />
            </Col>
            <Col xs={12}>
              <h6 className="mb-3 text-muted">Minimum Limits</h6>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodMinDepTND"
                label="Min Deposit (TND)"
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
                label="Min Deposit (USD)"
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
                label="Min Withdrawal (TND)"
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
                label="Min Withdrawal (USD)"
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

            {/* --- [معدل] Commission Percentages --- */}
            <Col xs={12}>
              <hr />
            </Col>
            <Col xs={12}>
              <h6 className="mb-3 text-muted">Commission Percentages</h6>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodDepositCommPercent"
                label="Deposit Commission %"
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
                  disabled={formData.type === "withdrawal"} // لا معنى لها لطرق السحب فقط
                />
              </FloatingLabel>
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodWithdrawalCommPercent"
                label="Withdrawal Commission %"
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
                  disabled={formData.type === "deposit"} // لا معنى لها لطرق الإيداع فقط
                />
              </FloatingLabel>
            </Col>
            {/* --- تمت إزالة حقول الرسوم الأخرى --- */}

            {/* --- Other Settings --- */}
            <Col xs={12}>
              <hr />
            </Col>
            <Col xs={12}>
              <h6 className="mb-3 text-muted">Other Settings</h6>
            </Col>
            <Col md={6} className="mb-3">
              <Form.Check
                type="switch"
                id={`methodIsActive-${methodToEdit?._id || "new"}`}
                name="isActive"
                label="Active for Users"
                checked={formData.isActive ?? true}
                onChange={handleChange}
              />
            </Col>
            <Col md={6} className="mb-3">
              <FloatingLabel
                controlId="methodNotes"
                label="Admin Notes (Internal)"
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
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? (
              <Spinner as="span" animation="border" size="sm" />
            ) : methodToEdit ? (
              "Save Changes"
            ) : (
              "Add Method"
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

// --- المكون الرئيسي للصفحة (معدل في عرض الجدول) ---
const AdminPaymentMethods = () => {
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

  const handleSaveMethod = useCallback(
    async (formData) => {
      if (editingMethod) {
        await dispatch(adminUpdatePaymentMethod(editingMethod._id, formData));
      } else {
        await dispatch(adminAddPaymentMethod(formData));
      }
      // الإغلاق يتم الآن داخل handleSubmit في المودال عند النجاح
    },
    [dispatch, editingMethod]
  );

  const handleDeleteMethod = useCallback(
    (methodId) => {
      dispatch(adminDeletePaymentMethod(methodId)); // التأكيد مدمج في الأكشن
    },
    [dispatch]
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
          {" "}
          <h2 className="page-title mb-0">Manage Payment Methods</h2>{" "}
        </Col>
        <Col xs="auto">
          {" "}
          <Button variant="primary" onClick={handleShowAddModal}>
            <FaPlus className="me-1" /> Add New Method
          </Button>{" "}
        </Col>
      </Row>

      {loading && (
        <div className="text-center my-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading methods...</p>
        </div>
      )}
      {!loading && error && (
        <Alert
          variant="danger"
          onClose={() => dispatch(clearPaymentMethodError())}
          dismissible
        >
          {error}
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
                  <th style={{ width: "60px" }}>Logo</th>
                  <th>Display Name (Internal)</th>
                  <th style={{ width: "100px" }}>Type</th>
                  <th>Deposit Info</th>
                  {/* --- [معدل] عمود العمولة --- */}
                  <th>Commission (Dep% / Wdr%)</th>
                  <th>Min Deposit (TND/USD)</th>
                  <th style={{ width: "100px" }}>Status</th>
                  <th className="text-center" style={{ width: "150px" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {allMethods.length > 0 ? (
                  allMethods.map((method) => {
                    const isUpdating = loadingUpdate[method._id] ?? false;
                    const isDeleting = loadingDelete[method._id] ?? false;
                    const isProcessing = isUpdating || isDeleting;
                    return (
                      <tr key={method._id}>
                        <td>
                          {" "}
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
                          />{" "}
                        </td>
                        <td>
                          {method.displayName}{" "}
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
                            {method.type}
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
                        {/* --- [معدل] عرض العمولات المنفصلة --- */}
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
                            {method.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="text-center action-cell">
                          <ButtonGroup size="sm">
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip>
                                  {method.isActive ? "Deactivate" : "Activate"}
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
                              overlay={<Tooltip>Edit Method</Tooltip>}
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
                              overlay={<Tooltip>Delete Method</Tooltip>}
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
                      No payment methods configured yet. Click 'Add New Method'
                      to start.
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
