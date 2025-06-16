// src/pages/admin/AdminTransactionRequests.jsx

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useContext,
} from "react";
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
import {
  adminGetDeposits,
  adminApproveDeposit,
  adminRejectDeposit,
} from "../../redux/actions/depositAction";
import {
  adminGetWithdrawalRequests,
  adminCompleteWithdrawal,
  adminRejectWithdrawal,
  adminGetWithdrawalDetails,
  adminClearWithdrawalDetails,
} from "../../redux/actions/withdrawalRequestAction";
import DepositRequestDetailsModal from "../../components/admin/DepositRequestDetailsModal";
import RejectReasonModal from "../../components/admin/RejectReasonModal";
import { SocketContext } from "../../App";

const PAGE_LIMIT = 15;
const noImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40px" fill="%23aaaaaa">?</text></svg>';

const TND_TO_USD_RATE = 3.0;
const formatCurrencyLocal = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
    safeCurrencyCode = "TND";
  }
  try {
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};

const AdminTransactionRequests = () => {
  const dispatch = useDispatch();
  const socket = useContext(SocketContext);

  const depositState = useSelector(
    (state) => state.depositRequestReducer || {}
  );
  const withdrawalState = useSelector(
    (state) => state.withdrawalRequestReducer || {}
  );

  const [activeTab, setActiveTab] = useState("pendingDeposits");
  const [currentPage, setCurrentPage] = useState(1);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestType, setRequestType] = useState("deposit");

  const { data, loading, error, actionLoadingMap } = useMemo(() => {
    const isDeposit = activeTab.includes("Deposits");
    if (isDeposit) {
      return {
        data: depositState.adminRequestsData,
        loading: depositState.loadingAdminList,
        error: depositState.errorAdminList,
        actionLoadingMap: {
          ...depositState.loadingApprove,
          ...depositState.loadingReject,
        },
      };
    } else {
      return {
        data: withdrawalState.adminRequestsData,
        loading: withdrawalState.loadingAdminRequests,
        error: withdrawalState.errorAdminRequests,
        actionLoadingMap: withdrawalState.loadingAdminAction || {},
      };
    }
  }, [activeTab, depositState, withdrawalState]);

  const fetchDataForCurrentTab = useCallback(
    (page) => {
      const isPending = activeTab.includes("pending");
      const statusFilter = isPending ? "pending" : "";
      const isDeposit = activeTab.includes("Deposits");

      if (isDeposit) {
        dispatch(
          adminGetDeposits({ page, limit: PAGE_LIMIT, status: statusFilter })
        );
      } else {
        dispatch(
          adminGetWithdrawalRequests({
            page,
            limit: PAGE_LIMIT,
            status: statusFilter,
          })
        );
      }
    },
    [dispatch, activeTab]
  );

  useEffect(() => {
    fetchDataForCurrentTab(currentPage);
  }, [fetchDataForCurrentTab, currentPage]);

  useEffect(() => {
    if (!socket) return;
    const handleNewRequest = (data) => {
      console.log("[Socket] Received new admin transaction request", data);
      const { type, request } = data;
      const isDepositTabActive = activeTab.includes("Deposits");
      const isWithdrawalTabActive = activeTab.includes("Withdrawals");

      if (type === "deposit" && isDepositTabActive) {
        dispatch({
          type: "ADMIN_ADD_DEPOSIT_REQUEST_SOCKET",
          payload: request,
        });
        if (activeTab === "pendingDeposits")
          toast.info(`🔔 New deposit request from ${request.user?.fullName}`);
      } else if (type === "withdrawal" && isWithdrawalTabActive) {
        dispatch({
          type: "ADMIN_ADD_WITHDRAWAL_REQUEST_SOCKET",
          payload: request,
        });
        if (activeTab === "pendingWithdrawals")
          toast.info(
            `🔔 New withdrawal request from ${request.user?.fullName}`
          );
      }
    };
    socket.on("new_admin_transaction_request", handleNewRequest);
    return () => {
      socket.off("new_admin_transaction_request", handleNewRequest);
    };
  }, [socket, dispatch, activeTab]);

  const handleTabSelect = (k) => {
    if (k) {
      setActiveTab(k);
      setCurrentPage(1);
    }
  };

  const handlePageChange = (page) => {
    if (page > 0 && page <= (data.totalPages || 1)) {
      setCurrentPage(page);
    }
  };

  const handleRefresh = () => {
    toast.info("Refreshing list...");
    fetchDataForCurrentTab(currentPage);
  };

  const handleShowDetails = (request, type) => {
    setSelectedRequest(request);
    setRequestType(type);
    if (type === "withdrawal") dispatch(adminGetWithdrawalDetails(request._id));
    setShowDetailsModal(true);
  };

  const handleShowReject = (request, type) => {
    setSelectedRequest(request);
    setRequestType(type);
    setShowRejectModal(true);
  };

  const handleApproveOrComplete = async (request, type) => {
    if (!request || !request._id) return;
    const actionToDispatch =
      type === "deposit"
        ? adminApproveDeposit(request._id)
        : adminCompleteWithdrawal(request._id);
    try {
      await dispatch(actionToDispatch);
      // After success, re-fetch the first page of the current tab
      fetchDataForCurrentTab(1);
    } catch (e) {
      /* Error is handled in action */
    }
  };

  const handleConfirmReject = async (reason) => {
    if (!selectedRequest || !reason.trim()) {
      toast.warn("Rejection reason is required.");
      return;
    }
    const actionToDispatch =
      requestType === "deposit"
        ? adminRejectDeposit(selectedRequest._id, reason)
        : adminRejectWithdrawal(selectedRequest._id, reason);
    try {
      await dispatch(actionToDispatch);
      fetchDataForCurrentTab(1);
    } catch (e) {
      /* Error is handled in action */
    }
    setShowRejectModal(false);
  };

  const renderStatusBadge = (status) => {
    let variant = "secondary",
      icon = <FaInfoCircle />;
    if (!status) status = "unknown";
    switch (status.toLowerCase()) {
      case "completed":
      case "approved":
        variant = "success";
        icon = <FaCheckCircle />;
        break;
      case "pending":
        variant = "warning";
        icon = <FaHourglassHalf />;
        break;
      case "rejected":
      case "failed":
      case "cancelled":
        variant = "danger";
        icon = <FaExclamationTriangle />;
        break;
      default:
        break;
    }
    const displayStatus =
      status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
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
    isLoading,
    icon,
    onClick,
    tooltipText,
    variant = "outline-secondary"
  ) => (
    <OverlayTrigger placement="top" overlay={<Tooltip>{tooltipText}</Tooltip>}>
      <span>
        <Button
          size="sm"
          variant={variant}
          onClick={onClick}
          disabled={isLoading}
          className="mx-1"
        >
          {isLoading ? (
            <Spinner as="span" animation="border" size="sm" />
          ) : (
            icon
          )}
        </Button>
      </span>
    </OverlayTrigger>
  );

  const renderTable = (requests, type) => {
    if (loading)
      return (
        <div className="text-center p-5">
          <Spinner />
        </div>
      );
    if (error)
      return (
        <Alert variant="danger" className="text-center">
          Error: {error}
        </Alert>
      );
    if (!requests || requests.length === 0) {
      return (
        <Alert variant="info" className="text-center">
          No {activeTab.replace(/([A-Z])/g, " $1").toLowerCase()} found.
        </Alert>
      );
    }

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
                if (!req?._id || !req.user) return null;
                const isProcessing = actionLoadingMap[req._id] || false;
                const isPending = req.status?.toLowerCase() === "pending";
                let displayAmount = req.originalAmount ?? req.amount;
                let displayCurrency = req.originalCurrency ?? req.currency;
                let infoToDisplay =
                  req.transactionId ||
                  req.senderInfo ||
                  req.withdrawalInfo ||
                  "-";
                if (typeof infoToDisplay === "object" && infoToDisplay !== null)
                  infoToDisplay = Object.values(infoToDisplay)[0] || "-";

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
                          className="me-2"
                          alt="Avatar"
                        />
                        <span className="text-truncate">
                          {req.user.fullName || req.user.email}
                        </span>
                      </div>
                    </td>
                    <td className="fw-medium align-middle">
                      {formatCurrencyLocal(displayAmount, displayCurrency)}
                    </td>
                    <td className="align-middle">
                      {req.method || req.paymentMethod?.displayName || "N/A"}
                    </td>
                    <td className="align-middle">
                      {renderStatusBadge(req.status)}
                    </td>
                    <td className="small text-muted align-middle">
                      <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>{infoToDisplay}</Tooltip>}
                      >
                        <span
                          className="text-truncate d-inline-block"
                          style={{ maxWidth: "100px" }}
                        >
                          {infoToDisplay}
                        </span>
                      </OverlayTrigger>
                    </td>
                    <td className="text-center align-middle">
                      <ButtonGroup size="sm">
                        {renderActionBtn(
                          false,
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
        {data?.totalPages > 1 && (
          <div className="d-flex justify-content-center mt-3">
            <Pagination size="sm">
              <Pagination.Prev
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              />
              {[...Array(data.totalPages)].map((_, i) => (
                <Pagination.Item
                  key={i + 1}
                  active={i + 1 === currentPage}
                  onClick={() => handlePageChange(i + 1)}
                >
                  {i + 1}
                </Pagination.Item>
              ))}
              <Pagination.Next
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === data.totalPages}
              />
            </Pagination>
          </div>
        )}
      </>
    );
  };

  return (
    <Container fluid className="py-4 admin-requests-page">
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 className="page-title">Transaction Requests</h2>
        </Col>
        <Col xs="auto">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={handleRefresh}
            title="Refresh List"
          >
            <FaSync /> Refresh
          </Button>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onSelect={handleTabSelect}
        id="admin-requests-tabs"
        className="mb-3 nav-tabs-custom"
        fill
      >
        <Tab eventKey="pendingDeposits" title="Pending Deposits">
          {renderTable(data?.requests, "deposit")}
        </Tab>
        <Tab eventKey="allDeposits" title="All Deposits">
          {renderTable(data?.requests, "deposit")}
        </Tab>
        <Tab eventKey="pendingWithdrawals" title="Pending Withdrawals">
          {renderTable(data?.requests, "withdrawal")}
        </Tab>
        <Tab eventKey="allWithdrawals" title="All Withdrawals">
          {renderTable(data?.requests, "withdrawal")}
        </Tab>
      </Tabs>

      <DepositRequestDetailsModal
        show={showDetailsModal}
        onHide={() => {
          setShowDetailsModal(false);
          if (requestType === "withdrawal")
            dispatch(adminClearWithdrawalDetails());
          setSelectedRequest(null);
        }}
        request={
          requestType === "deposit"
            ? selectedRequest
            : withdrawalState.adminRequestDetails
        }
        requestType={requestType}
        loading={
          requestType === "withdrawal" && withdrawalState.loadingAdminDetails
        }
        formatCurrencyFn={formatCurrencyLocal}
        tndToUsdRate={TND_TO_USD_RATE}
      />
      <RejectReasonModal
        show={showRejectModal}
        onHide={() => setShowRejectModal(false)}
        onSubmit={handleConfirmReject}
        requestInfo={
          selectedRequest
            ? `Rejecting ${requestType} from ${selectedRequest.user?.fullName}`
            : "Reject Request"
        }
      />
    </Container>
  );
};

export default AdminTransactionRequests;
