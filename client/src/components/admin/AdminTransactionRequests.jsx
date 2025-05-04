// src/pages/admin/AdminTransactionRequests.jsx
// *** النسخة النهائية المفترضة (مطابقة للكود الأخير الذي قدمته، مع التأكيد على التعديلات السابقة) ***

import React, { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Container,
  Row,
  Col,
  Table,
  Badge,
  Button,
  Spinner,
  Alert,
  ButtonGroup,
  Tooltip,
  OverlayTrigger,
  Image,
  Tabs,
  Tab,
  Pagination,
} from "react-bootstrap";
import {
  FaEye,
  FaCheck,
  FaTimes,
  FaSync,
  FaHourglassHalf,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
} from "react-icons/fa";
import { format } from "date-fns";
import { toast } from "react-toastify";

// --- [!] تأكد أن الاستيرادات صحيحة ومطابقة لملف الأكشن ---
import {
  adminGetDeposits,
  adminApproveDeposit,
  adminRejectDeposit,
  clearDepositErrors,
} from "../../redux/actions/depositAction";
import {
  adminGetWithdrawalRequests,
  adminCompleteWithdrawal,
  adminRejectWithdrawal,
  adminClearWithdrawalError,
  adminGetWithdrawalDetails,
  adminClearWithdrawalDetails,
} from "../../redux/actions/withdrawalRequestAction";
// ----------------------------------------------------

import DepositRequestDetailsModal from "../../components/admin/DepositRequestDetailsModal";
import RejectReasonModal from "../../components/admin/RejectReasonModal";

const PAGE_LIMIT = 15; // تأكد أن هذه القيمة متوافقة مع الخادم
const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40px" fill="%23aaaaaa">?</text></svg>';

