import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  useContext,
} from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
import { FaSmile } from "react-icons/fa";
import { FaPaperPlane } from "react-icons/fa";
import { FaCheck } from "react-icons/fa";
import { FaCrown } from "react-icons/fa";
import { FaStar } from "react-icons/fa";
import { FaArrowLeft } from "react-icons/fa";
import { FaCommentDots } from "react-icons/fa";
import { FaUserPlus } from "react-icons/fa";
import { FaComments } from "react-icons/fa";
import { FaCamera } from "react-icons/fa";
import { FaShieldAlt } from "react-icons/fa";
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
  markSubChatAsReadInList,
} from "../redux/actions/mediationAction";
import { SocketContext } from "../App";
import "./MediationChatPage.css";
import RatingForm from "../components/ratings/RatingForm";
import { getRatingsForMediationAction } from "../redux/actions/ratingAction";
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
  if (messageDate.toDateString() === today.toDateString())
    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (messageDate.toDateString() === yesterday.toDateString())
    return (
      "Yesterday, " +
      messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  if (now.getFullYear() === messageDate.getFullYear())
    return (
      messageDate.toLocaleDateString([], { month: "short", day: "numeric" }) +
      ", " +
      messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
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

const MediationChatPage = () => {
  const { mediationRequestId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const socket = useContext(SocketContext);
  const currentUser = useSelector((state) => state.userReducer.user);
  const currentUserId = currentUser?._id;
  const currentUserRole = currentUser?.userRole;
  const currentUserFullName = currentUser?.fullName;
  const currentUserAvatarUrl = currentUser?.avatarUrl;

  const {
    activeMediationDetails: mediationDetails,
    loadingActiveMediationDetails: loadingDetails,
    errorActiveMediationDetails: errorDetails,
    adminSubChats,
    activeSubChat,
    creatingSubChat,
    errorCreatingSubChat,
  } = useSelector((state) => state.mediationReducer);

  const activeSubChatDetails = activeSubChat.details;
  const activeSubChatMessages = activeSubChat.messages || [];
  const loadingActiveSubChatMessages = activeSubChat.loadingMessages;
  const activeSubChatId = activeSubChat.id;

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
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [showDetailsOffcanvas, setShowDetailsOffcanvas] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageInModal, setCurrentImageInModal] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
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
  const [subChatTypingUsers, setSubChatTypingUsers] = useState({});
  const [subChatFile, setSubChatFile] = useState(null);
  const [subChatImagePreview, setSubChatImagePreview] = useState(null);
  const [showSubChatEmojiPicker, setShowSubChatEmojiPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const subChatMessagesEndRef = useRef(null);
  const subChatTypingTimeoutRef = useRef(null);
  const subChatFileInputRef = useRef(null);
  const subChatEmojiPickerRef = useRef(null);
  const subChatEmojiButtonRef = useRef(null);

  const adminSubChatsList = useMemo(() => {
    if (adminSubChats?.list) {
      return adminSubChats.list;
    }
    return [];
  }, [adminSubChats]);

  const handleShowDetailsOffcanvas = () => setShowDetailsOffcanvas(true);
  const handleCloseDetailsOffcanvas = () => setShowDetailsOffcanvas(false);

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
      setMessages(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setChatError(err.response?.data?.msg || "Failed to load chat history.");
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [mediationRequestId]);

  useEffect(() => {
    if (mediationDetails) {
      fetchChatHistory();
    }
  }, [mediationDetails, fetchChatHistory]);

  useEffect(() => () => dispatch(clearActiveMediationDetails()), [dispatch]);

  const scrollToBottom = useCallback(
    (ref = messagesEndRef, options = { behavior: "smooth" }) => {
      setTimeout(() => ref.current?.scrollIntoView(options), 150);
    },
    []
  );

  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0)
      scrollToBottom(messagesEndRef);
  }, [messages, isLoadingHistory, scrollToBottom]);

  useEffect(() => {
    if (showSubChatModal && activeSubChatMessages.length > 0)
      scrollToBottom(subChatMessagesEndRef);
  }, [activeSubChatMessages, showSubChatModal, scrollToBottom]);

  useEffect(() => {
    if (!socket?.connected || !mediationRequestId || !currentUserId) return;
    socket.emit("joinMediationChat", {
      mediationRequestId,
      userId: currentUserId,
      userRole: currentUserRole,
    });
    const handleJoinSuccess = (data) => {
      if (data.mediationRequestId === mediationRequestId) {
        setHasJoinedRoom(true);
        setChatError(null);
      }
    };
    const handleJoinError = (error) => {
      setChatError(error.message);
      setHasJoinedRoom(false);
    };
    socket.on("joinedMediationChatSuccess", handleJoinSuccess);
    socket.on("mediationChatError", handleJoinError);
    return () => {
      socket.emit("leaveMediationChat", { mediationRequestId });
      setHasJoinedRoom(false);
      socket.off("joinedMediationChatSuccess", handleJoinSuccess);
      socket.off("mediationChatError", handleJoinError);
    };
  }, [socket, mediationRequestId, currentUserId, currentUserRole]);

  useEffect(() => {
    if (!socket || !hasJoinedRoom) return;
    const handleNewMessage = (message) => {
      setMessages((prev) =>
        prev.some((m) => m._id === message._id) ? prev : [...prev, message]
      );
      if (message.sender?._id) {
        setTypingUsers((prev) => {
          const u = { ...prev };
          delete u[message.sender._id];
          return u;
        });
      }
    };
    const handleTyping = (data) => {
      if (data.userId !== currentUserId) {
        setTypingUsers((prev) => ({ ...prev, [data.userId]: { ...data } }));
      }
    };
    const handleStopTyping = (data) => {
      setTypingUsers((prev) => {
        const u = { ...prev };
        delete u[data.userId];
        return u;
      });
    };
    const handleMessagesReadUpdate = (data) => {
      if (data.mediationRequestId === mediationRequestId) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            const updatedInfo = data.updatedMessages.find(
              (uMsg) => uMsg._id === msg._id
            );
            if (updatedInfo && updatedInfo.reader) {
              const existingReaders = msg.readBy || [];
              if (
                !existingReaders
                  .filter(Boolean)
                  .some((r) => r && r.readerId === updatedInfo.reader.readerId)
              ) {
                return {
                  ...msg,
                  readBy: [...existingReaders, updatedInfo.reader],
                };
              }
            }
            return msg;
          })
        );
      }
    };
    socket.on("newMediationMessage", handleNewMessage);
    socket.on("user_typing", handleTyping);
    socket.on("user_stopped_typing", handleStopTyping);
    socket.on("messages_read_update", handleMessagesReadUpdate);
    return () => {
      socket.off("newMediationMessage", handleNewMessage);
      socket.off("user_typing", handleTyping);
      socket.off("user_stopped_typing", handleStopTyping);
      socket.off("messages_read_update", handleMessagesReadUpdate);
    };
  }, [socket, hasJoinedRoom, currentUserId, mediationRequestId]);

  useEffect(() => {
    if (!socket || !hasJoinedRoom || messages.length === 0 || !currentUserId)
      return;
    const unreadMessages = messages.filter(
      (msg) =>
        msg &&
        msg.sender?._id !== currentUserId &&
        !msg.readBy
          ?.filter(Boolean)
          .some(
            (reader) => reader && reader.readerId?.toString() === currentUserId
          )
    );
    if (unreadMessages.length > 0) {
      socket.emit("markMessagesAsRead", {
        mediationRequestId,
        messageIds: unreadMessages.map((msg) => msg._id),
        readerUserId: currentUserId,
      });
    }
  }, [messages, hasJoinedRoom, socket, currentUserId, mediationRequestId]);

  useEffect(() => {
    if (!socket?.connected || !activeSubChatId) return;
    setSubChatJoinStatus("joining");
    socket.emit("joinAdminSubChat", {
      mediationRequestId,
      subChatId: activeSubChatId,
      userId: currentUserId,
      userRole: currentUserRole,
    });
    const handleSubJoinSuccess = (data) => {
      if (data.subChatId === activeSubChatId) {
        setSubChatJoinStatus("success");
      }
    };
    const handleSubJoinError = (error) => {
      if (error.subChatId === activeSubChatId) {
        setSubChatJoinStatus("error");
        toast.error(`Sub-chat error: ${error.message}`);
      }
    };

    const handleSubChatUserTyping = (data) => {
      if (data.userId !== currentUserId && data.subChatId === activeSubChatId) {
        setSubChatTypingUsers((prev) => ({
          ...prev,
          [data.userId]: { ...data },
        }));
      }
    };
    const handleSubChatUserStoppedTyping = (data) => {
      if (data.subChatId === activeSubChatId) {
        setSubChatTypingUsers((prev) => {
          const u = { ...prev };
          delete u[data.userId];
          return u;
        });
      }
    };
    const handleAdminSubChatReadUpdate = (data) => {
      if (data.subChatId === activeSubChatId) {
        dispatch({
          type: "ADMIN_SUBCHAT_MESSAGES_STATUS_UPDATED_SOCKET",
          payload: data,
        });
      }
    };
    socket.on("joinedAdminSubChatSuccess", handleSubJoinSuccess);
    socket.on("adminSubChatError", handleSubJoinError);
    socket.on("adminSubChatUserTyping", handleSubChatUserTyping);
    socket.on("adminSubChatUserStoppedTyping", handleSubChatUserStoppedTyping);
    socket.on(
      "admin_sub_chat_messages_status_updated",
      handleAdminSubChatReadUpdate
    );
    return () => {
      socket.emit("leaveAdminSubChat", {
        mediationRequestId,
        subChatId: activeSubChatId,
      });
      setSubChatJoinStatus(null);
      socket.off("joinedAdminSubChatSuccess", handleSubJoinSuccess);
      socket.off("adminSubChatError", handleSubJoinError);
      socket.off("adminSubChatUserTyping", handleSubChatUserTyping);
      socket.off(
        "adminSubChatUserStoppedTyping",
        handleSubChatUserStoppedTyping
      );
      socket.off(
        "admin_sub_chat_messages_status_updated",
        handleAdminSubChatReadUpdate
      );
    };
  }, [
    socket,
    activeSubChatId,
    mediationRequestId,
    currentUserId,
    currentUserRole,
    dispatch,
  ]);

  // This is the final and correct effect for marking messages as read.
  useEffect(() => {
    // This effect should only run IF the modal is open and the socket is connected
    if (showSubChatModal && socket?.connected && activeSubChatId) {
      const handleNewMessageWhileOpen = (data) => {
        // Check if the new message belongs to the currently open sub-chat
        if (data.subChatId === activeSubChatId) {
          // If the message is not from me, mark it as read immediately
          if (
            (data.message.sender?._id || data.message.sender) !== currentUserId
          ) {
            socket.emit("markAdminSubChatMessagesRead", {
              mediationRequestId,
              subChatId: activeSubChatId,
              messageIds: [data.message._id], // Mark only the new message
              readerUserId: currentUserId,
            });
          }
        }
      };

      // Listen for new messages
      socket.on("new_admin_sub_chat_message", handleNewMessageWhileOpen);

      // Cleanup listener on unmount or when dependencies change
      return () => {
        socket.off("new_admin_sub_chat_message", handleNewMessageWhileOpen);
      };
    }
  }, [
    showSubChatModal,
    socket,
    activeSubChatId,
    mediationRequestId,
    currentUserId,
  ]);

  useEffect(() => {
    if (!socket) return;
    const handleMediationDetailsUpdate = (data) => {
      if (data.updatedMedId === mediationRequestId) {
        dispatch(
          updateMediationDetailsFromSocket(data.updatedMediationDetails)
        );
      }
    };
    const handleSocketDisconnect = (reason) => {
      setChatError("Connection lost.");
      setHasJoinedRoom(false);
      setSubChatJoinStatus(null);
      setTypingUsers({});
      setSubChatTypingUsers({});
    };
    const handleNewSubChatInvitation = (data) => {
      if (data.mediationRequestId === mediationRequestId) {
        toast.info(`Admin has started a new private chat with you.`);
        dispatch({ type: "ADD_SUB_CHAT_TO_MEDIATION", payload: data });
      }
    };
    socket.on("mediation_details_updated", handleMediationDetailsUpdate);
    socket.on("disconnect", handleSocketDisconnect);
    socket.on("new_sub_chat_invitation", handleNewSubChatInvitation);
    return () => {
      socket.off("mediation_details_updated", handleMediationDetailsUpdate);
      socket.off("disconnect", handleSocketDisconnect);
      socket.off("new_sub_chat_invitation", handleNewSubChatInvitation);
    };
  }, [socket, mediationRequestId, dispatch]);

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
        if (!parts.some((p) => p.id === admin._id?.toString()))
          parts.push({
            ...admin,
            roleLabel: admin.userRole || "Admin",
            id: admin._id?.toString(),
            isOverseer: true,
          });
      });
    }
    if (
      currentUserRole === "Admin" &&
      !parts.some((p) => p.id === currentUserId)
    )
      parts.push({
        ...currentUser,
        roleLabel: "Admin (You)",
        id: currentUserId,
        isOverseer: true,
      });
    return parts;
  }, [mediationDetails, currentUser, currentUserId, currentUserRole]);

  const otherParticipants = useMemo(() => {
    if (!currentUserId || !participants) return [];
    return participants.filter((p) => p.id !== currentUserId.toString());
  }, [participants, currentUserId]);

  const lastReadMessageByParticipant = useMemo(() => {
    if (!otherParticipants.length || !messages.length) return {};
    const indicators = {};
    otherParticipants.forEach((participant) => {
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message.type === "system") continue;
        const hasRead = message.readBy?.some(
          (reader) =>
            reader &&
            (reader.readerId === participant.id ||
              reader.readerId?._id === participant.id)
        );
        if (hasRead) {
          if (!indicators[message._id]) {
            indicators[message._id] = [];
          }
          if (
            !indicators[message._id].some((p) => p.readerId === participant.id)
          ) {
            indicators[message._id].push({
              readerId: participant.id,
              fullName: participant.fullName || "User",
              avatarUrl: participant.avatarUrl || noUserAvatar,
            });
          }
          break;
        }
      }
    });
    return indicators;
  }, [messages, otherParticipants]);

  const lastReadMessageBySubChatParticipant = useMemo(() => {
    const otherSubChatParticipants =
      activeSubChatDetails?.participants?.filter(
        (p) => p.userId?._id !== currentUserId
      ) || [];
    if (!otherSubChatParticipants.length || !activeSubChatMessages.length)
      return {};
    const indicators = {};
    otherSubChatParticipants.forEach((participant) => {
      if (!participant?.userId?._id) return;
      for (let i = activeSubChatMessages.length - 1; i >= 0; i--) {
        const message = activeSubChatMessages[i];
        if (message.type === "system") continue;
        const hasRead = message.readBy?.some(
          (reader) =>
            reader &&
            (reader.readerId === participant.userId._id ||
              reader.readerId?._id === participant.userId._id)
        );
        if (hasRead) {
          if (!indicators[message._id]) {
            indicators[message._id] = [];
          }
          if (
            !indicators[message._id].some(
              (p) => p.readerId === participant.userId._id
            )
          ) {
            indicators[message._id].push({
              readerId: participant.userId._id,
              fullName: participant.userId.fullName || "User",
              avatarUrl: participant.userId.avatarUrl || noUserAvatar,
            });
          }
          break;
        }
      }
    });
    return indicators;
  }, [activeSubChatMessages, activeSubChatDetails, currentUserId]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (socket?.connected && hasJoinedRoom) {
      if (!typingTimeoutRef.current && e.target.value.trim() !== "") {
        socket.emit("start_typing", {
          mediationRequestId,
          userId: currentUserId,
          fullName: currentUserFullName,
          avatarUrl: currentUserAvatarUrl,
        });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socket?.connected) {
          socket.emit("stop_typing", {
            mediationRequestId,
            userId: currentUserId,
          });
          typingTimeoutRef.current = null;
        }
      }, 1500);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socket?.connected && hasJoinedRoom) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        socket.emit("stop_typing", {
          mediationRequestId,
          userId: currentUserId,
        });
      }
      socket.emit("sendMediationMessage", {
        mediationRequestId,
        messageText: newMessage.trim(),
      });
      setNewMessage("");
      setShowEmojiPicker(false);
    } else {
      toast.error("Cannot send message. Not connected to chat.");
    }
  };

  const handleSubChatInputChange = (e) => {
    setNewSubChatMessage(e.target.value);
    if (
      socket?.connected &&
      subChatJoinStatus === "success" &&
      activeSubChatId
    ) {
      if (!subChatTypingTimeoutRef.current && e.target.value.trim() !== "") {
        socket.emit("adminSubChatStartTyping", {
          mediationRequestId,
          subChatId: activeSubChatId,
          userId: currentUserId,
          fullName: currentUserFullName,
          avatarUrl: currentUserAvatarUrl,
        });
      }
      if (subChatTypingTimeoutRef.current)
        clearTimeout(subChatTypingTimeoutRef.current);
      subChatTypingTimeoutRef.current = setTimeout(() => {
        if (socket?.connected) {
          socket.emit("adminSubChatStopTyping", {
            mediationRequestId,
            subChatId: activeSubChatId,
            userId: currentUserId,
          });
          subChatTypingTimeoutRef.current = null;
        }
      }, 1500);
    }
  };

  const handleSendSubChatMessage = async (e) => {
    e.preventDefault();
    if (!newSubChatMessage.trim() && !subChatFile) {
      toast.warn("Message cannot be empty.");
      return;
    }
    if (
      socket?.connected &&
      activeSubChatId &&
      subChatJoinStatus === "success"
    ) {
      if (subChatTypingTimeoutRef.current) {
        clearTimeout(subChatTypingTimeoutRef.current);
        subChatTypingTimeoutRef.current = null;
        socket.emit("adminSubChatStopTyping", {
          mediationRequestId,
          subChatId: activeSubChatId,
          userId: currentUserId,
        });
      }
      let imageUrlToSend = null;
      if (subChatFile) {
        try {
          const token = localStorage.getItem("token");
          if (!token) throw new Error("Auth token missing.");
          const formData = new FormData();
          formData.append("image", subChatFile);
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
          setSubChatFile(null);
          setSubChatImagePreview(null);
          if (subChatFileInputRef.current)
            subChatFileInputRef.current.value = "";
          return;
        }
      }
      socket.emit("sendAdminSubChatMessage", {
        mediationRequestId,
        subChatId: activeSubChatId,
        messageText: newSubChatMessage.trim(),
        imageUrl: imageUrlToSend,
      });
      setNewSubChatMessage("");
      setSubChatFile(null);
      setSubChatImagePreview(null);
      if (subChatFileInputRef.current) subChatFileInputRef.current.value = "";
      setShowSubChatEmojiPicker(false);
    } else {
      toast.error("Cannot send message. Not connected to sub-chat.");
    }
  };

  const renderMessageSenderAvatar = (sender, size = 40) => {
    let avatar = noUserAvatar;
    if (sender?.avatarUrl)
      avatar = sender.avatarUrl.startsWith("http")
        ? sender.avatarUrl
        : `${BACKEND_URL}/${sender.avatarUrl}`;
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
        if (forSubChat && activeSubChatId)
          socket.emit("sendAdminSubChatMessage", {
            mediationRequestId,
            subChatId: activeSubChatId,
            imageUrl,
          });
        else
          socket.emit("sendMediationMessage", { mediationRequestId, imageUrl });
      }
    } catch (error) {
      toast.error(error.response?.data?.msg || "Image upload failed.");
    }
  };

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
    )
      partiesToRate.push({
        id: seller._id,
        fullName: seller.fullName,
        role: "Seller",
      });
    if (
      buyer &&
      buyer._id !== currentUserId &&
      !uniqueRatedUserIds.includes(buyer._id)
    )
      partiesToRate.push({
        id: buyer._id,
        fullName: buyer.fullName,
        role: "Buyer",
      });
    if (
      mediator &&
      mediator._id !== currentUserId &&
      !uniqueRatedUserIds.includes(mediator._id)
    )
      partiesToRate.push({
        id: mediator._id,
        fullName: mediator.fullName,
        role: "Mediator",
      });
    return partiesToRate;
  }, [mediationDetails, currentUserId, mediationRatings, mediationRequestId]);

  const unratedPartiesCount = partiesNotYetRatedByCurrentUser.length;
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
    if (forSubChat) setNewSubChatMessage((prev) => prev + emojiData.emoji);
    else setNewMessage((prev) => prev + emojiData.emoji);
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
      if (createdSubChat) handleCloseCreateSubChatModal();
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
      toast.error("Could not open private chat.");
      return;
    }

    if (subChat.unreadMessagesCount > 0) {
      dispatch(markSubChatAsReadInList(subChat.subChatId));
    }

    dispatch(setActiveSubChatId(subChat.subChatId));
    dispatch(adminGetSubChatMessages(mediationRequestId, subChat.subChatId));
    setShowSubChatModal(true);
  };

  const handleCloseSubChatModal = () => {
    setShowSubChatModal(false);
    dispatch(clearActiveSubChatMessages());
    dispatch(setActiveSubChatId(null));
    setNewSubChatMessage("");
    setSubChatTypingUsers({});
    setShowSubChatEmojiPicker(false);
    setSubChatFile(null);
    setSubChatImagePreview(null);
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

  const renderTransactionDetailsAndActions = (subChatsList) => {
    return (
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
                    mediationDetails?.status !== "Disputed" ||
                    isResolvingDispute
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
              {!mediationDetails.adminSubChats && (
                <p className="text-muted small fst-italic mt-2">
                  No private chats initiated by admin yet.
                </p>
              )}
              {subChatsList.length > 0 && (
                <ListGroup variant="flush" className="subchat-display-list">
                  {subChatsList.map((subChat) => {
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
                                  p.userId && (
                                    <div key={p.userId._id || p.userId}>
                                      {renderMessageSenderAvatar(p.userId, 24)}
                                    </div>
                                  )
                              )}
                          </div>
                          <div className="flex-grow-1">
                            <div className="fw-bold small chat-title-truncate">
                              {chatDisplayName}
                            </div>
                            <small className="text-muted d-block subchat-snippet-truncate">
                              {subChat.lastMessageSnippet}
                            </small>
                          </div>
                          <div className="text-end ms-2 subchat-item-meta">
                            {subChat.lastMessageAt && (
                              <small className="text-muted d-block subchat-timestamp">
                                {formatMessageTimestampForDisplay(
                                  subChat.lastMessageAt
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
                    <Spinner as="span" animation="border" size="sm" />
                    Opening...
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
  };

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
                        key={msg._id || `msg-sys-${index}`}
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

                  const avatarsForThisMessage =
                    lastReadMessageByParticipant[msg._id];
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
                            style={{ paddingRight: "16px" }}
                          >
                            <div className="read-by-indicators-cluster d-flex align-items-center">
                              {avatarsForThisMessage.map((reader, idx) => (
                                <OverlayTrigger
                                  key={reader.readerId || `reader-${idx}`}
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
                renderTransactionDetailsAndActions(adminSubChatsList)
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
              renderTransactionDetailsAndActions(adminSubChatsList)
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
            {subChatJoinStatus === "joining" && (
              <Spinner
                size="sm"
                className="ms-2"
                variant="info"
                title="Joining room..."
              />
            )}
            {subChatJoinStatus === "error" && (
              <Badge bg="danger" className="ms-2">
                Join Error
              </Badge>
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
              const isMySubChatMessage =
                (msg.sender?._id || msg.sender) === currentUserId;
              const prevSubChatMessage = activeSubChatMessages[index - 1];
              const showSubChatAvatar =
                !prevSubChatMessage ||
                (prevSubChatMessage.sender?._id ||
                  prevSubChatMessage.sender) !==
                  (msg.sender?._id || msg.sender) ||
                msg.type === "system";

              const subChatAvatarsForThisMessage =
                lastReadMessageBySubChatParticipant[msg._id];
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
                        {isMySubChatMessage &&
                          (!subChatAvatarsForThisMessage ||
                            subChatAvatarsForThisMessage.length === 0) && (
                            <FaCheck
                              title="Sent"
                              className="text-muted ms-1"
                              style={{ fontSize: "0.8em" }}
                            />
                          )}
                      </div>
                    </div>
                  </ListGroup.Item>
                  {isMySubChatMessage &&
                    subChatAvatarsForThisMessage &&
                    subChatAvatarsForThisMessage.length > 0 && (
                      <div
                        className="d-flex justify-content-end pe-3 mb-2 read-indicators-wrapper"
                        style={{ paddingRight: "16px" }}
                      >
                        <div className="read-by-indicators-cluster d-flex align-items-center">
                          {subChatAvatarsForThisMessage.map((reader, idx) => (
                            <OverlayTrigger
                              key={reader.readerId || `sub-reader-${idx}`}
                              placement="top"
                              overlay={
                                <Tooltip>Seen by {reader.fullName}</Tooltip>
                              }
                            >
                              <Image
                                src={reader.avatarUrl || noUserAvatar}
                                roundedCircle
                                width={16}
                                height={16}
                                className="read-by-avatar-indicator"
                                style={{
                                  marginLeft: idx === 0 ? "0" : "-6px",
                                  border: "1.5px solid white",
                                  backgroundColor: "#e0e0e0",
                                  zIndex:
                                    subChatAvatarsForThisMessage.length - idx,
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
            <div ref={subChatMessagesEndRef} style={{ height: "1px" }} />
          </ListGroup>
        </Modal.Body>
        <Modal.Footer className="sub-chat-modal-footer themed-modal-footer d-flex flex-column align-items-stretch">
          {subChatImagePreview && (
            <div className="subchat-image-preview-wrapper mb-2 align-self-start">
              <Card
                style={{
                  width: "100px",
                  position: "relative",
                  cursor: "pointer",
                }}
                onClick={() => handleShowImageInModal(subChatImagePreview)}
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
                    e.stopPropagation();
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
          <div className="typing-indicator-container w-100">
            <TypingIndicator
              typingUsers={subChatTypingUsers}
              currentUserId={currentUserId}
            />
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
              disabled={
                loadingActiveSubChatMessages || subChatJoinStatus !== "success"
              }
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
                  setSubChatFile(file);
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setSubChatImagePreview(reader.result);
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
              disabled={
                loadingActiveSubChatMessages || subChatJoinStatus !== "success"
              }
              title="Attach image"
            >
              <FaCamera />
            </Button>
            <Form.Control
              type="text"
              placeholder={
                subChatJoinStatus === "success"
                  ? "Type message..."
                  : subChatJoinStatus === "joining"
                  ? "Joining chat..."
                  : "Cannot connect..."
              }
              value={newSubChatMessage}
              onChange={handleSubChatInputChange}
              disabled={
                loadingActiveSubChatMessages || subChatJoinStatus !== "success"
              }
              autoFocus
              className="flex-grow-1 me-1 subchat-input-field"
            />
            <Button
              variant="primary"
              type="submit"
              className="btn-icon-round"
              disabled={
                loadingActiveSubChatMessages ||
                subChatJoinStatus !== "success" ||
                (!newSubChatMessage.trim() && !subChatFile)
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
