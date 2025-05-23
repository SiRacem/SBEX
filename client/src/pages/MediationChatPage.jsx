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
import { FaPaperclip, FaSmile, FaPaperPlane, FaCheck } from "react-icons/fa";
import { toast } from "react-toastify";
import {
  buyerConfirmReceipt,
  openDisputeAction,
} from "../redux/actions/mediationAction";
import { SocketContext } from "../App"; // استيراد SocketContext
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
    (user) => user && user.id !== currentUserId && user.fullName // Changed from user.name to user.fullName for consistency
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
            alt={user.fullName} // Changed from user.name
            onError={(e) => {
              e.target.src = noUserAvatar;
            }}
          />
          <span className="typing-user-name-indicator me-1">
            {user.fullName}
          </span>
          {/* Changed from user.name */}
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

  const socket = useContext(SocketContext); // استخدام السوكت من SocketContext
  const currentUserId = useSelector((state) => state.userReducer.user?._id);
  const currentUserRole = useSelector(
    (state) => state.userReducer.user?.userRole
  ); // تأكد من جلب الدور أيضًا
  const onlineUserIds = useSelector(
    (state) => state.userReducer?.onlineUserIds || []
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
        console.log(
          "[ChatPage - Visibility/Focus] Marking messages as read:",
          unreadReceivedMessageIds
        );
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
      "[MediationChatPage] Current User ID:",
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
  }, [mediationRequestId, currentUserId, currentUserRole]);

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
    console.log("[Socket useEffect] Running. Dependencies changed:", {
      socketId: socket?.id,
      socketConnected: socket?.connected,
      mediationRequestId,
      currentUserId,
      currentUserRole,
      mediationDetailsStatus: mediationDetails?.status, // اطبع فقط الحالة أو خاصية مهمة
      loadingDetails,
      hasJoinedRoom, // حالة hasJoinedRoom الحالية عند بدء الـ effect
    });
  }, [
    socket?.id,
    socket?.connected,
    mediationRequestId,
    currentUserId,
    currentUserRole,
    mediationDetails?.status, // اطبع فقط الحالة أو خاصية مهمة
    loadingDetails,
  ]);
  // Socket Setup
  useEffect(() => {
    if (
      !socket ||
      !currentUserId ||
      !mediationRequestId ||
      loadingDetails ||
      !mediationDetails
    ) {
      return;
    }

    console.log("[Socket useEffect] Initializing socket listeners...");

    const handleConnect = () => {
      console.log("[ChatPage - Socket] Connected:", socket.id);
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = setTimeout(() => {
        if (socket.connected) {
          console.log("[ChatPage - Socket] Joining room:", mediationRequestId);
          socket.emit("joinMediationChat", {
            mediationRequestId,
            userId: currentUserId,
            userRole: currentUserRole, // <<< تأكد من تمرير هذا
          });
        }
      }, 300);
    };

    const handleJoinedSuccess = (data) => {
      console.log("[ChatPage - Socket] ✅ Joined chat:", data);
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

      if (message.sender?._id !== currentUserId) {
        setTypingUsers((prev) => {
          const updated = { ...prev };
          delete updated[message.sender._id];
          return updated;
        });
      }
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
      console.warn("[Socket] Chat error:", errorEvent);
      setChatError(errorEvent.message || "Chat error occurred.");
      setHasJoinedRoom(false);
    };

    const handleDisconnect = (reason) => {
      console.warn(`[Socket] Disconnected: ${reason}`);
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

    // ✅ تسجيل الـ listeners
    socket.on("connect", handleConnect);
    socket.on("joinedMediationChatSuccess", handleJoinedSuccess);
    socket.on("newMediationMessage", handleNewMessage);
    socket.on("messages_status_updated", handleMessagesStatusUpdated);
    socket.on("mediation_details_updated", handleMediationDetailsUpdated);
    socket.on("mediationChatError", handleChatError);
    socket.on("disconnect", handleDisconnect);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);

    // ✅ تأكيد الانضمام في حال الاتصال كان نشط
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      console.log("[Socket Cleanup]");
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
  ]);

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
    return (
      <Image
        src={avatar}
        roundedCircle
        width={size}
        height={size}
        className="me-2 flex-shrink-0"
        alt={sender?.fullName || "User"}
        onError={(e) => {
          e.target.src = noUserAvatar;
        }}
      />
    );
  };

  const handleImageUpload = async (fileToUpload) => {
    // Renamed 'file' to 'fileToUpload' for clarity
    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("Authentication required to upload image.");
      console.error("❌ No auth token found in localStorage.");
      return;
    }

    const formData = new FormData();
    formData.append("image", fileToUpload); // Now 'fileToUpload' is the actual File object

    try {
      // The URL should ideally use BACKEND_URL for consistency,
      // but "http://localhost:8000/mediation/chat/upload-image" is fine for local dev.
      const response = await axios.post(
        `${BACKEND_URL}/mediation/chat/upload-image`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            // 'Content-Type' is automatically set by axios for FormData
          },
        }
      );

      const { imageUrl } = response.data;
      if (imageUrl) {
        socket.emit("sendMediationMessage", {
          mediationRequestId,
          imageUrl, // This will be the relative path like /uploads/chat_images/xyz.jpg
          // messageText can be omitted or set to null/empty if it's just an image
        });
        // Optionally, clear the newMessage input if you want
        // setNewMessage("");
      }
      // toast.success("Image sent!"); // Optional success feedback
    } catch (error) {
      console.error("❌ Failed to upload image:", error);
      const errorMessage =
        error.response?.data?.msg ||
        "Failed to upload image. Please try again.";
      toast.error(errorMessage);
    }
  };

  // --- [!!!] متغير جديد لتحديد ما إذا كانت الدردشة نشطة بناءً على الحالة [!!!] ---
  // const isChatActive = useMemo(() => {
  //   return mediationDetails?.status === "InProgress";
  // }, [mediationDetails?.status]);

  const participants = useMemo(() => {
    if (!mediationDetails) return [];
    const parts = [];

    if (mediationDetails.seller) {
      parts.push({
        ...mediationDetails.seller,
        roleLabel: "Seller",
        id: mediationDetails.seller._id?.toString(),
      });
    }
    if (mediationDetails.buyer) {
      parts.push({
        ...mediationDetails.buyer,
        roleLabel: "Buyer",
        id: mediationDetails.buyer._id?.toString(),
      });
    }
    if (mediationDetails.mediator) {
      parts.push({
        ...mediationDetails.mediator,
        roleLabel: "Mediator",
        id: mediationDetails.mediator._id?.toString(),
      });
    }

    // --- [!!!] إضافة الأدمنز/المشرفين إلى قائمة المشاركين [!!!] ---
    if (
      mediationDetails.disputeOverseers &&
      Array.isArray(mediationDetails.disputeOverseers)
    ) {
      mediationDetails.disputeOverseers.forEach((admin) => {
        // تجنب إضافة نفس المستخدم مرتين إذا كان الأدمن هو الوسيط أو طرفًا
        if (!parts.some((p) => p.id === admin._id?.toString())) {
          parts.push({
            ...admin,
            roleLabel: admin.userRole || "Admin", // أو "Dispute Overseer"
            id: admin._id?.toString(),
            isOverseer: true, // علامة لتمييزهم إذا أردت
          });
        }
      });
    }
    // -------------------------------------------------------------
    return parts;
  }, [mediationDetails]);

  const otherParticipants = useMemo(() => {
    if (!currentUserId) return [];
    return participants.filter((p) => p.id !== currentUserId.toString());
  }, [participants, currentUserId]);

  const messageReadIndicators = useMemo(() => {
    if (
      !currentUserId ||
      messages.length === 0 ||
      otherParticipants.length === 0
    ) {
      return {}; // كائن فارغ: messageId -> array of reader avatars
    }

    const indicators = {};
    otherParticipants.forEach((participant) => {
      let lastReadByThisParticipantMessageId = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        // Ensure m.sender and m.readBy exist, and participant.id is comparable
        if (
          m.sender?._id === currentUserId &&
          m.readBy?.some((rb) => rb.readerId?.toString() === participant.id)
        ) {
          lastReadByThisParticipantMessageId = m._id;
          break;
        }
      }

      if (lastReadByThisParticipantMessageId) {
        if (!indicators[lastReadByThisParticipantMessageId]) {
          indicators[lastReadByThisParticipantMessageId] = [];
        }
        const messageWithReadEntry = messages.find(
          (m) => m._id === lastReadByThisParticipantMessageId
        );
        const readerEntry = messageWithReadEntry?.readBy.find(
          (rb) => rb.readerId?.toString() === participant.id
        );

        if (readerEntry) {
          indicators[lastReadByThisParticipantMessageId].push({
            readerId: participant.id,
            fullName: readerEntry.fullName || participant.fullName || "User", // Fallback for fullName
            avatarUrl: readerEntry.avatarUrl || participant.avatarUrl, // Fallback for avatarUrl
            readAt: readerEntry.readAt,
          });
        }
      }
    });
    return indicators;
  }, [messages, currentUserId, otherParticipants]);

  const isDisputed = useMemo(() => {
    return mediationDetails?.status === "Disputed";
  }, [mediationDetails?.status]);

  // isChatActive لا يزال مفيدًا لتعطيل الإدخال إذا لم تكن 'InProgress' أو 'Disputed'
  const isChatActuallyActiveForInput = useMemo(() => {
    return (
      mediationDetails?.status === "InProgress" ||
      mediationDetails?.status === "Disputed"
    );
  }, [mediationDetails?.status]);

  console.log("--- MediationChatPage RENDER (Disputed State) ---", {
    hasJoinedRoom,
    chatError,
    isLoadingHistory,
    isChatActuallyActiveForInput, // يجب أن تكون true
    isDisputed, // يجب أن تكون true
    mediationStatus: mediationDetails?.status,
  });

  console.log("--- Send Button Disabled Check ---", {
    isNewMessageEmpty: !newMessage.trim(),
    notHasJoinedRoom: !hasJoinedRoom,
    hasChatError: !!chatError,
    isLoadingHistory,
    notIsChatActuallyActiveForInput: !isChatActuallyActiveForInput,
    // نتيجة الشرط الكلي
    isButtonDisabled:
      !newMessage.trim() ||
      !hasJoinedRoom ||
      !!chatError ||
      isLoadingHistory ||
      !isChatActuallyActiveForInput,
  });

  const onEmojiClick = (emojiData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
    // Consider focusing input after emoji click
  };

  const handleFileSelected = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        setChatError("File is too large. Maximum 5MB allowed.");
        if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
        return;
      }
      if (!file.type.startsWith("image/")) {
        setChatError("Only image files are allowed.");
        if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
        return;
      }

      const formData = new FormData();
      formData.append("chatImage", file);
      formData.append("mediationRequestId", mediationRequestId); // Ensure this is available

      const token = localStorage.getItem("token");
      if (!token) {
        setChatError("Authentication required to upload image.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const config = { headers: { Authorization: `Bearer ${token}` } };

      axios
        .post(`${BACKEND_URL}/mediation/chat/upload-image`, formData, config)
        .then((response) => {
          // The server should broadcast the new image message via socket.
          // The client will receive it via 'newMediationMessage' handler.
          console.log(
            "Image upload initiated, server will broadcast:",
            response.data
          );
          // Optionally, provide user feedback here, e.g., "Image sending..."
        })
        .catch((err) => {
          console.error("Failed to upload image:", err);
          setChatError(
            err.response?.data?.msg ||
              "Failed to upload image. Please try again."
          );
        })
        .finally(() => {
          if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
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
      e.target.onerror = null; // Prevent infinite loop if fallback also fails
      e.target.src = fallbackProductImageUrl;
    }
  }, []);

  const handleConfirmReceipt = useCallback(async () => {
    if (!mediationDetails?._id || isConfirmingReceipt) return;

    if (
      window.confirm(
        "Are you sure you have received the product/service as agreed and wish to release the funds? This action cannot be undone."
      )
    ) {
      setIsConfirmingReceipt(true);
      try {
        await dispatch(buyerConfirmReceipt(mediationDetails._id));
        toast.success("Receipt confirmed! Funds will be released.");

        // --- [!!!] إعادة جلب التفاصيل [!!!] ---
        const token = localStorage.getItem("token");
        if (token && mediationRequestId) {
          // تأكد من وجود mediationRequestId
          const config = { headers: { Authorization: `Bearer ${token}` } };
          try {
            const response = await axios.get(
              `${BACKEND_URL}/mediation/request-details/${mediationRequestId}`,
              config
            );
            setMediationDetails(
              response.data.mediationRequest || response.data
            );
          } catch (fetchError) {
            console.error("Error re-fetching mediation details:", fetchError);
          }
        }
      } catch (error) {
        // toast.error(error.message || "Failed to confirm receipt."); // عادةً الـ action يعرض الـ toast
        console.error("Error confirming receipt:", error);
      } finally {
        setIsConfirmingReceipt(false);
      }
    }
  }, [
    dispatch,
    mediationDetails?._id,
    isConfirmingReceipt /* mediationRequestId */,
  ]);

  // --- [!!!] دالة جديدة لفتح النزاع [!!!] ---
  const handleOpenDispute = useCallback(async () => {
    if (
      !mediationDetails?._id ||
      isOpeningDispute ||
      mediationDetails.status !== "InProgress"
    )
      return;

    // يمكنك إضافة مودال هنا لطلب سبب أولي للنزاع إذا أردت
    // const reason = prompt("Please provide a brief reason for opening the dispute (optional):");
    // if (reason === null) return; // المستخدم ألغى

    if (
      window.confirm(
        "Are you sure you want to open a dispute for this transaction? This will pause the normal process and involve a mediator/admin to resolve the issue."
      )
    ) {
      setIsOpeningDispute(true);
      try {
        // dispatch action to open dispute
        // قد تحتاج لتمرير سبب النزاع إذا جمعته
        await dispatch(openDisputeAction(mediationDetails._id /*, reason */));
        toast.info(
          "A dispute has been opened. A mediator/admin will review the case."
        );
        // الواجهة يجب أن تُحدَّث عبر socket event (mediation_details_updated) أو إعادة جلب
      } catch (error) {
        // toast.error(error.message || "Failed to open dispute."); // عادةً الـ action يعرض الـ toast
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
  // ----------------------------------------------------

  const renderSidebarContent = () => (
    <>
      <h5 className="mb-3">Participants</h5>
      <ListGroup variant="flush" className="mb-4 participant-list">
        {participants.map((p) => {
          // --- [!!!] التحقق مما إذا كان المشارك متصلاً [!!!] ---
          const isOnline = onlineUserIds.includes(p.id?.toString()); // تأكد أن p.id هو string
          // ----------------------------------------------------
          return (
            <ListGroup.Item
              key={p.id || p._id} // Use p.id which is stringified
              className="d-flex align-items-center bg-transparent border-0 px-0 py-2"
            >
              {/* --- [!!!] إضافة مؤشر الاتصال [!!!] --- */}
              <div className="position-relative me-2">
                {renderMessageSenderAvatar(p, 30)}
                <span
                  className={`online-status-indicator-small ${
                    isOnline ? "online" : "offline"
                  }`}
                  title={isOnline ? "Online" : "Offline"}
                ></span>
              </div>
              <div>
                <div className="fw-bold">{p.fullName}</div>
                <small className="text-muted">
                  {p.isOverseer ? `Admin (${p.roleLabel})` : p.roleLabel}
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
            <strong>Product :</strong> {mediationDetails.product.title}
          </p>
          <p className="mb-1">
            <strong>Agreed Price :</strong>
            {formatCurrency(
              mediationDetails.bidAmount, // Assuming bidAmount is the agreed price in mediation
              mediationDetails.bidCurrency
            )}
          </p>
          <p className="mb-1">
            <strong>Escrowed :</strong>
            {mediationDetails.escrowedAmount
              ? formatCurrency(
                  mediationDetails.escrowedAmount,
                  mediationDetails.escrowedCurrency
                )
              : "Not yet"}
          </p>
          <p className="mb-1">
            <strong>Mediator Fee :</strong>
            {formatCurrency(
              mediationDetails.calculatedMediatorFee,
              mediationDetails.mediationFeeCurrency
            )}
          </p>
          <p className="mb-1">
            <strong>Status :</strong>
            <Badge
              bg={mediationDetails.status === "InProgress" ? "success" : "info"}
            >
              {mediationDetails.status}
            </Badge>
          </p>
        </div>
      ) : (
        <p>Loading transaction details...</p>
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
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                  />
                  Confirming...
                </>
              ) : (
                "Confirm Product Received"
              )}
            </Button>
          )}
        {/* --- [!!!] إضافة زر فتح النزاع [!!!] --- */}
        {(currentUserId === mediationDetails?.buyer?._id?.toString() ||
          currentUserId === mediationDetails?.seller?._id?.toString()) &&
          (mediationDetails?.status === "InProgress" ||
            mediationDetails?.status === "Disputed") && (
            <Button
              variant={isDisputed ? "warning" : "danger"} // تغيير اللون إذا كان النزاع مفتوحًا
              className="w-100"
              onClick={
                !isDisputed
                  ? handleOpenDispute
                  : () => {
                      /* يمكن إضافة إجراء هنا لعرض تفاصيل النزاع أو لا شيء */
                    }
              }
              disabled={
                isOpeningDispute ||
                isConfirmingReceipt ||
                (isDisputed && mediationDetails?.status === "Disputed")
              } // تعطيل الفتح إذا مفتوح بالفعل
            >
              {isDisputed ? (
                "Dispute In Progress" // أو "View Dispute Details"
              ) : isOpeningDispute ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                  />
                  Opening Dispute...
                </>
              ) : (
                "Open Dispute"
              )}
            </Button>
          )}
      </div>
    </>
  );

  // Loading and Error States
  if (!currentUserId) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p className="mt-2">Loading user information...</p>
        <Alert variant="warning" className="mt-3">
          Please log in to access the chat.
        </Alert>
      </Container>
    );
  }
  if (loadingDetails) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p className="mt-2">Loading mediation details...</p>
      </Container>
    );
  }
  if (chatError && !mediationDetails && !loadingDetails) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <h4>Error Loading Chat</h4>
          <p>{chatError}</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Alert>
      </Container>
    );
  }
  if (!mediationDetails && !loadingDetails && !chatError) {
    return (
      <Container className="py-5 text-center">
        <Alert variant="warning">Mediation details unavailable.</Alert>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </Container>
    );
  }

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
                    {/* Safe access */}
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
                  admin or assigned mediator is reviewing the case. Please
                  communicate clearly and provide any requested information.
                </Alert>
              )}
            </Card.Header>
            <Card.Body
              ref={chatContainerRef}
              className="chat-messages-area p-0"
            >
              {/* Persistent chat error display within the chat body if details loaded but socket has issues */}
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
                  <Spinner size="sm" /> Loading chat history...
                </div>
              )}
              <ListGroup variant="flush" className="p-3">
                {!isLoadingHistory && messages.length === 0 && !chatError && (
                  <ListGroup.Item className="text-center text-muted border-0 py-5">
                    No messages in this chat yet. Start the conversation!
                  </ListGroup.Item>
                )}
                {messages.map((msg, index) => {
                  const previousMessage = messages[index - 1];
                  const showAvatar =
                    !previousMessage ||
                    previousMessage.sender?._id !== msg.sender?._id;
                  const isMyMessage = msg.sender?._id === currentUserId;

                  const avatarsForThisMessage = messageReadIndicators[msg._id];

                  return (
                    <React.Fragment
                      key={msg._id || `msg-${index}-${msg.timestamp}`}
                    >
                      <ListGroup.Item
                        className={`d-flex mb-1 message-item border-0 ${
                          isMyMessage ? "sent" : "received"
                        } ${showAvatar ? "mt-2" : "mt-1"}`} // Added margin top based on avatar
                        style={showAvatar ? {} : { paddingLeft: "56px" }} // Indent if no avatar
                      >
                        <div
                          className="avatar-container me-2 flex-shrink-0"
                          style={{
                            width: "40px",
                            height: "40px",
                            visibility: showAvatar ? "visible" : "hidden",
                          }}
                        >
                          {showAvatar && renderMessageSenderAvatar(msg.sender)}
                        </div>
                        <div className="message-content flex-grow-1">
                          <div className="message-bubble">
                            {showAvatar && !isMyMessage && (
                              <strong className="d-block mb-1">
                                {msg.sender?.fullName || "System"}
                              </strong>
                            )}
                            {/* {msg.type === "image" && msg.imageUrl ? (
                              <Image
                                src={
                                  msg.imageUrl.startsWith("http")
                                    ? msg.imageUrl // إذا كان الرابط كاملاً بالفعل
                                    : `${BACKEND_URL}/uploads/${msg.imageUrl}` // <--- [!!!] التعديل هنا [!!!]
                                }
                                alt={msg.message || "Chat image"}
                                fluid
                                className="mt-1 chat-image-preview"
                                style={{
                                  maxHeight: "200px",
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                  objectFit: "contain",
                                  backgroundColor: "#f0f0f0",
                                }}
                                onError={(e) => {
                                  console.error(
                                    "Image load error for src:",
                                    e.target.src
                                  ); // أضف هذا للتحقق
                                  e.target.alt = "Image failed to load";
                                  // يمكنك هنا عرض fallbackProductImageUrl إذا أردت، لكن تأكد أنه لا يسبب حلقة
                                  // e.target.src = fallbackProductImageUrl; // كن حذرًا مع هذا لتجنب الحلقات
                                  e.target.style.display = "none"; // إخفاء أيقونة الصورة المكسورة
                                }}
                                onClick={() =>
                                  handleShowImageInModal(
                                    msg.imageUrl.startsWith("http")
                                      ? msg.imageUrl
                                      : `${BACKEND_URL}/uploads/${msg.imageUrl}` // <--- [!!!] التعديل هنا أيضًا للـ Modal [!!!]
                                  )
                                }
                              />
                            ) : (
                              <p className="mb-0 ws-pre-wrap">{msg.message}</p>
                            )} */}
                            {msg.type === "image" && msg.imageUrl ? (
                              <Image
                                src={`${BACKEND_URL}${msg.imageUrl}`}
                                alt="Chat"
                                style={{
                                  maxWidth: "100%",
                                  borderRadius: "8px",
                                  marginTop: "5px",
                                  cursor: "pointer",
                                  objectFit: "contain",
                                }}
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                                onClick={() =>
                                  handleShowImageInModal(
                                    `${BACKEND_URL}${msg.imageUrl}`
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
                            {/* Original Sent/Delivered tick for my messages */}
                            {isMyMessage &&
                              participants.length > 1 &&
                              (!avatarsForThisMessage ||
                                avatarsForThisMessage.length === 0) && (
                                <FaCheck
                                  title="Sent" // Or "Delivered" if you have that state
                                  className="text-muted ms-1"
                                  style={{ fontSize: "0.8em" }}
                                />
                              )}
                          </div>
                        </div>
                      </ListGroup.Item>

                      {/* NEW: Read indicators below my messages if applicable */}
                      {isMyMessage &&
                        avatarsForThisMessage &&
                        avatarsForThisMessage.length > 0 && (
                          <div
                            className="d-flex justify-content-end pe-3 mb-2 read-indicators-wrapper"
                            style={{
                              paddingLeft:
                                "56px" /* Align with message bubble */,
                            }}
                          >
                            <div className="read-by-indicators-cluster d-flex align-items-center">
                              {avatarsForThisMessage.map((reader, idx) => (
                                <OverlayTrigger
                                  key={reader.readerId}
                                  placement="top"
                                  overlay={
                                    <Tooltip
                                      id={`readby-indicator-${reader.readerId}`}
                                    >
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
                                      marginLeft: idx === 0 ? "0" : "-6px", // No margin for first, overlap for others
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
                {/* Scroll target */}
              </ListGroup>
            </Card.Body>
            <Card.Footer className="chat-input-area bg-light border-top p-3 position-relative">
              {!isChatActuallyActiveForInput &&
                mediationDetails &&
                mediationDetails.status !== "Disputed" && (
                  <Alert variant="info" className="text-center small mb-2 p-2">
                    The chat will become active once the mediation process is
                    fully in progress. Current status:
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
                      title="Toggle Emoji Picker"
                      disabled={
                        !hasJoinedRoom ||
                        !!chatError ||
                        isLoadingHistory ||
                        !isChatActuallyActiveForInput
                      } // <--- إضافة !isChatActive
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
                          // Modified onChange handler
                          const selectedFile = event.target.files[0];
                          if (selectedFile) {
                            // Client-side validation (optional but good practice)
                            if (selectedFile.size > 5 * 1024 * 1024) {
                              // 5MB limit
                              toast.error(
                                "File is too large. Maximum 5MB allowed."
                              );
                              if (fileInputRef.current)
                                fileInputRef.current.value = ""; // Reset file input
                              return;
                            }
                            if (!selectedFile.type.startsWith("image/")) {
                              toast.error(
                                "Only image files (JPEG, PNG, GIF, WEBP) are allowed."
                              );
                              if (fileInputRef.current)
                                fileInputRef.current.value = ""; // Reset file input
                              return;
                            }
                            handleImageUpload(selectedFile); // Pass the actual File object
                          }
                          // Reset file input so the same file can be selected again if needed
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
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
                        } // Ensure disabled conditions are correct
                      >
                        📷
                        {/* Consider using FaPaperclip or a more descriptive icon/text */}
                      </Button>
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Control
                      type="text"
                      placeholder={
                        !isChatActuallyActiveForInput
                          ? isDisputed
                            ? "Communicate regarding the dispute..."
                            : "Chat is not active yet..."
                          : hasJoinedRoom
                          ? "Type your message..."
                          : "Connecting to chat..."
                      }
                      value={newMessage}
                      onChange={handleInputChange}
                      disabled={
                        !hasJoinedRoom ||
                        !!chatError ||
                        isLoadingHistory ||
                        !isChatActuallyActiveForInput
                      } // <--- إضافة !isChatActive
                      autoFocus
                      onFocus={() => setShowEmojiPicker(false)} // Hide emoji picker when input is focused
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
                        !isChatActuallyActiveForInput // <--- إضافة !isChatActive
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
                  className="emoji-picker-container shadow-sm" // Added shadow for better visibility
                  style={{
                    position: "absolute", // Ensure it's absolute for correct positioning
                    bottom: "calc(100% + 10px)", // Position above the input area
                    right: "10px", // Align to the right
                    zIndex: 1050, // Ensure it's above other elements
                  }}
                >
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    emojiStyle={EmojiStyle.APPLE} // Or your preferred style
                    height={320}
                    // width="100%" // Can set width if needed
                    searchDisabled // Disable search if not needed
                    previewConfig={{ showPreview: false }} // Hide preview bar
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
            {/* Render only if details exist */}
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
        className="d-md-none" // Only for mobile
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
        dialogClassName="lightbox-modal" // Custom class for styling
      >
        <Modal.Body className="p-0 text-center bg-dark position-relative">
          {currentImageInModal && (
            <Image
              src={currentImageInModal} // Already includes BACKEND_URL if needed
              fluid
              style={{ maxHeight: "90vh", objectFit: "contain" }}
              alt="Full size view of chat image"
              onError={handleImageErrorInModal} // Use the memoized error handler
            />
          )}
          <Button
            variant="light"
            onClick={handleCloseImageModal}
            className="position-absolute top-0 end-0 m-2 opacity-75" // Style close button
            aria-label="Close image modal"
            style={{ zIndex: 1056 }} // Ensure it's above the image
          >
            × {/* HTML entity for close icon */}
          </Button>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default MediationChatPage;
