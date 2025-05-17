// src/pages/MediationChatPage.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  ListGroup,
  Spinner,
  Alert,
  Image,
  Badge,
  Offcanvas,
} from "react-bootstrap";
import io from "socket.io-client";
import axios from "axios";
import EmojiPicker from "emoji-picker-react";
import { FaPaperclip, FaSmile, FaPaperPlane } from "react-icons/fa";
import "./MediationChatPage.css";

const formatCurrency = (amount, currencyCode = "TND") => {
    const num = Number(amount);
    if (isNaN(num) || amount == null) return "N/A";
    let safeCurrencyCode = currencyCode;
    if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
        safeCurrencyCode = "TND";
    }
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: safeCurrencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    } catch (error) {
        return `${num.toFixed(2)} ${safeCurrencyCode}`;
    }
};

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const MediationChatPage = () => {
  const { mediationRequestId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const currentUserId = useSelector((state) => state.userReducer.user?._id);
  const currentUserFullName = useSelector(
    (state) => state.userReducer.user?.fullName
  );
  const currentUserAvatar = useSelector(
    (state) => state.userReducer.user?.avatarUrl
  );
  const currentUserRole = useSelector(
    (state) => state.userReducer.user?.userRole
  );

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [chatError, setChatError] = useState(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const hasJoinedRoomRef = useRef(false); // Keep for internal socket logic if preferred
  const joinTimeoutRef = useRef(null);

  const [mediationDetails, setMediationDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  const [showDetailsOffcanvas, setShowDetailsOffcanvas] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);

  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);

  const handleShowDetailsOffcanvas = () => setShowDetailsOffcanvas(true);
  const handleCloseDetailsOffcanvas = () => setShowDetailsOffcanvas(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (mediationRequestId && currentUserId) {
      const fetchMediationDetails = async () => {
        setLoadingDetails(true);
        setChatError(null);
        try {
          const token = localStorage.getItem("token");
          if (!token) {
            setChatError("Authentication required.");
            setLoadingDetails(false);
            return;
          }
          const config = { headers: { Authorization: `Bearer ${token}` } };
          const response = await axios.get(
            `${BACKEND_URL}/mediation/request-details/${mediationRequestId}`,
            config
          );
          setMediationDetails(response.data.mediationRequest || response.data);
        } catch (err) {
          setChatError(
            err.response?.data?.msg || "Failed to load mediation details."
          );
        } finally {
          setLoadingDetails(false);
        }
      };
      fetchMediationDetails();
    } else {
      setLoadingDetails(false);
    }
  }, [mediationRequestId, currentUserId]);

  useEffect(() => {
    if (mediationRequestId && currentUserId) {
      const fetchChatHistory = async () => {
        setIsLoadingHistory(true);
        try {
          const token = localStorage.getItem("token");
          if (!token) {
            setChatError((prev) => prev || "Auth token missing for history.");
            setIsLoadingHistory(false);
            return;
          }
          const config = { headers: { Authorization: `Bearer ${token}` } };
          const response = await axios.get(
            `${BACKEND_URL}/mediation/chat/${mediationRequestId}/history`,
            config
          );
          setMessages(response.data || []);
          if (!chatError && response.data) setChatError(null);
        } catch (err) {
          setChatError(
            (prev) =>
              prev || err.response?.data?.msg || "Failed to load chat history."
          );
        } finally {
          setIsLoadingHistory(false);
        }
      };
      fetchChatHistory();
    } else {
      setIsLoadingHistory(false);
    }
  }, [mediationRequestId, currentUserId]);

  useEffect(() => {
    if (
      !currentUserId ||
      !mediationRequestId ||
      !mediationDetails ||
      (chatError && !messages.length && !isLoadingHistory)
    ) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setHasJoinedRoom(false);
      return;
    }

    if (socketRef.current) socketRef.current.disconnect();
    setHasJoinedRoom(false);

    const newSocket = io(BACKEND_URL, {
      reconnectionAttempts: 3,
      transports: ["websocket"],
    });
    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = setTimeout(() => {
        if (newSocket.connected && !hasJoinedRoom) {
          const joinData = {
            mediationRequestId,
            userRole: currentUserRole,
            userId: currentUserId,
          };
          newSocket.emit("joinMediationChat", joinData);
        }
      }, 700);
    });

    newSocket.on("joinedMediationChatSuccess", (data) => {
      setChatError(null);
      setHasJoinedRoom(true);
    });

    newSocket.on("newMediationMessage", (message) => {
      setMessages((prev) => {
        if (
          prev.find(
            (m) => m._id === message._id && m.timestamp === message.timestamp
          )
        )
          return prev;
        return [...prev, message];
      });
    });

    newSocket.on("mediationChatError", (errorData) => {
      setChatError(errorData.message);
      setHasJoinedRoom(false);
    });

    newSocket.on("connect_error", (err) => {
      setChatError(`Socket connection failed: ${err.message}.`);
      setHasJoinedRoom(false);
    });

    newSocket.on("disconnect", (reason) => {
      if (reason === "io server disconnect" || reason === "transport close") {
        setChatError("Chat connection lost.");
      }
      setHasJoinedRoom(false);
    });

    return () => {
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      if (newSocket) {
        newSocket.emit("leaveMediationChat", { mediationRequestId });
        newSocket.removeAllListeners();
        newSocket.disconnect();
      }
      socketRef.current = null;
      setHasJoinedRoom(false);
    };
  }, [
    mediationRequestId,
    currentUserId,
    currentUserRole,
    mediationDetails,
    chatError,
    isLoadingHistory,
    messages.length,
    dispatch,
  ]); // Added isLoadingHistory & messages.length to re-evaluate if socket should connect

  useEffect(() => {
    const handleClickOutsideEmojiPicker = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker)
      document.addEventListener("mousedown", handleClickOutsideEmojiPicker);
    else
      document.removeEventListener("mousedown", handleClickOutsideEmojiPicker);
    return () =>
      document.removeEventListener("mousedown", handleClickOutsideEmojiPicker);
  }, [showEmojiPicker]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    const currentSocket = socketRef.current;
    if (
      newMessage.trim() &&
      currentSocket &&
      currentSocket.connected &&
      currentUserId &&
      hasJoinedRoom
    ) {
      currentSocket.emit("sendMediationMessage", {
        mediationRequestId,
        messageText: newMessage,
      });
      setNewMessage("");
    } else if (!currentSocket || !currentSocket.connected) {
      setChatError("Not connected to chat. Please refresh.");
    } else if (!hasJoinedRoom) {
      setChatError("Not joined the chat room yet.");
    }
  };

  const renderMessageSenderAvatar = (sender) => {
    let avatar = "https://bootdey.com/img/Content/avatar/avatar7.png";
    if (sender?.avatarUrl) {
      avatar = sender.avatarUrl.startsWith("http")
        ? sender.avatarUrl
        : `${BACKEND_URL}/${sender.avatarUrl}`;
    }
    return (
      <Image
        src={avatar}
        roundedCircle
        width={40}
        height={40}
        className="me-2 flex-shrink-0"
        alt={sender?.fullName || "User"}
        onError={(e) => {
          e.target.src = "https://bootdey.com/img/Content/avatar/avatar7.png";
        }}
      />
    );
  };

  const participants = useMemo(() => {
    if (!mediationDetails) return [];
    const parts = [];
    if (mediationDetails.seller)
      parts.push({
        ...mediationDetails.seller,
        roleLabel: "Seller",
        id: mediationDetails.seller._id,
      });
    if (mediationDetails.buyer)
      parts.push({
        ...mediationDetails.buyer,
        roleLabel: "Buyer",
        id: mediationDetails.buyer._id,
      });
    if (mediationDetails.mediator)
      parts.push({
        ...mediationDetails.mediator,
        roleLabel: "Mediator",
        id: mediationDetails.mediator._id,
      });
    return parts;
  }, [mediationDetails]);

  const onEmojiClick = (emojiData, event) => {
    setNewMessage((prevInput) => prevInput + emojiData.emoji);
  };

  const handleFileSelected = (event) => {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append("chatImage", file);
      formData.append("mediationRequestId", mediationRequestId);
      const token = localStorage.getItem("token");
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      };
      axios
        .post(`${BACKEND_URL}/mediation/chat/upload-image`, formData, config)
        .then((response) => console.log("Image uploaded:", response.data))
        .catch((err) =>
          setChatError(err.response?.data?.msg || "Failed to upload image.")
        );
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const renderSidebarContent = () => (
    <>
      <h5 className="mb-3">Participants</h5>
      <ListGroup variant="flush" className="mb-4 participant-list">
        {participants.map((p) => (
          <ListGroup.Item
            key={p.id || p._id}
            className="d-flex align-items-center bg-transparent border-0 px-0 py-2"
          >
            {renderMessageSenderAvatar(p)}
            <div>
              <div className="fw-bold">{p.fullName}</div>
              <small className="text-muted">{p.roleLabel}</small>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
      <h5 className="mb-3">Transaction Details</h5>
      {mediationDetails && mediationDetails.product ? (
        <div className="transaction-details-widget mb-4 small">
          <p className="mb-1">
            <strong>Product:</strong> {mediationDetails.product.title}
          </p>
          <p className="mb-1">
            <strong>Agreed Price:</strong>
            {formatCurrency(
              mediationDetails.bidAmount,
              mediationDetails.bidCurrency
            )}
          </p>
          <p className="mb-1">
            <strong>Escrowed:</strong>
            {mediationDetails.escrowedAmount
              ? formatCurrency(
                  mediationDetails.escrowedAmount,
                  mediationDetails.escrowedCurrency
                )
              : "Not yet"}
          </p>
          <p className="mb-1">
            <strong>Mediator Fee:</strong>
            {formatCurrency(
              mediationDetails.calculatedMediatorFee,
              mediationDetails.mediationFeeCurrency
            )}
          </p>
          <p className="mb-1">
            <strong>Status:</strong>
            <Badge bg="info">{mediationDetails.status}</Badge>
          </p>
        </div>
      ) : (
        <p>Loading transaction details...</p>
      )}
      <div className="mt-auto action-buttons-footer pt-3 border-top">
        {currentUserId === mediationDetails?.buyer?._id &&
          mediationDetails?.status === "InProgress" && (
            <Button variant="success" className="w-100 mb-2">
              Confirm Product Received
            </Button>
          )}
        {mediationDetails?.status === "InProgress" && (
          <Button variant="danger" className="w-100">
            Open Dispute
          </Button>
        )}
      </div>
    </>
  );

  if (!currentUserId)
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p>Loading user...</p>
        <Alert variant="warning" className="mt-3">
          Please login.
        </Alert>
      </Container>
    );
  if (loadingDetails)
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p>Loading details...</p>
      </Container>
    );
  if (!mediationDetails && !loadingDetails && chatError && !isLoadingHistory)
    return (
      <Container className="py-5">
        <Alert variant="danger">Error: {chatError}</Alert>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </Container>
    );
  if (!mediationDetails)
    return (
      <Container className="py-5">
        <Alert variant="warning">Details not found.</Alert>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </Container>
    );

  return (
    <Container fluid className="mediation-chat-page-redesigned p-0">
      <Row className="g-0" style={{ height: "calc(100vh - 56px)" }}>
        <Col
          md={8}
          lg={9}
          className="chat-main-area d-flex flex-column order-md-1"
        >
          <Card className="flex-grow-1 d-flex flex-column m-0 border-0 rounded-0">
            <Card.Header className="bg-light border-bottom p-3">
              <Row className="align-items-center">
                <Col>
                  <h5 className="mb-0">
                    Mediation: {mediationDetails.product?.title || "Product"}
                  </h5>
                  <small className="text-muted">ID: {mediationRequestId}</small>
                </Col>
                <Col xs="auto" className="d-md-none">
                  <Button
                    variant="outline-info"
                    size="sm"
                    onClick={handleShowDetailsOffcanvas}
                  >
                    Details
                  </Button>
                </Col>
                <Col xs="auto">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => navigate(-1)}
                  >
                    Back
                  </Button>
                </Col>
              </Row>
            </Card.Header>
            <Card.Body
              className="chat-messages-area p-0"
              style={{ flexGrow: 1, overflowY: "auto" }}
            >
              {chatError && !isLoadingHistory && (
                <Alert variant="danger" className="m-3">
                  {chatError}
                </Alert>
              )}
              {isLoadingHistory && messages.length === 0 && !chatError && (
                <div className="text-center p-5">
                  <Spinner size="sm" /> Loading history...
                </div>
              )}
              <ListGroup variant="flush" className="p-3">
                {!isLoadingHistory && messages.length === 0 && !chatError && (
                  <ListGroup.Item className="text-center text-muted border-0 py-5">
                    No messages yet.
                  </ListGroup.Item>
                )}
                {messages.map((msg, index) => (
                  <ListGroup.Item
                    key={msg._id || `msg-${index}-${msg.timestamp}`}
                    className={`d-flex mb-2 message-item border-0 ${
                      msg.sender?._id === currentUserId ? "sent" : "received"
                    }`}
                  >
                    {renderMessageSenderAvatar(msg.sender)}
                    <div className="message-content">
                      <div className="message-bubble">
                        <strong>
                          {msg.sender?._id === currentUserId
                            ? "You"
                            : msg.sender?.fullName || "System"}
                        </strong>
                        <p className="mb-0">{msg.message}</p>
                      </div>
                      <small className="text-muted message-timestamp d-block mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                  </ListGroup.Item>
                ))}
                <div ref={messagesEndRef} />
              </ListGroup>
            </Card.Body>
            <Card.Footer className="chat-input-area bg-light border-top p-3 position-relative">
              <Form onSubmit={handleSendMessage}>
                <Row className="g-2 align-items-center">
                  <Col xs="auto">
                    <Button
                      ref={emojiButtonRef}
                      variant="light"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      title="Emoji"
                      disabled={!hasJoinedRoom || !!chatError}
                    >
                      <FaSmile />
                    </Button>
                  </Col>
                  <Col xs="auto">
                    <Button
                      variant="light"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach file"
                      disabled={!hasJoinedRoom || !!chatError}
                    >
                      <FaPaperclip />
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      onChange={handleFileSelected}
                      accept="image/*"
                    />
                  </Col>
                  <Col>
                    <Form.Control
                      type="text"
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={!hasJoinedRoom || !!chatError}
                      autoFocus
                    />
                  </Col>
                  <Col xs="auto">
                    <Button
                      type="submit"
                      disabled={
                        !newMessage.trim() || !hasJoinedRoom || !!chatError
                      }
                    >
                      <FaPaperPlane />
                      <span className="d-none d-sm-inline">Send</span>
                    </Button>
                  </Col>
                </Row>
              </Form>
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 5px)",
                    right: "10px",
                    zIndex: 1051,
                  }}
                >
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    emojiStyle="native"
                    height={320}
                    searchDisabled
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              )}
            </Card.Footer>
          </Card>
        </Col>
        <Col
          md={4}
          lg={3}
          className="chat-sidebar-area bg-light border-start p-3 d-none d-md-flex flex-column order-md-2"
        >
          <div className="flex-grow-1" style={{ overflowY: "auto" }}>
            {renderSidebarContent()}
          </div>
        </Col>
      </Row>
      <Offcanvas
        show={showDetailsOffcanvas}
        onHide={handleCloseDetailsOffcanvas}
        placement="end"
        className="d-md-none"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Details & Participants</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="d-flex flex-column">
          {renderSidebarContent()}
        </Offcanvas.Body>
      </Offcanvas>
    </Container>
  );
};

export default MediationChatPage;
