// src/pages/TicketDetailsPage.jsx
import React, { useEffect, useState, useMemo, useContext, useRef } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Button,
  Badge,
  Form,
  ListGroup,
  InputGroup,
  Image,
  OverlayTrigger,
  Popover,
} from "react-bootstrap";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useDropzone } from "react-dropzone";
import EmojiPicker from "emoji-picker-react";

import {
  getTicketDetailsAction,
  adminGetTicketDetailsAction,
  addTicketReplyAction,
  adminAddTicketReplyAction,
  closeTicketByUserAction,
  adminUpdateTicketStatusAction,
  adminUpdateTicketPriorityAction,
  adminAssignTicketAction,
  resetAddTicketReplyStatus,
  clearTicketDetailsAction,
} from "../redux/actions/ticketAction";
import {
  FaPaperclip,
  FaReply,
  FaTimesCircle,
  FaInfoCircle,
  FaUserCircle,
  FaHeadset,
  FaTicketAlt,
  FaFileAlt,
  FaUserShield,
  FaTasks,
  FaHighlighter,
  FaUserTie,
  FaFileVideo,
  FaFileAudio,
  FaImage,
  FaSmile,
} from "react-icons/fa";
import { FiSend, FiUsers } from "react-icons/fi";
import moment from "moment";
import { toast } from "react-toastify";
import { SocketContext } from "../App";
import "./TicketDetailsPage.css";

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = 2;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const TICKET_STATUSES_OPTIONS = [
  { value: "Open", label: "Open" },
  { value: "PendingSupportReply", label: "Pending Support Reply" },
  { value: "PendingUserInput", label: "Pending User Input" },
  { value: "InProgress", label: "In Progress" },
  { value: "Resolved", label: "Resolved" },
  { value: "Closed", label: "Closed" },
  { value: "OnHold", label: "On Hold" },
];

const TICKET_PRIORITIES_OPTIONS = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Urgent", label: "Urgent" },
];

