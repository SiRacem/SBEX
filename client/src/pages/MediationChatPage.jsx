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
  FaCrown,
  FaShieldAlt,
  FaStar,
  FaArrowLeft,
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  buyerConfirmReceipt,
  openDisputeAction,
  getMediationDetailsByIdAction,
  updateMediationDetailsFromSocket,
  clearActiveMediationDetails,
  adminResolveDisputeAction,
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
  const currentUserId = useSelector((state) => state.userReducer.user?._id);
  const currentUserRole = useSelector(
    (state) => state.userReducer.user?.userRole
  );
  const mediationDetails = useSelector(
    (state) => state.mediationReducer.activeMediationDetails
  );
  const loadingDetails = useSelector(
    (state) => state.mediationReducer.loadingActiveMediationDetails
  );
  const errorDetails = useSelector(
    (state) => state.mediationReducer.errorActiveMediationDetails
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
  // const joinTimeoutRef = useRef(null); // <<< تم إزالته/تعديله
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

  const handleShowDetailsOffcanvas = () => setShowDetailsOffcanvas(true);
  const handleCloseDetailsOffcanvas = () => setShowDetailsOffcanvas(false);

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
    const parties = [];
    const { seller, buyer, mediator } = mediationDetails;
    if (
      seller &&
      seller._id !== currentUserId &&
      !uniqueRatedUserIds.includes(seller._id)
    ) {
      parties.push({
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
      parties.push({ id: buyer._id, fullName: buyer.fullName, role: "Buyer" });
    }
    if (
      mediator &&
      mediator._id !== currentUserId &&
      !uniqueRatedUserIds.includes(mediator._id)
    ) {
      parties.push({
        id: mediator._id,
        fullName: mediator.fullName,
        role: "Mediator",
      });
    }
    return parties;
  }, [mediationDetails, currentUserId, mediationRatings, mediationRequestId]);

  const unratedPartiesCount = partiesNotYetRatedByCurrentUser.length;

  const scrollToBottom = useCallback((options = { behavior: "smooth" }) => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView(options), 100);
  }, []);

  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0) {
      scrollToBottom({ behavior: "smooth" });
    }
  }, [messages, isLoadingHistory, scrollToBottom]);

  // useEffect(() => { // يمكن دمج هذا مع السابق إذا كان السلوك "auto" مرغوبًا دائمًا
  //   if (!isLoadingHistory && messages.length > 0) {
  //     scrollToBottom({ behavior: "auto" });
  //   }
  // }, [isLoadingHistory, messages.length, scrollToBottom]);

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
        .filter((id) => id); // Ensure IDs are valid
      if (unreadReceivedMessageIds.length > 0) {
        console.log(
          "[MediationChatPage] Marking messages as read:",
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
    if (
      mediationRequestId &&
      currentUserId &&
      (!mediationDetails || mediationDetails._id !== mediationRequestId)
    ) {
      console.log(
        "[MediationChatPage] Fetching mediation details for ID:",
        mediationRequestId
      );
      dispatch(getMediationDetailsByIdAction(mediationRequestId));
    }
  }, [dispatch, mediationRequestId, currentUserId, mediationDetails]);

  const fetchChatHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setChatError(null);
    console.log(
      "[MediationChatPage] Fetching chat history for:",
      mediationRequestId
    );
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication token missing.");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(
        `${BACKEND_URL}/mediation/chat/${mediationRequestId}/history`,
        config
      );
      setMessages(response.data || []);
      console.log(
        "[MediationChatPage] Chat history loaded, messages count:",
        response.data?.length || 0
      );
    } catch (err) {
      console.error("[MediationChatPage] Error loading chat history:", err);
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

  // <<< تعديل: دالة الانضمام للغرفة أصبحت هنا ومستخدمة في useEffect الخاص بالـ socket
  const handleJoinChatRoom = useCallback(() => {
    if (
      socket &&
      socket.connected &&
      mediationRequestId &&
      currentUserId &&
      currentUserRole
    ) {
      console.log(
        `[MediationChatPage - handleJoinChatRoom] Attempting to join room: ${mediationRequestId} for user: ${currentUserId} (Role: ${currentUserRole})`
      );
      socket.emit("joinMediationChat", {
        mediationRequestId,
        userId: currentUserId,
        userRole: currentUserRole,
      });
    } else {
      console.warn(
        "[MediationChatPage - handleJoinChatRoom] Could not attempt to join room due to missing data/connection. Socket connected:",
        socket?.connected,
        "MediationID:",
        mediationRequestId,
        "UserID:",
        currentUserId,
        "UserRole:",
        currentUserRole
      );
    }
  }, [socket, mediationRequestId, currentUserId, currentUserRole]);

  useEffect(() => {
    if (!socket || !currentUserId || !mediationRequestId || !mediationDetails) {
      console.log(
        "[MediationChatPage - Socket useEffect] Skipping setup: Missing socket, user, mediation ID, or details."
      );
      return;
    }
    console.log(
      "[MediationChatPage - Socket useEffect] Setting up socket event listeners for:",
      mediationRequestId
    );

    const handleJoinedSuccess = (data) => {
      console.log(
        "[MediationChatPage - Socket Event] 'joinedMediationChatSuccess':",
        data
      );
      setHasJoinedRoom(true);
      setChatError(null); // Clear any previous chat errors on successful join
      markVisibleMessagesAsReadCallback();
    };

    const handleNewMessage = (message) => {
      console.log(
        "[MediationChatPage - Socket Event] 'newMediationMessage':",
        message
      );
      setMessages((prevMessages) => {
        if (prevMessages.some((m) => m._id === message._id)) {
          console.log(
            "[MediationChatPage - handleNewMessage] Duplicate message skipped:",
            message._id
          );
          return prevMessages;
        }
        const newMessagesArray = [...prevMessages, message];
        if (
          message.sender?._id !== currentUserId &&
          socket.connected && // Ensure socket is still connected
          document.visibilityState === "visible" &&
          message._id // Ensure message has an ID
        ) {
          console.log(
            "[MediationChatPage - handleNewMessage] Auto-marking new incoming message as read:",
            message._id
          );
          socket.emit("mark_messages_read", {
            mediationRequestId,
            messageIds: [message._id],
            readerUserId: currentUserId,
          });
        }
        return newMessagesArray;
      });

      if (message.sender && message.sender._id) {
        setTypingUsers((prevTypingUsers) => {
          if (prevTypingUsers.hasOwnProperty(message.sender._id)) {
            const updatedTypingUsers = { ...prevTypingUsers };
            delete updatedTypingUsers[message.sender._id];
            return updatedTypingUsers;
          }
          return prevTypingUsers;
        });
      }
    };

    const handleMessagesStatusUpdated = ({
      mediationRequestId: updatedMedId,
      updatedMessages, // Array of { _id, readBy: [{ readerId, timestamp, fullName, avatarUrl }] }
    }) => {
      console.log(
        "[MediationChatPage - Socket Event] 'messages_status_updated':",
        { updatedMedId, updatedMessages }
      );
      if (updatedMedId === mediationRequestId) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            const updatedMsgInfo = updatedMessages.find(
              (uMsg) => uMsg._id === msg._id
            );
            if (
              updatedMsgInfo &&
              updatedMsgInfo.readBy &&
              updatedMsgInfo.readBy.length > 0
            ) {
              const newReaderEntry = updatedMsgInfo.readBy[0]; // Server sends the latest reader info
              const existingReadBy = Array.isArray(msg.readBy)
                ? msg.readBy
                : [];

              const alreadyReadByThisReader = existingReadBy.some(
                (r) => r.readerId === newReaderEntry.readerId
              );

              if (!alreadyReadByThisReader) {
                console.log(
                  `[MediationChatPage - handleMessagesStatusUpdated] Adding reader ${newReaderEntry.readerId} to message ${msg._id}`
                );
                return { ...msg, readBy: [...existingReadBy, newReaderEntry] };
              } else {
                // Optional: update if newReaderEntry has more details (e.g. fullName/avatarUrl if missing)
                // or if timestamp is significantly different. For now, just keep existing.
                return msg;
              }
            }
            return msg;
          })
        );
      }
    };

    const handleMediationDetailsUpdated = ({
      mediationRequestId: updatedMedId,
      updatedMediationDetails,
    }) => {
      console.log(
        "[MediationChatPage - Socket Event] 'mediation_details_updated':",
        { updatedMedId, updatedMediationDetails }
      );
      if (updatedMedId === mediationRequestId) {
        dispatch(updateMediationDetailsFromSocket(updatedMediationDetails));
      }
    };

    const handleChatErrorEvent = (errorEvent) => {
      console.error(
        "[MediationChatPage - Socket Event] 'mediationChatError':",
        errorEvent
      );
      setChatError(errorEvent.message || "Chat error occurred.");
      setHasJoinedRoom(false); // Assume join failed or connection problematic
    };

    const handleDisconnectEvent = (reason) => {
      console.warn("[MediationChatPage - Socket Event] 'disconnect':", reason);
      setChatError("Chat connection lost. Attempting to reconnect...");
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

    // Socket event listeners
    socket.on("connect", handleJoinChatRoom); // <<< Re-join on connect/reconnect
    socket.on("joinedMediationChatSuccess", handleJoinedSuccess);
    socket.on("newMediationMessage", handleNewMessage);
    socket.on("messages_status_updated", handleMessagesStatusUpdated);
    socket.on("mediation_details_updated", handleMediationDetailsUpdated);
    socket.on("mediationChatError", handleChatErrorEvent);
    socket.on("disconnect", handleDisconnectEvent);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);

    // Attempt to join if already connected
    if (socket.connected) {
      console.log(
        "[MediationChatPage - Socket useEffect] Socket already connected, calling handleJoinChatRoom."
      );
      handleJoinChatRoom();
    }

    return () => {
      console.log(
        "[MediationChatPage - Socket useEffect Cleanup] Removing listeners for:",
        mediationRequestId
      );
      // if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current); // No longer needed
      if (socket && socket.connected && mediationRequestId) {
        // Check if socket is defined before emitting
        console.log(
          "[MediationChatPage - Socket Cleanup] Emitting 'leaveMediationChat' for:",
          mediationRequestId
        );
        socket.emit("leaveMediationChat", { mediationRequestId });
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          socket.emit("stop_typing", { mediationRequestId });
          typingTimeoutRef.current = null;
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
    };
  }, [
    socket,
    mediationRequestId,
    currentUserId,
    //currentUserRole, // Included in handleJoinChatRoom's dependencies
    mediationDetails, // To re-evaluate if user can join if details change
    dispatch,
    markVisibleMessagesAsReadCallback,
    handleJoinChatRoom, // <<< Added handleJoinChatRoom
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
          // Check connection again before emitting
          socket.emit("stop_typing", { mediationRequestId });
          typingTimeoutRef.current = null;
        }
      }, 1500);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    console.log(
      "[MediationChatPage] Attempting to send message. Content:",
      newMessage.trim()
    );
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
      console.log("[MediationChatPage] 'sendMediationMessage' emitted.");
      setNewMessage("");
      setShowEmojiPicker(false);
    } else {
      console.warn(
        "[MediationChatPage] Cannot send message. Conditions not met. Message:",
        newMessage,
        "Socket connected:",
        socket?.connected,
        "Joined room:",
        hasJoinedRoom
      );
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
            console.warn(
              `[MediationChatPage] Failed to load avatar for ${
                sender?.fullName || "user"
              }: ${avatar}. Using fallback.`
            );
            if (e.target.src !== noUserAvatar) {
              e.target.onerror = null; // Prevent infinite loop if fallback fails
              e.target.src = noUserAvatar;
            }
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
    console.log("[MediationChatPage] Uploading image:", fileToUpload.name);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/mediation/chat/upload-image`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { imageUrl } = response.data;
      if (imageUrl) {
        console.log(
          "[MediationChatPage] Image uploaded successfully, URL:",
          imageUrl
        );
        socket.emit("sendMediationMessage", { mediationRequestId, imageUrl });
        console.log(
          "[MediationChatPage] 'sendMediationMessage' with image emitted."
        );
      }
    } catch (error) {
      console.error("[MediationChatPage] Failed to upload image:", error);
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
    ) {
      return {};
    }
    const indicators = {};
    otherParticipants.forEach((participant) => {
      if (!participant || !participant.id) return;
      let lastReadByThisParticipantMessageId = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (
          m &&
          m.sender &&
          m.sender._id &&
          m.sender._id.toString() === currentUserId.toString() &&
          m.readBy &&
          Array.isArray(m.readBy) &&
          m.readBy.some(
            (rb) =>
              rb &&
              rb.readerId &&
              rb.readerId.toString() === participant.id.toString()
          )
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
              fullName: readerEntry.fullName || participant.fullName || "User", // Use fullName from readBy if available
              avatarUrl: readerEntry.avatarUrl || participant.avatarUrl, // Use avatarUrl from readBy if available
              readAt: readerEntry.readAt,
            });
          }
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
    [fallbackProductImageUrl] // fallbackProductImageUrl is stable
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
      } catch (error) {
        console.error("[MediationChatPage] Error confirming receipt:", error);
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
        console.error("[MediationChatPage] Error opening dispute:", error);
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
      toast.warn(
        "Action not allowed, already in progress, or not in correct state."
      );
      return;
    }
    if (!resolutionNotes.trim()) {
      toast.warn("Resolution notes are required to resolve the dispute.");
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
      toast.error("Invalid winner role specified.");
      return;
    }
    if (!winnerId || !loserId) {
      toast.error(
        "Could not determine winner or loser ID from mediation details."
      );
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to rule in favor of the ${winnerRole}? Resolution notes: "${resolutionNotes}". This action is final.`
      )
    ) {
      return;
    }
    setIsResolvingDispute(true);
    const resolutionData = {
      winnerId,
      loserId,
      resolutionNotes: resolutionNotes.trim(),
      cancelMediation: false,
    };
    console.log(
      `[MediationChatPage] Admin resolving dispute. Winner: ${winnerRole}, Notes: ${resolutionNotes}, Mediation ID: ${mediationDetails._id}`
    );
    try {
      await dispatch(
        adminResolveDisputeAction(mediationDetails._id, resolutionData)
      );
    } catch (error) {
      console.error(
        "[MediationChatPage] Error resolving dispute from component:",
        error
      );
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
      toast.warn("Action not allowed or not in correct state.");
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to cancel this mediation? This is a drastic measure. Notes: "${resolutionNotes}"`
      )
    ) {
      return;
    }
    setIsResolvingDispute(true);
    const resolutionData = {
      resolutionNotes:
        resolutionNotes.trim() || "Mediation cancelled by admin.",
      cancelMediation: true,
    };
    console.log(
      `[MediationChatPage] Admin cancelling mediation. Mediation ID: ${mediationDetails._id}, Notes: ${resolutionNotes}`
    );
    try {
      await dispatch(
        adminResolveDisputeAction(mediationDetails._id, resolutionData)
      );
    } catch (error) {
      console.error(
        "[MediationChatPage] Error cancelling mediation from component:",
        error
      );
    } finally {
      setIsResolvingDispute(false);
    }
  };

  const renderRatingsPanel = () => {
    const isLoadingSpecificRatings =
      loadingMediationRatings && loadingMediationRatings[mediationRequestId];

    if (isLoadingSpecificRatings && !mediationRatings[mediationRequestId]) {
      // Show loader if loading and no data yet
      return (
        <div className="text-center p-3">
          <Spinner animation="border" size="sm" /> Loading ratings...
        </div>
      );
    }

    if (!mediationDetails) {
      // Should ideally not happen if this panel is shown
      return (
        <Alert variant="warning" className="m-3">
          Mediation details not available.
        </Alert>
      );
    }

    if (mediationDetails.status !== "Completed") {
      return (
        <Alert variant="info" className="m-3">
          Ratings are available once the transaction is completed.
        </Alert>
      );
    }

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
            <FaArrowLeft className="me-1" /> Back to Details
          </Button>
        </div>
        <div
          className="p-3 flex-grow-1" // flex-grow-1 allows this div to take available space
          style={{ overflowY: "auto", minHeight: "0" }} // overflowY enables scrolling, minHeight:0 for flex item scroll
        >
          {/* Scrollable content area for ratings */}
          {partiesNotYetRatedByCurrentUser.length > 0 ? (
            partiesNotYetRatedByCurrentUser.map((party) => (
              <RatingForm
                key={party.id}
                mediationRequestId={mediationRequestId}
                ratedUserId={party.id}
                ratedUserFullName={party.fullName}
                onRatingSubmitted={() => {
                  // Re-fetch ratings for this mediation to update the list
                  // and potentially see if all are rated to show success message
                  dispatch(getRatingsForMediationAction(mediationRequestId));
                }}
              />
            ))
          ) : (
            <Alert variant="success" className="m-0">
              You have rated all available participants for this transaction.
              Thank you!
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

  const renderTransactionDetailsAndActions = () => (
    <>
      <div className="flex-grow-1" style={{ overflowY: "auto" }}>
        {/* Make this part scrollable */}
        <div className="p-3">
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
                        <FaShieldAlt />
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
                      ? "primary" // Changed to primary for completed
                      : isDisputed
                      ? "danger"
                      : "info" // Default for other statuses
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
              <h5 className="mb-3 text-danger">Admin Dispute Controls</h5>
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
        </div>
      </div>

      {/* Action buttons footer - should stick to bottom */}
      <div className="action-buttons-footer p-3 border-top mt-auto">
        {/* mt-auto to push to bottom */}
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
            } // Disable if ratings are loading
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

  // --- بداية العرض الرئيسي ---
  if (!currentUserId) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p>Loading user...</p>
        <Alert variant="warning" className="mt-3">
          Please log in.
        </Alert>
      </Container>
    );
  }

  if (loadingDetails && !mediationDetails) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p>Loading mediation details...</p>
      </Container>
    );
  }

  if (errorDetails && !mediationDetails) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <h4>Error Loading Mediation Details</h4>
          <p>{errorDetails}</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Alert>
      </Container>
    );
  }

  if (!mediationDetails && !loadingDetails && !errorDetails) {
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
              {/* ... (جزء الـ Header الحالي بدون تغيير جوهري) ... */}
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
                    // ... (عرض رسائل النظام، بدون تغيير جوهري)
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
                                alt="Chat image" // <<< تعديل: نص بديل أوضح
                                className="chat-image-preview"
                                // <<< تعديل: معالج onError محسن
                                onError={(e) => {
                                  console.warn(
                                    `[MediationChatPage] Failed to load chat image: ${e.target.src}. Replacing with fallback.`
                                  );
                                  if (
                                    e.target.src !== fallbackProductImageUrl
                                  ) {
                                    e.target.onerror = null; // لمنع حلقة لا نهائية
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
                        {/* ... (Avatar for sent messages - if you decide to show it) ... */}
                      </ListGroup.Item>
                      {isMyMessage &&
                        avatarsForThisMessage &&
                        avatarsForThisMessage.length > 0 && (
                          // ... (عرض مؤشرات القراءة، بدون تغيير جوهري)
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
                mediationDetails && // mediationDetails must exist here
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
                      disabled={
                        !hasJoinedRoom ||
                        !!chatError || // Disable if chat connection error
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
                              // 5MB
                              toast.error("Max file size is 5MB.");
                              return;
                            }
                            if (!file.type.startsWith("image/")) {
                              toast.error("Only image files are allowed.");
                              return;
                            }
                            handleImageUpload(file);
                          }
                          if (fileInputRef.current)
                            fileInputRef.current.value = ""; // Reset file input
                        }}
                        style={{ display: "none" }}
                        ref={fileInputRef}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={
                          !hasJoinedRoom ||
                          !!chatError || // Disable if chat connection error
                          isLoadingHistory ||
                          !isChatActuallyActiveForInput
                        }
                      >
                        📷
                        {/* Using emoji for camera as an example, replace with FaPaperclip if preferred */}
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
                        !!chatError || // Disable if chat connection error
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
                        !!chatError || // Disable if chat connection error
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
                    emojiStyle={EmojiStyle.APPLE} // Or your preferred style
                    height={320}
                    searchDisabled
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              )}
            </Card.Footer>
          </Card>
        </Col>

        {/* Sidebar for larger screens */}
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
                <Alert variant="warning">
                  Details unavailable for sidebar.
                </Alert>
              </div>
            )}
          </div>
        </Col>
      </Row>

      {/* Offcanvas for smaller screens */}
      <Offcanvas
        show={showDetailsOffcanvas}
        onHide={() => {
          handleCloseDetailsOffcanvas();
          // setSidebarView('details'); // Optionally reset view when closing offcanvas, or let it persist
        }}
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
          {mediationDetails ? ( // Only render offcanvas content if mediationDetails exist
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
              <Alert variant="warning">
                Details unavailable for offcanvas.
              </Alert>
            </div>
          )}
        </Offcanvas.Body>
      </Offcanvas>

      {/* Image Modal */}
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

// --- إعادة تصدير المكونات التي لم تتغير ---
// (renderRatingsPanel و renderTransactionDetailsAndActions يجب أن تكونا داخل MediationChatPage أو يتم استيرادهما)
// لأغراض هذا الرد، افترضت أنهما جزء من MediationChatPage. إذا كانا ملفات منفصلة، لا تغييرات هناك.

export default MediationChatPage;
