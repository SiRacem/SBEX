// src/pages/admin/AdminTicketsDashboardPage.jsx
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom"; // أضفت Link هنا
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Button,
  Table,
  Badge,
  Pagination,
  Form,
  InputGroup,
} from "react-bootstrap";
import { adminGetAllTicketsAction } from "../../redux/actions/ticketAction";
import {
  FaTicketAlt,
  FaFilter,
  FaSearch,
  FaEye,
  FaUserTie,
  FaUser,
  FaExclamationTriangle,
} from "react-icons/fa"; // تم إضافة FaExclamationTriangle
import moment from "moment";
import { toast } from "react-toastify"; // تم إضافة استيراد toast

// تعريف قوائم الفلاتر (يمكنك وضعها في ملف constants إذا أردت)
const TICKET_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "Open", label: "Open" },
  { value: "PendingSupportReply", label: "Pending Support Reply" },
  { value: "PendingUserInput", label: "Pending User Input" },
  { value: "InProgress", label: "In Progress" },
  { value: "Resolved", label: "Resolved" },
  { value: "Closed", label: "Closed" },
  { value: "OnHold", label: "On Hold" },
];

// --- [تم تعريف TICKET_PRIORITIES هنا] ---
const TICKET_PRIORITIES = [
  // أضف خيار "All Priorities" إذا أردت
  // { value: '', label: 'All Priorities' },
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Urgent", label: "Urgent" },
];
// --- نهاية تعريف TICKET_PRIORITIES ---

const AdminTicketsDashboardPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleViewTicket = (ticketIdentifier) => {
    // افترض أن مسار تفاصيل تذكرة الأدمن هو /dashboard/admin/ticket-view/:ticketId
    // أو أي مسار تقرره
    navigate(`/dashboard/admin/ticket-view/${ticketIdentifier}`);
  };

  const {
    adminTickets,
    loadingAdminTickets,
    errorAdminTickets,
    adminTicketsPagination,
  } = useSelector((state) => state.ticketReducer);
  const { user, isAuth } = useSelector((state) => state.userReducer);

  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const ticketsPerPage = 10;

  useEffect(() => {
    if (
      !isAuth ||
      (user && user.userRole !== "Admin" && user.userRole !== "Support")
    ) {
      toast.error(
        "Access Denied: You do not have permission to view this page."
      );
      navigate("/dashboard");
    } else {
      const params = {
        page: currentPage,
        limit: ticketsPerPage,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: searchTerm || undefined,
        sortBy: "lastReplyAt",
        order: "desc",
      };
      dispatch(adminGetAllTicketsAction(params));
    }
  }, [
    dispatch,
    isAuth,
    user,
    navigate,
    currentPage,
    statusFilter,
    priorityFilter,
    searchTerm,
    ticketsPerPage,
  ]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleFilterChange = (e) => {
    setCurrentPage(1);
    if (e.target.name === "statusFilter") setStatusFilter(e.target.value);
    if (e.target.name === "priorityFilter") setPriorityFilter(e.target.value);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    // الـ useEffect سيعيد جلب البيانات عند تغيير searchTerm
    // أو يمكنك استدعاء dispatch هنا مباشرةً لضمان التحديث الفوري عند الضغط على زر البحث
    const params = {
      page: 1,
      limit: ticketsPerPage,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      search: searchTerm || undefined,
      sortBy: "lastReplyAt",
      order: "desc",
    };
    dispatch(adminGetAllTicketsAction(params));
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case "Open":
        return "primary";
      case "PendingSupportReply":
        return "info";
      case "PendingUserInput":
        return "warning";
      case "InProgress":
        return "secondary";
      case "Resolved":
        return "success";
      case "Closed":
        return "danger";
      case "OnHold":
        return "light";
      default:
        return "dark";
    }
  };
  const getPriorityBadgeVariant = (priority) => {
    switch (priority) {
      case "Low":
        return "success";
      case "Medium":
        return "info";
      case "High":
        return "warning";
      case "Urgent":
        return "danger";
      default:
        return "secondary";
    }
  };

  if (loadingAdminTickets && (!adminTickets || adminTickets.length === 0)) {
    // تعديل الشرط قليلاً
    return (
      <Container className="py-5 text-center">
        <Spinner
          animation="border"
          variant="primary"
          style={{ width: "3rem", height: "3rem" }}
        />
        <p className="mt-3 fs-5">Loading tickets dashboard...</p>
      </Container>
    );
  }

  return (
    <Container fluid className="admin-tickets-dashboard-page py-4">
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="page-title d-flex align-items-center">
            <FaTicketAlt className="me-2" /> Support Tickets Dashboard
          </h2>
        </Col>
      </Row>

      <Card className="mb-4 shadow-sm filter-card">
        <Card.Body>
          <Form onSubmit={handleSearchSubmit}>
            <Row className="g-3 align-items-end">
              <Col md={4} sm={6} className="mb-2 mb-md-0">
                <Form.Group controlId="statusFilterAdmin">
                  <Form.Label className="small fw-semibold">
                    <FaFilter className="me-1" /> Status
                  </Form.Label>
                  <Form.Select
                    name="statusFilter"
                    value={statusFilter}
                    onChange={handleFilterChange}
                  >
                    {TICKET_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4} sm={6} className="mb-2 mb-md-0">
                <Form.Group controlId="priorityFilterAdmin">
                  <Form.Label className="small fw-semibold">
                    <FaExclamationTriangle className="me-1" /> Priority
                  </Form.Label>
                  <Form.Select
                    name="priorityFilter"
                    value={priorityFilter}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Priorities</option>
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Label className="small fw-semibold">
                  <FaSearch className="me-1" /> Search
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder="Search by ID, title, user email..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    aria-label="Search tickets"
                  />
                  <Button variant="outline-primary" type="submit">
                    Search
                  </Button>
                </InputGroup>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {errorAdminTickets && (
        <Alert variant="danger">
          <h4>Error Loading Tickets</h4>
          <p>{errorAdminTickets}</p>
          <Button
            onClick={() => {
              /* استدعاء dispatch لجلب التذاكر مرة أخرى */ dispatch(
                adminGetAllTicketsAction({
                  page: currentPage,
                  limit: ticketsPerPage,
                })
              );
            }}
            variant="outline-danger"
          >
            Retry
          </Button>
        </Alert>
      )}

      {!loadingAdminTickets &&
        adminTickets &&
        adminTickets.length === 0 &&
        !errorAdminTickets && (
          <Card className="text-center shadow-sm mt-4">
            <Card.Body className="p-5">
              <FaTicketAlt size={50} className="text-muted mb-3" />
              <h4>No Tickets Found</h4>
              <p className="text-muted">
                There are no support tickets matching your current filters. Try
                adjusting your search or filters.
              </p>
            </Card.Body>
          </Card>
        )}

      {adminTickets && adminTickets.length > 0 && (
        <Card className="shadow-sm tickets-table-card">
          <Card.Header className="bg-light d-flex justify-content-between align-items-center py-3">
            <h5 className="mb-0">
              All Tickets{" "}
              <Badge bg="secondary" pill>
                {adminTicketsPagination.totalDocs || 0}
              </Badge>
            </h5>
            {/* يمكن إضافة spinner هنا إذا كان loadingAdminTickets هو true ولكن هناك تذاكر معروضة من تحميل سابق */}
            {loadingAdminTickets && (
              <Spinner animation="border" size="sm" variant="primary" />
            )}
          </Card.Header>
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0 tickets-table align-middle">
              <thead className="table-light">
                <tr>
                  <th>ID</th>
                  <th>Title / Created</th>
                  <th>User</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Last Update</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminTickets.map((ticket) => (
                  <tr key={ticket._id}>
                    <td>
                      <small className="text-monospace">
                        {ticket.ticketId}
                      </small>
                    </td>
                    <td>
                      <Link
                        to={`/dashboard/admin/ticket-view/${
                          ticket.ticketId || ticket._id
                        }`}
                        className="ticket-table-title fw-bold text-decoration-none mb-0 d-block"
                      >
                        {ticket.title}
                      </Link>
                      <small className="text-muted">
                        {moment(ticket.createdAt).format("DD MMM YYYY, h:mm A")}
                      </small>
                    </td>
                    <td>
                      {ticket.user ? (
                        <>
                          <FaUser className="me-1 text-muted" size="0.9em" />{" "}
                          {ticket.user.fullName || "N/A"}
                          <small className="d-block text-muted">
                            {ticket.user.email}
                          </small>
                        </>
                      ) : (
                        <Badge bg="light" text="dark" pill>
                          System
                        </Badge>
                      )}
                    </td>
                    <td>
                      <small>{ticket.category}</small>
                    </td>
                    <td>
                      <Badge
                        pill
                        bg={getPriorityBadgeVariant(ticket.priority)}
                        className="fw-normal"
                      >
                        {ticket.priority}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        pill
                        bg={getStatusBadgeVariant(ticket.status)}
                        className="fw-normal"
                      >
                        {ticket.status}
                      </Badge>
                    </td>
                    <td>
                      {ticket.assignedTo ? (
                        <>
                          <FaUserTie className="me-1 text-muted" size="0.9em" />{" "}
                          {ticket.assignedTo.fullName || "Support Staff"}
                        </>
                      ) : (
                        <Badge bg="secondary" pill className="fw-normal">
                          Unassigned
                        </Badge>
                      )}
                    </td>
                    <td>
                      <small>
                        {moment(
                          ticket.lastReplyAt || ticket.updatedAt
                        ).fromNow()}
                      </small>
                    </td>
                    <td className="text-center">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/dashboard/admin/ticket-view/${
                              ticket.ticketId || ticket._id
                            }`
                          )
                        }
                        title="View Ticket Details"
                      >
                        <FaEye />{" "}
                        <span className="d-none d-md-inline">View</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {adminTicketsPagination && adminTicketsPagination.totalPages > 1 && (
        <Row className="mt-4 justify-content-center">
          <Col xs="auto">
            <Pagination>
              <Pagination.First
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1 || loadingAdminTickets}
              />
              <Pagination.Prev
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loadingAdminTickets}
              />
              {/* يمكنك عرض عدد محدود من أرقام الصفحات هنا بدلاً من كلها */}
              {[...Array(adminTicketsPagination.totalPages).keys()].map(
                (page) => (
                  <Pagination.Item
                    key={page + 1}
                    active={page + 1 === currentPage}
                    onClick={() => handlePageChange(page + 1)}
                    disabled={loadingAdminTickets}
                  >
                    {page + 1}
                  </Pagination.Item>
                )
              )}
              <Pagination.Next
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={
                  currentPage === adminTicketsPagination.totalPages ||
                  loadingAdminTickets
                }
              />
              <Pagination.Last
                onClick={() =>
                  handlePageChange(adminTicketsPagination.totalPages)
                }
                disabled={
                  currentPage === adminTicketsPagination.totalPages ||
                  loadingAdminTickets
                }
              />
            </Pagination>
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default AdminTicketsDashboardPage;
