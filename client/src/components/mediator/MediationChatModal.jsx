// client/src/components/mediation/MediationChatModal.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Modal,
  Button,
  Form,
  ListGroup,
  Image,
  Spinner,
  Alert,
  Badge,
} from "react-bootstrap";
import { useSelector } from "react-redux";
import { FaPaperPlane, FaUserCircle } from "react-icons/fa";
import { io } from "socket.io-client"; // استيراد مكتبة العميل
import axios from "axios"; // لجلب سجل المحادثة
import "./MediationChatModal.css"; // ملف CSS اختياري للتنسيق

const noAvatarUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23cccccc"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40px" fill="%23ffffff">?</text></svg>';

const MediationChatModal = ({
  show,
  onHide,
  mediationRequest,
  productTitle,
}) => {
  const currentUser = useSelector((state) => state.userReducer.user);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null); // للـ auto-scroll

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]); // تمرير messages كاعتمادية

  // إعداد اتصال Socket.IO عند عرض المودال
  useEffect(() => {
    if (show && mediationRequest?._id && currentUser?._id) {
      // الاتصال بالخادم (تأكد من أن الـ URL صحيح)
      // إذا كان socket.io يعمل على نفس منفذ الـ backend الرئيسي
      socketRef.current = io(
        process.env.REACT_APP_SOCKET_URL || "http://localhost:8000",
        {
          // يمكنك إضافة خيارات هنا مثل auth مع التوكن إذا كنت قد أعددت ذلك في الخادم
          // query: { token: localStorage.getItem('token') } // مثال
        }
      );

      socketRef.current.on("connect", () => {
        console.log("Socket connected for chat:", socketRef.current.id);
        setIsConnected(true);
        // مهم: إرسال addUser لربط socket.id بـ userId في الخادم
        socketRef.current.emit("addUser", currentUser._id);

        // الانضمام إلى غرفة المحادثة
        console.log(`Attempting to join room: ${mediationRequest._id}`);
        setIsJoiningRoom(true);
        socketRef.current.emit("joinMediationChat", {
          mediationRequestId: mediationRequest._id,
          userRole: currentUser.userRole, // يمكنك تمرير الدور إذا أردت
        });
      });

      socketRef.current.on(
        "joinedMediationChatSuccess",
        ({ mediationRequestId: joinedRoomId }) => {
          console.log(`Successfully joined chat room: ${joinedRoomId}`);
          setIsJoiningRoom(false);
          setChatError(null);
          // جلب سجل المحادثة بعد الانضمام بنجاح
          fetchChatHistory();
        }
      );

      socketRef.current.on("newMediationMessage", (receivedMessage) => {
        console.log("New message received:", receivedMessage);
        setMessages((prevMessages) => [...prevMessages, receivedMessage]);
      });

      socketRef.current.on("mediationChatError", (error) => {
        console.error("Mediation Chat Error from server:", error.message);
        setChatError(error.message || "A chat error occurred.");
        setIsJoiningRoom(false);
      });

      socketRef.current.on("disconnect", () => {
        console.log("Socket disconnected for chat");
        setIsConnected(false);
        setIsJoiningRoom(false);
      });

      return () => {
        // Cleanup عند إغلاق المودال أو تغيير الطلب
        if (socketRef.current) {
          console.log(
            `Leaving room: ${mediationRequest._id} and disconnecting socket.`
          );
          socketRef.current.emit("leaveMediationChat", {
            mediationRequestId: mediationRequest._id,
          });
          socketRef.current.disconnect();
          socketRef.current = null;
          setIsConnected(false);
          setIsJoiningRoom(false);
        }
      };
    } else {
      // إذا تم إغلاق المودال أو لم تكن البيانات جاهزة، تأكد من قطع الاتصال
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setIsJoiningRoom(false);
      }
    }
  }, [show, mediationRequest?._id, currentUser?._id]); // إعادة الاتصال إذا تغير الطلب أو المستخدم

  const fetchChatHistory = async () => {
    if (!mediationRequest?._id) return;
    setLoadingHistory(true);
    setChatError(null);
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      // تأكد أن مسار API صحيح
      const { data } = await axios.get(
        `/api/mediation/chat/${mediationRequest._id}/history`,
        config
      );
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch chat history:", error);
      setChatError(error.response?.data?.msg || "Failed to load chat history.");
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (
      !newMessage.trim() ||
      !socketRef.current ||
      !isConnected ||
      !mediationRequest?._id
    ) {
      if (!isConnected) setChatError("Not connected to chat server.");
      return;
    }
    if (newMessage.length > 500) {
      // حد أقصى لطول الرسالة (اختياري)
      setChatError("Message is too long (max 500 characters).");
      return;
    }

    socketRef.current.emit("sendMediationMessage", {
      mediationRequestId: mediationRequest._id,
      messageText: newMessage.trim(),
    });
    // (اختياري) تحديث متفائل للرسائل
    // const optimisticMessage = {
    //     _id: Date.now().toString(), // ID مؤقت
    //     sender: { _id: currentUser._id, fullName: currentUser.fullName, avatarUrl: currentUser.avatarUrl },
    //     message: newMessage.trim(),
    //     timestamp: new Date().toISOString()
    // };
    // setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage("");
    setChatError(null);
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      dialogClassName="mediation-chat-modal"
      backdrop="static"
      keyboard={false}
    >
      <Modal.Header closeButton={!isJoiningRoom}>
        <Modal.Title>
          Mediation Chat:{" "}
          {productTitle || mediationRequest?.product?.title || "Transaction"}
          {isJoiningRoom && (
            <Spinner
              animation="border"
              size="sm"
              className="ms-2"
              variant="primary"
            />
          )}
          {!isJoiningRoom && !isConnected && (
            <Badge bg="danger" className="ms-2">
              Disconnected
            </Badge>
          )}
          {!isJoiningRoom && isConnected && (
            <Badge bg="success" className="ms-2">
              Connected
            </Badge>
          )}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="chat-body">
        {chatError && (
          <Alert
            variant="danger"
            onClose={() => setChatError(null)}
            dismissible
          >
            {chatError}
          </Alert>
        )}
        {loadingHistory ? (
          <div className="text-center my-5">
            <Spinner animation="border" /> Loading history...
          </div>
        ) : messages.length === 0 && !chatError ? (
          <div className="text-center text-muted py-4">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <ListGroup variant="flush" className="message-list">
            {messages.map((msg, index) => (
              <ListGroup.Item
                key={msg._id || `msg-${index}`}
                className={`d-flex message-item ${
                  msg.sender?._id === currentUser?._id ? "sent" : "received"
                }`}
              >
                <Image
                  src={msg.sender?.avatarUrl || noAvatarUrl}
                  roundedCircle
                  className="chat-avatar me-2"
                  alt={msg.sender?.fullName || "User"}
                />
                <div className="message-content">
                  <div className="message-sender-name">
                    <strong>
                      {msg.sender?._id === currentUser?._id
                        ? "You"
                        : msg.sender?.fullName || "Unknown User"}
                    </strong>
                    <small className="text-muted ms-2 timestamp">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                  <div className="message-text">{msg.message}</div>
                </div>
              </ListGroup.Item>
            ))}
            <div ref={messagesEndRef} /> {/* عنصر فارغ للـ scroll to bottom */}
          </ListGroup>
        )}
      </Modal.Body>
      <Modal.Footer className="chat-footer">
        <Form onSubmit={handleSendMessage} className="w-100 d-flex">
          <Form.Control
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={!isConnected || isJoiningRoom || loadingHistory}
            maxLength={500}
          />
          <Button
            variant="primary"
            type="submit"
            disabled={
              !isConnected ||
              isJoiningRoom ||
              loadingHistory ||
              !newMessage.trim()
            }
            className="ms-2"
          >
            <FaPaperPlane /> Send
          </Button>
        </Form>
      </Modal.Footer>
    </Modal>
  );
};

export default MediationChatModal;
