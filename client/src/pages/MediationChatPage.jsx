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
  Tooltip, // Carousel was unused, removed. Tooltip is used.
  OverlayTrigger,
} from "react-bootstrap";
import io from "socket.io-client";
import axios from "axios";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";
import { FaPaperclip, FaSmile, FaPaperPlane, FaCheck } from "react-icons/fa";
import { toast } from "react-toastify";
import "./MediationChatPage.css";
import { buyerConfirmReceipt } from "../redux/actions/mediationAction";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const noUserAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png"; // Ensure this path is correct or use a placeholder
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
  console.log("--- MediationChatPage RENDER ---");
  const { mediationRequestId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch(); // Keep if used by other parts not shown or planned

  const currentUserId = useSelector((state) => state.userReducer.user?._id);
  const currentUserRole = useSelector(
    (state) => state.userReducer.user?.userRole
  );
  const onlineUserIds = useSelector(
    (state) => state.userReducer?.onlineUserIds || []
  );
  // const currentUserFullName = useSelector((state) => state.userReducer.user?.fullName); // Not directly used, can be removed if not needed elsewhere

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

  const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false); // حالة تحميل للزر

  const handleShowDetailsOffcanvas = () => setShowDetailsOffcanvas(true);
  const handleCloseDetailsOffcanvas = () => setShowDetailsOffcanvas(false);

  const scrollToBottom = useCallback((options = { behavior: "smooth" }) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView(options);
    }, 100); // Small delay to ensure DOM is ready
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages arrive, but only if not loading history initially
    if (!isLoadingHistory && messages.length > 0) {
      // Determine if we should scroll smoothly or instantly
      // For example, if the user has scrolled up, maybe don't scroll smoothly
      // For now, always smooth scroll on new messages if not loading history
      scrollToBottom({ behavior: "smooth" });
    }
  }, [messages, isLoadingHistory, scrollToBottom]);

  useEffect(() => {
    // Instant scroll when history first loads
    if (!isLoadingHistory && messages.length > 0 && messagesEndRef.current) {
      const lastFewMessages = messages.slice(-3); // Check if any of the last few messages are new
      // This condition can be improved, but for now, scrolls if history is not loading.
      if (messages.length > 0) {
        // Simplified: scroll if messages exist after loading
        scrollToBottom({ behavior: "auto" });
      }
    }
  }, [isLoadingHistory, messages.length, scrollToBottom]);

  const markVisibleMessagesAsReadCallback = useCallback(() => {
    const currentSocket = socketRef.current;
    if (
      currentSocket?.connected &&
      hasJoinedRoom &&
      messages.length > 0 &&
      document.visibilityState === "visible" &&
      currentUserId &&
      mediationRequestId // Ensure mediationRequestId is available
    ) {
      const unreadReceivedMessageIds = messages
        .filter(
          (msg) =>
            msg.sender?._id !== currentUserId &&
            (!msg.readBy ||
              !msg.readBy.some((r) => r.readerId === currentUserId)) // Simpler check for current user
        )
        .map((msg) => msg._id)
        .filter((id) => id); // Filter out any potential undefined/null IDs

      if (unreadReceivedMessageIds.length > 0) {
        console.log(
          "[ChatPage - Visibility/Focus] Marking visible messages as read:",
          unreadReceivedMessageIds
        );
        currentSocket.emit("mark_messages_read", {
          mediationRequestId,
          messageIds: unreadReceivedMessageIds,
          readerUserId: currentUserId,
        });
      }
    }
  }, [messages, currentUserId, mediationRequestId, hasJoinedRoom]); // Dependencies for the core logic

  useEffect(() => {
    // Effect for visibility and focus changes
    console.log("[ChatPage - Effect] Setting up visibility/focus listeners.");
    document.addEventListener(
      "visibilitychange",
      markVisibleMessagesAsReadCallback
    );
    window.addEventListener("focus", markVisibleMessagesAsReadCallback);

    // Initial check if window is already visible
    if (document.visibilityState === "visible") {
      markVisibleMessagesAsReadCallback();
    }

    return () => {
      console.log(
        "[ChatPage - Effect] Cleaning up visibility/focus listeners."
      );
      document.removeEventListener(
        "visibilitychange",
        markVisibleMessagesAsReadCallback
      );
      window.removeEventListener("focus", markVisibleMessagesAsReadCallback);
    };
  }, [markVisibleMessagesAsReadCallback]); // Depends on the memoized callback

  useEffect(() => {
    // Effect for fetching mediation details
    if (mediationRequestId && currentUserId) {
      console.log(
        "[ChatPage - Effect] Fetching mediation details for:",
        mediationRequestId
      );
      const fetchMediationDetails = async () => {
        setLoadingDetails(true);
        setChatError(null); // Reset chat error before fetching
        try {
          const token = localStorage.getItem("token");
          if (!token) {
            setChatError("Authentication required. Please login again.");
            setLoadingDetails(false);
            return;
          }
          const config = { headers: { Authorization: `Bearer ${token}` } };
          const response = await axios.get(
            `${BACKEND_URL}/mediation/request-details/${mediationRequestId}`,
            config
          );
          setMediationDetails(response.data.mediationRequest || response.data); // Handle potential nesting
        } catch (err) {
          console.error("Failed to load mediation details:", err);
          setChatError(
            err.response?.data?.msg ||
              "Failed to load mediation details. Please try again."
          );
        } finally {
          setLoadingDetails(false);
        }
      };
      fetchMediationDetails();
    } else {
      setLoadingDetails(false); // If no ID, not loading
    }
  }, [mediationRequestId, currentUserId]); // Re-fetch if these change

  useEffect(() => {
    // Effect for fetching chat history
    if (mediationRequestId && currentUserId) {
      console.log(
        "[ChatPage - Effect] Fetching chat history for:",
        mediationRequestId
      );
      const fetchChatHistory = async () => {
        setIsLoadingHistory(true);
        // Do not reset chatError here, preserve errors from detail fetching
        try {
          const token = localStorage.getItem("token");
          if (!token) {
            setChatError(
              (prev) => prev || "Authentication token missing for chat history."
            );
            setIsLoadingHistory(false);
            return;
          }
          const config = { headers: { Authorization: `Bearer ${token}` } };
          const response = await axios.get(
            `${BACKEND_URL}/mediation/chat/${mediationRequestId}/history`,
            config
          );
          setMessages(response.data || []);
          if (!chatError && response.data) setChatError(null); // Clear error if history loads successfully and no prior error
        } catch (err) {
          console.error("Failed to load chat history:", err);
          setChatError(
            (prev) =>
              prev ||
              err.response?.data?.msg ||
              "Failed to load chat history. Please try again."
          );
        } finally {
          setIsLoadingHistory(false);
        }
      };
      fetchChatHistory();
    } else {
      setIsLoadingHistory(false); // If no ID, not loading
    }
  }, [mediationRequestId, currentUserId]); // Re-fetch if these change

  // Main Socket Connection useEffect
  useEffect(() => {
    console.log("[ChatPage - SOCKET useEffect] Fired.");
    const userIdForEffect = currentUserId;
    const roleForEffect = currentUserRole;
    const mediationIdForEffect = mediationRequestId;

    // Conditions to prevent socket connection
    if (!userIdForEffect || !mediationIdForEffect) {
      console.log(
        "[ChatPage - SOCKET useEffect] Missing userId or mediationId. Skipping socket setup."
      );
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setHasJoinedRoom(false);
      return;
    }

    if (loadingDetails) {
      console.log(
        "[ChatPage - SOCKET useEffect] Mediation details are loading. Skipping socket setup for now."
      );
      return; // Don't connect if details are still loading
    }

    if (!mediationDetails && !loadingDetails) {
      console.log(
        "[ChatPage - SOCKET useEffect] No mediationDetails and not loadingDetails. Skipping socket setup."
      );
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setHasJoinedRoom(false);
      return;
    }

    // If there's a persistent chat error that's not related to initial loading, consider if socket should attempt connection
    // For now, we proceed if details are loaded, history might still be loading or have errored.
    // If chatError is from fetchMediationDetails, we might not want to connect.
    // Let's assume if mediationDetails are present, we can try to connect.
    if (chatError && !mediationDetails) {
      // If there's an error AND no details, probably critical
      console.warn(
        "[ChatPage - SOCKET useEffect] Chat error present and no mediation details. Socket connection aborted."
      );
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setHasJoinedRoom(false);
      return;
    }

    // Disconnect existing socket if any before creating a new one
    if (socketRef.current) {
      console.log(
        "[ChatPage - SOCKET useEffect] Disconnecting existing socket:",
        socketRef.current.id
      );
      socketRef.current.disconnect();
      socketRef.current = null; // Clear the ref
    }
    setHasJoinedRoom(false); // Reset join status

    console.log(
      "[ChatPage - SOCKET useEffect] Attempting to establish new socket connection to:",
      BACKEND_URL
    );
    const newSocket = io(BACKEND_URL, {
      reconnectionAttempts: 5, // Increased attempts
      // transports: ['websocket', 'polling'], // Allow both, REMOVED for client to use default
      // query: { userId: userIdForEffect, mediationId: mediationIdForEffect } // Can pass initial data via query
    });
    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      console.log(
        `[ChatPage - Socket] Connected successfully with ID: ${newSocket.id}. Emitting addUser.`
      );
      newSocket.emit("addUser", userIdForEffect); // Add user to general online list

      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);

      // Ensure mediationDetails are loaded before trying to join
      if (mediationDetails) {
        joinTimeoutRef.current = setTimeout(() => {
          // Check connected status again inside timeout, as it might have disconnected
          if (newSocket.connected && !hasJoinedRoom) {
            // Use local hasJoinedRoom from state
            console.log(
              "[ChatPage - Socket] Emitting joinMediationChat for:",
              mediationIdForEffect
            );
            const joinData = {
              mediationRequestId: mediationIdForEffect,
              userRole: roleForEffect,
              userId: userIdForEffect,
            };
            newSocket.emit("joinMediationChat", joinData);
          } else {
            console.warn(
              "[ChatPage - Socket] Cannot join room: Socket not connected or already joined (or attempted)."
            );
          }
        }, 300); // Delay to ensure addUser is processed by server if needed
      } else {
        console.warn(
          "[ChatPage - Socket] Mediation details not available at connect time, cannot join room yet."
        );
      }
    });

    newSocket.on("joinedMediationChatSuccess", (data) => {
      console.log("[ChatPage - Socket] joinedMediationChatSuccess:", data);
      setChatError(null); // Clear any previous chat errors on successful join
      setHasJoinedRoom(true);
      markVisibleMessagesAsReadCallback(); // Mark messages as read on successful join
    });

    newSocket.on("newMediationMessage", (message) => {
      console.log(
        "[ChatPage - Socket] newMediationMessage received (FULL OBJECT):",
        JSON.stringify(message, null, 2)
      ); // <--- أضف هذا
      setMessages((prevMessages) => {
        const messageExists = prevMessages.some(
          (m) =>
            m._id === message._id || // Primary check by ID
            (m.timestamp === message.timestamp && // Fallback for optimistic updates without ID yet
              m.sender?._id === message.sender?._id &&
              m.message === message.message &&
              m.imageUrl === message.imageUrl)
        );
        if (messageExists) {
          console.log(
            "[ChatPage - Socket] Duplicate message detected, not adding:",
            message._id
          );
          return prevMessages;
        }
        const newMessagesArray = [...prevMessages, message];

        // If the message is from another user and we are in the room, mark it as read immediately
        if (
          message.sender?._id !== userIdForEffect &&
          newSocket.connected &&
          hasJoinedRoom && // Use state variable here
          document.visibilityState === "visible" &&
          message._id // Ensure message has an ID to mark
        ) {
          console.log(
            "[ChatPage - Socket] Auto-marking new incoming message as read:",
            message._id
          );
          newSocket.emit("mark_messages_read", {
            mediationRequestId: mediationIdForEffect,
            messageIds: [message._id],
            readerUserId: userIdForEffect,
          });
        }
        return newMessagesArray;
      });

      // Clear typing indicator for the sender of the new message
      if (message.sender?._id && message.sender._id !== userIdForEffect) {
        setTypingUsers((prevTypingUsers) => {
          const updatedTypingUsers = { ...prevTypingUsers };
          delete updatedTypingUsers[message.sender._id];
          return updatedTypingUsers;
        });
      }
    });

    newSocket.on(
      "messages_status_updated",
      ({ mediationRequestId: updatedMedId, updatedMessages }) => {
        console.log(
          "[ChatPage - Socket] messages_status_updated received for:",
          updatedMedId,
          "Updates:",
          updatedMessages
        );
        if (updatedMedId === mediationIdForEffect) {
          setMessages((prevMessages) =>
            prevMessages.map((msg) => {
              const updatedMsgInfo = updatedMessages.find(
                (uMsg) => uMsg._id === msg._id
              );
              return updatedMsgInfo
                ? { ...msg, readBy: updatedMsgInfo.readBy } // Ensure readBy has full user details if needed for display
                : msg;
            })
          );
        }
      }
    );

    newSocket.on(
      "mediation_details_updated",
      ({ mediationRequestId: updatedMedId, updatedMediationDetails }) => {
        if (updatedMedId === mediationIdForEffect) {
          console.log(
            '[ChatPage - Socket] Received "mediation_details_updated":',
            updatedMediationDetails
          );
          setMediationDetails(updatedMediationDetails); // <--- تحديث الحالة هنا
          // يمكنك أيضًا تحديث حالة الرسائل إذا كانت جزءًا من updatedMediationDetails
          if (updatedMediationDetails.chatMessages) {
            setMessages(updatedMediationDetails.chatMessages);
          }
        }
      }
    );

    newSocket.on("mediationChatError", (errorEvent) => {
      console.warn("[ChatPage - Socket] mediationChatError:", errorEvent);
      setChatError(errorEvent.message || "A chat error occurred.");
      setHasJoinedRoom(false); // If there's a chat error, assume not joined
    });

    newSocket.on("connect_error", (errorEvent) => {
      console.error(
        `[ChatPage - Socket] Connection Error: ${errorEvent.message}`,
        errorEvent
      );
      // Only set chatError if it's not already a more specific error.
      // Avoid rapidly changing chatError if connection attempts fail repeatedly.
      setChatError(
        (prevError) =>
          prevError ||
          `Socket connection failed: ${errorEvent.message}. Retrying...`
      );
      setHasJoinedRoom(false);
    });

    newSocket.on("disconnect", (reason) => {
      console.warn(`[ChatPage - Socket] Disconnected. Reason: ${reason}`);
      if (reason === "io server disconnect" || reason === "transport close") {
        setChatError(
          "Chat connection lost. Please check your internet connection."
        );
      }
      // Don't set chatError for client-side disconnects unless specific
      setHasJoinedRoom(false);
      // Clear typing users on disconnect
      setTypingUsers({});
    });

    newSocket.on("user_typing", ({ userId, fullName, avatarUrl }) => {
      if (userId !== userIdForEffect) {
        setTypingUsers((prev) => ({
          ...prev,
          [userId]: { id: userId, fullName, avatarUrl },
        }));
      }
    });

    newSocket.on("user_stopped_typing", ({ userId }) => {
      if (userId !== userIdForEffect) {
        setTypingUsers((prev) => {
          const updatedTyping = { ...prev };
          delete updatedTyping[userId];
          return updatedTyping;
        });
      }
    });

    // Cleanup function
    return () => {
      console.log(
        "[ChatPage - SOCKET useEffect] Cleanup: Disconnecting socket and removing listeners."
      );
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      if (newSocket) {
        // Explicitly emit leave before disconnecting if user was in a room
        if (hasJoinedRoom && mediationIdForEffect) {
          // Check hasJoinedRoom state
          newSocket.emit("leaveMediationChat", {
            mediationRequestId: mediationIdForEffect,
          });
        }
        if (typingTimeoutRef.current) {
          // Clear any pending stop_typing
          clearTimeout(typingTimeoutRef.current);
          newSocket.emit("stop_typing", {
            mediationRequestId: mediationIdForEffect,
          });
        }
        newSocket.removeAllListeners(); // Important to prevent memory leaks
        newSocket.disconnect();
      }
      socketRef.current = null;
      setHasJoinedRoom(false); // Reset on cleanup
    };
  }, [
    mediationRequestId,
    currentUserId,
    currentUserRole,
    mediationDetails, // Object, ensure stability or use specific IDs from it
    loadingDetails,
    // chatError, // REMOVED from deps to prevent loops on connection errors
    // markVisibleMessagesAsReadCallback, // REMOVED from deps
    // dispatch, // Only if dispatch is actually used to change state that re-runs this effect
  ]); // Key dependencies that control socket lifecycle

  useEffect(() => {
    // Effect for handling clicks outside emoji picker
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
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutsideEmojiPicker);
    } else {
      document.removeEventListener("mousedown", handleClickOutsideEmojiPicker);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideEmojiPicker);
    };
  }, [showEmojiPicker]);

  const handleInputChange = (e) => {
    const currentSocket = socketRef.current;
    setNewMessage(e.target.value);

    if (currentSocket?.connected && hasJoinedRoom && mediationRequestId) {
      if (!typingTimeoutRef.current && e.target.value.trim() !== "") {
        currentSocket.emit("start_typing", { mediationRequestId });
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (currentSocket?.connected) {
          // Check connection again inside timeout
          currentSocket.emit("stop_typing", { mediationRequestId });
        }
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
      hasJoinedRoom &&
      mediationRequestId
    ) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        currentSocket.emit("stop_typing", { mediationRequestId }); // Ensure stop typing is sent
      }

      currentSocket.emit("sendMediationMessage", {
        mediationRequestId,
        messageText: newMessage.trim(),
      });
      setNewMessage("");
      setShowEmojiPicker(false); // Hide emoji picker on send
    } else if (!currentSocket || !currentSocket.connected) {
      setChatError(
        "Not connected to chat. Please refresh or check connection."
      );
    } else if (!hasJoinedRoom) {
      setChatError("Not joined the chat room yet. Please wait or refresh.");
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

  // --- [!!!] متغير جديد لتحديد ما إذا كانت الدردشة نشطة بناءً على الحالة [!!!] ---
  const isChatActive = useMemo(() => {
    return mediationDetails?.status === "InProgress";
  }, [mediationDetails?.status]);

  const participants = useMemo(() => {
    if (!mediationDetails) return [];
    const parts = [];
    // Ensure IDs are strings for consistent comparison later if needed
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
                <small className="text-muted">{p.roleLabel}</small>
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
              disabled={isConfirmingReceipt}
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
        {mediationDetails?.status === "InProgress" && (
          <Button variant="danger" className="w-100" disabled>
            Open Dispute (WIP)
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
  // If there's a chatError AND mediationDetails failed to load (or is null)
  if (chatError && !mediationDetails && !loadingDetails) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <h4>Error Loading Chat</h4>
          <p>{chatError}</p>
          <p>
            This could be due to network issues or if the mediation request does
            not exist or you don't have permission.
          </p>
        </Alert>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </Container>
    );
  }
  // If no details, not loading, and no specific chatError (e.g., 404 from API)
  if (!mediationDetails && !loadingDetails && !chatError) {
    return (
      <Container className="py-5 text-center">
        <Alert variant="warning">
          Mediation details could not be found or are unavailable.
        </Alert>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </Container>
    );
  }

  // Main Chat UI
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
                            {msg.type === "image" && msg.imageUrl ? (
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
              {!isChatActive &&
                mediationDetails && ( // عرض رسالة إذا الدردشة ليست InProgress والتفاصيل موجودة
                  <Alert variant="info" className="text-center small mb-2 p-2">
                    The chat will become active once the mediation process is
                    fully in progress (Status: InProgress). Current status:
                    <strong>
                      {mediationDetails.status
                        .replace(/([A-Z])/g, " $1")
                        .trim()}
                    </strong>
                  </Alert>
                )}
              <div className="typing-indicator-container">
                <TypingIndicator
                  typingUsersData={typingUsers}
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
                      title="Toggle Emoji Picker"
                      disabled={
                        !hasJoinedRoom ||
                        !!chatError ||
                        isLoadingHistory ||
                        !isChatActive
                      } // <--- إضافة !isChatActive
                    >
                      <FaSmile />
                    </Button>
                  </Col>
                  <Col xs="auto">
                    <Button
                      variant="light"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach Image"
                      disabled={
                        !hasJoinedRoom ||
                        !!chatError ||
                        isLoadingHistory ||
                        !isChatActive
                      } // <--- إضافة !isChatActive
                    >
                      <FaPaperclip />
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      onChange={handleFileSelected}
                      accept="image/*" // Only accept images
                      disabled={
                        !hasJoinedRoom ||
                        !!chatError ||
                        isLoadingHistory ||
                        !isChatActive
                      } // <--- إضافة !isChatActive
                    />
                  </Col>
                  <Col>
                    <Form.Control
                      type="text"
                      placeholder={
                        hasJoinedRoom
                          ? "Type your message..."
                          : "Connecting to chat..."
                      }
                      value={newMessage}
                      onChange={handleInputChange}
                      disabled={
                        !hasJoinedRoom ||
                        !!chatError ||
                        isLoadingHistory ||
                        !isChatActive
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
                        !isChatActive // <--- إضافة !isChatActive
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
