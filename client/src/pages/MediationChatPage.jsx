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
  FaSmile,
  FaPaperPlane,
  FaCheck,
  FaCrown,
  FaShieldAlt,
  FaStar,
  FaArrowLeft,
  FaCommentDots,
  FaUserPlus,
  FaComments,
  FaEnvelopeOpenText,
  FaCamera,
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  buyerConfirmReceipt,
  openDisputeAction,
  getMediationDetailsByIdAction,
  updateMediationDetailsFromSocket,
  clearActiveMediationDetails,
  adminResolveDisputeAction,
  adminCreateSubChat,
  adminGetAllSubChats,
  adminGetSubChatMessages,
  setActiveSubChatId,
  clearActiveSubChatMessages,
  adminResetCreateSubChat,
  handleAdminSubChatCreatedSocket,
  handleNewAdminSubChatMessageSocket,
  handleAdminSubChatMessagesStatusUpdatedSocket,
} from "../redux/actions/mediationAction";
import { SocketContext } from "../App";
import "./MediationChatPage.css";
import RatingForm from "../components/ratings/RatingForm";
import { getRatingsForMediationAction } from "../redux/actions/ratingAction";

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
  const currentUser = useSelector((state) => state.userReducer.user);
  const currentUserId = currentUser?._id;
  const currentUserRole = currentUser?.userRole;

  const {
    activeMediationDetails: mediationDetails,
    loadingActiveMediationDetails: loadingDetails,
    errorActiveMediationDetails: errorDetails,
    adminSubChats,
    activeSubChat,
    creatingSubChat,
    errorCreatingSubChat,
  } = useSelector((state) => state.mediationReducer);

  const adminSubChatsList = adminSubChats.list;
  const loadingAdminSubChats = adminSubChats.loading;
  const activeSubChatDetails = activeSubChat.details;
  const activeSubChatMessages = activeSubChat.messages;
  const loadingActiveSubChatMessages = activeSubChat.loadingMessages;
  const activeSubChatId = activeSubChat.id;

  console.log(
    "Rendering MediationChatPage, activeSubChatMessages length:",
    activeSubChatMessages.length,
    "Active SubChat ID:",
    activeSubChatId
  );

  const onlineUserIds = useSelector(
    (state) => state.userReducer?.onlineUserIds || []
  );
  const { mediationRatings, loadingMediationRatings } = useSelector(
    (state) => state.ratingReducer
  );

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [chatError, setChatError] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
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
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [sidebarView, setSidebarView] = useState("details");
  const [isResolvingDispute, setIsResolvingDispute] = useState(false);

  const [showCreateSubChatModal, setShowCreateSubChatModal] = useState(false);
  const [subChatTitle, setSubChatTitle] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [subChatJoinStatus, setSubChatJoinStatus] = useState(null);
  const [showSubChatModal, setShowSubChatModal] = useState(false);
  const [newSubChatMessage, setNewSubChatMessage] = useState("");
  const subChatMessagesEndRef = useRef(null);
  const [subChatTypingUsers, setSubChatTypingUsers] = useState({});
  const subChatTypingTimeoutRef = useRef(null);

  // --- [!!!] States جديدة لمعاينة الصورة في الشات الفرعي [!!!] ---
  const [subChatFile, setSubChatFile] = useState(null); // للاحتفاظ بكائن الملف
  const [subChatImagePreview, setSubChatImagePreview] = useState(null); // للاحتفاظ بـ dataURL للمعاينة
  const subChatFileInputRef = useRef(null);
  // --- [!!!] نهاية States الجديدة [!!!] ---

  const [showSubChatEmojiPicker, setShowSubChatEmojiPicker] = useState(false);
  const subChatEmojiPickerRef = useRef(null);
  const subChatEmojiButtonRef = useRef(null);

  const handleShowDetailsOffcanvas = () => setShowDetailsOffcanvas(true);
  const handleCloseDetailsOffcanvas = () => setShowDetailsOffcanvas(false);

  useEffect(() => {
    if (!socket) return;

    const handleJoinSuccess = (data) => {
      console.log("✅ Joined sub chat room:", data);
      setSubChatJoinStatus("success");
    };

    const handleJoinError = (error) => {
      console.warn(
        "❌ Failed to join sub chat room:",
        error?.message || "Unknown error"
      );
      setSubChatJoinStatus("error");
    };

    socket.on("joinedAdminSubChatSuccess", handleJoinSuccess);
    socket.on("adminSubChatError", handleJoinError);

    return () => {
      socket.off("joinedAdminSubChatSuccess", handleJoinSuccess);
      socket.off("adminSubChatError", handleJoinError);
    };
  }, [socket]);

  useEffect(() => {
    if (
      mediationDetails?._id &&
      mediationDetails.status === "Completed" &&
      sidebarView === "ratings"
    ) {
      dispatch(getRatingsForMediationAction(mediationDetails._id));
    }
  }, [dispatch, mediationDetails?._id, mediationDetails?.status, sidebarView]);

  const partiesNotYetRatedByCurrentUser = useMemo(() => {
    if (
      !mediationDetails ||
      !currentUserId ||
      mediationDetails.status !== "Completed"
    )
      return [];
    const currentMediationRatings =
      mediationRatings && mediationRatings[mediationRequestId]
        ? mediationRatings[mediationRequestId]
        : [];
    const ratedUserIdsByCurrentUser = currentMediationRatings
      .filter(
        (rating) =>
          rating.rater === currentUserId || rating.rater?._id === currentUserId
      )
      .map((rating) => rating.ratedUser?._id || rating.ratedUser);
    const uniqueRatedUserIds = [...new Set(ratedUserIdsByCurrentUser)];
    const partiesToRate = [];
    const { seller, buyer, mediator } = mediationDetails;
    if (
      seller &&
      seller._id !== currentUserId &&
      !uniqueRatedUserIds.includes(seller._id)
    ) {
      partiesToRate.push({
        id: seller._id,
        fullName: seller.fullName,
        role: "Seller",
      });
    }
    if (
      buyer &&
      buyer._id !== currentUserId &&
      !uniqueRatedUserIds.includes(buyer._id)
    ) {
      partiesToRate.push({
        id: buyer._id,
        fullName: buyer.fullName,
        role: "Buyer",
      });
    }
    if (
      mediator &&
      mediator._id !== currentUserId &&
      !uniqueRatedUserIds.includes(mediator._id)
    ) {
      partiesToRate.push({
        id: mediator._id,
        fullName: mediator.fullName,
        role: "Mediator",
      });
    }
    return partiesToRate;
  }, [mediationDetails, currentUserId, mediationRatings, mediationRequestId]);

  const unratedPartiesCount = partiesNotYetRatedByCurrentUser.length;

  const scrollToBottom = useCallback(
    (ref = messagesEndRef, options = { behavior: "smooth" }) => {
      setTimeout(() => ref.current?.scrollIntoView(options), 150);
    },
    []
  );

  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0) {
      scrollToBottom(messagesEndRef);
    }
  }, [messages, isLoadingHistory, scrollToBottom]);

  useEffect(() => {
    if (showSubChatModal && activeSubChatMessages.length > 0) {
      scrollToBottom(subChatMessagesEndRef);
    }
  }, [activeSubChatMessages, showSubChatModal, scrollToBottom]);

  const markVisibleMessagesAsReadCallback = useCallback(
    (chatType = "main") => {
      if (!socket?.connected || !currentUserId || !mediationRequestId) return;
      const messagesToScan =
        chatType === "main" ? messages : activeSubChatMessages;
      const currentActiveSubChatId =
        chatType === "sub" ? activeSubChatId : null;

      if (
        messagesToScan.length > 0 &&
        document.visibilityState === "visible" &&
        (chatType === "main" ? hasJoinedRoom : !!currentActiveSubChatId)
      ) {
        const unreadReceivedMessageIds = messagesToScan
          .filter(
            (msg) =>
              msg.sender?._id !== currentUserId &&
              (!msg.readBy ||
                !msg.readBy.some((r) => r.readerId === currentUserId))
          )
          .map((msg) => msg._id)
          .filter((id) => id);

        if (unreadReceivedMessageIds.length > 0) {
          const eventName =
            chatType === "main"
              ? "mark_messages_read"
              : "markAdminSubChatMessagesRead";
          const payload = {
            mediationRequestId,
            messageIds: unreadReceivedMessageIds,
            readerUserId: currentUserId,
          };
          if (chatType === "sub") {
            payload.subChatId = currentActiveSubChatId;
          }
          socket.emit(eventName, payload);
        }
      }
    },
    [
      messages,
      activeSubChatMessages,
      currentUserId,
      mediationRequestId,
      activeSubChatId,
      hasJoinedRoom,
      socket,
    ]
  );

  useEffect(() => {
    const mainChatReadHandler = () => markVisibleMessagesAsReadCallback("main");
    document.addEventListener("visibilitychange", mainChatReadHandler);
    window.addEventListener("focus", mainChatReadHandler);
    if (document.visibilityState === "visible") mainChatReadHandler();
    return () => {
      document.removeEventListener("visibilitychange", mainChatReadHandler);
      window.removeEventListener("focus", mainChatReadHandler);
    };
  }, [markVisibleMessagesAsReadCallback]);

  useEffect(() => {
    if (showSubChatModal && activeSubChatId) {
      const subChatReadHandler = () => markVisibleMessagesAsReadCallback("sub");
      document.addEventListener("visibilitychange", subChatReadHandler);
      window.addEventListener("focus", subChatReadHandler);
      if (document.visibilityState === "visible") subChatReadHandler();
      return () => {
        document.removeEventListener("visibilitychange", subChatReadHandler);
        window.removeEventListener("focus", subChatReadHandler);
      };
    }
  }, [showSubChatModal, activeSubChatId, markVisibleMessagesAsReadCallback]);

  useEffect(() => {
    if (
      mediationRequestId &&
      currentUserId &&
      (!mediationDetails || mediationDetails._id !== mediationRequestId)
    ) {
      dispatch(getMediationDetailsByIdAction(mediationRequestId));
    }
  }, [dispatch, mediationRequestId, currentUserId, mediationDetails]);

  const fetchChatHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setChatError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Auth token missing.");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(
        `${BACKEND_URL}/mediation/chat/${mediationRequestId}/history`,
        config
      );
      setMessages(response.data || []);
    } catch (err) {
      setChatError(err.response?.data?.msg || "Failed to load chat history.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [mediationRequestId]);

  useEffect(() => {
    if (mediationDetails && mediationDetails._id === mediationRequestId) {
      fetchChatHistory();
    }
  }, [mediationDetails, mediationRequestId, fetchChatHistory]);

  useEffect(() => {
    return () => {
      dispatch(clearActiveMediationDetails());
    };
  }, [dispatch]);

  const handleJoinChatRoom = useCallback(() => {
    if (
      socket &&
      socket.connected &&
      mediationRequestId &&
      currentUserId &&
      currentUserRole
    ) {
      socket.emit("joinMediationChat", {
        mediationRequestId,
        userId: currentUserId,
        userRole: currentUserRole,
      });
    }
  }, [socket, mediationRequestId, currentUserId, currentUserRole]);

  useEffect(() => {
    console.log("Active SubChat Messages Updated:", activeSubChatMessages);
  }, [activeSubChatMessages]);

  useEffect(() => {
    if (!socket || !currentUserId || !mediationRequestId || !mediationDetails)
      return;

    const handleJoinedSuccess = (data) => {
      setHasJoinedRoom(true);
      setChatError(null);
      markVisibleMessagesAsReadCallback("main");
    };
    const handleNewMessage = (message) => {
      setMessages((prevMessages) => {
        if (prevMessages.some((m) => m._id === message._id))
          return prevMessages;
        const newMessagesArray = [...prevMessages, message];
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
        return newMessagesArray;
      });
      if (message.sender && message.sender._id) {
        setTypingUsers((prev) => {
          const upd = { ...prev };
          delete upd[message.sender._id];
          return upd;
        });
      }
    };
    const handleMessagesStatusUpdated = ({ updatedMedId, updatedMessages }) => {
      if (updatedMedId === mediationRequestId) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            const updatedMsgInfo = updatedMessages.find(
              (uMsg) => uMsg._id === msg._id
            );
            if (updatedMsgInfo?.readBy?.length > 0) {
              const newReaderEntry = updatedMsgInfo.readBy[0];
              const existingReadBy = Array.isArray(msg.readBy)
                ? msg.readBy
                : [];
              if (
                !existingReadBy.some(
                  (r) => r.readerId === newReaderEntry.readerId
                )
              ) {
                return { ...msg, readBy: [...existingReadBy, newReaderEntry] };
              }
            }
            return msg;
          })
        );
      }
    };
    const handleMediationDetailsUpdated = ({
      updatedMedId,
      updatedMediationDetails,
    }) => {
      if (updatedMedId === mediationRequestId)
        dispatch(updateMediationDetailsFromSocket(updatedMediationDetails));
    };
    const handleChatErrorEvent = (errorEvent) => {
      setChatError(errorEvent.message || "Chat error.");
      setHasJoinedRoom(false);
    };
    const handleDisconnectEvent = (reason) => {
      setChatError("Chat connection lost.");
      setHasJoinedRoom(false);
      setTypingUsers({});
      setSubChatTypingUsers({});
    };
    const handleUserTyping = ({ userId, fullName, avatarUrl }) => {
      if (userId !== currentUserId)
        setTypingUsers((prev) => ({
          ...prev,
          [userId]: { id: userId, fullName, avatarUrl },
        }));
    };
    const handleUserStoppedTyping = ({ userId }) => {
      if (userId !== currentUserId)
        setTypingUsers((prev) => {
          const upd = { ...prev };
          delete upd[userId];
          return upd;
        });
    };
    const handleAdminSubChatCreated = (data) => {
      console.log(
        `[Socket Event - User ${currentUser?.fullName}] 'admin_sub_chat_created' received:`,
        data
      );
      if (data.mediationRequestId === mediationRequestId) {
        dispatch(handleAdminSubChatCreatedSocket(data)); // هذا يضيفه لـ Redux

        const isCurrentUserParticipant = data.subChat.participants.some(
          (p) => (p.userId?._id || p.userId) === currentUserId
        );
        const isCreatedByCurrentUser =
          (data.subChat.createdBy?._id || data.subChat.createdBy) ===
          currentUserId;

        if (isCurrentUserParticipant && !isCreatedByCurrentUser) {
          toast.info(
            <>
              <FaComments className="me-1" /> Admin started a new private chat
              with you:
              <strong>{data.subChat.title || "Discussion"}</strong>
            </>,
            {
              onClick: () => {
                // تأكد أن subChat هنا يحتوي على subChatId
                if (data.subChat && data.subChat.subChatId) {
                  handleOpenSubChatModal(data.subChat);
                } else {
                  console.error(
                    "SubChat or subChatId missing in admin_sub_chat_created toast click",
                    data
                  );
                }
              },
            }
          );
        } else if (isCurrentUserParticipant && isCreatedByCurrentUser) {
          // إذا كان الأدمن هو من أنشأه، ربما تريد فتحه تلقائيًا أو إظهار إشعار آخر
          // handleOpenSubChatModal(data.subChat);
        }
      }
    };
    const handleNewAdminSubChatMessage = (data) => {
      // payload: { mediationRequestId, subChatId, message }
      console.log(
        `[Socket Event - User ${currentUser?.fullName}] 'new_admin_sub_chat_message' received for subChat ${data.subChatId}:, data.message`
      );
      if (data.mediationRequestId === mediationRequestId) {
        dispatch(handleNewAdminSubChatMessageSocket(data)); // هذا يضيفه لـ Redux
        if (activeSubChatId === data.subChatId) {
          // إذا كان الشات المفتوح حاليًا
          scrollToBottom(subChatMessagesEndRef);
          // منطق mark as read للرسائل المستقبلة
          if (
            (data.message.sender?._id || data.message.sender) !==
              currentUserId && // ليست رسالتي
            document.visibilityState === "visible" &&
            data.message._id &&
            socket?.connected
          ) {
            socket.emit("markAdminSubChatMessagesRead", {
              mediationRequestId,
              subChatId: data.subChatId,
              messageIds: [data.message._id],
              // readerUserId: currentUserId, // السيرفر سيستخدم socket.userIdForChat
            });
          }
        } else {
          // إذا كان الشات غير مفتوح
          const relevantSubChatFromDetails =
            mediationDetails?.adminSubChats?.find(
              (sc) => sc.subChatId === data.subChatId
            );
          const relevantSubChatFromList = adminSubChatsList.find(
            (sc) => sc.subChatId === data.subChatId
          );
          const relevantSubChat =
            relevantSubChatFromDetails || relevantSubChatFromList;

          const isCurrentUserParticipant = relevantSubChat?.participants.some(
            (p) => (p.userId?._id || p.userId) === currentUserId
          );
          if (
            relevantSubChat &&
            isCurrentUserParticipant &&
            (data.message.sender?._id || data.message.sender) !== currentUserId
          ) {
            toast.info(
              <>
                <FaEnvelopeOpenText className="me-1" /> New message in:
                <strong>{relevantSubChat.title || "Admin Chat"}</strong>
              </>,
              { onClick: () => handleOpenSubChatModal(relevantSubChat) }
            );
          }
        }
      }
    };
    const handleAdminSubChatMessagesStatusUpdated = (data) => {
      if (
        data.mediationRequestId === mediationRequestId &&
        activeSubChatId === data.subChatId
      )
        dispatch(handleAdminSubChatMessagesStatusUpdatedSocket(data));
    };
    const handleAdminSubChatUserTyping = (data) => {
      // { subChatId, userId, fullName, avatarUrl }
      // console.log([Socket Event - User ${currentUser?.fullName}] 'adminSubChatUserTyping' received:, data);
      if (activeSubChatId === data.subChatId && data.userId !== currentUserId) {
        setSubChatTypingUsers((prev) => ({
          ...prev,
          [data.userId]: {
            id: data.userId,
            fullName: data.fullName,
            avatarUrl: data.avatarUrl,
          },
        }));
      }
    };
    const handleAdminSubChatUserStoppedTyping = (data) => {
      // { subChatId, userId }
      // console.log(`[Socket Event - User ${currentUser?.fullName}] 'adminSubChatUserStoppedTyping' received:`, data);
      if (activeSubChatId === data.subChatId && data.userId !== currentUserId) {
        setSubChatTypingUsers((prev) => {
          const upd = { ...prev };
          delete upd[data.userId];
          return upd;
        });
      }
    };

    socket.on("connect", handleJoinChatRoom);
    socket.on("joinedMediationChatSuccess", handleJoinedSuccess);
    socket.on("newMediationMessage", handleNewMessage);
    socket.on("messages_status_updated", handleMessagesStatusUpdated);
    socket.on("mediation_details_updated", handleMediationDetailsUpdated);
    socket.on("mediationChatError", handleChatErrorEvent);
    socket.on("disconnect", handleDisconnectEvent);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);
    socket.on("admin_sub_chat_created", handleAdminSubChatCreated);
    socket.on("new_admin_sub_chat_message", handleNewAdminSubChatMessage);
    socket.on(
      "admin_sub_chat_messages_status_updated",
      handleAdminSubChatMessagesStatusUpdated
    );
    socket.on("adminSubChatUserTyping", (data) => {
      console.log("User is typing in sub-chat:", data);
      handleAdminSubChatUserTyping(data);
    });
    socket.on(
      "adminSubChatUserStoppedTyping",
      handleAdminSubChatUserStoppedTyping
    );

    if (socket.connected) {
      handleJoinChatRoom();
    }

    return () => {
      if (socket && socket.connected) {
        if (mediationRequestId)
          socket.emit("leaveMediationChat", { mediationRequestId });
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          socket.emit("stop_typing", { mediationRequestId });
          typingTimeoutRef.current = null;
        }
        if (activeSubChatId) {
          socket.emit("leaveAdminSubChat", {
            mediationRequestId,
            subChatId: activeSubChatId,
          });
        }
        if (subChatTypingTimeoutRef.current) {
          clearTimeout(subChatTypingTimeoutRef.current);
          subChatTypingTimeoutRef.current = null;
        }
      }
      socket.off("connect", handleJoinChatRoom);
      socket.off("joinedMediationChatSuccess", handleJoinedSuccess);
      socket.off("newMediationMessage", handleNewMessage);
      socket.off("messages_status_updated", handleMessagesStatusUpdated);
      socket.off("mediation_details_updated", handleMediationDetailsUpdated);
      socket.off("mediationChatError", handleChatErrorEvent);
      socket.off("disconnect", handleDisconnectEvent);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stopped_typing", handleUserStoppedTyping);
      socket.off("admin_sub_chat_created", handleAdminSubChatCreated);
      socket.on("new_admin_sub_chat_message", (data) => {
        console.log("New sub-chat message received:", data);
        handleNewAdminSubChatMessage(data);
      });
      socket.off(
        "admin_sub_chat_messages_status_updated",
        handleAdminSubChatMessagesStatusUpdated
      );
      socket.off("adminSubChatUserTyping", handleAdminSubChatUserTyping);
      socket.off(
        "adminSubChatUserStoppedTyping",
        handleAdminSubChatUserStoppedTyping
      );
    };
  }, [
    socket,
    mediationRequestId,
    currentUserId,
    mediationDetails,
    dispatch,
    markVisibleMessagesAsReadCallback,
    handleJoinChatRoom,
    activeSubChatId,
    adminSubChatsList,
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
    const isSenderAdmin =
      sender?.userRole === "Admin" ||
      sender?.roleLabel?.toLowerCase().includes("admin");
    const isCurrentUserViewingAsAdminAndIsSender =
      currentUser?.userRole === "Admin" && sender?._id === currentUserId;
    const showCrown = isSenderAdmin || isCurrentUserViewingAsAdminAndIsSender;

    return (
      <div className="position-relative avatar-wrapper-main">
        <Image
          src={avatar}
          roundedCircle
          width={size}
          height={size}
          className={`flex-shrink-0 ${
            showCrown ? "admin-avatar-highlight" : ""
          }`}
          alt={sender?.fullName || "User"}
          onError={(e) => {
            if (e.target.src !== noUserAvatar) {
              e.target.onerror = null;
              e.target.src = noUserAvatar;
            }
          }}
        />
        {showCrown && (
          <FaCrown className="participant-role-icon admin" title="Admin" />
        )}
      </div>
    );
  };

  const handleImageUpload = async (fileToUpload, forSubChat = false) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Authentication required.");
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
        if (forSubChat && activeSubChatId) {
          socket.emit("sendAdminSubChatMessage", {
            mediationRequestId,
            subChatId: activeSubChatId,
            imageUrl,
          });
        } else {
          socket.emit("sendMediationMessage", { mediationRequestId, imageUrl });
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.msg || "Image upload failed.");
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
    // Ensure current user (if admin) is in participants list if not already via disputeOverseers
    if (
      currentUserRole === "Admin" &&
      !parts.some((p) => p.id === currentUserId)
    ) {
      parts.push({
        ...currentUser,
        roleLabel: "Admin (You)",
        id: currentUserId,
        isOverseer: true,
      });
    }
    return parts;
  }, [mediationDetails, currentUser, currentUserId, currentUserRole]); // Added currentUser dependencies

  const otherParticipants = useMemo(() => {
    if (!currentUserId || !participants) return [];
    return participants.filter((p) => p.id !== currentUserId.toString());
  }, [participants, currentUserId]);

  const messageReadIndicators = useMemo(() => {
    if (
      !currentUserId ||
      !messages ||
      messages.length === 0 ||
      !otherParticipants ||
      otherParticipants.length === 0
    )
      return {};
    const indicators = {};
    otherParticipants.forEach((participant) => {
      if (!participant || !participant.id) return;
      let lastReadByThisParticipantMessageId = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (
          m?.sender?._id?.toString() === currentUserId.toString() &&
          Array.isArray(m.readBy) &&
          m.readBy.some(
            (rb) => rb?.readerId?.toString() === participant.id.toString()
          )
        ) {
          lastReadByThisParticipantMessageId = m._id;
          break;
        }
      }
      if (lastReadByThisParticipantMessageId) {
        if (!indicators[lastReadByThisParticipantMessageId])
          indicators[lastReadByThisParticipantMessageId] = [];
        const messageWithReadEntry = messages.find(
          (msg) => msg?._id === lastReadByThisParticipantMessageId
        );
        if (messageWithReadEntry?.readBy) {
          const readerEntry = messageWithReadEntry.readBy.find(
            (rb) => rb?.readerId?.toString() === participant.id.toString()
          );
          if (readerEntry)
            indicators[lastReadByThisParticipantMessageId].push({
              readerId: participant.id,
              fullName: readerEntry.fullName || participant.fullName,
              avatarUrl: readerEntry.avatarUrl || participant.avatarUrl,
              readAt: readerEntry.readAt,
            });
        }
      }
    });
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
  const onEmojiClick = (emojiData, forSubChat = false) => {
    if (forSubChat) {
      setNewSubChatMessage((prev) => prev + emojiData.emoji);
    } else {
      setNewMessage((prev) => prev + emojiData.emoji);
    }
  };
  const handleShowImageInModal = (imageUrl) => {
    if (imageUrl) {
      setCurrentImageInModal(imageUrl);
      setShowImageModal(true);
    } else {
      toast.error("Could not load image.");
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
    if (window.confirm("Confirm receipt? This action is final.")) {
      setIsConfirmingReceipt(true);
      try {
        await dispatch(buyerConfirmReceipt(mediationDetails._id));
        toast.success("Receipt confirmed!");
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
    if (window.confirm("Open a dispute? This involves an admin.")) {
      setIsOpeningDispute(true);
      try {
        await dispatch(openDisputeAction(mediationDetails._id));
        toast.info("Dispute opened.");
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
  const handleResolveDispute = async (winnerRole) => {
    if (
      !mediationDetails?._id ||
      mediationDetails.status !== "Disputed" ||
      currentUserRole !== "Admin" ||
      isResolvingDispute
    ) {
      toast.warn("Action not allowed or in progress.");
      return;
    }
    if (!resolutionNotes.trim()) {
      toast.warn("Resolution notes required.");
      return;
    }
    let winnerId, loserId;
    if (winnerRole === "buyer") {
      winnerId = mediationDetails.buyer?._id;
      loserId = mediationDetails.seller?._id;
    } else if (winnerRole === "seller") {
      winnerId = mediationDetails.seller?._id;
      loserId = mediationDetails.buyer?._id;
    } else {
      toast.error("Invalid winner.");
      return;
    }
    if (!winnerId || !loserId) {
      toast.error("Cannot determine winner/loser.");
      return;
    }
    if (
      !window.confirm(
        `Rule in favor of ${winnerRole}? Notes: "${resolutionNotes}". Final.`
      )
    )
      return;
    setIsResolvingDispute(true);
    const resData = {
      winnerId,
      loserId,
      resolutionNotes: resolutionNotes.trim(),
      cancelMediation: false,
    };
    try {
      await dispatch(adminResolveDisputeAction(mediationDetails._id, resData));
    } catch (error) {
      console.error("Error resolving dispute:", error);
    } finally {
      setIsResolvingDispute(false);
    }
  };
  const handleCancelMediationByAdmin = async () => {
    if (
      !mediationDetails?._id ||
      mediationDetails.status !== "Disputed" ||
      currentUserRole !== "Admin" ||
      isResolvingDispute
    ) {
      toast.warn("Action not allowed.");
      return;
    }
    if (!window.confirm(`Cancel mediation? Notes: "${resolutionNotes}"`))
      return;
    setIsResolvingDispute(true);
    const resData = {
      resolutionNotes: resolutionNotes.trim() || "Cancelled by admin.",
      cancelMediation: true,
    };
    try {
      await dispatch(adminResolveDisputeAction(mediationDetails._id, resData));
    } catch (error) {
      console.error("Error cancelling mediation:", error);
    } finally {
      setIsResolvingDispute(false);
    }
  };
  const renderRatingsPanel = () => {
    const isLoadingSpecificRatings =
      loadingMediationRatings && loadingMediationRatings[mediationRequestId];
    if (isLoadingSpecificRatings && !mediationRatings[mediationRequestId])
      return (
        <div className="text-center p-3">
          <Spinner animation="border" size="sm" /> Loading ratings...
        </div>
      );
    if (!mediationDetails)
      return (
        <Alert variant="warning" className="m-3">
          Details unavailable.
        </Alert>
      );
    if (mediationDetails.status !== "Completed")
      return (
        <Alert variant="info" className="m-3">
          Ratings available once completed.
        </Alert>
      );
    return (
      <>
        <div
          className="d-flex justify-content-between align-items-center mb-0 p-3 border-bottom sticky-top bg-light"
          style={{ zIndex: 1 }}
        >
          <h5 className="mb-0">Rate Participants</h5>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setSidebarView("details")}
          >
            <FaArrowLeft className="me-1" /> Back
          </Button>
        </div>
        <div
          className="p-3 flex-grow-1"
          style={{ overflowY: "auto", minHeight: "0" }}
        >
          {partiesNotYetRatedByCurrentUser.length > 0 ? (
            partiesNotYetRatedByCurrentUser.map((party) => (
              <RatingForm
                key={party.id}
                mediationRequestId={mediationRequestId}
                ratedUserId={party.id}
                ratedUserFullName={party.fullName}
                onRatingSubmitted={() =>
                  dispatch(getRatingsForMediationAction(mediationRequestId))
                }
              />
            ))
          ) : (
            <Alert variant="success" className="m-0">
              All participants rated. Thank you!
            </Alert>
          )}
          {isLoadingSpecificRatings && (
            <div className="text-center mt-2">
              <Spinner size="sm" />
            </div>
          )}
        </div>
      </>
    );
  };

  const handleOpenCreateSubChatModal = () => {
    setSubChatTitle("");
    setSelectedParticipants([]);
    setShowCreateSubChatModal(true);
    dispatch(adminResetCreateSubChat());
  };
  const handleOpenCreateSubChatModalWithParticipant = (participantUser) => {
    if (!participantUser || !participantUser.id) return;
    setSubChatTitle(`Discussion with ${participantUser.fullName}`);
    setSelectedParticipants([participantUser.id]);
    setShowCreateSubChatModal(true);
    dispatch(adminResetCreateSubChat());
  };
  const handleCloseCreateSubChatModal = () => {
    setShowCreateSubChatModal(false);
    dispatch(adminResetCreateSubChat());
  };
  const handleCreateSubChat = async (e) => {
    e.preventDefault();
    if (selectedParticipants.length === 0) {
      toast.warn("Select at least one participant.");
      return;
    }
    const subChatData = {
      participantUserIds: selectedParticipants,
      title: subChatTitle.trim() || `Private Discussion`,
    };
    try {
      const createdSubChat = await dispatch(
        adminCreateSubChat(mediationRequestId, subChatData)
      );
      if (createdSubChat) {
        handleCloseCreateSubChatModal();
      }
    } catch (error) {
      console.error("Failed to create sub-chat from component:", error);
    }
  };
  const handleParticipantSelection = (userId) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };
  const handleOpenSubChatModal = (subChat) => {
    if (!subChat || !subChat.subChatId) {
      console.error(
        "[MediationChatPage] Attempted to open sub-chat modal with invalid subChat object:",
        subChat
      );
      toast.error("Could not open the private chat. Information missing.");
      return;
    }
    console.log(
      `[MediationChatPage - User ${
        currentUser?.fullName
      }] Opening SubChat Modal for: ${subChat.subChatId} (Title: ${
        subChat.title || "N/A"
      })`
    );

    dispatch(setActiveSubChatId(subChat.subChatId)); // يضبط الـ ID النشط
    dispatch(adminGetSubChatMessages(mediationRequestId, subChat.subChatId));

    // ✅ Socket Join Room Logic
    if (
      socket?.connected &&
      mediationRequestId &&
      subChat.subChatId &&
      currentUserId &&
      currentUserRole
    ) {
      socket.emit("joinAdminSubChat", {
        mediationRequestId,
        subChatId: subChat.subChatId,
        userId: currentUserId,
        userRole: currentUserRole,
      });
    }
    // يجلب الرسائل

    if (socket && socket.connected) {
      console.log(
        `[MediationChatPage - User ${currentUser?.fullName}] Emitting 'joinAdminSubChat' for subChat: ${subChat.subChatId}`
      );
      socket.emit("joinAdminSubChat", {
        mediationRequestId,
        subChatId: subChat.subChatId,
        userId: currentUserId, // ID المستخدم الحالي
        userRole: currentUserRole, // دور المستخدم الحالي
      });
    }
    setShowSubChatModal(true);
  };
  const handleCloseSubChatModal = () => {
    if (socket?.connected && activeSubChatId) {
      socket.emit("leaveAdminSubChat", {
        mediationRequestId,
        subChatId: activeSubChatId,
      });
      if (subChatTypingTimeoutRef.current) {
        clearTimeout(subChatTypingTimeoutRef.current);
        socket.emit("adminSubChatStopTyping", {
          mediationRequestId,
          subChatId: activeSubChatId,
        });
        subChatTypingTimeoutRef.current = null;
      }
    }
    setShowSubChatModal(false);
    dispatch(clearActiveSubChatMessages());
    dispatch(setActiveSubChatId(null));
    setNewSubChatMessage("");
    setSubChatTypingUsers({});
    setShowSubChatEmojiPicker(false);
  };
  const handleSubChatInputChange = (e) => {
    setNewSubChatMessage(e.target.value);
    if (socket?.connected && activeSubChatId && mediationRequestId) {
      if (!subChatTypingTimeoutRef.current && e.target.value.trim() !== "") {
        socket.emit("adminSubChatStartTyping", {
          mediationRequestId,
          subChatId: activeSubChatId,
        });
      }
      if (subChatTypingTimeoutRef.current)
        clearTimeout(subChatTypingTimeoutRef.current);
      subChatTypingTimeoutRef.current = setTimeout(() => {
        if (socket?.connected) {
          socket.emit("adminSubChatStopTyping", {
            mediationRequestId,
            subChatId: activeSubChatId,
          });
          subChatTypingTimeoutRef.current = null;
        }
      }, 1500);
    }
  };
  const handleSendSubChatMessage = async (e) => {
    e.preventDefault();
    if (!newSubChatMessage.trim() && !subChatFile) {
      // تم التعديل للتحقق من subChatFile بدلاً من imageUrl
      toast.warn("Message cannot be empty.");
      return;
    }
    if (socket?.connected && activeSubChatId && mediationRequestId) {
      if (subChatTypingTimeoutRef.current) {
        clearTimeout(subChatTypingTimeoutRef.current);
        subChatTypingTimeoutRef.current = null;
        socket.emit("adminSubChatStopTyping", {
          mediationRequestId,
          subChatId: activeSubChatId,
        });
      }

      let imageUrlToSend = null;
      if (subChatFile) {
        // إذا كان هناك ملف جاهز للرفع
        try {
          const token = localStorage.getItem("token");
          if (!token) throw new Error("Auth token missing.");
          const formData = new FormData();
          formData.append("image", subChatFile); // استخدم subChatFile
          const response = await axios.post(
            `${BACKEND_URL}/mediation/chat/upload-image`,
            formData,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          imageUrlToSend = response.data.imageUrl;
        } catch (uploadError) {
          toast.error(
            uploadError.response?.data?.msg || "Sub-chat image upload failed."
          );
          setSubChatFile(null); // امسح الملف عند الفشل
          setSubChatImagePreview(null); // امسح المعاينة عند الفشل
          if (subChatFileInputRef.current)
            subChatFileInputRef.current.value = "";
          return;
        }
      }

      socket.emit("sendAdminSubChatMessage", {
        mediationRequestId,
        subChatId: activeSubChatId,
        messageText: newSubChatMessage.trim(),
        imageUrl: imageUrlToSend, // أرسل الرابط إذا تم الرفع، أو null
      });

      setNewSubChatMessage("");
      setSubChatFile(null); // امسح الملف بعد الإرسال
      setSubChatImagePreview(null); // امسح المعاينة بعد الإرسال
      if (subChatFileInputRef.current) subChatFileInputRef.current.value = "";
      setShowSubChatEmojiPicker(false);
    } else {
      toast.error("Cannot send message. Connection or chat details missing.");
    }
  };

  useEffect(() => {
    if (
      mediationDetails?._id === mediationRequestId &&
      mediationDetails.status === "Disputed" &&
      currentUserRole === "Admin"
    ) {
      dispatch(adminGetAllSubChats(mediationRequestId));
    }
  }, [dispatch, mediationDetails, mediationRequestId, currentUserRole]);

  const renderTransactionDetailsAndActions = () => (
    <>
      <div className="flex-grow-1 sidebar-scrollable-content">
        <h5 className="mb-3 sidebar-section-title">Participants</h5>
        <ListGroup variant="flush" className="mb-4 participant-list">
          {participants.map((p) => {
            const isOnline = onlineUserIds.includes(p.id?.toString());
            const isCurrentUserAdmin = currentUserRole === "Admin";
            const isNotSelf = p.id !== currentUserId;
            return (
              <ListGroup.Item
                key={p.id || p._id}
                className="d-flex align-items-center bg-transparent border-0 px-0 py-2 participant-item"
              >
                <div className="position-relative me-2 participant-avatar-container">
                  {renderMessageSenderAvatar(p, 30)}
                  <span
                    className={`online-status-indicator-sidebar ${
                      isOnline ? "online" : "offline"
                    }`}
                    title={isOnline ? "Online" : "Offline"}
                  ></span>
                </div>
                <div className="participant-info flex-grow-1">
                  <div className="fw-bold">{p.fullName}</div>
                  <small className="text-muted">{p.roleLabel}</small>
                </div>
                {isCurrentUserAdmin &&
                  isNotSelf &&
                  mediationDetails?.status === "Disputed" && (
                    <OverlayTrigger
                      placement="top"
                      overlay={
                        <Tooltip id={`tooltip-chat-${p.id}`}>
                          Start private chat with {p.fullName}
                        </Tooltip>
                      }
                    >
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-primary open-subchat-icon"
                        onClick={() =>
                          handleOpenCreateSubChatModalWithParticipant(p)
                        }
                      >
                        <FaCommentDots />
                      </Button>
                    </OverlayTrigger>
                  )}
              </ListGroup.Item>
            );
          })}
        </ListGroup>

        <h5 className="mb-3 sidebar-section-title">Transaction Details</h5>
        {mediationDetails?.product ? (
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
              <Badge
                bg={
                  mediationDetails.status === "InProgress"
                    ? "success"
                    : mediationDetails.status === "Completed"
                    ? "primary"
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
        {currentUserRole === "Admin" && isDisputed && (
          <div className="admin-dispute-tools mt-4 pt-3 border-top">
            <h5 className="mb-3 text-danger sidebar-section-title">
              Admin Dispute Controls
            </h5>
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
                  !resolutionNotes.trim() ||
                  isResolvingDispute
                }
              >
                {isResolvingDispute ? (
                  <Spinner size="sm" />
                ) : (
                  "Rule in Favor of Buyer"
                )}
              </Button>
              <Button
                variant="warning"
                onClick={() => handleResolveDispute("seller")}
                disabled={
                  mediationDetails?.status !== "Disputed" ||
                  !resolutionNotes.trim() ||
                  isResolvingDispute
                }
              >
                {isResolvingDispute ? (
                  <Spinner size="sm" />
                ) : (
                  "Rule in Favor of Seller"
                )}
              </Button>
              <Button
                variant="outline-danger"
                onClick={() => handleCancelMediationByAdmin()}
                disabled={
                  mediationDetails?.status !== "Disputed" || isResolvingDispute
                }
                className="mt-2"
              >
                {isResolvingDispute ? (
                  <Spinner size="sm" />
                ) : (
                  "Cancel Mediation"
                )}
              </Button>
            </div>
          </div>
        )}

        {mediationDetails?.status === "Disputed" && (
          <div className="subchats-section mt-4 pt-3 border-top">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="mb-0 sidebar-section-title text-info">
                <FaComments className="me-1" /> Private Chats
              </h5>
              {currentUserRole === "Admin" && (
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip id="tooltip-new-subchat">
                      Create a new private discussion
                    </Tooltip>
                  }
                >
                  <Button
                    variant="outline-info"
                    size="sm"
                    onClick={handleOpenCreateSubChatModal}
                    className="btn-icon-round"
                  >
                    <FaUserPlus />
                  </Button>
                </OverlayTrigger>
              )}
            </div>
            {currentUserRole === "Admin" && loadingAdminSubChats && (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" variant="info" />
                <span className="ms-2 small">Loading chats...</span>
              </div>
            )}
            {currentUserRole === "Admin" &&
              !loadingAdminSubChats &&
              adminSubChatsList.length === 0 && (
                <p className="text-muted small fst-italic mt-2">
                  No private chats initiated by admin yet.
                </p>
              )}
            {currentUserRole === "Admin" &&
              !loadingAdminSubChats &&
              adminSubChatsList.length > 0 && (
                <ListGroup variant="flush" className="subchat-display-list">
                  {adminSubChatsList.map((subChat) => {
                    const otherUsersInSubChat = subChat.participants
                      ?.filter((par) => par.userId?._id !== currentUserId)
                      .map((par) => par.userId?.fullName);
                    let chatDisplayName = subChat.title;
                    if (!chatDisplayName) {
                      if (
                        otherUsersInSubChat &&
                        otherUsersInSubChat.length === 1
                      )
                        chatDisplayName = `Chat with ${otherUsersInSubChat[0]}`;
                      else if (
                        otherUsersInSubChat &&
                        otherUsersInSubChat.length > 1
                      )
                        chatDisplayName = `Group: ${otherUsersInSubChat
                          .slice(0, 1)
                          .join(", ")} & ${
                          otherUsersInSubChat.length - 1
                        } other(s)`;
                      else chatDisplayName = "Private Discussion";
                    }
                    const lastMessage =
                      subChat.messages && subChat.messages.length > 0
                        ? subChat.messages[subChat.messages.length - 1]
                        : null;
                    let lastMessageSnippet =
                      lastMessage?.type === "system"
                        ? "Chat started"
                        : "No messages yet.";
                    if (lastMessage && lastMessage.type !== "system") {
                      lastMessageSnippet =
                        lastMessage.type === "text"
                          ? (lastMessage.message || "").substring(0, 25) + "..."
                          : `[${
                              lastMessage.type.charAt(0).toUpperCase() +
                              lastMessage.type.slice(1)
                            }]`;
                    }
                    const unreadCount = subChat.unreadMessagesCount || 0;
                    return (
                      <ListGroup.Item
                        key={subChat.subChatId}
                        action
                        onClick={() => handleOpenSubChatModal(subChat)}
                        className={`subchat-display-list-item ${
                          activeSubChatId === subChat.subChatId
                            ? "active-subchat-item"
                            : ""
                        }`}
                      >
                        <div className="d-flex align-items-center">
                          <div className="subchat-item-avatars me-2">
                            {subChat.participants
                              ?.filter((p) => p.userId?._id !== currentUserId)
                              .slice(0, 2)
                              .map(
                                (p) =>
                                  p.userId &&
                                  renderMessageSenderAvatar(p.userId, 24)
                              )}
                          </div>
                          <div className="flex-grow-1">
                            <div className="fw-bold small chat-title-truncate">
                              {chatDisplayName}
                            </div>
                            <small className="text-muted d-block subchat-snippet-truncate">
                              {lastMessageSnippet}
                            </small>
                          </div>
                          <div className="text-end ms-2 subchat-item-meta">
                            {lastMessage && (
                              <small className="text-muted d-block subchat-timestamp">
                                {formatMessageTimestampForDisplay(
                                  lastMessage.timestamp
                                )}
                              </small>
                            )}
                            {unreadCount > 0 && (
                              <Badge
                                pill
                                bg="danger"
                                className="mt-1 subchat-unread-badge"
                              >
                                {unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </ListGroup.Item>
                    );
                  })}
                </ListGroup>
              )}
            {currentUserRole !== "Admin" &&
              mediationDetails?.adminSubChats?.filter((sc) =>
                sc.participants.some(
                  (p) =>
                    (p.userId?._id || p.userId)?.toString() ===
                    currentUserId?.toString()
                )
              ).length > 0 && (
                <ListGroup
                  variant="flush"
                  className="subchat-display-list mt-2"
                >
                  {mediationDetails.adminSubChats
                    .filter((sc) =>
                      sc.participants.some(
                        (p) =>
                          (p.userId?._id || p.userId)?.toString() ===
                          currentUserId?.toString()
                      )
                    )
                    .sort(
                      (a, b) =>
                        new Date(b.lastMessageAt || b.createdAt) -
                        new Date(a.lastMessageAt || a.createdAt)
                    )
                    .map((subChat) => {
                      const adminParticipant = subChat.participants?.find(
                        (p) => p.userId?.userRole === "Admin"
                      );
                      let chatDisplayName =
                        subChat.title ||
                        (adminParticipant
                          ? `Chat with Admin ${adminParticipant.userId.fullName}`
                          : "Admin Discussion");
                      let unreadCountForCurrentUser = 0;
                      const lastMessage =
                        subChat.messages && subChat.messages.length > 0
                          ? subChat.messages[subChat.messages.length - 1]
                          : null;
                      let lastMessageSnippet =
                        lastMessage?.type === "system"
                          ? "Chat started"
                          : "No messages yet.";
                      if (subChat.messages?.length > 0) {
                        subChat.messages.forEach((msg) => {
                          if (
                            msg.sender?._id !== currentUserId &&
                            (!msg.readBy ||
                              !msg.readBy.some(
                                (r) => r.readerId === currentUserId
                              ))
                          ) {
                            unreadCountForCurrentUser++;
                          }
                        });
                        if (lastMessage && lastMessage.type !== "system")
                          lastMessageSnippet =
                            lastMessage.type === "text"
                              ? (lastMessage.message || "").substring(0, 25) +
                                "..."
                              : `[${
                                  lastMessage.type.charAt(0).toUpperCase() +
                                  lastMessage.type.slice(1)
                                }]`;
                      }
                      return (
                        <ListGroup.Item
                          key={subChat.subChatId}
                          action
                          onClick={() => handleOpenSubChatModal(subChat)}
                          className={`subchat-display-list-item ${
                            activeSubChatId === subChat.subChatId
                              ? "active-subchat-item"
                              : ""
                          }`}
                        >
                          <div className="d-flex align-items-center">
                            <div className="subchat-item-avatars me-2">
                              {adminParticipant &&
                                renderMessageSenderAvatar(
                                  adminParticipant.userId,
                                  24
                                )}
                            </div>
                            <div className="flex-grow-1">
                              <div className="fw-bold small chat-title-truncate">
                                {chatDisplayName}
                              </div>
                              <small className="text-muted d-block subchat-snippet-truncate">
                                {lastMessageSnippet}
                              </small>
                            </div>
                            <div className="text-end ms-2 subchat-item-meta">
                              {lastMessage && (
                                <small className="text-muted d-block subchat-timestamp">
                                  {formatMessageTimestampForDisplay(
                                    lastMessage.timestamp
                                  )}
                                </small>
                              )}
                              {unreadCountForCurrentUser > 0 && (
                                <Badge
                                  pill
                                  bg="danger"
                                  className="mt-1 subchat-unread-badge"
                                >
                                  {unreadCountForCurrentUser}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </ListGroup.Item>
                      );
                    })}
                </ListGroup>
              )}
            {currentUserRole !== "Admin" &&
              (!mediationDetails?.adminSubChats ||
                mediationDetails.adminSubChats.filter((sc) =>
                  sc.participants.some(
                    (p) =>
                      (p.userId?._id || p.userId)?.toString() ===
                      currentUserId?.toString()
                  )
                ).length === 0) && (
                <p className="text-muted small fst-italic mt-2">
                  No private chats with admin for this dispute yet.
                </p>
              )}
          </div>
        )}
      </div>
      <div className="action-buttons-footer p-3 border-top mt-auto">
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
                  <Spinner as="span" animation="border" size="sm" />
                  Confirming...
                </>
              ) : (
                "Confirm Product Received"
              )}
            </Button>
          )}
        {(currentUserId === mediationDetails?.buyer?._id?.toString() ||
          currentUserId === mediationDetails?.seller?._id?.toString()) &&
          mediationDetails?.status === "InProgress" && (
            <Button
              variant={"danger"}
              className="w-100"
              onClick={handleOpenDispute}
              disabled={isOpeningDispute || isConfirmingReceipt || isDisputed}
            >
              {isOpeningDispute ? (
                <>
                  <Spinner as="span" animation="border" size="sm" /> Opening...
                </>
              ) : (
                "Open Dispute"
              )}
            </Button>
          )}
        {isDisputed && mediationDetails?.status === "Disputed" && (
          <Button variant="outline-secondary" className="w-100" disabled>
            Dispute In Progress
          </Button>
        )}
        {mediationDetails?.status === "Completed" && (
          <Button
            variant="info"
            className="w-100 mt-2"
            onClick={() => {
              dispatch(getRatingsForMediationAction(mediationRequestId));
              setSidebarView("ratings");
            }}
            disabled={
              loadingMediationRatings &&
              loadingMediationRatings[mediationRequestId]
            }
          >
            <FaStar className="me-1" /> Rate Participants
            {unratedPartiesCount > 0 && (
              <Badge pill bg="danger" className="ms-2">
                {unratedPartiesCount}
              </Badge>
            )}
            {loadingMediationRatings &&
              loadingMediationRatings[mediationRequestId] && (
                <Spinner as="span" size="sm" className="ms-1" />
              )}
          </Button>
        )}
      </div>
    </>
  );

  if (!currentUserId)
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" /> <p>Loading user...</p>
        <Alert variant="warning" className="mt-3">
          Please log in.
        </Alert>
      </Container>
    );
  if (loadingDetails && !mediationDetails)
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" /> <p>Loading mediation details...</p>
      </Container>
    );
  if (errorDetails && !mediationDetails)
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <h4>Error Loading Mediation Details</h4>
          <p>{errorDetails}</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Alert>
      </Container>
    );
  if (!mediationDetails && !loadingDetails && !errorDetails)
    return (
      <Container className="py-5 text-center">
        <Alert variant="warning">Mediation details unavailable.</Alert>
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
                  <small className="text-muted">
                    ID: {mediationRequestId.slice(-6)}
                  </small>
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
              {chatError && (
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
                    msg.type === "system";
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
                            : { paddingLeft: isMyMessage ? "0px" : "56px" }
                        }
                      >
                        {!isMyMessage && (
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
                        )}
                        <div
                          className={`message-content flex-grow-1 ${
                            isMyMessage
                              ? "align-items-end"
                              : "align-items-start"
                          }`}
                        >
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
                                alt="Chat image"
                                className="chat-image-preview"
                                onError={(e) => {
                                  if (
                                    e.target.src !== fallbackProductImageUrl
                                  ) {
                                    e.target.onerror = null;
                                    e.target.src = fallbackProductImageUrl;
                                  }
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
                            style={{
                              paddingRight: showAvatar ? "56px" : "16px",
                            }}
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
                    Chat is active when mediation is In Progress. Status:
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
                      className="btn-icon-round"
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
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error("Max file size 5MB.");
                            return;
                          }
                          if (!file.type.startsWith("image/")) {
                            toast.error("Only images.");
                            return;
                          }
                          handleImageUpload(file, false);
                        }
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                      style={{ display: "none" }}
                      ref={fileInputRef}
                    />
                    <Button
                      variant="light"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-icon-round"
                      disabled={
                        !hasJoinedRoom ||
                        !!chatError ||
                        isLoadingHistory ||
                        !isChatActuallyActiveForInput
                      }
                    >
                      <FaCamera />
                    </Button>
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
                      className="btn-icon-round"
                      disabled={
                        !newMessage.trim() ||
                        !hasJoinedRoom ||
                        !!chatError ||
                        isLoadingHistory ||
                        !isChatActuallyActiveForInput
                      }
                    >
                      <FaPaperPlane />
                    </Button>
                  </Col>
                </Row>
              </Form>
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="emoji-picker-container shadow-sm main-chat-emoji-picker"
                >
                  <EmojiPicker
                    onEmojiClick={(e) => onEmojiClick(e, false)}
                    emojiStyle={EmojiStyle.APPLE}
                    height={300}
                    width="100%"
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
          className="chat-sidebar-area bg-light border-start p-0 d-none d-md-flex flex-column order-md-2"
        >
          <div
            className="flex-grow-1 d-flex flex-column"
            style={{ minHeight: 0 }}
          >
            {mediationDetails ? (
              sidebarView === "details" ? (
                renderTransactionDetailsAndActions()
              ) : (
                renderRatingsPanel()
              )
            ) : loadingDetails ? (
              <div className="text-center p-3 flex-grow-1 d-flex align-items-center justify-content-center">
                <Spinner animation="border" />
              </div>
            ) : (
              <div className="p-3">
                <Alert variant="warning">Details unavailable.</Alert>
              </div>
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
          <Offcanvas.Title>
            {sidebarView === "details"
              ? "Details & Actions"
              : "Rate Participants"}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="d-flex flex-column p-0">
          {mediationDetails ? (
            sidebarView === "details" ? (
              renderTransactionDetailsAndActions()
            ) : (
              renderRatingsPanel()
            )
          ) : loadingDetails ? (
            <div className="text-center p-3 flex-grow-1 d-flex align-items-center justify-content-center">
              <Spinner animation="border" />
            </div>
          ) : (
            <div className="p-3">
              <Alert variant="warning">Details unavailable.</Alert>
            </div>
          )}
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
      <Modal
        show={showCreateSubChatModal}
        onHide={handleCloseCreateSubChatModal}
        centered
        dialogClassName="themed-modal"
      >
        <Modal.Header closeButton className="themed-modal-header">
          <Modal.Title>
            <FaUserPlus className="me-2 text-info" />
            Create New Private Chat
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errorCreatingSubChat && (
            <Alert variant="danger">{errorCreatingSubChat}</Alert>
          )}
          <Form onSubmit={handleCreateSubChat}>
            <Form.Group className="mb-3">
              <Form.Label>Chat Title (Optional)</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g., Clarification on item X"
                value={subChatTitle}
                onChange={(e) => setSubChatTitle(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>
                Select Participants (besides yourself, Admin)
              </Form.Label>
              {mediationDetails &&
                ["seller", "buyer", "mediator"].map((role) => {
                  const party = mediationDetails[role];
                  if (party && party._id !== currentUserId) {
                    return (
                      <Form.Check
                        type="checkbox"
                        key={party._id}
                        id={`participant-check-${party._id}`}
                        label={
                          <>
                            {renderMessageSenderAvatar(party, 24)}
                            <span className="ms-1">
                              {party.fullName} (
                              {role.charAt(0).toUpperCase() + role.slice(1)})
                            </span>
                          </>
                        }
                        checked={selectedParticipants.includes(party._id)}
                        onChange={() => handleParticipantSelection(party._id)}
                        className="mb-1 participant-checkbox-item"
                      />
                    );
                  }
                  return null;
                })}
            </Form.Group>
            <Button
              variant="primary"
              type="submit"
              disabled={creatingSubChat || selectedParticipants.length === 0}
              className="w-100"
            >
              {creatingSubChat ? (
                <>
                  <Spinner as="span" size="sm" /> Creating...
                </>
              ) : (
                "Start Private Chat"
              )}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
      <Modal
        show={showSubChatModal}
        onHide={handleCloseSubChatModal}
        size="lg"
        centered
        dialogClassName="sub-chat-modal themed-modal"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton className="themed-modal-header">
          <Modal.Title className="d-flex align-items-center">
            <FaComments className="me-2 text-primary" />
            {activeSubChatDetails?.title || "Admin Private Chat"}
            {loadingActiveSubChatMessages && (
              <Spinner size="sm" className="ms-2" variant="primary" />
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="sub-chat-modal-body p-0 d-flex flex-column">
          {activeSubChatDetails?.participants && (
            <div className="subchat-participants-header p-2 bg-light border-bottom small text-muted">
              <strong>Participants: </strong>
              {activeSubChatDetails.participants
                .map((p) => p.userId?.fullName || "User")
                .join(", ")}
            </div>
          )}
          <ListGroup
            variant="flush"
            className="sub-chat-messages-list flex-grow-1 p-3 custom-scrollbar"
          >
            {loadingActiveSubChatMessages &&
              activeSubChatMessages.length === 0 && (
                <div className="text-center p-5">
                  <Spinner variant="primary" /> Loading...
                </div>
              )}
            {!loadingActiveSubChatMessages &&
              activeSubChatMessages.length === 0 && (
                <ListGroup.Item className="text-center text-muted border-0 py-5">
                  No messages in this private chat yet.
                </ListGroup.Item>
              )}
            {activeSubChatMessages.map((msg, index) => {
              const isMySubChatMessage = msg.sender?._id === currentUserId;
              const prevSubChatMessage = activeSubChatMessages[index - 1];
              const showSubChatAvatar =
                !prevSubChatMessage ||
                prevSubChatMessage.sender?._id !== msg.sender?._id ||
                msg.type === "system";
              if (msg.type === "system") {
                return (
                  <ListGroup.Item
                    key={msg._id || `submsg-sys-${index}`}
                    className="message-item system-message text-center my-2 border-0"
                  >
                    <div className="d-inline-block p-2 rounded bg-light-subtle text-muted small system-message-bubble">
                      <span dangerouslySetInnerHTML={{ __html: msg.message }} />
                      <div className="message-timestamp mt-1">
                        {formatMessageTimestampForDisplay(msg.timestamp)}
                      </div>
                    </div>
                  </ListGroup.Item>
                );
              }
              return (
                <React.Fragment
                  key={msg._id || `submsg-${index}-${msg.timestamp}`}
                >
                  <ListGroup.Item
                    className={`d-flex mb-1 message-item border-0 ${
                      isMySubChatMessage ? "sent" : "received"
                    } ${showSubChatAvatar ? "mt-2" : "mt-1"}`}
                    style={
                      showSubChatAvatar || msg.type === "system"
                        ? {}
                        : { paddingLeft: isMySubChatMessage ? "0px" : "56px" }
                    }
                  >
                    {!isMySubChatMessage && (
                      <div
                        className="avatar-container me-2 flex-shrink-0"
                        style={{
                          width: "40px",
                          height: "40px",
                          visibility:
                            showSubChatAvatar && msg.sender
                              ? "visible"
                              : "hidden",
                        }}
                      >
                        {showSubChatAvatar &&
                          msg.sender &&
                          renderMessageSenderAvatar(msg.sender)}
                      </div>
                    )}
                    <div
                      className={`message-content flex-grow-1 ${
                        isMySubChatMessage
                          ? "align-items-end"
                          : "align-items-start"
                      }`}
                    >
                      <div className="message-bubble">
                        {showSubChatAvatar &&
                          !isMySubChatMessage &&
                          msg.sender && (
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
                            alt="Sub-chat attachment"
                            className="chat-image-preview"
                            onError={(e) => {
                              e.target.src = fallbackProductImageUrl;
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
                          isMySubChatMessage
                            ? "justify-content-end"
                            : "justify-content-start"
                        } align-items-center mt-1`}
                      >
                        <small className="text-muted message-timestamp">
                          {formatMessageTimestampForDisplay(msg.timestamp)}
                        </small>
                      </div>
                    </div>
                  </ListGroup.Item>
                </React.Fragment>
              );
            })}
            <div ref={subChatMessagesEndRef} style={{ height: "1px" }} />
          </ListGroup>
        </Modal.Body>
        <Modal.Footer className="sub-chat-modal-footer themed-modal-footer">
          {/* --- [!!!] قسم معاينة الصورة --- [!!!] */}
          {subChatImagePreview && (
            <div className="subchat-image-preview-wrapper mb-2 align-self-start">
              <Card
                style={{
                  width: "100px",
                  position: "relative",
                  cursor: "pointer",
                }} /* <-- إضافة cursor */
                onClick={() =>
                  handleShowImageInModal(subChatImagePreview)
                } /* <-- إضافة onClick */
              >
                <Card.Img
                  variant="top"
                  src={subChatImagePreview}
                  style={{ maxHeight: "100px", objectFit: "cover" }}
                />
                <Button
                  variant="danger"
                  size="sm"
                  className="position-absolute top-0 end-0 m-1 p-0"
                  style={{
                    lineHeight: 1,
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    fontSize: "0.8rem",
                  }}
                  onClick={(e) => {
                    e.stopPropagation(); // <-- منع فتح الصورة عند الضغط على زر الحذف
                    setSubChatFile(null);
                    setSubChatImagePreview(null);
                    if (subChatFileInputRef.current)
                      subChatFileInputRef.current.value = "";
                  }}
                  title="Remove image"
                >
                  ×
                </Button>
              </Card>
            </div>
          )}
          {/* --- [!!!] نهاية قسم معاينة الصورة --- [!!!] */}
          <div className="typing-indicator-container w-100">
            {Object.keys(subChatTypingUsers).length > 0 && (
              <TypingIndicator
                typingUsersData={subChatTypingUsers}
                currentUserId={currentUserId}
              />
            )}
          </div>
          <Form
            onSubmit={handleSendSubChatMessage}
            className="w-100 d-flex align-items-center"
          >
            <Button
              ref={subChatEmojiButtonRef}
              variant="light"
              onClick={() => setShowSubChatEmojiPicker((prev) => !prev)}
              title="Emoji"
              className="me-1 btn-icon-round"
              disabled={loadingActiveSubChatMessages}
            >
              <FaSmile />
            </Button>
            <Form.Control
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  if (file.size > 5 * 1024 * 1024) {
                    // 5MB
                    toast.error("Max file size is 5MB.");
                    setSubChatFile(null);
                    setSubChatImagePreview(null);
                    if (subChatFileInputRef.current)
                      subChatFileInputRef.current.value = "";
                    return;
                  }
                  if (!file.type.startsWith("image/")) {
                    toast.error("Please select an image file.");
                    setSubChatFile(null);
                    setSubChatImagePreview(null);
                    if (subChatFileInputRef.current)
                      subChatFileInputRef.current.value = "";
                    return;
                  }
                  setSubChatFile(file); // خزّن الملف
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setSubChatImagePreview(reader.result); // خزّن dataURL للمعاينة
                  };
                  reader.readAsDataURL(file);
                } else {
                  setSubChatFile(null);
                  setSubChatImagePreview(null);
                }
              }}
              style={{ display: "none" }}
              ref={subChatFileInputRef}
            />
            <Button
              variant="light"
              onClick={() => subChatFileInputRef.current?.click()}
              className="me-1 btn-icon-round"
              disabled={loadingActiveSubChatMessages}
              title="Attach image"
            >
              <FaCamera />
            </Button>
            <Form.Control
              type="text"
              placeholder="Type message..."
              value={newSubChatMessage}
              onChange={handleSubChatInputChange}
              disabled={loadingActiveSubChatMessages}
              autoFocus
              className="flex-grow-1 me-1 subchat-input-field"
            />
            <Button
              variant="primary"
              type="submit"
              className="btn-icon-round"
              disabled={
                loadingActiveSubChatMessages ||
                (!newSubChatMessage.trim() && !subChatFile) // تم التعديل للتحقق من subChatFile
              }
            >
              <FaPaperPlane />
            </Button>
          </Form>
          {showSubChatEmojiPicker && (
            <div
              ref={subChatEmojiPickerRef}
              className="emoji-picker-container shadow-sm subchat-emoji-picker"
            >
              <EmojiPicker
                onEmojiClick={(e) => onEmojiClick(e, true)}
                emojiStyle={EmojiStyle.APPLE}
                height={300}
                width="100%"
                searchDisabled
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default MediationChatPage;