const TicketDetailsPage = () => {
  const { ticketId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useContext(SocketContext);

  const {
    activeTicketDetails: ticket,
    activeTicketReplies: replies,
    loadingTicketDetails,
    errorTicketDetails,
    loadingAddReply,
    successAddReply,
    errorAddReply,
    loadingCloseTicket,
    loadingAdminUpdate,
  } = useSelector((state) => state.ticketReducer);
  const { user, users: allUsersList } = useSelector(
    (state) => state.userReducer
  );

  const isAdminView = useMemo(
    () => location.pathname.startsWith("/dashboard/admin/ticket-view"),
    [location.pathname]
  );
  const isUserAdminOrSupport = useMemo(
    () => user && (user.userRole === "Admin" || user.userRole === "Support"),
    [user]
  );

  const [replyMessage, setReplyMessage] = useState("");
  const [newStatusAdmin, setNewStatusAdmin] = useState("");
  const [newPriorityAdmin, setNewPriorityAdmin] = useState("");
  const [assignToUserIdAdmin, setAssignToUserIdAdmin] = useState("");
  const [resolutionNotesAdmin, setResolutionNotesAdmin] = useState("");

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [previewLightboxOpen, setPreviewLightboxOpen] = useState(false);
  const [previewLightboxIndex, setPreviewLightboxIndex] = useState(0);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyFiles, setReplyFiles] = useState([]);
  const textAreaRef = useRef(null);

  const onEmojiClick = (emojiObject) => {
    const cursor = textAreaRef.current.selectionStart;
    const text =
      replyMessage.slice(0, cursor) +
      emojiObject.emoji +
      replyMessage.slice(cursor);
    setReplyMessage(text);
    setShowEmojiPicker(false);
    textAreaRef.current.focus();
  };

  const onDrop = (acceptedFiles) => {
    const newFiles = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setReplyFiles((prev) => [...prev, ...newFiles].slice(0, 5));
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "application/pdf": [],
      "video/*": [],
      "audio/*": [],
    },
    maxSize: 15 * 1024 * 1024,
  });

  const removeReplyFile = (fileToRemove) => {
    setReplyFiles((prevFiles) => {
      const newFiles = prevFiles.filter(
        (file) => file.path !== fileToRemove.path
      );
      URL.revokeObjectURL(fileToRemove.preview);
      return newFiles;
    });
  };

  const imageAttachments = useMemo(() => {
    if (!ticket?.attachments) return [];
    return ticket.attachments.filter(
      (att) => att.fileType && att.fileType.startsWith("image/")
    );
  }, [ticket]);

  useEffect(() => {
    if (ticketId) {
      if (isAdminView && isUserAdminOrSupport)
        dispatch(adminGetTicketDetailsAction(ticketId));
      else if (!isAdminView && user) dispatch(getTicketDetailsAction(ticketId));
      else if (isAdminView && user && !isUserAdminOrSupport) {
        toast.error("Access Denied for admin view.");
        navigate("/dashboard/tickets");
      }
    }
    return () => {
      dispatch(clearTicketDetailsAction());
    };
  }, [dispatch, ticketId, isAdminView, isUserAdminOrSupport, user, navigate]);

  useEffect(() => {
    if (socket && ticket && ticket._id) {
      const ticketRoomId = ticket._id.toString();
      socket.emit("join_ticket_room", ticketRoomId);
      return () => {
        socket.emit("leave_ticket_room", ticketRoomId);
      };
    }
  }, [socket, ticket]);

  useEffect(() => {
    if (ticket && isAdminView) {
      setNewStatusAdmin(ticket.status || "");
      setNewPriorityAdmin(ticket.priority || "");
      setAssignToUserIdAdmin(ticket.assignedTo?._id || "");
    }
  }, [ticket, isAdminView]);

  useEffect(() => {
    if (successAddReply) {
      setReplyMessage("");
      replyFiles.forEach((file) => URL.revokeObjectURL(file.preview));
      setReplyFiles([]);
      toast.success("Reply added successfully!");
      dispatch(resetAddTicketReplyStatus());
    }
    if (errorAddReply) {
      toast.error(errorAddReply);
      dispatch(resetAddTicketReplyStatus());
    }
  }, [successAddReply, errorAddReply, dispatch, replyFiles]);

  useEffect(() => {
    if (socket && ticket && ticket._id) {
      const handleNewReply = (data) => {
        if (
          data.ticketId === ticket._id &&
          (!replies || !replies.find((r) => r._id === data.reply._id))
        ) {
          dispatch({ type: "REALTIME_ADD_TICKET_REPLY", payload: data });
        }
      };
      socket.on("new_ticket_reply", handleNewReply);
      return () => socket.off("new_ticket_reply", handleNewReply);
    }
  }, [socket, ticket, dispatch, replies]);

  const handleAddReply = (e) => {
    e.preventDefault();
    if (!replyMessage.trim() && replyFiles.length === 0) {
      toast.error("Reply message or an attachment is required.");
      return;
    }
    const currentTicketId = ticket?.ticketId || ticket?._id || ticketId;
    const replyData = { message: replyMessage };
    if (isAdminView && isUserAdminOrSupport) {
      dispatch(
        adminAddTicketReplyAction(currentTicketId, replyData, replyFiles)
      );
    } else {
      dispatch(addTicketReplyAction(currentTicketId, replyData, replyFiles));
    }
  };

  const handleCloseTicket = () => {
    if (window.confirm("Are you sure?"))
      dispatch(closeTicketByUserAction(ticket?._id || ticketId));
  };
  const handleAdminUpdateStatus = () => {
    if (ticket && isUserAdminOrSupport)
      dispatch(
        adminUpdateTicketStatusAction(ticket.ticketId || ticket._id, {
          status: newStatusAdmin,
          resolutionNotes: resolutionNotesAdmin,
        })
      );
  };
  const handleAdminUpdatePriority = () => {
    if (ticket && isUserAdminOrSupport)
      dispatch(
        adminUpdateTicketPriorityAction(ticket.ticketId || ticket._id, {
          priority: newPriorityAdmin,
        })
      );
  };
  const handleAdminAssignTicket = () => {
    if (ticket && isUserAdminOrSupport)
      dispatch(
        adminAssignTicketAction(ticket.ticketId || ticket._id, {
          assignedToUserId: assignToUserIdAdmin || null,
        })
      );
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

  if (!user && !loadingTicketDetails)
    return (
      <Container className="py-5 text-center">
        <Alert variant="warning">
          Your session might have expired. Please <Link to="/login">login</Link>{" "}
          again.
        </Alert>
      </Container>
    );
  if (loadingTicketDetails && !ticket)
    return (
      <Container className="py-5 text-center">
        <Spinner
          animation="border"
          variant="primary"
          style={{ width: "3rem", height: "3rem" }}
        />
        <p className="mt-3 fs-5">Loading ticket...</p>
      </Container>
    );
  if (errorTicketDetails)
    return (
      <Container className="py-5">
        <Alert variant="danger" className="text-center">
          <h4>
            <FaTimesCircle className="me-2" /> Error
          </h4>
          <p>{errorTicketDetails}</p>
          <Button
            as={Link}
            to={isAdminView ? "/dashboard/admin/tickets" : "/dashboard/tickets"}
            variant="primary"
          >
            Back
          </Button>
        </Alert>
      </Container>
    );
  if (!ticket && !loadingTicketDetails)
    return (
      <Container className="py-5 text-center">
        <Alert variant="warning">
          <h4>
            <FaInfoCircle className="me-2" /> Not Found
          </h4>
          <p>Ticket details not found.</p>
          <Button
            as={Link}
            to={isAdminView ? "/dashboard/admin/tickets" : "/dashboard/tickets"}
            variant="secondary"
          >
            Back
          </Button>
        </Alert>
      </Container>
    );
  if (ticket && user) {
    if (!isAdminView && user._id !== ticket.user?._id)
      return (
        <Container className="py-5 text-center">
          <Alert variant="danger">Not authorized.</Alert>
        </Container>
      );
  } else if (!loadingTicketDetails)
    return (
      <Container className="py-5 text-center">
        <Alert variant="info">Preparing details...</Alert>
      </Container>
    );

  const supportStaffList =
    allUsersList?.filter(
      (u) => u.userRole === "Support" || u.userRole === "Admin"
    ) || [];

  return (
    <Container className="ticket-details-page py-4 py-lg-5">
      <Row className="justify-content-center">
        <Col md={10} lg={9} xl={8}>
          <Card className="shadow-lg border-0 mb-4">
            <Card.Header className="bg-light p-3 d-flex justify-content-between align-items-center ticket-details-header">
              <div>
                <h4 className="mb-1 ticket-title">
                  <FaTicketAlt className="me-2 text-primary" /> {ticket.title}
                </h4>
                <span className="text-muted small">ID: {ticket.ticketId}</span>
              </div>
              <Button
                as={Link}
                to={
                  isAdminView
                    ? "/dashboard/admin/tickets"
                    : "/dashboard/tickets"
                }
                variant="outline-secondary"
                size="sm"
              >
                « Back to Tickets
              </Button>
            </Card.Header>
            <Card.Body className="p-3 p-md-4">
              <Row className="mb-3 ticket-meta-info">
                <Col md={6} className="mb-2 mb-md-0">
                  <p className="mb-1">
                    <strong className="text-muted">Category:</strong>{" "}
                    {ticket.category}
                  </p>
                  <p className="mb-1">
                    <strong className="text-muted">Priority:</strong>{" "}
                    <Badge
                      pill
                      bg={getPriorityBadgeVariant(ticket.priority)}
                      className="ms-1"
                    >
                      {ticket.priority}
                    </Badge>
                  </p>
                  <p className="mb-0">
                    <strong className="text-muted">Status:</strong>{" "}
                    <Badge
                      pill
                      bg={getStatusBadgeVariant(ticket.status)}
                      className="ms-1"
                    >
                      {ticket.status}
                    </Badge>
                  </p>
                </Col>
                <Col md={6} className="text-md-end">
                  <p className="mb-1">
                    <strong className="text-muted">By:</strong>{" "}
                    {ticket.user?.fullName || "N/A"} (
                    <small className="text-monospace">
                      {ticket.user?.email || "N/A"}
                    </small>
                    )
                  </p>
                  <p className="mb-1">
                    <strong className="text-muted">Created:</strong>{" "}
                    {moment(ticket.createdAt).format("MMM DD, YYYY, h:mm A")}
                  </p>
                  <p className="mb-1">
                    <strong className="text-muted">Last Update:</strong>{" "}
                    {moment(ticket.lastReplyAt || ticket.updatedAt).fromNow()}
                  </p>
                  {ticket.assignedTo && (
                    <p className="mb-0">
                      <strong className="text-muted">Assigned:</strong>{" "}
                      <FaUserTie className="me-1" />
                      {ticket.assignedTo.fullName || "Support"}
                    </p>
                  )}
                </Col>
              </Row>
              <hr />
              <h5 className="mt-4 mb-2">Initial Description:</h5>
              <div className="ticket-description p-3 bg-light-subtle border rounded">
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    fontSize: "0.95rem",
                  }}
                >
                  {ticket.description}
                </pre>
              </div>
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="mt-4">
                  <h5 className="mb-3">
                    <FaPaperclip className="me-2" /> Attachments
                  </h5>
                  <ListGroup
                    variant="flush"
                    className="attachment-list-details"
                  >
                    {ticket.attachments.map((att, idx) => {
                      const fileType = att.fileType || "";
                      const isImage = fileType.startsWith("image/");
                      const isVideo = fileType.startsWith("video/");
                      const isAudio = fileType.startsWith("audio/");
                      const fullUrl = `${BACKEND_URL}/${att.filePath}`;
                      return (
                        <ListGroup.Item
                          key={idx}
                          className="px-0 py-2 d-flex align-items-center"
                        >
                          <div
                            className="flex-shrink-0"
                            style={{ width: "100px", marginRight: "15px" }}
                          >
                            {isImage ? (
                              <div
                                onClick={() => {
                                  const imageIndex = imageAttachments.findIndex(
                                    (img) => img.filePath === att.filePath
                                  );
                                  if (imageIndex > -1) {
                                    setLightboxIndex(imageIndex);
                                    setLightboxOpen(true);
                                  }
                                }}
                                style={{ cursor: "pointer" }}
                                title={`View ${att.fileName}`}
                              >
                                <img
                                  src={fullUrl}
                                  alt={att.fileName}
                                  style={{
                                    width: "80px",
                                    height: "80px",
                                    objectFit: "cover",
                                    borderRadius: "8px",
                                    border: "1px solid #ddd",
                                  }}
                                />
                              </div>
                            ) : isVideo ? (
                              <div className="text-center">
                                <FaFileVideo
                                  size={40}
                                  className="text-primary"
                                />
                                <span className="d-block small text-muted">
                                  Video
                                </span>
                              </div>
                            ) : isAudio ? (
                              <div className="text-center">
                                <FaFileAudio size={40} className="text-info" />
                                <span className="d-block small text-muted">
                                  Audio
                                </span>
                              </div>
                            ) : (
                              <div className="text-center">
                                <FaFileAlt
                                  size={40}
                                  className="text-secondary"
                                />
                                <span className="d-block small text-muted">
                                  File
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-decoration-none fw-semibold d-block"
                            >
                              {att.fileName}
                            </a>
                            <span className="text-muted small">
                              {formatFileSize(att.fileSize)}
                            </span>
                          </div>
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                </div>
              )}
            </Card.Body>
          </Card>

          {isAdminView && isUserAdminOrSupport && ticket && (
            <Card className="shadow-sm border-0 mb-4 admin-ticket-actions-panel">
              {" "}
              <Card.Header className="bg-secondary text-white py-2">
                <h5 className="mb-0">
                  <FaUserShield className="me-2" /> Admin Controls
                </h5>
              </Card.Header>{" "}
              <Card.Body className="p-3">
                {" "}
                <Row className="g-3">
                  {" "}
                  <Col md={6} className="mb-3 mb-md-0">
                    {" "}
                    <Form.Group controlId="adminChangeStatus">
                      <Form.Label className="small fw-semibold">
                        <FaTasks className="me-1" /> Change Status
                      </Form.Label>
                      <InputGroup>
                        <Form.Select
                          value={newStatusAdmin}
                          onChange={(e) => setNewStatusAdmin(e.target.value)}
                        >
                          <option value="">Select status...</option>
                          {TICKET_STATUSES_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </Form.Select>
                        <Button
                          variant="outline-info"
                          onClick={handleAdminUpdateStatus}
                          disabled={loadingAdminUpdate || !newStatusAdmin}
                        >
                          Update
                        </Button>
                      </InputGroup>
                    </Form.Group>{" "}
                  </Col>{" "}
                  <Col md={6} className="mb-3 mb-md-0">
                    {" "}
                    <Form.Group controlId="adminChangePriority">
                      <Form.Label className="small fw-semibold">
                        <FaHighlighter className="me-1" /> Change Priority
                      </Form.Label>
                      <InputGroup>
                        <Form.Select
                          value={newPriorityAdmin}
                          onChange={(e) => setNewPriorityAdmin(e.target.value)}
                        >
                          <option value="">Select priority...</option>
                          {TICKET_PRIORITIES_OPTIONS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </Form.Select>
                        <Button
                          variant="outline-warning"
                          onClick={handleAdminUpdatePriority}
                          disabled={loadingAdminUpdate || !newPriorityAdmin}
                        >
                          Update
                        </Button>
                      </InputGroup>
                    </Form.Group>{" "}
                  </Col>{" "}
                  <Col md={12} className="mt-md-3">
                    {" "}
                    <Form.Group controlId="adminAssignTicket">
                      <Form.Label className="small fw-semibold">
                        <FiUsers className="me-1" /> Assign To
                      </Form.Label>
                      <InputGroup>
                        <Form.Select
                          value={assignToUserIdAdmin}
                          onChange={(e) =>
                            setAssignToUserIdAdmin(e.target.value)
                          }
                        >
                          <option value="">Unassigned / Select Staff...</option>
                          {supportStaffList.map((staff) => (
                            <option key={staff._id} value={staff._id}>
                              {staff.fullName} ({staff.userRole})
                            </option>
                          ))}
                        </Form.Select>
                        <Button
                          variant="outline-success"
                          onClick={handleAdminAssignTicket}
                          disabled={loadingAdminUpdate}
                        >
                          Assign
                        </Button>
                      </InputGroup>
                    </Form.Group>{" "}
                  </Col>{" "}
                  {newStatusAdmin === "Resolved" && (
                    <Col md={12} className="mt-md-3">
                      <Form.Group controlId="adminResolutionNotes">
                        <Form.Label className="small fw-semibold">
                          Resolution Notes (Optional)
                        </Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={resolutionNotesAdmin}
                          onChange={(e) =>
                            setResolutionNotesAdmin(e.target.value)
                          }
                          placeholder="Add notes about the resolution..."
                        />
                      </Form.Group>
                    </Col>
                  )}{" "}
                </Row>{" "}
                {loadingAdminUpdate && (
                  <div className="text-center mt-2">
                    <Spinner animation="border" size="sm" variant="info" />
                  </div>
                )}{" "}
              </Card.Body>{" "}
            </Card>
          )}

          <Card className="shadow-sm border-0 mb-4">
            <Card.Header className="bg-light p-3">
              <h5 className="mb-0">Conversation</h5>
            </Card.Header>
            <ListGroup variant="flush" className="ticket-replies-list p-3">
              {replies && replies.length > 0 ? (
                replies.map((reply) => (
                  <ListGroup.Item
                    key={reply._id}
                    className={`mb-3 p-3 border-0 rounded shadow-sm reply-item ${
                      reply.isSupportReply ? "reply-support" : "reply-user"
                    }`}
                  >
                    {" "}
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      {" "}
                      <strong className="reply-author">
                        {reply.isSupportReply ? (
                          <FaHeadset className="me-1 text-info" />
                        ) : (
                          <FaUserCircle className="me-1 text-success" />
                        )}
                        {reply.user?.fullName ||
                          (reply.isSupportReply ? "Support Team" : "User")}
                      </strong>{" "}
                      <small className="text-muted">
                        {moment(reply.createdAt).fromNow()}
                      </small>{" "}
                    </div>{" "}
                    <pre
                      className="reply-message"
                      style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
                    >
                      {reply.message}
                    </pre>{" "}
                    {reply.attachments && reply.attachments.length > 0 && (
                      <div className="mt-2 reply-attachments">
                        {" "}
                        <small className="text-muted d-block mb-1">
                          Attachments:
                        </small>{" "}
                        {reply.attachments.map((att, rix) => (
                          <a
                            key={rix}
                            href={`${BACKEND_URL}/${att.filePath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="d-block small text-decoration-none mb-1"
                          >
                            <FaPaperclip size="0.8em" /> {att.fileName}
                          </a>
                        ))}{" "}
                      </div>
                    )}{" "}
                  </ListGroup.Item>
                ))
              ) : (
                <ListGroup.Item className="text-center text-muted py-4 border-0">
                  No replies yet.
                </ListGroup.Item>
              )}
            </ListGroup>
          </Card>

          {ticket &&
            ticket.status !== "Closed" &&
            ((user &&
              (user._id === ticket.user?._id || isUserAdminOrSupport) &&
              ticket.status !== "Resolved") ||
              (isUserAdminOrSupport && ticket.status === "Resolved")) && (
              <Card className="shadow-sm border-0 add-reply-card">
                <Card.Header className="bg-light p-3">
                  <h5 className="mb-0">
                    <FaReply className="me-2" /> Add Your Reply
                  </h5>
                </Card.Header>
                <Card.Body className="p-3 p-md-4">
                  <Form onSubmit={handleAddReply}>
                    {replyFiles.length > 0 && (
                      <div className="d-flex flex-wrap gap-2 mb-3 reply-attachment-previews">
                        {replyFiles.map((file, i) => (
                          <div key={i} className="position-relative">
                            <Image
                              src={file.preview}
                              thumbnail
                              style={{
                                width: "70px",
                                height: "70px",
                                objectFit: "cover",
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                if (file.type.startsWith("image/")) {
                                  setPreviewLightboxIndex(i);
                                  setPreviewLightboxOpen(true);
                                } else {
                                  window.open(file.preview, "_blank");
                                }
                              }}
                            />
                            <Button
                              variant="danger"
                              size="sm"
                              className="position-absolute top-0 end-0 m-1 p-0"
                              style={{
                                lineHeight: "1",
                                width: "20px",
                                height: "20px",
                                borderRadius: "50%",
                              }}
                              onClick={() => removeReplyFile(file)}
                            >
                              <FaTimesCircle />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Form.Group className="mb-2" controlId="replyMessageForm">
                      <Form.Control
                        ref={textAreaRef}
                        as="textarea"
                        rows={5}
                        placeholder="Type your reply here..."
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                      />
                    </Form.Group>
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <div className="d-flex gap-2">
                        <OverlayTrigger
                          trigger="click"
                          placement="top"
                          show={showEmojiPicker}
                          onToggle={setShowEmojiPicker}
                          rootClose
                          overlay={
                            <Popover id="popover-emoji-picker">
                              <EmojiPicker onEmojiClick={onEmojiClick} />
                            </Popover>
                          }
                        >
                          <Button variant="light" size="sm">
                            <FaSmile />
                          </Button>
                        </OverlayTrigger>
                        <div {...getRootProps({ className: "dropzone" })}>
                          <input {...getInputProps()} />
                          <Button variant="light" size="sm">
                            <FaImage />
                          </Button>
                        </div>
                      </div>
                      <Button
                        variant="success"
                        type="submit"
                        disabled={loadingAddReply}
                        className="px-4"
                      >
                        {loadingAddReply ? (
                          <Spinner
                            as="span"
                            animation="border"
                            size="sm"
                            className="me-1"
                          />
                        ) : (
                          <FiSend className="me-1" />
                        )}
                        Submit
                      </Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>
            )}

          {user &&
            user._id === ticket?.user?._id &&
            !["Closed", "Resolved"].includes(ticket?.status) && (
              <div className="mt-4 text-end">
                <Button
                  variant="outline-danger"
                  onClick={handleCloseTicket}
                  disabled={loadingCloseTicket}
                >
                  {loadingCloseTicket ? (
                    <Spinner as="span" size="sm" className="me-1" />
                  ) : (
                    <FaTimesCircle className="me-1" />
                  )}{" "}
                  Close This Ticket
                </Button>
              </div>
            )}
        </Col>
      </Row>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={imageAttachments.map((att) => ({
          src: `${BACKEND_URL}/${att.filePath}`,
        }))}
        index={lightboxIndex}
        on={{ view: ({ index }) => setLightboxIndex(index) }}
      />

      <Lightbox
        open={previewLightboxOpen}
        close={() => setPreviewLightboxOpen(false)}
        slides={replyFiles
          .filter((file) => file.type.startsWith("image/"))
          .map((file) => ({ src: file.preview }))}
        index={previewLightboxIndex}
        on={{ view: ({ index }) => setPreviewLightboxIndex(index) }}
      />
    </Container>
  );
};

export default TicketDetailsPage;
