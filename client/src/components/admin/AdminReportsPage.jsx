// src/components/admin/AdminReportsPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Card,
  Table,
  Pagination,
  Button,
  Spinner,
  Alert,
  Form,
  Badge,
  Modal,
  Image,
  Row,
  Col,
} from "react-bootstrap";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { toast } from "react-toastify";
import {
  FaEye,
  FaFilter,
  FaSortAmountDown,
  FaSortAmountUp,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import "./AdminReportsPage.css";

const getTokenConfig = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
};

const AdminReportsPage = () => {
  const { t } = useTranslation();

  const statusDisplayMap = {
    PENDING_REVIEW: {
      text: t("admin.reports.statuses.pending"),
      variant: "warning",
    },
    UNDER_INVESTIGATION: {
      text: t("admin.reports.statuses.investigation"),
      variant: "info",
    },
    ACTION_TAKEN: {
      text: t("admin.reports.statuses.actionTaken"),
      variant: "success",
    },
    DISMISSED: {
      text: t("admin.reports.statuses.dismissed"),
      variant: "secondary",
    },
  };

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalReports, setTotalReports] = useState(0);
  const itemsPerPage = 10;

  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  const [editStatus, setEditStatus] = useState("");
  const [editAdminNotes, setEditAdminNotes] = useState("");
  const [editResolutionDetails, setEditResolutionDetails] = useState("");

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    const config = getTokenConfig();
    if (!config) {
      setError(t("apiErrors.notAuthorized"));
      setLoading(false);
      return;
    }

    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        status: filterStatus || undefined,
        sortBy: sortBy,
        sortOrder: sortOrder,
      };
      const { data } = await axios.get("/reports/admin/all", {
        ...config,
        params,
      });

      setReports(data.reports || []);
      setTotalPages(data.totalPages || 0);
      setTotalReports(data.totalReports || 0);
      setCurrentPage(data.currentPage || 1);
    } catch (err) {
      const errMsg =
        err.response?.data?.msg || t("admin.reports.errors.fetchFailed");
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus, sortBy, sortOrder, t]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleSort = (field) => {
    const newSortOrder =
      sortBy === field && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(field);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
  };

  const handleOpenDetailModal = async (report) => {
    setSelectedReport(report);
    setModalLoading(true);
    setModalError(null);
    setShowDetailModal(true);

    const config = getTokenConfig();
    if (!config) {
      setModalError(t("apiErrors.notAuthorized"));
      setModalLoading(false);
      return;
    }

    try {
      const { data: detailedReport } = await axios.get(
        `/reports/admin/${report._id}`,
        config
      );
      setSelectedReport(detailedReport);
      setEditStatus(detailedReport.status || "");
      setEditAdminNotes(detailedReport.adminNotes || "");
      setEditResolutionDetails(detailedReport.resolutionDetails || "");
    } catch (err) {
      setModalError(
        err.response?.data?.msg || t("admin.reports.errors.fetchDetailsFailed")
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedReport(null);
  };

  const handleUpdateReport = async () => {
    if (!selectedReport) return;
    setModalLoading(true);
    setModalError(null);
    const config = getTokenConfig();
    if (!config) {
      setModalError(t("apiErrors.notAuthorized"));
      setModalLoading(false);
      return;
    }

    const updateData = {
      status: editStatus,
      adminNotes: editAdminNotes,
      resolutionDetails: editResolutionDetails,
    };

    try {
      const { data } = await axios.put(
        `/reports/admin/${selectedReport._id}/status`,
        updateData,
        config
      );
      toast.success(data.msg || t("admin.reports.updateSuccess"));
      fetchReports();
      handleCloseDetailModal();
    } catch (err) {
      const errMsg =
        err.response?.data?.msg || t("admin.reports.errors.updateFailed");
      setModalError(errMsg);
      toast.error(errMsg);
    } finally {
      setModalLoading(false);
    }
  };

  if (loading && reports.length === 0) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">{t("admin.reports.page.loading")}</p>
      </Container>
    );
  }

  if (error && reports.length === 0) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
        <Button onClick={fetchReports}>{t("common.retry")}</Button>
      </Container>
    );
  }

  return (
    <>
      <Container fluid className="p-4 admin-reports-page">
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0">{t("admin.reports.page.title")}</h4>
          </Card.Header>
          <Card.Body>
            <Form className="mb-3">
              <Row>
                <Col md={4}>
                  <Form.Group controlId="filterStatus">
                    <Form.Label>
                      <FaFilter className="me-1" />{" "}
                      {t("admin.reports.filter.label")}
                    </Form.Label>
                    <Form.Select
                      value={filterStatus}
                      onChange={(e) => {
                        setFilterStatus(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="">{t("admin.reports.filter.all")}</option>
                      {Object.entries(statusDisplayMap).map(
                        ([key, { text }]) => (
                          <option key={key} value={key}>
                            {text}
                          </option>
                        )
                      )}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
            </Form>

            {loading && (
              <div className="text-center my-3">
                <Spinner animation="border" size="sm" />{" "}
                {t("admin.reports.page.fetchingUpdates")}
              </div>
            )}
            {error && !loading && (
              <Alert variant="danger" className="my-2">
                {error}
              </Alert>
            )}

            {reports.length === 0 && !loading ? (
              <Alert variant="info" className="text-center">
                {t("admin.reports.page.noReports")}
              </Alert>
            ) : (
              <Table
                striped
                bordered
                hover
                responsive
                className="reports-table"
              >
                <thead>
                  <tr>
                    <th
                      onClick={() => handleSort("createdAt")}
                      style={{ cursor: "pointer" }}
                    >
                      {t("admin.reports.table.date")}
                      {sortBy === "createdAt" &&
                        (sortOrder === "asc" ? (
                          <FaSortAmountUp />
                        ) : (
                          <FaSortAmountDown />
                        ))}
                    </th>
                    <th>{t("admin.reports.table.reporter")}</th>
                    <th>{t("admin.reports.table.reportedUser")}</th>
                    <th
                      onClick={() => handleSort("reasonCategory")}
                      style={{ cursor: "pointer" }}
                    >
                      {t("admin.reports.table.reason")}
                      {sortBy === "reasonCategory" &&
                        (sortOrder === "asc" ? (
                          <FaSortAmountUp />
                        ) : (
                          <FaSortAmountDown />
                        ))}
                    </th>
                    <th>{t("admin.reports.table.details")}</th>
                    <th
                      onClick={() => handleSort("status")}
                      style={{ cursor: "pointer" }}
                    >
                      {t("admin.reports.table.status")}
                      {sortBy === "status" &&
                        (sortOrder === "asc" ? (
                          <FaSortAmountUp />
                        ) : (
                          <FaSortAmountDown />
                        ))}
                    </th>
                    <th>{t("admin.reports.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report._id}>
                      <td>
                        {new Date(report.createdAt).toLocaleDateString()}
                        <small className="text-muted d-block">
                          {new Date(report.createdAt).toLocaleTimeString()}
                        </small>
                      </td>
                      <td>
                        {report.reporterUser ? (
                          <Link
                            to={`/profile/${report.reporterUser._id}`}
                            target="_blank"
                            title={report.reporterUser.email}
                          >
                            {report.reporterUser.fullName || "N/A"}
                          </Link>
                        ) : (
                          t("common.unknown")
                        )}
                      </td>
                      <td>
                        {report.reportedUser ? (
                          <Link
                            to={`/profile/${report.reportedUser._id}`}
                            target="_blank"
                            title={report.reportedUser.email}
                          >
                            {report.reportedUser.fullName || "N/A"}
                          </Link>
                        ) : (
                          t("common.unknown")
                        )}
                      </td>
                      <td>
                        {t(`admin.reports.reasons.${report.reasonCategory}`, {
                          defaultValue: report.reasonCategory.replace(
                            /_/g,
                            " "
                          ),
                        })}
                      </td>
                      <td>
                        {report.details.substring(0, 50)}
                        {report.details.length > 50 ? "..." : ""}
                      </td>
                      <td>
                        <Badge
                          bg={
                            statusDisplayMap[report.status]?.variant ||
                            "secondary"
                          }
                        >
                          {statusDisplayMap[report.status]?.text ||
                            report.status}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleOpenDetailModal(report)}
                        >
                          <FaEye className="me-1" />{" "}
                          {t("admin.reports.actions.viewEdit")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            {totalPages > 1 && (
              <Pagination className="justify-content-center">
                {/* Pagination buttons can be translated if needed, but numbers are universal */}
              </Pagination>
            )}
            <p className="text-center text-muted small mt-2">
              {t("admin.reports.page.paginationInfo", {
                currentPage,
                totalPages,
                totalReports,
              })}
            </p>
          </Card.Body>
        </Card>

        {selectedReport && (
          <Modal
            show={showDetailModal}
            onHide={handleCloseDetailModal}
            size="lg"
            centered
            backdrop="static"
          >
            <Modal.Header closeButton={!modalLoading}>
              <Modal.Title>
                {t("admin.reports.modal.title")} - {t("admin.reports.modal.id")}
                : {selectedReport._id.substring(selectedReport._id.length - 6)}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {modalLoading && (
                <div className="text-center">
                  <Spinner animation="border" />{" "}
                  {t("admin.reports.modal.loading")}
                </div>
              )}
              {modalError && <Alert variant="danger">{modalError}</Alert>}
              {!modalLoading && selectedReport && (
                <>
                  <Row>
                    <Col md={6}>
                      <p>
                        <strong>{t("admin.reports.table.reporter")}:</strong>{" "}
                        <Link
                          to={`/profile/${selectedReport.reporterUser?._id}`}
                          target="_blank"
                        >
                          {selectedReport.reporterUser?.fullName}
                        </Link>{" "}
                        ({selectedReport.reporterUser?.email})
                      </p>
                      <p>
                        <strong>
                          {t("admin.reports.table.reportedUser")}:
                        </strong>{" "}
                        <Link
                          to={`/profile/${selectedReport.reportedUser?._id}`}
                          target="_blank"
                        >
                          {selectedReport.reportedUser?.fullName}
                        </Link>{" "}
                        ({selectedReport.reportedUser?.email})
                      </p>
                      <p>
                        <strong>{t("admin.reports.table.reason")}:</strong>{" "}
                        {t(
                          `admin.reports.reasons.${selectedReport.reasonCategory}`,
                          {
                            defaultValue: selectedReport.reasonCategory.replace(
                              /_/g,
                              " "
                            ),
                          }
                        )}
                      </p>
                      <p>
                        <strong>{t("admin.reports.table.date")}:</strong>{" "}
                        {new Date(selectedReport.createdAt).toLocaleString()}
                      </p>
                      {selectedReport.mediationContext && (
                        <p>
                          <strong>
                            {t("admin.reports.modal.relatedMediation")}:
                          </strong>{" "}
                          <Link
                            to={`/dashboard/mediation-chat/${
                              selectedReport.mediationContext._id ||
                              selectedReport.mediationContext
                            }`}
                            target="_blank"
                          >
                            {t("admin.reports.modal.viewMediation")}
                          </Link>
                        </p>
                      )}
                    </Col>
                    <Col md={6}>
                      <p>
                        <strong>
                          {t("admin.reports.modal.currentStatus")}:
                        </strong>{" "}
                        <Badge
                          bg={
                            statusDisplayMap[selectedReport.status]?.variant ||
                            "secondary"
                          }
                        >
                          {statusDisplayMap[selectedReport.status]?.text ||
                            selectedReport.status}
                        </Badge>
                      </p>
                      <Form.Group controlId="editReportStatus" className="mb-3">
                        <Form.Label>
                          {t("admin.reports.modal.changeStatus")}:
                        </Form.Label>
                        <Form.Select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          disabled={modalLoading}
                        >
                          {Object.entries(statusDisplayMap).map(
                            ([key, { text }]) => (
                              <option key={key} value={key}>
                                {text}
                              </option>
                            )
                          )}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  <hr />
                  <p>
                    <strong>{t("admin.reports.modal.reporterDetails")}:</strong>
                  </p>
                  <p className="report-details-box">{selectedReport.details}</p>

                  {selectedReport.imageUrls &&
                    selectedReport.imageUrls.length > 0 && (
                      <>
                        <p>
                          <strong>
                            {t("admin.reports.modal.attachedImages", {
                              count: selectedReport.imageUrls.length,
                            })}
                            :
                          </strong>
                        </p>
                        <div className="report-modal-images-container">
                          {selectedReport.imageUrls.map((url, index) => (
                            <Image
                              key={index}
                              src={`/${url}`}
                              thumbnail
                              className="report-thumbnail"
                              onClick={() => {
                                setLightboxIndex(index);
                                setLightboxOpen(true);
                              }}
                              alt={`${t("admin.reports.modal.evidence")} ${
                                index + 1
                              }`}
                            />
                          ))}
                        </div>
                        <hr />
                      </>
                    )}

                  <Form.Group controlId="adminNotes" className="mb-3">
                    <Form.Label>
                      {t("admin.reports.modal.adminNotes")}
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={editAdminNotes}
                      onChange={(e) => setEditAdminNotes(e.target.value)}
                      placeholder={t(
                        "admin.reports.modal.adminNotesPlaceholder"
                      )}
                    />
                  </Form.Group>

                  <Form.Group controlId="resolutionDetails">
                    <Form.Label>
                      {t("admin.reports.modal.resolutionDetails")}
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={editResolutionDetails}
                      onChange={(e) => setEditResolutionDetails(e.target.value)}
                      placeholder={t(
                        "admin.reports.modal.resolutionDetailsPlaceholder"
                      )}
                    />
                  </Form.Group>
                </>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={handleCloseDetailModal}
                disabled={modalLoading}
              >
                {t("common.close")}
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateReport}
                disabled={modalLoading || !selectedReport}
              >
                {modalLoading ? <Spinner size="sm" /> : t("common.saveChanges")}
              </Button>
            </Modal.Footer>
          </Modal>
        )}
      </Container>
      {lightboxOpen && selectedReport?.imageUrls && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={selectedReport.imageUrls.map((url) => ({ src: `/${url}` }))}
          index={lightboxIndex}
        />
      )}
    </>
  );
};

export default AdminReportsPage;