const AdminTransactionRequests = () => {
  const dispatch = useDispatch();

  // --- Redux state selectors ---
  const depositState = useSelector(
    (state) => state.depositRequestReducer || {}
  );
  const withdrawalState = useSelector(
    (state) => state.withdrawalRequestReducer || {}
  );

  // --- [معدل] الوصول للمصفوفة داخل adminRequestsData ---
  const {
    adminRequestsData: { requests: depositRequests = [] } = {}, // <-- الوصول لـ requests داخل adminRequestsData
    loadingAdminList: loadingDeposits = false,
    errorAdminList: errorDeposits = null,
    adminRequestsData: { totalPages: depositTotalPages = 1 } = {}, // <-- الوصول لـ totalPages
    adminRequestsData: { currentPage: depositCurrentPage = 1 } = {}, // <-- الوصول لـ currentPage
    loadingApprove: loadingDepositApprove = {}, // افترض أنها مسطحة إذا كانت من reducer آخر أو عدلها
    loadingReject: loadingDepositReject = {}, // افترض أنها مسطحة إذا كانت من reducer آخر أو عدلها
    errorAdminAction: errorDepositAction = null,
  } = depositState;
  // --------------------------------------------------

  console.log(
    "Deposit Requests in Component (from adminRequestsData):",
    depositRequests
  ); // <-- تحديث console.log

  const {
    // --- [معدل] الوصول لمصفوفة السحب أيضاً ---
    adminRequestsData: { requests: withdrawalRequests = [] } = {}, // <-- الوصول لـ requests
    loadingAdminList: loadingWithdrawals = false,
    errorAdminList: errorWithdrawals = null,
    adminRequestsData: { totalPages: withdrawalTotalPages = 1 } = {}, // <-- الوصول لـ totalPages
    adminRequestsData: { currentPage: withdrawalCurrentPage = 1 } = {}, // <-- الوصول لـ currentPage
    loadingAdminAction: loadingWithdrawalAction = {},
    errorAdminAction: errorWithdrawalAction = null,
    adminRequestDetails: selectedWithdrawalDetails, // <-- استخدام اسم الحقل الصحيح من Reducer
    loadingAdminDetails: loadingWithdrawalDetails = false,
  } = withdrawalState; // افترض أن withdrawal reducer يستخدم نفس بنية adminRequestsData

  // --- Local component state ---
  const [activeTab, setActiveTab] = useState("pendingDeposits");
  const [currentPageData, setCurrentPageData] = useState({
    page: 1,
    totalPages: 1,
  });
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestType, setRequestType] = useState("deposit");

  // --- Fetch lists ---
  const fetchData = useCallback(
    (page = 1) => {
      // --- [!] فلتر الحالة بأحرف صغيرة ---
      const statusFilter = activeTab.includes("pending") ? "pending" : ""; // <-- استخدام 'pending'
      // ----------------------------------
      console.log(
        `Fetching data for tab: ${activeTab}, page: ${page}, statusFilter: '${statusFilter}'`
      );

      setCurrentPageData((prev) => ({ ...prev, page }));

      if (activeTab.includes("Deposits")) {
        // --- [معدل] إضافة toLowerCase للفلتر ---
        dispatch(
          adminGetDeposits({ page, limit: PAGE_LIMIT, status: statusFilter })
        );
        // -------------------------------------
        dispatch(clearDepositErrors());
      } else if (activeTab.includes("Withdrawals")) {
        // --- [معدل] إضافة toLowerCase للفلتر ---
        dispatch(
          adminGetWithdrawalRequests({
            page,
            limit: PAGE_LIMIT,
            status: statusFilter,
          })
        );
        // -------------------------------------
        dispatch(adminClearWithdrawalError());
      }
    },
    [activeTab, dispatch] // الاعتماديات
  );

  // جلب البيانات عند التحميل أو تغيير التبويب
  useEffect(() => {
    fetchData(1);
  }, [fetchData]); // fetchData يعتمد على activeTab
  useEffect(() => {
    if (activeTab.includes("Deposits")) {
      setCurrentPageData({
        page: depositCurrentPage,
        totalPages: depositTotalPages,
      });
    } else if (activeTab.includes("Withdrawals")) {
      setCurrentPageData({
        page: withdrawalCurrentPage,
        totalPages: withdrawalTotalPages,
      });
    }
  }, [
    depositCurrentPage,
    depositTotalPages,
    withdrawalCurrentPage,
    withdrawalTotalPages,
    activeTab,
  ]);

  // --- Handlers (تبقى كما هي من النسخة السابقة) ---
  const handleShowDetails = (request, type) => {
    if (!request || !request._id) {
      toast.error("Invalid request data.");
      return;
    }
    console.log(`Showing details for ${type} request:`, request);
    setSelectedRequest(request);
    setRequestType(type);
    if (type === "withdrawal") {
      dispatch(adminGetWithdrawalDetails(request._id));
    }
    setShowDetailsModal(true);
  };

  const handleShowReject = (request, type) => {
    if (!request || !request._id) return;
    setSelectedRequest(request);
    setRequestType(type);
    setShowRejectModal(true);
  };

  const handleConfirmReject = (reason) => {
    if (!selectedRequest || !reason || reason.trim() === "") {
      toast.warn("Rejection reason is required.");
      return;
    }
    if (requestType === "deposit") {
      dispatch(adminRejectDeposit(selectedRequest._id, reason));
    } else {
      dispatch(adminRejectWithdrawal(selectedRequest._id, reason));
    }
    setShowRejectModal(false);
    setSelectedRequest(null);
  };

  const handleApproveOrComplete = (request, type) => {
    if (!request || !request._id) return;
    const userFullName = request.user?.fullName || "user";
    const amountStr = `${request.amount?.toFixed(2)} ${request.currency}`;
    if (type === "deposit") {
      if (
        window.confirm(`Approve deposit of ${amountStr} for ${userFullName}?`)
      ) {
        dispatch(adminApproveDeposit(request._id));
      }
    } else {
      if (
        window.confirm(
          `Complete withdrawal of ${amountStr} for ${userFullName}?`
        )
      ) {
        dispatch(adminCompleteWithdrawal(request._id));
      }
    }
  };

  // --- Render Helpers (تبقى كما هي من النسخة السابقة) ---
  const renderStatusBadge = (status) => {
    let variant = "secondary";
    let icon = <FaInfoCircle />;
    const lowerStatus = status?.toLowerCase();
    if (lowerStatus === "completed" || lowerStatus === "approved") {
      variant = "success";
      icon = <FaCheckCircle />;
    } else if (lowerStatus === "pending") {
      variant = "warning";
      icon = <FaHourglassHalf />;
    } else if (
      lowerStatus === "rejected" ||
      lowerStatus === "failed" ||
      lowerStatus === "cancelled"
    ) {
      variant = "danger";
      icon = <FaExclamationTriangle />;
    }
    const displayStatus = status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : "Unknown";
    return (
      <Badge
        pill
        bg={variant}
        className="d-inline-flex align-items-center status-badge"
      >
        {React.cloneElement(icon, { className: "me-1" })} {displayStatus}
      </Badge>
    );
  };

  const renderActionBtn = (
    loading,
    icon,
    onClick,
    tooltipText,
    variant = "outline-secondary",
    disabled = false
  ) => (
    <OverlayTrigger placement="top" overlay={<Tooltip>{tooltipText}</Tooltip>}>
      <span className="d-inline-block">
        <Button
          size="sm"
          variant={variant}
          onClick={onClick}
          disabled={loading || disabled}
          className="mx-1 action-button"
          style={loading || disabled ? { pointerEvents: "none" } : {}}
        >
          {loading ? <Spinner as="span" animation="border" size="sm" /> : icon}
        </Button>
      </span>
    </OverlayTrigger>
  );

  // --- [!] تعديل بسيط في renderTable للتحقق من loadingMap ---
  const renderTable = (requests = [], type) => {
    const loadingList =
      type === "deposit" ? loadingDeposits : loadingWithdrawals;
    const errorList = type === "deposit" ? errorDeposits : errorWithdrawals;

    const isLoadingMap = (reqId) => {
      if (type === "deposit") {
        // التحقق إذا كانت حالات التحميل كائنات
        const approveLoading =
          typeof loadingDepositApprove === "object"
            ? loadingDepositApprove[reqId]
            : loadingDepositApprove;
        const rejectLoading =
          typeof loadingDepositReject === "object"
            ? loadingDepositReject[reqId]
            : loadingDepositReject;
        return approveLoading || rejectLoading;
      } else {
        // افترض أن loadingWithdrawalAction هو كائن { requestId: boolean }
        return typeof loadingWithdrawalAction === "object"
          ? loadingWithdrawalAction[reqId]
          : loadingWithdrawalAction;
      }
    };

    const { page, totalPages } = currentPageData;

    if (loadingList)
      return (
        <div className="text-center p-5">
          <Spinner />
          <p className="mt-2 text-muted">Loading...</p>
        </div>
      );
    if (errorList)
      return (
        <Alert variant="danger" className="text-center">
          Error: {errorList}
        </Alert>
      );
    // --- [!] تعديل رسالة عدم وجود طلبات ---
    if (!requests || requests.length === 0) {
      // استخدم statusFilter للتحقق إذا كان الفلتر مفعلاً
      const statusFilter = activeTab.includes("pending") ? "pending" : "";
      const message =
        statusFilter === "pending"
          ? `No pending ${type} requests found.`
          : `No ${type} requests found for this filter.`;
      return (
        <Alert variant="info" className="text-center">
          {message}
        </Alert>
      );
    }
    // -------------------------------------

    return (
      <>
        <div className="table-responsive">
          <Table
            striped
            bordered
            hover
            responsive="sm"
            size="sm"
            className="admin-requests-table"
          >
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Info (ID/Ref)</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                if (!req?._id || !req.user) {
                  console.warn("Skipping render:", req);
                  return null;
                }
                const isProcessing = isLoadingMap(req._id);
                const isPending = req.status?.toLowerCase() === "pending";
                return (
                  <tr
                    key={req._id}
                    className={isProcessing ? "processing-row" : ""}
                  >
                    <td className="small text-muted align-middle">
                      {req.createdAt
                        ? format(new Date(req.createdAt), "Pp")
                        : "N/A"}
                    </td>
                    <td className="align-middle">
                      <div className="d-flex align-items-center">
                        <Image
                          src={req.user.avatarUrl || noImageUrl}
                          roundedCircle
                          width={25}
                          height={25}
                          className="me-2 flex-shrink-0"
                          alt="Avatar"
                        />
                        <span className="text-truncate">
                          {req.user.fullName || req.user.email || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="fw-medium align-middle">
                      {req.amount != null ? req.amount.toFixed(2) : "N/A"}{" "}
                      <span className="text-muted">{req.currency || ""}</span>
                    </td>
                    <td className="align-middle">
                      {req.method ||
                        req.paymentMethod?.displayName ||
                        req.paymentMethod?.name ||
                        "N/A"}
                    </td>
                    <td className="align-middle">
                      {renderStatusBadge(req.status)}
                    </td>
                    <td className="small text-muted align-middle">
                      <OverlayTrigger
                        placement="top"
                        overlay={
                          <Tooltip>
                            {req.transactionId || req.senderInfo || "-"}
                          </Tooltip>
                        }
                      >
                        <span
                          className="text-truncate d-inline-block"
                          style={{ maxWidth: "100px" }}
                        >
                          {req.transactionId || req.senderInfo || "-"}
                        </span>
                      </OverlayTrigger>
                    </td>
                    <td className="text-center align-middle action-cell">
                      <ButtonGroup size="sm">
                        {renderActionBtn(
                          loadingWithdrawalDetails &&
                            selectedRequest?._id === req._id &&
                            requestType === "withdrawal",
                          <FaEye />,
                          () => handleShowDetails(req, type),
                          "View Details"
                        )}
                        {isPending &&
                          renderActionBtn(
                            isProcessing,
                            <FaCheck />,
                            () => handleApproveOrComplete(req, type),
                            type === "deposit" ? "Approve" : "Complete",
                            "outline-success"
                          )}
                        {isPending &&
                          renderActionBtn(
                            isProcessing,
                            <FaTimes />,
                            () => handleShowReject(req, type),
                            "Reject",
                            "outline-danger"
                          )}
                      </ButtonGroup>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="d-flex justify-content-center mt-3">
            <Pagination size="sm">
              <Pagination.Prev
                onClick={() => fetchData(page - 1)}
                disabled={page === 1}
              />
              {[...Array(totalPages)].map((_, i) => (
                <Pagination.Item
                  key={i + 1}
                  active={i + 1 === page}
                  onClick={() => fetchData(i + 1)}
                >
                  {i + 1}
                </Pagination.Item>
              ))}
              <Pagination.Next
                onClick={() => fetchData(page + 1)}
                disabled={page === totalPages}
              />
            </Pagination>
          </div>
        )}
      </>
    );
  };
  // ----------------------------------------------------------

  // --- JSX الرئيسي للمكون ---
  return (
    <Container fluid className="py-4 admin-requests-page">
      <Row className="mb-3 align-items-center">
        {" "}
        <Col>
          <h2 className="page-title">Transaction Requests</h2>
        </Col>{" "}
        <Col xs="auto">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => fetchData(currentPageData.page)}
            title="Refresh List"
          >
            <FaSync /> Refresh
          </Button>
        </Col>{" "}
      </Row>
      {errorDepositAction && (
        <Alert variant="danger">Error: {errorDepositAction}</Alert>
      )}
      {errorWithdrawalAction && (
        <Alert variant="danger">Error: {errorWithdrawalAction}</Alert>
      )}

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k || "pendingDeposits")}
        id="admin-requests-tabs"
        className="mb-3 nav-tabs-custom"
        fill
      >
        {/* --- [معدل] تمرير المصفوفات الصحيحة لـ renderTable --- */}
        <Tab eventKey="pendingDeposits" title="Pending Deposits">
          {renderTable(depositRequests, "deposit")}
        </Tab>
        <Tab eventKey="allDeposits" title="All Deposits">
          {renderTable(depositRequests, "deposit")}
        </Tab>
        <Tab eventKey="pendingWithdrawals" title="Pending Withdrawals">
          {renderTable(withdrawalRequests, "withdrawal")}
        </Tab>
        <Tab eventKey="allWithdrawals" title="All Withdrawals">
          {renderTable(withdrawalRequests, "withdrawal")}
        </Tab>
        {/* ------------------------------------------------- */}
      </Tabs>

      <DepositRequestDetailsModal
        show={showDetailsModal}
        onHide={() => {
          setShowDetailsModal(false);
          if (requestType === "withdrawal") {
            dispatch(adminClearWithdrawalDetails());
          }
          setSelectedRequest(null);
        }}
        request={
          requestType === "deposit"
            ? selectedRequest
            : selectedWithdrawalDetails
        } // <-- مرر تفاصيل السحب من Redux
        requestType={requestType}
        loading={requestType === "withdrawal" && loadingWithdrawalDetails}
      />

      <RejectReasonModal
        show={showRejectModal}
        onHide={() => setShowRejectModal(false)}
        onSubmit={handleConfirmReject}
        requestInfo={
          selectedRequest
            ? `Rejecting ${requestType} (#${selectedRequest?._id?.slice(
                -6
              )}) from ${
                selectedRequest.user?.fullName || "user"
              } for ${selectedRequest.amount?.toFixed(2)} ${
                selectedRequest.currency
              }`
            : "Reject Request"
        }
      />
    </Container>
  );
};

export default AdminTransactionRequests;
