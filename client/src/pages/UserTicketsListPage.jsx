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
import { useTranslation } from "react-i18next";
import { getUserTicketsAction } from "../redux/actions/ticketAction";
import { FaTicketAlt, FaPlusCircle, FaEye } from "react-icons/fa";
import moment from "moment";
import "moment/locale/ar";
import "moment/locale/fr";
import "./tickets.css";

const UserTicketsListPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    userTickets,
    loadingUserTickets,
    errorUserTickets,
    userTicketsPagination,
  } = useSelector((state) => state.ticketReducer);
  const { isAuth } = useSelector((state) => state.userReducer);

  const [currentPage, setCurrentPage] = useState(1);
  const ticketsPerPage = 10;

  useEffect(() => {
    const lang = i18n.language;
    if (lang === "tn") {
      moment.locale("ar");
    } else {
      moment.locale(lang);
    }
  }, [i18n.language]);

  useEffect(() => {
    if (isAuth) {
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

  // دالة الترجمة بقيت كما هي لأنها تعتمد على مفاتيح الترجمة
  const getTranslatedCategory = (categoryFromDB) => {
    if (!categoryFromDB) return "";
    return t(`createTicket.categories.${categoryFromDB}`, {
      defaultValue: categoryFromDB,
    });
  };

  if (loadingUserTickets && (!userTickets || userTickets.length === 0)) {
    return (
      <Container className="py-5 text-center">
        <Spinner
          animation="border"
          variant="primary"
          style={{ width: "3rem", height: "3rem" }}
        />
        <p className="mt-3 fs-5">{t("ticketsListPage.loading")}</p>
      </Container>
    );
  }

  if (errorUserTickets) {
    return (
      <Container className="py-5">
        <Alert variant="danger" className="text-center">
          <h4>{t("ticketsListPage.errorTitle")}</h4>
          <p>
            {typeof errorUserTickets === "object"
              ? t(errorUserTickets.key, {
                  ...errorUserTickets.params,
                  defaultValue: errorUserTickets.fallback,
                })
              : errorUserTickets}
          </p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="user-tickets-list-page py-4 py-lg-5">
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="page-title d-flex align-items-center">
            <FaTicketAlt className="me-2" /> {t("ticketsListPage.pageTitle")}
          </h2>
        </Col>
        <Col xs="auto">
          <Button
            as={Link}
            to="/dashboard/support/create-ticket"
            variant="primary"
          >
            <FaPlusCircle className="me-1" />{" "}
            {t("ticketsListPage.createButton")}
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
                      {t("ticketsListPage.ticketId")} {ticket.ticketId}
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
                      {t(`ticketsListPage.statuses.${ticket.status}`, {
                        defaultValue: ticket.status,
                      })}
                    </Badge>
                  </Col>
                  <Col md={2} sm={6} xs={5} className="text-md-end text-end">
                    <small className="text-muted d-block">
                      {t("ticketsListPage.lastUpdate")}
                    </small>
                    <small className="text-muted">
                      {moment(ticket.lastReplyAt || ticket.updatedAt).format(
                        "ll"
                      )}
                    </small>
                  </Col>
                </Row>
                <div className="mt-2 d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    {t("ticketsListPage.category")}{" "}
                    {getTranslatedCategory(ticket.category)}
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
                    <FaEye className="me-1" /> {t("ticketsListPage.viewButton")}
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
        !loadingUserTickets && (
          <Card className="text-center shadow-sm">
            <Card.Body className="p-5">
              <FaTicketAlt size={50} className="text-muted mb-3" />
              <h4>{t("ticketsListPage.noTicketsTitle")}</h4>
              <p className="text-muted">
                {t("ticketsListPage.noTicketsSubtitle")}
              </p>
              <Button
                as={Link}
                to="/dashboard/support/create-ticket"
                variant="success"
              >
                <FaPlusCircle className="me-1" />{" "}
                {t("ticketsListPage.createFirstButton")}
              </Button>
            </Card.Body>
          </Card>
        )
      )}
    </Container>
  );
};

export default UserTicketsListPage;