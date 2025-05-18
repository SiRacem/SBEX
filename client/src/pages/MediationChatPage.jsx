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
  Modal,
} from "react-bootstrap";
import io from "socket.io-client";
import axios from "axios";
import EmojiPicker from "emoji-picker-react";
import { FaPaperclip, FaSmile, FaPaperPlane } from "react-icons/fa";
import "./MediationChatPage.css"; // تأكد من أن هذا الملف موجود ويحتوي على الأنماط اللازمة
import TypingIndicator from "../components/chat/TypingIndicator";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const noUserAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png";
const fallbackProductImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e0e0e0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16px" fill="%23999">Error</text></svg>';

const formatCurrency = (amount, currencyCode = "TND") => {
  const num = Number(amount);
  if (isNaN(num) || amount == null) return "N/A";
  let safeCurrencyCode = currencyCode;
  if (typeof currencyCode !== "string" || currencyCode.trim() === "")
    safeCurrencyCode = "TND";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch (error) {
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};

const formatMessageTimestampForDisplay = (timestamp) => {
  const messageDate = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (messageDate >= today)
    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (messageDate >= yesterday)
    return (
      "Yesterday, " +
      messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  return (
    messageDate.toLocaleDateString([], { day: "numeric", month: "short" }) +
    ", " +
    messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

const MediationChatPage = () => {
  const { mediationRequestId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const currentUserId = useSelector((state) => state.userReducer.user?._id);
  const currentUserRole = useSelector(
    (state) => state.userReducer.user?.userRole
  );
  const currentUserFullName = useSelector(
    (state) => state.userReducer.user?.fullName
  );

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [chatError, setChatError] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const socketRef = useRef(null);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const joinTimeoutRef = useRef(null);

  const [mediationDetails, setMediationDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  const [showDetailsOffcanvas, setShowDetailsOffcanvas] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);

  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageInModal, setCurrentImageInModal] = useState(null);

  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);

  const handleShowDetailsOffcanvas = () => setShowDetailsOffcanvas(true);
  const handleCloseDetailsOffcanvas = () => setShowDetailsOffcanvas(false);

  const scrollToBottom = useCallback((options = { behavior: "smooth" }) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView(options);
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);
  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0)
      scrollToBottom({ behavior: "auto" });
  }, [isLoadingHistory, messages.length, scrollToBottom]);

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
            setChatError((prev) => prev || "Auth token missing.");
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
              prev || err.response?.data?.msg || "Failed to load history."
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
      (chatError && !isLoadingHistory && messages.length === 0)
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
      }, 200);
    });
    newSocket.on("joinedMediationChatSuccess", (data) => {
      setChatError(null);
      setHasJoinedRoom(true);
    });
    newSocket.on("newMediationMessage", (message) => {
      setMessages((prev) => {
        const exists = prev.some(
          (m) =>
            m.timestamp === message.timestamp &&
            m.sender?._id === message.sender?._id &&
            m.message === message.message &&
            m.imageUrl === message.imageUrl
        );
        if (exists) return prev;
        return [...prev, message];
      });
      if (message.sender?._id !== currentUserId) {
        setTypingUsers((prev) => {
          const updated = { ...prev };
          delete updated[message.sender._id];
          return updated;
        });
      }
    });
    newSocket.on("mediationChatError", (e) => {
      setChatError(e.message);
      setHasJoinedRoom(false);
    });
    newSocket.on("connect_error", (e) => {
      setChatError(`Socket connection failed: ${e.message}.`);
      setHasJoinedRoom(false);
    });
    newSocket.on("disconnect", (r) => {
      if (r === "io server disconnect" || r === "transport close")
        setChatError("Chat connection lost.");
      setHasJoinedRoom(false);
    });
    newSocket.on('user_typing', ({ userId, fullName, avatarUrl }) => { // <--- استقبل avatarUrl هنا
        if (userId !== currentUserId) { 
            console.log(`[Socket] User typing: ${fullName} (${userId}), Avatar: ${avatarUrl}`);
            setTypingUsers(prev => ({ 
                ...prev, 
                [userId]: { fullName, avatarUrl } // <--- خزّن avatarUrl هنا
            }));
        }
    });

    newSocket.on('user_stopped_typing', ({ userId }) => {
        if (userId !== currentUserId) {
            console.log(`[Socket] User stopped typing: ${userId}`);
            setTypingUsers(prev => {
                const updatedTypingUsers = { ...prev };
                delete updatedTypingUsers[userId];
                return updatedTypingUsers;
            });
        }
    });

    return () => {
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      if (newSocket) {
        newSocket.emit("leaveMediationChat", { mediationRequestId });
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          newSocket.emit("stop_typing", { mediationRequestId });
        }
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
    dispatch,
  ]);

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

  const handleInputChange = (e) => {
    const currentSocket = socketRef.current;
    setNewMessage(e.target.value);
    if (currentSocket?.connected && hasJoinedRoom) {
      if (!typingTimeoutRef.current && e.target.value.trim() !== "") {
        currentSocket.emit("start_typing", { mediationRequestId });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        currentSocket.emit("stop_typing", { mediationRequestId });
        typingTimeoutRef.current = null;
      }, 1500);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const currentSocket = socketRef.current;
    if (
      newMessage.trim() &&
      currentSocket?.connected &&
      currentUserId &&
      hasJoinedRoom
    ) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      currentSocket.emit("stop_typing", { mediationRequestId });
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
    let avatar = noUserAvatar;
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
          e.target.src = noUserAvatar;
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

  const onEmojiClick = (emojiData) =>
    setNewMessage((prev) => prev + emojiData.emoji);

  const handleFileSelected = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setChatError("Max 5MB.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (!file.type.startsWith("image/")) {
        setChatError("Images only.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const formData = new FormData();
      formData.append("chatImage", file);
      formData.append("mediationRequestId", mediationRequestId);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      axios
        .post(`${BACKEND_URL}/mediation/chat/upload-image`, formData, config)
        .then((response) =>
          console.log("Image uploaded, server should broadcast:", response.data)
        )
        .catch((err) =>
          setChatError(err.response?.data?.msg || "Failed to upload image.")
        )
        .finally(() => {
          if (fileInputRef.current) fileInputRef.current.value = "";
        });
    }
  };

  const handleShowImageInModal = (imageUrl) => {
    setCurrentImageInModal(imageUrl);
    setShowImageModal(true);
  };
  const handleCloseImageModal = () => setShowImageModal(false);
  const handleImageErrorInModal = useCallback((e) => {
    if (e.target.src !== fallbackProductImageUrl) {
      e.target.onerror = null;
      e.target.src = fallbackProductImageUrl;
    }
  }, []);

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
            <strong>Agreed Price:</strong>{" "}
            {formatCurrency(
              mediationDetails.bidAmount,
              mediationDetails.bidCurrency
            )}
          </p>
          <p className="mb-1">
            <strong>Escrowed:</strong>{" "}
            {mediationDetails.escrowedAmount
              ? formatCurrency(
                  mediationDetails.escrowedAmount,
                  mediationDetails.escrowedCurrency
                )
              : "Not yet"}
          </p>
          <p className="mb-1">
            <strong>Mediator Fee:</strong>{" "}
            {formatCurrency(
              mediationDetails.calculatedMediatorFee,
              mediationDetails.mediationFeeCurrency
            )}
          </p>
          <p className="mb-1">
            <strong>Status:</strong>{" "}
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
  if (!mediationDetails && !loadingDetails && !chatError)
    return (
      <Container className="py-5">
        <Alert variant="warning">Details not found.</Alert>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </Container>
    );

  const currentlyTypingNames = Object.values(typingUsers).filter(
    (name) => name !== currentUserFullName
  );

  return (
    <Container fluid className="mediation-chat-page-redesigned p-0">
      <Row className="g-0 main-chat-layout">
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
              ref={chatContainerRef}
              className="chat-messages-area p-0"
            >
              {chatError && (
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
                {messages.map((msg, index) => {
                  const previousMessage = messages[index - 1];
                  const showAvatar =
                    !previousMessage ||
                    previousMessage.sender?._id !== msg.sender?._id;
                  return (
                    <ListGroup.Item
                      key={msg._id || `msg-${index}-${msg.timestamp}`}
                      className={`d-flex mb-1 message-item border-0 ${
                        msg.sender?._id === currentUserId ? "sent" : "received"
                      } ${showAvatar ? "" : "no-avatar"}`}
                    >
                      <div
                        className="avatar-container me-2 flex-shrink-0"
                        style={{ width: "40px", height: "40px" }}
                      >
                        {showAvatar && renderMessageSenderAvatar(msg.sender)}
                      </div>
                      <div className="message-content">
                        <div className="message-bubble">
                          {showAvatar && msg.sender?._id !== currentUserId && (
                            <strong>{msg.sender?.fullName || "System"}</strong>
                          )}
                          {msg.type === "image" && msg.imageUrl ? (
                            <Image
                              src={`${BACKEND_URL}/${msg.imageUrl}`}
                              alt={msg.message || "Chat image"}
                              fluid
                              className="mt-1 chat-image-preview"
                              style={{
                                maxHeight: "200px",
                                borderRadius: "8px",
                                cursor: "pointer",
                                objectFit: "contain",
                              }}
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                              onClick={() =>
                                handleShowImageInModal(
                                  `${BACKEND_URL}/${msg.imageUrl}`
                                )
                              }
                            />
                          ) : (
                            <p className="mb-0">{msg.message}</p>
                          )}
                        </div>
                        <small className="text-muted message-timestamp d-block mt-1">
                          {formatMessageTimestampForDisplay(msg.timestamp)}
                        </small>
                      </div>
                    </ListGroup.Item>
                  );
                })}
                <div ref={messagesEndRef} />
              </ListGroup>
            </Card.Body>
            <Card.Footer className="chat-input-area bg-light border-top p-3 position-relative">
              <div
                className="typing-indicator-area mb-1"
                style={{
                  height: "20px",
                  fontSize: "0.8rem",
                  color: "#6c757d",
                  fontStyle: "italic",
                }}
              >
                <TypingIndicator
                  typingUsers={typingUsers}
                  currentUserId={currentUserId}
                />
              </div>
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
                      onChange={handleInputChange}
                      disabled={!hasJoinedRoom || !!chatError}
                      autoFocus
                      onFocus={() => setShowEmojiPicker(false)}
                    />
                  </Col>
                  <Col xs="auto">
                    <Button
                      type="submit"
                      disabled={
                        !newMessage.trim() || !hasJoinedRoom || !!chatError
                      }
                    >
                      <FaPaperPlane />{" "}
                      <span className="d-none d-sm-inline">Send</span>
                    </Button>
                  </Col>
                </Row>
              </Form>
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="emoji-picker-container"
                  style={{ bottom: "calc(100% + 10px)", right: "10px" }}
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
          <div className="flex-grow-1 sidebar-scrollable-content">
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

      <Modal
        show={showImageModal}
        onHide={handleCloseImageModal}
        centered
        size="lg"
        dialogClassName="lightbox-modal"
      >
        <Modal.Body className="p-0 text-center bg-dark position-relative">
          {currentImageInModal && (
            <Image
              src={currentImageInModal}
              fluid
              style={{ maxHeight: "90vh", objectFit: "contain" }}
              alt="Full size view"
              onError={handleImageErrorInModal}
            />
          )}
          <Button
            variant="light"
            onClick={handleCloseImageModal}
            className="position-absolute top-0 end-0 m-2"
            aria-label="Close"
            style={{ zIndex: 1056 }}
          >
            ×
          </Button>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default MediationChatPage;
