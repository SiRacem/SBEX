// src/pages/admin/ReviewMediatorApplications.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Container,
  Table,
  Button,
  Spinner,
  Alert,
  Modal,
  Form,
  Badge,
  Pagination,
} from "react-bootstrap";
import {
  FaCheck,
  FaTimes,
  FaEye,
  FaStar,
  FaMoneyBillWave,
} from "react-icons/fa";
import { format as formatDateFns } from "date-fns"; // اسم مميز لتجنب التضارب
import { toast } from "react-toastify";
import {
  adminGetPendingMediatorApplications,
  adminProcessMediatorApplication,
  adminResetProcessMediatorAppStatus,
} from "../../redux/actions/userAction"; // تأكد أن المسار صحيح
import { Link } from "react-router-dom";

const PAGE_LIMIT = 15; // عدد العناصر في كل صفحة

// دالة تنسيق العملة
const formatCurrencyForTable = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  // إذا كانت القيمة الأصلية null، undefined، أو كانت النتيجة NaN بعد التحويل لرقم
  if (amount == null || isNaN(num)) {
    return "N/A"; // أو يمكنك عرض '-' أو تركها فارغة حسب تفضيلك
  }
  // يمكنك إضافة معالجة خاصة للصفر إذا أردت
  // if (num === 0) return "0.00 " + currencyCode; // أو "N/A" إذا كنت لا تريد عرض الصفر

  try {
    return new Intl.NumberFormat("en-US", {
      // أو "fr-TN" أو لغة أخرى
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch (e) {
    console.error("Error formatting currency:", e);
    return `${num.toFixed(2)} ${currencyCode}`; // fallback
  }
};

const ReviewMediatorApplications = () => {
  const dispatch = useDispatch();

  // جلب البيانات من Redux store
  const {
    pendingMediatorApps, // هذا هو الكائن الذي يحتوي على { applications, totalPages, etc. }
    loadingPendingApps,
    errorPendingApps,
    processingApp, // كائن لتتبع تحميل معالجة كل طلب على حدة
    errorProcessApp, // خطأ عام لمعالجة الطلبات
    successProcessApp, // حالة نجاح عامة لمعالجة الطلبات
  } = useSelector((state) => state.userReducer);

  // حالات المكون المحلية
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [userToReject, setUserToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1); // الصفحة الحالية للـ pagination

  // دالة لجلب طلبات الوسطاء المعلقة بناءً على الصفحة
  const fetchApplications = useCallback(
    (page = 1) => {
      console.log(`Fetching pending mediator applications for page: ${page}`);
      dispatch(
        adminGetPendingMediatorApplications({ page, limit: PAGE_LIMIT })
      );
      setCurrentPage(page); // تحديث الصفحة الحالية في حالة المكون
    },
    [dispatch] // الاعتمادية هي dispatch فقط
  );

  // جلب الطلبات عند تحميل المكون لأول مرة
  useEffect(() => {
    fetchApplications(1); // جلب الصفحة الأولى
  }, []); // الاعتمادية فارغة ليعمل مرة واحدة عند تحميل المكون

  // معالجة الموافقة على طلب
  const handleApprove = (userId) => {
    if (processingApp[userId]) return; // منع الضغط المتكرر
    if (
      window.confirm(
        `Are you sure you want to approve user ID: ${userId} as a mediator?`
      )
    ) {
      dispatch(adminProcessMediatorApplication(userId, "approve"));
    }
  };

  // فتح مودال الرفض
  const handleOpenRejectModal = (user) => {
    setUserToReject(user);
    setRejectReason(""); // مسح سبب الرفض السابق
    setShowRejectModal(true);
  };

  // تأكيد الرفض من المودال
  const handleConfirmReject = () => {
    if (!userToReject || !userToReject._id) {
      toast.error("User to reject is not properly selected.");
      return;
    }
    if (!rejectReason.trim()) {
      toast.warn("Please provide a reason for rejection.");
      return;
    }
    if (processingApp[userToReject._id]) return; // منع الضغط المتكرر

    dispatch(
      adminProcessMediatorApplication(
        userToReject._id,
        "reject",
        rejectReason.trim()
      )
    );
    setShowRejectModal(false); // إغلاق المودال بعد الإرسال
  };

  // إعادة تعيين حالات النجاح/الخطأ بعد المعالجة لإزالة الرسائل/التحميل
  useEffect(() => {
    if (successProcessApp || errorProcessApp) {
      // بعد فترة قصيرة لإتاحة الفرصة للمستخدم لرؤية الـ toast
      const timer = setTimeout(() => {
        dispatch(adminResetProcessMediatorAppStatus());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successProcessApp, errorProcessApp, dispatch]);

  // بناء عناصر Pagination
  const paginationItems = [];
  if (pendingMediatorApps && pendingMediatorApps.totalPages > 1) {
    for (let number = 1; number <= pendingMediatorApps.totalPages; number++) {
      paginationItems.push(
        <Pagination.Item
          key={number}
          active={number === currentPage}
          onClick={() => fetchApplications(number)}
          disabled={loadingPendingApps}
        >
          {number}
        </Pagination.Item>
      );
    }
  }

  return (
    <Container fluid className="py-4">
      <h2 className="page-title mb-4">Review Mediator Applications</h2>

      {/* عرض رسالة الخطأ العامة لمعالجة الطلبات */}
      {errorProcessApp && (
        <Alert
          variant="danger"
          onClose={() => dispatch(adminResetProcessMediatorAppStatus())}
          dismissible
        >
          Error processing application:{" "}
          {typeof errorProcessApp === "string"
            ? errorProcessApp
            : JSON.stringify(errorProcessApp)}
        </Alert>
      )}

      {/* عرض حالة التحميل أو الأخطاء أو البيانات */}
      {loadingPendingApps &&
      (!pendingMediatorApps?.applications ||
        pendingMediatorApps.applications.length === 0) ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading applications...</p>
        </div>
      ) : errorPendingApps ? (
        <Alert variant="danger" className="text-center py-4">
          Error loading applications:{" "}
          {typeof errorPendingApps === "string"
            ? errorPendingApps
            : JSON.stringify(errorPendingApps)}
        </Alert>
      ) : !pendingMediatorApps?.applications ||
        pendingMediatorApps.applications.length === 0 ? (
        <Alert variant="info" className="text-center py-4">
          No pending mediator applications to review at the moment.
        </Alert>
      ) : (
        <>
          <div className="table-responsive">
            <Table
              striped
              bordered
              hover
              size="sm"
              className="text-center align-middle"
            >
              <thead className="table-light">
                <tr>
                  <th className="text-center">Applicant</th>
                  <th className="text-center">Email</th>
                  <th className="text-center">Level</th>
                  <th className="text-center">Guarantee Deposit (TND)</th>
                  <th className="text-center">Application Basis</th>
                  <th className="text-center">Applied On</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingMediatorApps.applications.map((app) => {
                  // --- [!!! التعريف الصحيح لـ isProcessingThisApp هنا داخل map !!!] ---
                  const isProcessingThisApp = processingApp[app._id]; 
                  // --------------------------------------------------------------------
                  return (
                    <tr key={app._id}>
                      <td>{app.fullName || "N/A"}</td>
                      <td>{app.email}</td>
                      <td>{app.level != null ? app.level : "N/A"}</td>
                      <td>
                        {app.mediatorApplicationBasis === "Guarantee" &&
                        app.mediatorEscrowGuarantee != null
                          ? formatCurrencyForTable(
                              app.mediatorEscrowGuarantee,
                              "TND"
                            )
                          : "N/A"}
                      </td>
                      <td>
                        {app.mediatorApplicationBasis === "Reputation" && (
                          <Badge bg="info" text="dark" pill>
                            <FaStar className="me-1" /> Reputation
                          </Badge>
                        )}
                        {app.mediatorApplicationBasis === "Guarantee" && (
                          <Badge bg="success" pill>
                            <FaMoneyBillWave className="me-1" /> Guarantee
                          </Badge>
                        )}
                        {(!app.mediatorApplicationBasis ||
                          app.mediatorApplicationBasis === "Unknown") && (
                          <Badge bg="secondary" pill>
                            Unknown
                          </Badge>
                        )}
                      </td>
                      <td className="small text-muted">
                        {/* استخدام تاريخ تقديم الطلب المخصص إذا وجد، ثم createdAt، ثم updatedAt */}
                        {app.mediatorApplicationSubmittedAt ||
                        app.createdAt ||
                        app.updatedAt
                          ? formatDateFns(
                              new Date(
                                app.mediatorApplicationSubmittedAt ||
                                  app.createdAt ||
                                  app.updatedAt
                              ),
                              "dd/MM/yyyy, hh:mm a"
                            )
                          : "N/A"}
                      </td>
                      <td className="text-center">
                        <Button
                          as={Link}
                          to={`/profile/${app._id}`} // افترض أن هذا هو الرابط الصحيح لبروفايل المستخدم
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="outline-info"
                          size="sm"
                          className="me-1 action-button"
                          title="View User Profile"
                          disabled={isProcessingThisApp}
                        >
                          <FaEye />
                        </Button>
                        <Button
                          variant="outline-success"
                          size="sm"
                          className="me-1 action-button"
                          onClick={() => handleApprove(app._id)}
                          disabled={isProcessingThisApp}
                          title="Approve Application"
                        >
                          {isProcessingThisApp ? (
                            <Spinner size="sm" animation="border" />
                          ) : (
                            <FaCheck />
                          )}
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="action-button"
                          onClick={() => handleOpenRejectModal(app)}
                          disabled={isProcessingThisApp}
                          title="Reject Application"
                        >
                          {isProcessingThisApp ? (
                            <Spinner size="sm" animation="border" />
                          ) : (
                            <FaTimes />
                          )}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>

          {/* Pagination */}
          {pendingMediatorApps.totalPages > 1 && (
            <div className="d-flex justify-content-center mt-3">
              <Pagination size="sm">
                <Pagination.Prev
                  onClick={() => fetchApplications(currentPage - 1)}
                  disabled={currentPage === 1 || loadingPendingApps}
                />
                {paginationItems}
                <Pagination.Next
                  onClick={() => fetchApplications(currentPage + 1)}
                  disabled={
                    currentPage === pendingMediatorApps.totalPages ||
                    loadingPendingApps
                  }
                />
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* Reject Reason Modal */}
      <Modal
        show={showRejectModal}
        onHide={() => setShowRejectModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Reject Mediator Application</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Provide reason for rejecting application from: <br />
            <strong>
              {userToReject?.fullName || `User ID: ${userToReject?._id}`}
            </strong>
          </p>
          <Form.Group controlId="rejectReasonTextarea">
            <Form.Label>Rejection Reason (Required)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              required
              isInvalid={!rejectReason.trim() && rejectReason !== ""} // أظهر خطأ إذا كان فارغًا بعد الكتابة
            />
            <Form.Control.Feedback type="invalid">
              Reason is required.
            </Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmReject}
            disabled={!rejectReason.trim() || processingApp[userToReject?._id]}
          >
            {processingApp[userToReject?._id] ? (
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
              />
            ) : (
              "Confirm Rejection"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ReviewMediatorApplications;
