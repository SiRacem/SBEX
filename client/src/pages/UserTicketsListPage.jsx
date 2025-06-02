// src/pages/UserTicketsListPage.jsx
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Button,
  ListGroup,
  Badge,
  Pagination,
} from "react-bootstrap";
import { getUserTicketsAction } from "../redux/actions/ticketAction"; // تأكد من المسار الصحيح
import { FaTicketAlt, FaPlusCircle, FaEye } from "react-icons/fa";
import moment from "moment";
import "./tickets.css"; // ملف CSS مخصص لتنسيق الصفحة

const UserTicketsListPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    userTickets,
    loadingUserTickets,
    errorUserTickets,
    userTicketsPagination,
  } = useSelector((state) => state.ticketReducer);
  const { user, isAuth } = useSelector((state) => state.userReducer);

  // حالة للصفحة الحالية (للت分页)
  const [currentPage, setCurrentPage] = useState(1);
  const ticketsPerPage = 10; // يمكنك جعل هذا قابل للتعديل

  useEffect(() => {
    if (!isAuth) {
      navigate("/login");
    } else {
      // جلب التذاكر للصفحة الحالية
      dispatch(
        getUserTicketsAction({
          page: currentPage,
          limit: ticketsPerPage,
          sortBy: "lastReplyAt",
          order: "desc",
        })
      );
    }
  }, [dispatch, isAuth, navigate, currentPage, ticketsPerPage]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const getStatusBadgeVariant = (status) => {
    // ... (نفس دالة getStatusBadgeVariant من TicketDetailsPage)
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

  if (loadingUserTickets && userTickets.length === 0) {
    // عرض التحميل فقط إذا لم تكن هناك تذاكر معروضة بالفعل
    return (
      <Container className="py-5 text-center">
        <Spinner
          animation="border"
          variant="primary"
          style={{ width: "3rem", height: "3rem" }}
        />
        <p className="mt-3 fs-5">Loading your tickets...</p>
      </Container>
    );
  }

  if (errorUserTickets) {
    return (
      <Container className="py-5">
        <Alert variant="danger" className="text-center">
          <h4>Error Loading Tickets</h4>
          <p>{errorUserTickets}</p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="user-tickets-list-page py-4 py-lg-5">
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="page-title d-flex align-items-center">
            <FaTicketAlt className="me-2" /> My Support Tickets
          </h2>
        </Col>
        <Col xs="auto">
          <Button
            as={Link}
            to="/dashboard/support/create-ticket"
            variant="primary"
          >
            <FaPlusCircle className="me-1" /> Create New Ticket
          </Button>
        </Col>
      </Row>

      {userTickets && userTickets.length > 0 ? (
        <>
          <ListGroup variant="flush" className="ticket-list-group">
            {userTickets.map((ticket) => (
              <ListGroup.Item
                key={ticket._id}
                action
                onClick={() =>
                  navigate(
                    `/dashboard/support/tickets/${
                      ticket.ticketId || ticket._id
                    }`
                  )
                }
                className="mb-3 p-3 shadow-sm rounded ticket-list-item"
                style={{ cursor: "pointer" }}
              >
                <Row className="align-items-center">
                  <Col md={7} className="mb-2 mb-md-0">
                    <h5 className="mb-1 ticket-item-title">{ticket.title}</h5>
                    <small className="text-muted">
                      Ticket ID: {ticket.ticketId}
                    </small>
                  </Col>
                  <Col
                    md={3}
                    sm={6}
                    xs={7}
                    className="text-md-center mb-2 mb-md-0"
                  >
                    <Badge
                      pill
                      bg={getStatusBadgeVariant(ticket.status)}
                      className="px-2 py-1 ticket-status-badge"
                    >
                      {ticket.status}
                    </Badge>
                  </Col>
                  <Col md={2} sm={6} xs={5} className="text-md-end text-end">
                    <small className="text-muted d-block">Last Update:</small>
                    <small className="text-muted">
                      {moment(ticket.lastReplyAt || ticket.updatedAt).format(
                        "MMM DD, YYYY"
                      )}
                    </small>
                  </Col>
                </Row>
                <div className="mt-2 d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    Category: {ticket.category}
                  </small>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(
                        `/dashboard/support/tickets/${
                          ticket.ticketId || ticket._id
                        }`
                      );
                    }}
                  >
                    <FaEye className="me-1" /> View
                  </Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>

          {userTicketsPagination && userTicketsPagination.totalPages > 1 && (
            <Row className="mt-4 justify-content-center">
              <Col xs="auto">
                <Pagination>
                  <Pagination.First
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1 || loadingUserTickets}
                  />
                  <Pagination.Prev
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loadingUserTickets}
                  />
                  {[...Array(userTicketsPagination.totalPages).keys()].map(
                    (page) => (
                      <Pagination.Item
                        key={page + 1}
                        active={page + 1 === currentPage}
                        onClick={() => handlePageChange(page + 1)}
                        disabled={loadingUserTickets}
                      >
                        {page + 1}
                      </Pagination.Item>
                    )
                  )}
                  <Pagination.Next
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={
                      currentPage === userTicketsPagination.totalPages ||
                      loadingUserTickets
                    }
                  />
                  <Pagination.Last
                    onClick={() =>
                      handlePageChange(userTicketsPagination.totalPages)
                    }
                    disabled={
                      currentPage === userTicketsPagination.totalPages ||
                      loadingUserTickets
                    }
                  />
                </Pagination>
              </Col>
            </Row>
          )}
        </>
      ) : (
        !loadingUserTickets && ( // عرض هذه الرسالة فقط إذا انتهى التحميل ولم تكن هناك تذاكر
          <Card className="text-center shadow-sm">
            <Card.Body className="p-5">
              <FaTicketAlt size={50} className="text-muted mb-3" />
              <h4>No Support Tickets Found</h4>
              <p className="text-muted">
                You haven't created any support tickets yet.
              </p>
              <Button
                as={Link}
                to="/dashboard/support/create-ticket"
                variant="success"
              >
                <FaPlusCircle className="me-1" /> Create Your First Ticket
              </Button>
            </Card.Body>
          </Card>
        )
      )}
    </Container>
  );
};

export default UserTicketsListPage;
