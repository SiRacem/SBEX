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
import { useDispatch, useSelector } from "react-redux";
import axios from "axios"; // أو action إذا أنشأت واحدًا لجلب البلاغات
import { toast } from "react-toastify";
import {
  FaEye,
  FaEdit,
  FaFilter,
  FaSortAmountDown,
  FaSortAmountUp,
  FaImages,
} from "react-icons/fa";
import { Link } from "react-router-dom"; // لعرض روابط للملفات الشخصية
import "./AdminReportsPage.css";

// ثابت لحفظ التوكن وتكوين الطلبات
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

// (اختياري) ماب لأسماء الحالات لتكون أوضح
const statusDisplayMap = {
  PENDING_REVIEW: { text: "Pending Review", variant: "warning" },
  UNDER_INVESTIGATION: { text: "Under Investigation", variant: "info" },
  ACTION_TAKEN: { text: "Action Taken", variant: "success" },
};

const AdminReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalReports, setTotalReports] = useState(0);
  const itemsPerPage = 10; // أو اجعله قابل للتعديل

  // Filtering state
  const [filterStatus, setFilterStatus] = useState(""); // '', 'PENDING_REVIEW', etc.

  // Sorting state
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Modal for viewing/editing report details
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  // State for editing within the modal
  const [editStatus, setEditStatus] = useState("");
  const [editAdminNotes, setEditAdminNotes] = useState("");
  const [editResolutionDetails, setEditResolutionDetails] = useState("");

  // Lightbox for report images
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [currentLightboxImageIndex, setCurrentLightboxImageIndex] = useState(0);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    const config = getTokenConfig();
    if (!config) {
      setError("Authentication required.");
      setLoading(false);
      return;
    }

    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        status: filterStatus || undefined, // لا ترسل الفلتر إذا كان فارغًا
        sortBy: sortBy,
        sortOrder: sortOrder,
      };
      // المسار يجب أن يطابق ما في Backend router (e.g., /reports/admin/all)
      const { data } = await axios.get("/reports/admin/all", {
        ...config,
        params,
      });

      setReports(data.reports || []);
      setTotalPages(data.totalPages || 0);
      setTotalReports(data.totalReports || 0);
      setCurrentPage(data.currentPage || 1); // تأكد من تحديث الصفحة الحالية من الاستجابة
    } catch (err) {
      const errMsg = err.response?.data?.msg || "Failed to fetch reports.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus, sortBy, sortOrder]); // itemsPerPage ثابت

  useEffect(() => {
    fetchReports();
  }, [fetchReports]); // سيتم استدعاؤها عند تغيير أي من الاعتماديات داخل fetchReports

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleSort = (field) => {
    const newSortOrder =
      sortBy === field && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(field);
    setSortOrder(newSortOrder);
    setCurrentPage(1); // العودة للصفحة الأولى عند تغيير الفرز
  };

  const handleOpenDetailModal = async (report) => {
    setSelectedReport(report); // عرض البيانات الأولية من القائمة
    setModalLoading(true);
    setModalError(null);
    setShowDetailModal(true);

    const config = getTokenConfig();
    if (!config) {
      /* ... handle auth error ... */ setModalLoading(false);
      return;
    }

    try {
      // جلب التفاصيل الكاملة للبلاغ
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
        err.response?.data?.msg || "Failed to load report details."
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedReport(null);
    setEditStatus("");
    setEditAdminNotes("");
    setEditResolutionDetails("");
    setModalError(null);
  };

  const handleUpdateReport = async () => {
    if (!selectedReport) return;
    setModalLoading(true);
    setModalError(null);
    const config = getTokenConfig();
    if (!config) {
      /* ... handle auth error ... */ setModalLoading(false);
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
      toast.success(data.msg || "Report updated successfully!");
      fetchReports(); // إعادة جلب القائمة لتحديثها
      handleCloseDetailModal();
    } catch (err) {
      const errMsg = err.response?.data?.msg || "Failed to update report.";
      setModalError(errMsg);
      toast.error(errMsg);
    } finally {
      setModalLoading(false);
    }
  };

  const openReportImageLightbox = (images, startIndex = 0) => {
    setLightboxImages(images || []);
    setCurrentLightboxImageIndex(startIndex);
    setShowLightbox(true);
  };

  const closeReportImageLightbox = () => {
    setShowLightbox(false);
    setLightboxImages([]);
  };

  const nextLightboxImage = () => {
    setCurrentLightboxImageIndex((prev) => (prev + 1) % lightboxImages.length);
  };

  const prevLightboxImage = () => {
    setCurrentLightboxImageIndex(
      (prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length
    );
  };

  if (loading && reports.length === 0) {
    // عرض التحميل الأولي فقط إذا لم تكن هناك بيانات بعد
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">Loading reports...</p>
      </Container>
    );
  }

  if (error && reports.length === 0) {
    // عرض الخطأ فقط إذا لم يتم تحميل أي بيانات
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
        <Button onClick={fetchReports}>Retry</Button>
      </Container>
    );
  }

  return (
    <Container fluid className="p-4 admin-reports-page">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">User Reports Management</h4>
          {/* يمكن إضافة زر لإعادة التحميل أو إحصائيات سريعة هنا */}
        </Card.Header>
        <Card.Body>
          <Form className="mb-3">
            <Row>
              <Col md={4}>
                <Form.Group controlId="filterStatus">
                  <Form.Label>
                    <FaFilter className="me-1" /> Filter by Status
                  </Form.Label>
                  <Form.Select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">All Statuses</option>
                    {Object.entries(statusDisplayMap).map(([key, { text }]) => (
                      <option key={key} value={key}>
                        {text}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              {/* يمكنك إضافة المزيد من الفلاتر هنا (بحث، تاريخ، إلخ) */}
            </Row>
          </Form>

          {loading && (
            <div className="text-center my-3">
              <Spinner animation="border" size="sm" /> Fetching updates...
            </div>
          )}
          {error && !loading && (
            <Alert variant="danger" className="my-2">
              {error}
            </Alert>
          )}

          {reports.length === 0 && !loading ? (
            <Alert variant="info" className="text-center">
              No reports found matching your criteria.
            </Alert>
          ) : (
            <Table striped bordered hover responsive className="reports-table">
              <thead>
                <tr>
                  <th
                    onClick={() => handleSort("createdAt")}
                    style={{ cursor: "pointer" }}
                  >
                    Date
                    {sortBy === "createdAt" &&
                      (sortOrder === "asc" ? (
                        <FaSortAmountUp />
                      ) : (
                        <FaSortAmountDown />
                      ))}
                  </th>
                  <th>Reporter</th>
                  <th>Reported User</th>
                  <th
                    onClick={() => handleSort("reasonCategory")}
                    style={{ cursor: "pointer" }}
                  >
                    Reason
                    {sortBy === "reasonCategory" &&
                      (sortOrder === "asc" ? (
                        <FaSortAmountUp />
                      ) : (
                        <FaSortAmountDown />
                      ))}
                  </th>
                  <th>Details (Snippet)</th>
                  <th
                    onClick={() => handleSort("status")}
                    style={{ cursor: "pointer" }}
                  >
                    Status
                    {sortBy === "status" &&
                      (sortOrder === "asc" ? (
                        <FaSortAmountUp />
                      ) : (
                        <FaSortAmountDown />
                      ))}
                  </th>
                  <th>Actions</th>
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
                        "Unknown"
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
                        "Unknown"
                      )}
                    </td>
                    <td>{report.reasonCategory.replace(/_/g, " ")}</td>
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
                        {statusDisplayMap[report.status]?.text || report.status}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleOpenDetailModal(report)}
                      >
                        <FaEye className="me-1" /> View / Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {totalPages > 1 && (
            <Pagination className="justify-content-center">
              <Pagination.First
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              />
              <Pagination.Prev
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              />
              {/* يمكنك إضافة أرقام الصفحات هنا إذا أردت */}
              {[...Array(totalPages).keys()].map((num) => {
                const pageNum = num + 1;
                // عرض عدد محدود من أرقام الصفحات
                if (
                  pageNum === currentPage ||
                  pageNum === currentPage - 1 ||
                  pageNum === currentPage - 2 ||
                  pageNum === currentPage + 1 ||
                  pageNum === currentPage + 2 ||
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum === currentPage - 3 && currentPage > 5) ||
                  (pageNum === currentPage + 3 && currentPage < totalPages - 4)
                ) {
                  return (
                    <Pagination.Item
                      key={pageNum}
                      active={pageNum === currentPage}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Pagination.Item>
                  );
                } else if (
                  (pageNum === currentPage - 4 && currentPage > 6) ||
                  (pageNum === currentPage + 4 && currentPage < totalPages - 5)
                ) {
                  return (
                    <Pagination.Ellipsis key={`ellipsis-${pageNum}`} disabled />
                  );
                }
                return null;
              })}
              <Pagination.Next
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              />
              <Pagination.Last
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              />
            </Pagination>
          )}
          <p className="text-center text-muted small mt-2">
            Showing page {currentPage} of {totalPages}. Total reports:
            {totalReports}.
          </p>
        </Card.Body>
      </Card>

      {/* Modal for Report Details and Editing */}
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
              Report Details - ID : {' '}
              {selectedReport._id.substring(selectedReport._id.length - 6)}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {modalLoading && (
              <div className="text-center">
                <Spinner animation="border" /> Loading details...
              </div>
            )}
            {modalError && <Alert variant="danger">{modalError}</Alert>}
            {!modalLoading && selectedReport && (
              <>
                <Row>
                  <Col md={6}>
                    <p>
                      <strong>Reporter :</strong> {' '}
                      <Link
                        to={`/profile/${selectedReport.reporterUser?._id}`}
                        target="_blank"
                      >
                        {selectedReport.reporterUser?.fullName}
                      </Link> {' '}
                      ({selectedReport.reporterUser?.email})
                    </p>
                    <p>
                      <strong>Reported User :</strong> {' '}
                      <Link
                        to={`/profile/${selectedReport.reportedUser?._id}`}
                        target="_blank"
                      >
                        {selectedReport.reportedUser?.fullName}
                      </Link> {' '}
                      ({selectedReport.reportedUser?.email})
                    </p>
                    <p>
                      <strong>Reason :</strong> {' '}
                      {selectedReport.reasonCategory.replace(/_/g, " ")}
                    </p>
                    <p>
                      <strong>Report Date :</strong> {' '}
                      {new Date(selectedReport.createdAt).toLocaleString()}
                    </p>
                    {selectedReport.mediationContext && (
                      <p>
                        <strong>Related Mediation :</strong> {' '}
                        <Link
                          to={`/dashboard/mediation-chat/${
                            selectedReport.mediationContext._id ||
                            selectedReport.mediationContext
                          }`}
                          target="_blank"
                        >
                          View Mediation
                        </Link>
                      </p>
                    )}
                  </Col>
                  <Col md={6}>
                    <p>
                      <strong>Current Status :</strong> {' '}
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
                      <Form.Label>Change Status :</Form.Label>
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
                  <strong>Details Provided by Reporter :</strong>
                </p>
                <p
                  style={{
                    whiteSpace: "pre-wrap",
                    background: "#f8f9fa",
                    padding: "10px",
                    borderRadius: "4px",
                  }}
                >
                  {selectedReport.details}
                </p>

                {selectedReport.imageUrls &&
                  selectedReport.imageUrls.length > 0 && (
                    <>
                      <p>
                        <strong>
                          Attached Images ({selectedReport.imageUrls.length}) :
                        </strong>
                      </p>
                      <div className="report-modal-images-container">
                        {selectedReport.imageUrls.map((url, index) => (
                          <Image
                            key={index}
                            src={`/${url}`} // المسار يجب أن يكون صحيحًا بالنسبة لخادمك
                            thumbnail
                            style={{
                              width: "100px",
                              height: "100px",
                              objectFit: "cover",
                              margin: "5px",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              openReportImageLightbox(
                                selectedReport.imageUrls,
                                index
                              )
                            }
                            alt={`Evidence ${index + 1}`}
                          />
                        ))}
                      </div>
                      <hr />
                    </>
                  )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={handleCloseDetailModal}
              disabled={modalLoading}
            >
              Close
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateReport}
              disabled={modalLoading || !selectedReport}
            >
              {modalLoading ? <Spinner size="sm" /> : "Save Changes"}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Lightbox Modal for Report Images */}
      <Modal
        show={showLightbox}
        onHide={closeReportImageLightbox}
        centered
        size="xl"
        dialogClassName="report-image-lightbox"
      >
        <Modal.Header closeButton className="bg-dark text-white border-0">
          <Modal.Title>
            Image {currentLightboxImageIndex + 1} of {lightboxImages.length}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 text-center bg-dark">
          {lightboxImages[currentLightboxImageIndex] && (
            <Image
              src={`/${lightboxImages[currentLightboxImageIndex]}`}
              fluid
              style={{ maxHeight: "85vh", objectFit: "contain", width: "100%" }}
              alt={`Report evidence ${currentLightboxImageIndex + 1}`}
            />
          )}
        </Modal.Body>
        {lightboxImages.length > 1 && (
          <Modal.Footer className="d-flex justify-content-between bg-dark border-0">
            <Button
              variant="outline-light"
              onClick={prevLightboxImage}
              disabled={lightboxImages.length <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline-light"
              onClick={nextLightboxImage}
              disabled={lightboxImages.length <= 1}
            >
              Next
            </Button>
          </Modal.Footer>
        )}
      </Modal>
    </Container>
  );
};

export default AdminReportsPage;
