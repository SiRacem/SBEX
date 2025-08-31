// src/components/admin/AdminTicketsDashboardPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
} from "react-icons/fa";
import moment from "moment";
import { toast } from "react-toastify";

const AdminTicketsDashboardPage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Dynamically generate filter options from translation files
  const TICKET_STATUSES = useMemo(
    () => [
      { value: "", label: t("admin.tickets.filters.allStatuses") },
      ...Object.keys(
        t("ticketsListPage.statuses", { returnObjects: true })
      ).map((key) => ({
        value: key,
        label: t(`ticketsListPage.statuses.${key}`),
      })),
    ],
    [t]
  );

  const TICKET_PRIORITIES = useMemo(
    () => [
      { value: "", label: t("admin.tickets.filters.allPriorities") },
      ...Object.keys(t("createTicket.priorities", { returnObjects: true })).map(
        (key) => ({
          value: key,
          label: t(`createTicket.priorities.${key}`),
        })
      ),
    ],
    [t]
  );

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
      toast.error(t("apiErrors.notAuthorizedAdmin"));
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
    t,
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
    // ... (this function remains the same)
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
    // ... (this function remains the same)
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
    return (
      <Container className="py-5 text-center">
        <Spinner
          animation="border"
          variant="primary"
          style={{ width: "3rem", height: "3rem" }}
        />
        <p className="mt-3 fs-5">{t("admin.tickets.page.loading")}</p>
      </Container>
    );
  }

  return (
    <Container fluid className="admin-tickets-dashboard-page py-4">
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="page-title d-flex align-items-center">
            <FaTicketAlt className="me-2" /> {t("admin.tickets.page.title")}
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
                    <FaFilter className="me-1" />{" "}
                    {t("admin.tickets.filters.status")}
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
                    <FaExclamationTriangle className="me-1" />{" "}
                    {t("admin.tickets.filters.priority")}
                  </Form.Label>
                  <Form.Select
                    name="priorityFilter"
                    value={priorityFilter}
                    onChange={handleFilterChange}
                  >
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
                  <FaSearch className="me-1" />{" "}
                  {t("admin.tickets.filters.search")}
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder={t("admin.tickets.filters.searchPlaceholder")}
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                  <Button variant="outline-primary" type="submit">
                    {t("admin.tickets.filters.searchButton")}
                  </Button>
                </InputGroup>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {errorAdminTickets && (
        <Alert variant="danger">
          <h4>{t("admin.tickets.page.errorTitle")}</h4>
          <p>
            {t(errorAdminTickets.key, {
              ...errorAdminTickets.params,
              defaultValue: errorAdminTickets.fallback,
            })}
          </p>
          <Button
            onClick={() =>
              dispatch(
                adminGetAllTicketsAction({
                  page: currentPage,
                  limit: ticketsPerPage,
                })
              )
            }
            variant="outline-danger"
          >
            {t("common.retry")}
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
              <h4>{t("admin.tickets.page.noTicketsTitle")}</h4>
              <p className="text-muted">
                {t("admin.tickets.page.noTicketsSubtitle")}
              </p>
            </Card.Body>
          </Card>
        )}

      {adminTickets && adminTickets.length > 0 && (
        <Card className="shadow-sm tickets-table-card">
          <Card.Header className="bg-light d-flex justify-content-between align-items-center py-3">
            <h5 className="mb-0">
              {t("admin.tickets.table.header")}{" "}
              <Badge bg="secondary" pill>
                {adminTicketsPagination.totalDocs || 0}
              </Badge>
            </h5>
            {loadingAdminTickets && (
              <Spinner animation="border" size="sm" variant="primary" />
            )}
          </Card.Header>
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0 tickets-table align-middle">
              <thead className="table-light">
                <tr>
                  <th>{t("admin.tickets.table.id")}</th>
                  <th>{t("admin.tickets.table.titleCreated")}</th>
                  <th>{t("admin.tickets.table.user")}</th>
                  <th>{t("admin.tickets.table.category")}</th>
                  <th>{t("admin.tickets.table.priority")}</th>
                  <th>{t("admin.tickets.table.status")}</th>
                  <th>{t("admin.tickets.table.assignedTo")}</th>
                  <th>{t("admin.tickets.table.lastUpdate")}</th>
                  <th className="text-center">
                    {t("admin.tickets.table.actions")}
                  </th>
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
                          {t("admin.tickets.table.systemUser")}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <small>
                        {t(`createTicket.categories.${ticket.category}`, {
                          defaultValue: ticket.category,
                        })}
                      </small>
                    </td>
                    <td>
                      <Badge
                        pill
                        bg={getPriorityBadgeVariant(ticket.priority)}
                        className="fw-normal"
                      >
                        {t(`createTicket.priorities.${ticket.priority}`, {
                          defaultValue: ticket.priority,
                        })}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        pill
                        bg={getStatusBadgeVariant(ticket.status)}
                        className="fw-normal"
                      >
                        {t(`ticketsListPage.statuses.${ticket.status}`, {
                          defaultValue: ticket.status,
                        })}
                      </Badge>
                    </td>
                    <td>
                      {ticket.assignedTo ? (
                        <>
                          <FaUserTie className="me-1 text-muted" size="0.9em" />{" "}
                          {ticket.assignedTo.fullName ||
                            t("admin.tickets.table.supportStaff")}
                        </>
                      ) : (
                        <Badge bg="secondary" pill className="fw-normal">
                          {t("admin.tickets.table.unassigned")}
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
                        title={t("admin.tickets.actions.view")}
                      >
                        <FaEye />{" "}
                        <span className="d-none d-md-inline">
                          {t("admin.tickets.actions.viewButton")}
                        </span>
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