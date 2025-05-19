// client/src/pages/MediationsListPage.jsx
import React, { useEffect } from "react"; // تمت إزالة useState إذا لم تعد هناك حاجة له
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom"; // تمت إزالة Link إذا لم تستخدمه مباشرة هنا
import {
  Container,
  Row,
  Col,
  Card,
  ListGroup,
  Button,
  Spinner,
  Alert,
  Badge,
} from "react-bootstrap";
import { FaComments, FaUserFriends, FaBoxOpen } from "react-icons/fa"; // FaEye تمت إزالتها
import {
  getMyMediationSummaries,
  markMediationAsReadInList,
} from "../redux/actions/mediationAction"; // استيراد الـ action

const MediationsListPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    requests, // تم تغيير الاسم إلى requests ليطابق الـ reducer
    loading,
    error,
    totalUnreadMessagesCount, // يمكن استخدامه لعرض إجمالي إذا أردت
  } = useSelector((state) => state.mediationReducer.myMediationSummaries); // تعديل المسار في الـ state

  // const currentUserId = useSelector(state => state.userReducer.user?._id); // ليس ضروريًا هنا مباشرة

  useEffect(() => {
    console.log("MediationsListPage: Fetching summaries...");
    dispatch(getMyMediationSummaries());
  }, [dispatch]);

  const handleOpenChat = (mediationId) => {
    // (اختياري) تحديث فوري لعدد الرسائل غير المقروءة في القائمة لهذه المحادثة
    dispatch(markMediationAsReadInList(mediationId));
    navigate(`/dashboard/mediation-chat/${mediationId}`);
  };

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">Loading your mediations...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          Error loading mediations:{" "}
          {typeof error === "object"
            ? error.message || JSON.stringify(error)
            : error}
        </Alert>
        <Button
          onClick={() => dispatch(getMyMediationSummaries())}
          variant="outline-primary"
        >
          Try Again
        </Button>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 px-md-4">
      {" "}
      {/* تعديل الحشو للشاشات المختلفة */}
      <Row className="mb-3 align-items-center">
        <Col>
          <h2 className="h4">My Mediation Chats</h2>
        </Col>
        {totalUnreadMessagesCount > 0 && (
          <Col xs="auto">
            <Badge bg="primary" pill className="fs-6">
              {totalUnreadMessagesCount} Total Unread
            </Badge>
          </Col>
        )}
      </Row>
      {requests && requests.length > 0 ? (
        <ListGroup variant="flush">
          {" "}
          {/* variant flush لإزالة الحدود الافتراضية */}
          {requests.map((mediation) => (
            <ListGroup.Item
              key={mediation._id}
              action // يجعل العنصر قابلاً للنقر بصريًا
              onClick={() => handleOpenChat(mediation._id)} // فتح الدردشة عند النقر على العنصر بأكمله
              className="mb-2 shadow-sm rounded mediation-list-item p-3" // إضافة حشو وتصميم
              style={{ cursor: "pointer" }}
            >
              <Row className="align-items-center g-2">
                {" "}
                {/* g-2 لتباعد صغير بين الأعمدة */}
                <Col md="auto" xs={2} className="text-center d-none d-md-block">
                  {" "}
                  {/* إخفاء الأيقونة الكبيرة على الشاشات الصغيرة جدًا */}
                  <div
                    className={`status-indicator-dot me-2 ${
                      mediation.unreadMessagesCount > 0 ? "unread" : "read"
                    }`}
                  ></div>
                  <FaBoxOpen
                    size={28}
                    className={
                      mediation.unreadMessagesCount > 0
                        ? "text-primary"
                        : "text-muted"
                    }
                  />
                </Col>
                <Col>
                  <div className="d-flex justify-content-between align-items-start">
                    <h5
                      className="mb-1 fs-6 fw-bold text-truncate"
                      style={{ maxWidth: "80%" }}
                    >
                      {mediation.product?.title || "Mediation Session"}
                    </h5>
                    {mediation.unreadMessagesCount > 0 && (
                      <Badge pill bg="danger" className="ms-2 flex-shrink-0">
                        {mediation.unreadMessagesCount}
                      </Badge>
                    )}
                  </div>
                  <p className="mb-1 text-muted small">
                    <FaUserFriends className="me-1" />
                    With: {mediation.otherParty?.fullName || "N/A"}
                    <span className="d-none d-sm-inline">
                      {" "}
                      ({mediation.otherParty?.roleLabel || "Participant"})
                    </span>
                  </p>
                  <div className="d-flex justify-content-between align-items-center">
                    <Badge
                      bg={
                        mediation.status === "InProgress"
                          ? "success"
                          : mediation.status === "Completed" ||
                            mediation.status === "Cancelled"
                          ? "secondary"
                          : "info"
                      }
                      className="me-2"
                    >
                      {mediation.status}
                    </Badge>
                    <span className="text-muted small">
                      {mediation.lastMessageTimestamp
                        ? `Last: ${new Date(
                            mediation.lastMessageTimestamp
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })} ${new Date(
                            mediation.lastMessageTimestamp
                          ).toLocaleDateString([], {
                            day: "2-digit",
                            month: "short",
                          })}`
                        : `Updated: ${new Date(
                            mediation.updatedAt
                          ).toLocaleDateString()}`}
                    </span>
                  </div>
                </Col>
                {/* <Col md={2} xs={3} className="text-end">
                                    <Button 
                                        variant="outline-primary" 
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); handleOpenChat(mediation._id); }} // منع انتشار الحدث
                                    >
                                        <FaComments className="me-sm-1" /> <span className="d-none d-sm-inline">Chat</span>
                                    </Button>
                                </Col> */}
              </Row>
            </ListGroup.Item>
          ))}
        </ListGroup>
      ) : (
        <Card className="text-center p-4 p-md-5 shadow-sm mt-4">
          <Card.Body>
            <FaComments size={48} className="text-muted opacity-50 mb-3" />
            <h4 className="h5">No Mediation Chats Found</h4>
            <p className="text-muted">
              You are not currently involved in any mediation processes.
            </p>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
};

export default MediationsListPage;
