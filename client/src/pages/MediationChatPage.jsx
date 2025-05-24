// src/pages/MediationChatPage.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  useContext,
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
  Tooltip,
  OverlayTrigger,
} from "react-bootstrap";
import axios from "axios";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";
import {
  FaPaperclip,
  FaSmile,
  FaPaperPlane,
  FaCheck,
  FaCrown, // أيقونة للتاج (اختياري)
  FaShieldAlt, // أيقونة للدرع (اختياري)
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  buyerConfirmReceipt,
  openDisputeAction,
  // ستحتاج لإنشاء هذا الـ action لاحقًا
  // adminResolveDisputeAction,
} from "../redux/actions/mediationAction";
import { SocketContext } from "../App";
import "./MediationChatPage.css";

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
    console.warn(`Currency formatting error for ${safeCurrencyCode}:`, error);
    return `${num.toFixed(2)} ${safeCurrencyCode}`;
  }
};

const formatMessageTimestampForDisplay = (timestamp) => {
  if (!timestamp) return "";
  const messageDate = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.toDateString() === today.toDateString()) {
    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (messageDate.toDateString() === yesterday.toDateString()) {
    return (
      "Yesterday, " +
      messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }
  if (now.getFullYear() === messageDate.getFullYear()) {
    return (
      messageDate.toLocaleDateString([], { month: "short", day: "numeric" }) +
      ", " +
      messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }
  return (
    messageDate.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    ", " +
    messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

const TypingIndicator = ({ typingUsersData, currentUserId }) => {
  const otherTypingUsers = Object.values(typingUsersData).filter(
    (user) => user && user.id !== currentUserId && user.fullName
  );

  if (otherTypingUsers.length === 0) {
    return (
      <div
        className="typing-indicator-area-placeholder mb-1"
        style={{ height: "20px" }}
      ></div>
    );
  }

  return (
    <div className="typing-indicator-area mb-1">
      {otherTypingUsers.slice(0, 2).map((user, index) => (
        <React.Fragment key={user.id}>
          <Image
            src={
              user.avatarUrl && !user.avatarUrl.startsWith("http")
                ? `${BACKEND_URL}/${user.avatarUrl}`
                : user.avatarUrl || noUserAvatar
            }
            roundedCircle
            width={18}
            height={18}
            className="me-1 typing-avatar-indicator"
            alt={user.fullName}
            onError={(e) => {
              e.target.src = noUserAvatar;
            }}
          />
          <span className="typing-user-name-indicator me-1">
            {user.fullName}
          </span>
          {index < otherTypingUsers.slice(0, 2).length - 1 && (
            <span className="mx-1">,</span>
          )}
        </React.Fragment>
      ))}
      {otherTypingUsers.length > 2 && (
        <span className="mx-1">and {otherTypingUsers.length - 2} other(s)</span>
      )}
      <span className="is-typing-text-indicator mx-1">
        {otherTypingUsers.length > 1 ? "are" : "is"}
      </span>
      <div className="typing-dots-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
};

const MediationChatPage = () => {
  const { mediationRequestId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const socket = useContext(SocketContext);
  const currentUserId = useSelector((state) => state.userReducer.user?._id);
  const currentUserRole = useSelector(
    (state) => state.userReducer.user?.userRole
  );
  const onlineUserIds = useSelector(
    (state) => state.userReducer?.onlineUserIds || []
  );

  console.log(
    "INITIAL RENDER - currentUserId:",
    currentUserId,
    "currentUserRole:",
    currentUserRole
  );

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [chatError, setChatError] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
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
  const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
  const [isOpeningDispute, setIsOpeningDispute] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState(""); // للأدمن

  const handleShowDetailsOffcanvas = () => setShowDetailsOffcanvas(true);
  const handleCloseDetailsOffcanvas = () => setShowDetailsOffcanvas(false);

  const scrollToBottom = useCallback((options = { behavior: "smooth" }) => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView(options), 100);
  }, []);

  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0) {
      scrollToBottom({ behavior: "smooth" });
    }
  }, [messages, isLoadingHistory, scrollToBottom]);

  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0) {
      scrollToBottom({ behavior: "auto" });
    }
  }, [isLoadingHistory, messages.length, scrollToBottom]);

  const markVisibleMessagesAsReadCallback = useCallback(() => {
    if (
      socket?.connected &&
      hasJoinedRoom &&
      messages.length > 0 &&
      document.visibilityState === "visible" &&
      currentUserId &&
      mediationRequestId
    ) {
      const unreadReceivedMessageIds = messages
        .filter(
          (msg) =>
            msg.sender?._id !== currentUserId &&
            (!msg.readBy ||
              !msg.readBy.some((r) => r.readerId === currentUserId))
        )
        .map((msg) => msg._id)
        .filter((id) => id);
      if (unreadReceivedMessageIds.length > 0) {
        socket.emit("mark_messages_read", {
          mediationRequestId,
          messageIds: unreadReceivedMessageIds,
          readerUserId: currentUserId,
        });
      }
    }
  }, [messages, currentUserId, mediationRequestId, hasJoinedRoom, socket]);

  useEffect(() => {
    document.addEventListener(
      "visibilitychange",
      markVisibleMessagesAsReadCallback
    );
    window.addEventListener("focus", markVisibleMessagesAsReadCallback);
    if (document.visibilityState === "visible")
      markVisibleMessagesAsReadCallback();
    return () => {
      document.removeEventListener(
        "visibilitychange",
        markVisibleMessagesAsReadCallback
      );
      window.removeEventListener("focus", markVisibleMessagesAsReadCallback);
    };
  }, [markVisibleMessagesAsReadCallback]);

  useEffect(() => {
    console.log(
      "[MediationChatPage] User Info - ID:",
      currentUserId,
      "Role:",
      currentUserRole
    );
    if (mediationRequestId && currentUserId) {
      const fetchMediationDetails = async () => {
        setLoadingDetails(true);
        setChatError(null);
        try {
          const token = localStorage.getItem("token");
          if (!token) throw new Error("Authentication required.");
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
      fetchChatHistory();
      fetchMediationDetails();
    }
  }, [mediationRequestId, currentUserId, currentUserRole]); // currentUserRole مضاف للـ dependencies

  const fetchChatHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication token missing.");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(
        `${BACKEND_URL}/mediation/chat/${mediationRequestId}/history`,
        config
      );
      setMessages(response.data || []);
      if (!chatError && response.data) setChatError(null);
    } catch (err) {
      setChatError(err.response?.data?.msg || "Failed to load chat history.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (
      !socket ||
      !currentUserId ||
      !mediationRequestId ||
      loadingDetails ||
      !mediationDetails
    )
      return;

    const handleConnect = () => {
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = setTimeout(() => {
        if (socket.connected) {
          socket.emit("joinMediationChat", {
            mediationRequestId,
            userId: currentUserId,
            userRole: currentUserRole,
          });
        }
      }, 300);
    };

    const handleJoinedSuccess = (data) => {
      setHasJoinedRoom(true);
      setChatError(null);
      markVisibleMessagesAsReadCallback();
    };

    const handleNewMessage = (message) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === message._id)) return prev;
        const newMessages = [...prev, message];
        if (
          message.sender?._id !== currentUserId &&
          socket.connected &&
          document.visibilityState === "visible" &&
          message._id
        ) {
          socket.emit("mark_messages_read", {
            mediationRequestId,
            messageIds: [message._id],
            readerUserId: currentUserId,
          });
        }
        return newMessages;
      });

      if (message.sender && message.sender._id) {
        // تحقق من وجود المرسل ومعرّفه
        setTypingUsers((prevTypingUsers) => {
          // تحقق مما إذا كان مرسل الرسالة موجودًا حاليًا في قائمة المستخدمين الذين يكتبون
          if (prevTypingUsers.hasOwnProperty(message.sender._id)) {
            const updatedTypingUsers = { ...prevTypingUsers };
            delete updatedTypingUsers[message.sender._id];
            return updatedTypingUsers;
          }
          // إذا لم يكن المستخدم يكتب بالفعل، أعد الحالة السابقة بدون تغيير
          return prevTypingUsers;
        });
      }
      // --- END OF FIX ---
    };

    const handleMessagesStatusUpdated = ({
      mediationRequestId: updatedMedId,
      updatedMessages,
    }) => {
      if (updatedMedId === mediationRequestId) {
        setMessages((prev) =>
          prev.map((msg) => {
            const updatedMsg = updatedMessages.find(
              (uMsg) => uMsg._id === msg._id
            );
            return updatedMsg ? { ...msg, readBy: updatedMsg.readBy } : msg;
          })
        );
      }
    };
    const handleMediationDetailsUpdated = ({
      mediationRequestId: updatedMedId,
      updatedMediationDetails,
    }) => {
      if (updatedMedId === mediationRequestId) {
        setMediationDetails(updatedMediationDetails);
      }
    };
    const handleChatError = (errorEvent) => {
      setChatError(errorEvent.message || "Chat error occurred.");
      setHasJoinedRoom(false);
    };
    const handleDisconnect = (reason) => {
      setChatError("Chat connection lost.");
      setHasJoinedRoom(false);
      setTypingUsers({});
    };
    const handleUserTyping = ({ userId, fullName, avatarUrl }) => {
      if (userId !== currentUserId) {
        setTypingUsers((prev) => ({
          ...prev,
          [userId]: { id: userId, fullName, avatarUrl },
        }));
      }
    };
    const handleUserStoppedTyping = ({ userId }) => {
      if (userId !== currentUserId) {
        setTypingUsers((prev) => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
      }
    };

    socket.on("connect", handleConnect);
    socket.on("joinedMediationChatSuccess", handleJoinedSuccess);
    socket.on("newMediationMessage", handleNewMessage);
    socket.on("messages_status_updated", handleMessagesStatusUpdated);
    socket.on("mediation_details_updated", handleMediationDetailsUpdated);
    socket.on("mediationChatError", handleChatError);
    socket.on("disconnect", handleDisconnect);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);

    if (socket.connected) handleConnect();

    return () => {
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      if (socket && socket.connected && mediationRequestId) {
        socket.emit("leaveMediationChat", { mediationRequestId });
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          socket.emit("stop_typing", { mediationRequestId });
          typingTimeoutRef.current = null;
        }
      }
      socket.off("connect", handleConnect);
      socket.off("joinedMediationChatSuccess", handleJoinedSuccess);
      socket.off("newMediationMessage", handleNewMessage);
      socket.off("messages_status_updated", handleMessagesStatusUpdated);
      socket.off("mediation_details_updated", handleMediationDetailsUpdated);
      socket.off("mediationChatError", handleChatError);
      socket.off("disconnect", handleDisconnect);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stopped_typing", handleUserStoppedTyping);
    };
  }, [
    socket,
    mediationRequestId,
    currentUserId,
    currentUserRole,
    loadingDetails,
    mediationDetails?._id,
    markVisibleMessagesAsReadCallback,
  ]); // markVisibleMessagesAsReadCallback مضاف

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (socket?.connected && hasJoinedRoom && mediationRequestId) {
      if (!typingTimeoutRef.current && e.target.value.trim() !== "") {
        socket.emit("start_typing", { mediationRequestId });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socket?.connected) {
          socket.emit("stop_typing", { mediationRequestId });
          typingTimeoutRef.current = null;
        }
      }, 1500);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (
      newMessage.trim() &&
      socket?.connected &&
      currentUserId &&
      hasJoinedRoom &&
      mediationRequestId
    ) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        socket.emit("stop_typing", { mediationRequestId });
      }
      socket.emit("sendMediationMessage", {
        mediationRequestId,
        messageText: newMessage.trim(),
      });
      setNewMessage("");
      setShowEmojiPicker(false);
    } else {
      setChatError("Cannot send message. Check connection or chat status.");
    }
  };

  const renderMessageSenderAvatar = (sender, size = 40) => {
    let avatar = noUserAvatar;
    if (sender?.avatarUrl) {
      avatar = sender.avatarUrl.startsWith("http")
        ? sender.avatarUrl
        : `${BACKEND_URL}/${sender.avatarUrl}`;
    }
    const isAdmin =
      sender?.userRole === "Admin" ||
      sender?.roleLabel?.toLowerCase().includes("admin");
    return (
      <div className="position-relative">
        <Image
          src={avatar}
          roundedCircle
          width={size}
          height={size}
          className={`me-2 flex-shrink-0 ${
            isAdmin ? "admin-avatar-highlight" : ""
          }`}
          alt={sender?.fullName || "User"}
          onError={(e) => {
            e.target.src = noUserAvatar;
          }}
        />
        {isAdmin && (
          <FaCrown
            className="admin-crown-icon"
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              color: "gold",
              backgroundColor: "rgba(0,0,0,0.5)",
              borderRadius: "50%",
              padding: "2px",
              fontSize: size * 0.4,
            }}
            title="Admin"
          />
        )}
      </div>
    );
  };

  const handleImageUpload = async (fileToUpload) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Authentication required to upload image.");
      return;
    }
    const formData = new FormData();
    formData.append("image", fileToUpload);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/mediation/chat/upload-image`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { imageUrl } = response.data;
      if (imageUrl) {
        socket.emit("sendMediationMessage", { mediationRequestId, imageUrl });
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.msg || "Failed to upload image.";
      toast.error(errorMessage);
    }
  };

  const participants = useMemo(() => {
    if (!mediationDetails) return [];
    const parts = [];
    if (mediationDetails.seller)
      parts.push({
        ...mediationDetails.seller,
        roleLabel: "Seller",
        id: mediationDetails.seller._id?.toString(),
      });
    if (mediationDetails.buyer)
      parts.push({
        ...mediationDetails.buyer,
        roleLabel: "Buyer",
        id: mediationDetails.buyer._id?.toString(),
      });
    if (mediationDetails.mediator)
      parts.push({
        ...mediationDetails.mediator,
        roleLabel: "Mediator",
        id: mediationDetails.mediator._id?.toString(),
      });
    if (
      mediationDetails.disputeOverseers &&
      Array.isArray(mediationDetails.disputeOverseers)
    ) {
      mediationDetails.disputeOverseers.forEach((admin) => {
        if (!parts.some((p) => p.id === admin._id?.toString())) {
          parts.push({
            ...admin,
            roleLabel: admin.userRole || "Admin",
            id: admin._id?.toString(),
            isOverseer: true,
          });
        }
      });
    }
    return parts;
  }, [mediationDetails]);

  const otherParticipants = useMemo(() => {
    if (!currentUserId) return [];
    return participants.filter((p) => p.id !== currentUserId.toString());
  }, [participants, currentUserId]);

  const messageReadIndicators = useMemo(() => {
    // شرط خروج مبكر إذا لم تكن هناك بيانات كافية
    if (
      !currentUserId ||
      !messages ||
      messages.length === 0 ||
      !otherParticipants ||
      otherParticipants.length === 0
    ) {
      return {};
    }

    const indicators = {};

    otherParticipants.forEach((participant) => {
      // تحقق من أن المشارك صالح ولديه ID
      if (!participant || !participant.id) {
        console.warn(
          "[messageReadIndicators] Skipping an invalid participant in otherParticipants:",
          participant
        );
        return; // انتقل للمشارك التالي إذا كان هذا المشارك غير صالح
      }

      let lastReadByThisParticipantMessageId = null;

      // المرور على الرسائل من الأحدث إلى الأقدم
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];

        // تحقق من أن الرسالة ومُرسِلها وبيانات القراءة موجودة وصحيحة
        if (
          m && // الرسالة موجودة
          m.sender && // مُرسِل الرسالة موجود
          m.sender._id && // مُرسِل الرسالة لديه _id
          m.sender._id.toString() === currentUserId.toString() && // الرسالة أُرسلت بواسطة المستخدم الحالي
          m.readBy && // مصفوفة readBy موجودة
          Array.isArray(m.readBy) && // هي مصفوفة بالفعل
          m.readBy.some(
            (
              rb // تحقق من كل قارئ
            ) =>
              rb && // كائن القارئ (rb) موجود
              rb.readerId && // القارئ لديه readerId
              rb.readerId.toString() === participant.id.toString() // هل هذا القارئ هو المشارك الحالي من otherParticipants
          )
        ) {
          lastReadByThisParticipantMessageId = m._id;
          break; // وجدنا آخر رسالة قرأها هذا المشارك
        }
      }

      if (lastReadByThisParticipantMessageId) {
        if (!indicators[lastReadByThisParticipantMessageId]) {
          indicators[lastReadByThisParticipantMessageId] = [];
        }

        const messageWithReadEntry = messages.find(
          (msg) => msg && msg._id === lastReadByThisParticipantMessageId
        );

        if (
          messageWithReadEntry &&
          messageWithReadEntry.readBy &&
          Array.isArray(messageWithReadEntry.readBy)
        ) {
          const readerEntry = messageWithReadEntry.readBy.find(
            (rb) =>
              rb &&
              rb.readerId &&
              rb.readerId.toString() === participant.id.toString()
          );

          if (readerEntry) {
            indicators[lastReadByThisParticipantMessageId].push({
              readerId: participant.id,
              fullName: readerEntry.fullName || participant.fullName || "User",
              avatarUrl: readerEntry.avatarUrl || participant.avatarUrl,
              readAt: readerEntry.readAt,
            });
          } else {
            console.warn(
              `[messageReadIndicators] Could not find readerEntry for participant ${participant.id} in message ${lastReadByThisParticipantMessageId}`
            );
          }
        } else {
          console.warn(
            `[messageReadIndicators] Could not find messageWithReadEntry or its readBy array for message ${lastReadByThisParticipantMessageId}`
          );
        }
      }
    });
    console.log("[messageReadIndicators] Calculated indicators:", indicators); // يمكنك تفعيل هذا للـ debugging
    return indicators;
  }, [messages, currentUserId, otherParticipants]);

  const isDisputed = useMemo(
    () => mediationDetails?.status === "Disputed",
    [mediationDetails?.status]
  );
  const isChatActuallyActiveForInput = useMemo(
    () =>
      mediationDetails?.status === "InProgress" ||
      mediationDetails?.status === "Disputed",
    [mediationDetails?.status]
  );

  const onEmojiClick = (emojiData) =>
    setNewMessage((prev) => prev + emojiData.emoji);

  const handleShowImageInModal = (imageUrl) => {
    if (imageUrl) {
      setCurrentImageInModal(imageUrl);
      setShowImageModal(true);
    } else {
      toast.error("Could not load image for preview.");
    }
  };
  const handleCloseImageModal = () => setShowImageModal(false);
  const handleImageErrorInModal = useCallback(
    (e) => {
      toast.error("Failed to load full-size image.");
      if (e.target.src !== fallbackProductImageUrl) {
        e.target.onerror = null;
        e.target.src = fallbackProductImageUrl;
      }
    },
    [fallbackProductImageUrl]
  );

  const handleConfirmReceipt = useCallback(async () => {
    if (!mediationDetails?._id || isConfirmingReceipt) return;
    if (
      window.confirm(
        "Are you sure you have received the product/service and wish to release funds? This action cannot be undone."
      )
    ) {
      setIsConfirmingReceipt(true);
      try {
        await dispatch(buyerConfirmReceipt(mediationDetails._id));
        toast.success("Receipt confirmed! Funds will be released.");
        // Re-fetch details can be handled by socket event 'mediation_details_updated'
      } catch (error) {
        console.error("Error confirming receipt:", error);
      } finally {
        setIsConfirmingReceipt(false);
      }
    }
  }, [dispatch, mediationDetails?._id, isConfirmingReceipt]);

  const handleOpenDispute = useCallback(async () => {
    if (
      !mediationDetails?._id ||
      isOpeningDispute ||
      mediationDetails.status !== "InProgress"
    )
      return;
    if (
      window.confirm(
        "Are you sure you want to open a dispute? This will involve a mediator/admin."
      )
    ) {
      setIsOpeningDispute(true);
      try {
        await dispatch(openDisputeAction(mediationDetails._id));
        toast.info(
          "A dispute has been opened. A mediator/admin will review the case."
        );
      } catch (error) {
        console.error("Error opening dispute:", error);
      } finally {
        setIsOpeningDispute(false);
      }
    }
  }, [
    dispatch,
    mediationDetails?._id,
    mediationDetails?.status,
    isOpeningDispute,
  ]);

  // --- Admin Action Handlers (Placeholders) ---
  const handleResolveDispute = async (winner) => {
    if (
      !mediationDetails?._id ||
      mediationDetails.status !== "Disputed" ||
      currentUserRole !== "Admin"
    ) {
      toast.warn("Action not allowed or not in correct state.");
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to rule in favor of the ${winner}? Resolution notes: "${resolutionNotes}". This action is final.`
      )
    ) {
      return;
    }
    console.log(
      `Admin resolving dispute. Winner: ${winner}, Notes: ${resolutionNotes}, Mediation ID: ${mediationDetails._id}`
    );
    // TODO: Dispatch an action like adminResolveDisputeAction(mediationDetails._id, winner, resolutionNotes)
    // This action will call the backend API to finalize the dispute.
    toast.info(
      `Dispute resolution process for ${winner} initiated (Backend logic to be implemented).`
    );
    // Example: dispatch(adminResolveDisputeAction(mediationDetails._id, winner, resolutionNotes));
  };

  const handleCancelMediationByAdmin = async () => {
    if (
      !mediationDetails?._id ||
      mediationDetails.status !== "Disputed" ||
      currentUserRole !== "Admin"
    ) {
      toast.warn("Action not allowed or not in correct state.");
      return;
    }
    if (
      !window.confirm(
        "Are you sure you want to cancel this mediation? This is a drastic measure."
      )
    ) {
      return;
    }
    console.log(
      `Admin cancelling mediation. Mediation ID: ${mediationDetails._id}, Notes: ${resolutionNotes}`
    );
    // TODO: Dispatch an action like adminCancelMediationAction(mediationDetails._id, resolutionNotes)
    toast.info(
      "Mediation cancellation process initiated (Backend logic to be implemented)."
    );
  };

  const renderSidebarContent = () => (
    <>
      <h5 className="mb-3">Participants</h5>
      <ListGroup variant="flush" className="mb-4 participant-list">
        {participants.map((p) => {
          const isOnline = onlineUserIds.includes(p.id?.toString());
          const isAdminParticipant =
            p.roleLabel === "Admin" ||
            (p.isOverseer && p.roleLabel?.toLowerCase().includes("admin"));
          return (
            <ListGroup.Item
              key={p.id || p._id}
              className={`d-flex align-items-center bg-transparent border-0 px-0 py-2 participant-item ${
                isAdminParticipant ? "admin-participant" : ""
              }`}
            >
              <div className="position-relative me-2">
                {renderMessageSenderAvatar(p, 30)}
                {isAdminParticipant && (
                  <Badge
                    pill
                    bg="primary"
                    className="admin-badge position-absolute bottom-0 end-0"
                    style={{
                      transform: "translate(25%, 25%)",
                      fontSize: "0.6rem",
                      border: "1.5px solid white",
                    }}
                  >
                    <FaShieldAlt /> {/* أو FaCrown */}
                  </Badge>
                )}
                <span
                  className={`online-status-indicator-small ${
                    isOnline ? "online" : "offline"
                  }`}
                  title={isOnline ? "Online" : "Offline"}
                ></span>
              </div>
              <div>
                <div
                  className={`fw-bold ${
                    isAdminParticipant ? "text-primary" : ""
                  }`}
                >
                  {p.fullName}
                </div>
                <small className="text-muted">
                  {isAdminParticipant ? (
                    <strong>{p.roleLabel}</strong>
                  ) : (
                    p.roleLabel
                  )}
                </small>
              </div>
            </ListGroup.Item>
          );
        })}
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
            <Badge
              bg={
                mediationDetails.status === "InProgress"
                  ? "success"
                  : isDisputed
                  ? "danger"
                  : "info"
              }
            >
              {mediationDetails.status}
            </Badge>
          </p>
        </div>
      ) : (
        <p>Loading transaction details...</p>
      )}

      {/* Admin Dispute Controls */}
      {currentUserRole === "Admin" && isDisputed && (
        <div className="admin-dispute-tools mt-4 pt-3 border-top">
          <h5 className="mb-3 text-danger">Admin Dispute Controls</h5>
          {/* Placeholder for private chat button
            <Button variant="outline-info" size="sm" className="w-100 mb-3" onClick={() => toast.info("Private chat feature: To be implemented")}>
                <FaCommentDots /> Private Chat with Party (TBI)
            </Button>
            */}
          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold">
              Resolution Notes (Visible to parties):
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Explain the decision rationale here..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
            />
          </Form.Group>
          <p className="text-muted small mb-1">Decision:</p>
          <div className="d-grid gap-2">
            <Button
              variant="success"
              onClick={() => handleResolveDispute("buyer")}
              disabled={
                mediationDetails?.status !== "Disputed" ||
                !resolutionNotes.trim()
              }
            >
              Rule in Favor of Buyer
            </Button>
            <Button
              variant="warning"
              onClick={() => handleResolveDispute("seller")}
              disabled={
                mediationDetails?.status !== "Disputed" ||
                !resolutionNotes.trim()
              }
            >
              Rule in Favor of Seller
            </Button>
            {/* 
                <Button variant="secondary" onClick={() => handleResolveDispute('custom')} disabled={mediationDetails?.status !== 'Disputed'  || !resolutionNotes.trim()}>
                    Custom Resolution / Split (TBI)
                </Button>
                */}
            <Button
              variant="outline-danger"
              onClick={() => handleCancelMediationByAdmin()}
              disabled={mediationDetails?.status !== "Disputed"}
              className="mt-2"
            >
              Cancel Mediation (e.g., Fraud)
            </Button>
          </div>
        </div>
      )}

      <div className="mt-auto action-buttons-footer pt-3 border-top">
        {currentUserId === mediationDetails?.buyer?._id?.toString() &&
          mediationDetails?.status === "InProgress" && (
            <Button
              variant="success"
              className="w-100 mb-2"
              onClick={handleConfirmReceipt}
              disabled={isConfirmingReceipt || isOpeningDispute || isDisputed}
            >
              {isConfirmingReceipt ? (
                <>
                  <Spinner as="span" animation="border" size="sm" />{" "}
                  Confirming...
                </>
              ) : (
                "Confirm Product Received"
              )}
            </Button>
          )}
        {(currentUserId === mediationDetails?.buyer?._id?.toString() ||
          currentUserId === mediationDetails?.seller?._id?.toString()) &&
          (mediationDetails?.status === "InProgress" ||
            mediationDetails?.status === "Disputed") && (
            <Button
              variant={isDisputed ? "outline-secondary" : "danger"}
              className="w-100"
              onClick={
                !isDisputed
                  ? handleOpenDispute
                  : () =>
                      toast.info("Dispute is already open and under review.")
              }
              disabled={
                isOpeningDispute ||
                isConfirmingReceipt ||
                (isDisputed && mediationDetails?.status === "Disputed")
              }
            >
              {isDisputed ? (
                "Dispute In Progress"
              ) : isOpeningDispute ? (
                <>
                  <Spinner as="span" animation="border" size="sm" /> Opening...
                </>
              ) : (
                "Open Dispute"
              )}
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
          Please log in.
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
  if (chatError && !mediationDetails && !loadingDetails)
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <h4>Error Loading Chat</h4>
          <p>{chatError}</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Alert>
      </Container>
    );
  if (!mediationDetails && !loadingDetails && !chatError)
    return (
      <Container className="py-5 text-center">
        <Alert variant="warning">Details unavailable.</Alert>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </Container>
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
                    Mediation: {mediationDetails?.product?.title || "Chat"}
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
              {isDisputed && (
                <Alert
                  variant="warning"
                  className="mt-2 mb-0 text-center small p-2"
                >
                  <strong>This mediation is currently in dispute.</strong> An
                  admin or assigned mediator is reviewing the case.
                </Alert>
              )}
            </Card.Header>
            <Card.Body
              ref={chatContainerRef}
              className="chat-messages-area p-0"
            >
              {chatError && mediationDetails && (
                <Alert
                  variant="danger"
                  className="m-3 rounded-0 border-0 border-start border-danger border-4 small"
                >
                  Chat Connection Issue: {chatError}
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
                    previousMessage.sender?._id !== msg.sender?._id ||
                    msg.type === "system"; // إظهار الأفاتار دائمًا لرسائل النظام إذا كان لها مُرسِل (أو لا تظهر إذا كان null)
                  const isMyMessage = msg.sender?._id === currentUserId;

                  if (msg.type === "system") {
                    return (
                      <ListGroup.Item
                        key={msg._id || `msg-${index}`}
                        className="message-item system-message text-center my-2 border-0"
                      >
                        <div className="d-inline-block p-2 rounded bg-light-subtle text-muted small system-message-bubble">
                          <span
                            dangerouslySetInnerHTML={{
                              __html: msg.message
                                .replace(
                                  /\*\*(.*?)\*\*/g,
                                  "<strong>$1</strong>"
                                )
                                .replace(
                                  /🛡️/g,
                                  '<FaShieldAlt class="me-1 text-info"/>'
                                ),
                            }}
                          />
                          <div
                            className="message-timestamp mt-1"
                            style={{ fontSize: "0.7rem" }}
                          >
                            {formatMessageTimestampForDisplay(msg.timestamp)}
                          </div>
                        </div>
                      </ListGroup.Item>
                    );
                  }

                  const avatarsForThisMessage = messageReadIndicators[msg._id];
                  return (
                    <React.Fragment
                      key={msg._id || `msg-${index}-${msg.timestamp}`}
                    >
                      <ListGroup.Item
                        className={`d-flex mb-1 message-item border-0 ${
                          isMyMessage ? "sent" : "received"
                        } ${showAvatar ? "mt-2" : "mt-1"}`}
                        style={
                          showAvatar || msg.type === "system"
                            ? {}
                            : { paddingLeft: "56px" }
                        }
                      >
                        <div
                          className="avatar-container me-2 flex-shrink-0"
                          style={{
                            width: "40px",
                            height: "40px",
                            visibility:
                              showAvatar && msg.sender ? "visible" : "hidden",
                          }}
                        >
                          {showAvatar &&
                            msg.sender &&
                            renderMessageSenderAvatar(msg.sender)}
                        </div>
                        <div className="message-content flex-grow-1">
                          <div className="message-bubble">
                            {showAvatar && !isMyMessage && msg.sender && (
                              <strong className="d-block mb-1">
                                {msg.sender?.fullName || "User"}
                              </strong>
                            )}
                            {msg.type === "image" && msg.imageUrl ? (
                              <Image
                                src={
                                  msg.imageUrl.startsWith("http")
                                    ? msg.imageUrl
                                    : `${BACKEND_URL}${msg.imageUrl}`
                                }
                                alt="Chat"
                                className="chat-image-preview"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                                onClick={() =>
                                  handleShowImageInModal(
                                    msg.imageUrl.startsWith("http")
                                      ? msg.imageUrl
                                      : `${BACKEND_URL}${msg.imageUrl}`
                                  )
                                }
                              />
                            ) : (
                              <div className="message-text">{msg.message}</div>
                            )}
                          </div>
                          <div
                            className={`message-meta d-flex ${
                              isMyMessage
                                ? "justify-content-end"
                                : "justify-content-start"
                            } align-items-center mt-1`}
                          >
                            <small className="text-muted message-timestamp">
                              {formatMessageTimestampForDisplay(msg.timestamp)}
                            </small>
                            {isMyMessage &&
                              participants.length > 1 &&
                              (!avatarsForThisMessage ||
                                avatarsForThisMessage.length === 0) && (
                                <FaCheck
                                  title="Sent"
                                  className="text-muted ms-1"
                                  style={{ fontSize: "0.8em" }}
                                />
                              )}
                          </div>
                        </div>
                      </ListGroup.Item>
                      {isMyMessage &&
                        avatarsForThisMessage &&
                        avatarsForThisMessage.length > 0 && (
                          <div
                            className="d-flex justify-content-end pe-3 mb-2 read-indicators-wrapper"
                            style={{ paddingLeft: "56px" }}
                          >
                            <div className="read-by-indicators-cluster d-flex align-items-center">
                              {avatarsForThisMessage.map((reader, idx) => (
                                <OverlayTrigger
                                  key={reader.readerId}
                                  placement="top"
                                  overlay={
                                    <Tooltip id={`readby-${reader.readerId}`}>
                                      Seen by {reader.fullName}
                                      {reader.readAt
                                        ? ` at ${formatMessageTimestampForDisplay(
                                            reader.readAt
                                          )}`
                                        : ""}
                                    </Tooltip>
                                  }
                                >
                                  <Image
                                    src={
                                      reader.avatarUrl &&
                                      !reader.avatarUrl.startsWith("http")
                                        ? `${BACKEND_URL}/${reader.avatarUrl}`
                                        : reader.avatarUrl || noUserAvatar
                                    }
                                    roundedCircle
                                    width={16}
                                    height={16}
                                    className="read-by-avatar-indicator"
                                    style={{
                                      marginLeft: idx === 0 ? "0" : "-6px",
                                      border: "1.5px solid white",
                                      backgroundColor: "#e0e0e0",
                                      zIndex:
                                        avatarsForThisMessage.length - idx,
                                    }}
                                    onError={(e) => {
                                      e.target.src = noUserAvatar;
                                    }}
                                  />
                                </OverlayTrigger>
                              ))}
                            </div>
                          </div>
                        )}
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} style={{ height: "1px" }} />
              </ListGroup>
            </Card.Body>
            <Card.Footer className="chat-input-area bg-light border-top p-3 position-relative">
              {!isChatActuallyActiveForInput &&
                mediationDetails &&
                mediationDetails.status !== "Disputed" && (
                  <Alert variant="info" className="text-center small mb-2 p-2">
                    Chat is active when mediation is In Progress. Status:{" "}
                    <strong>
                      {mediationDetails.status
                        .replace(/([A-Z])/g, " $1")
                        .trim()}
                    </strong>
                  </Alert>
                )}
              <div className="typing-indicator-container">
                {Object.keys(typingUsers).length > 0 && (
                  <TypingIndicator
                    typingUsersData={typingUsers}
                    currentUserId={currentUserId}
                  />
                )}
              </div>
              <Form onSubmit={handleSendMessage}>
                <Row className="g-2 align-items-center">
                  <Col xs="auto">
                    <Button
                      ref={emojiButtonRef}
                      variant="light"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      title="Emoji"
                      disabled={
                        !hasJoinedRoom ||
                        !!chatError ||
                        isLoadingHistory ||
                        !isChatActuallyActiveForInput
                      }
                    >
                      <FaSmile />
                    </Button>
                  </Col>
                  <Col xs="auto">
                    <Form.Group
                      controlId="chatImageUpload"
                      className="d-inline"
                    >
                      <Form.Control
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error("Max 5MB.");
                              return;
                            }
                            if (!file.type.startsWith("image/")) {
                              toast.error("Images only.");
                              return;
                            }
                            handleImageUpload(file);
                          }
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        style={{ display: "none" }}
                        ref={fileInputRef}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={
                          !hasJoinedRoom ||
                          !!chatError ||
                          isLoadingHistory ||
                          !isChatActuallyActiveForInput
                        }
                      >
                        📷
                      </Button>
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Control
                      type="text"
                      placeholder={
                        !isChatActuallyActiveForInput
                          ? isDisputed
                            ? "Communicate regarding dispute..."
                            : "Chat not active..."
                          : hasJoinedRoom
                          ? "Type message..."
                          : "Connecting..."
                      }
                      value={newMessage}
                      onChange={handleInputChange}
                      disabled={
                        !hasJoinedRoom ||
                        !!chatError ||
                        isLoadingHistory ||
                        !isChatActuallyActiveForInput
                      }
                      autoFocus
                      onFocus={() => setShowEmojiPicker(false)}
                    />
                  </Col>
                  <Col xs="auto">
                    <Button
                      type="submit"
                      disabled={
                        !newMessage.trim() ||
                        !hasJoinedRoom ||
                        !!chatError ||
                        isLoadingHistory ||
                        !isChatActuallyActiveForInput
                      }
                    >
                      <FaPaperPlane />
                      <span className="d-none d-sm-inline"> Send</span>
                    </Button>
                  </Col>
                </Row>
              </Form>
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="emoji-picker-container shadow-sm"
                >
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    emojiStyle={EmojiStyle.APPLE}
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
            {mediationDetails && renderSidebarContent()}
            {!mediationDetails && !loadingDetails && (
              <p>Details unavailable.</p>
            )}
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
          {mediationDetails && renderSidebarContent()}
          {!mediationDetails && !loadingDetails && <p>Details unavailable.</p>}
        </Offcanvas.Body>
      </Offcanvas>
      <Modal
        show={showImageModal}
        onHide={handleCloseImageModal}
        centered
        size="lg"
        dialogClassName="lightbox-modal"
      >
        <Modal.Header closeButton className="bg-dark text-white border-0">
          <Modal.Title bsPrefix="lightbox-modal-title h5">
            Image Preview
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 text-center bg-dark position-relative">
          {currentImageInModal ? (
            <Image
              src={currentImageInModal}
              fluid
              style={{ maxHeight: "85vh", objectFit: "contain", width: "100%" }}
              alt="Full size view"
              onError={handleImageErrorInModal}
            />
          ) : (
            <div
              className="d-flex justify-content-center align-items-center"
              style={{ minHeight: "300px" }}
            >
              <Spinner animation="border" variant="light" />
              <span className="ms-2 text-light">Loading...</span>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default MediationChatPage;
