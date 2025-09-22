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
import EmojiPicker from "emoji-picker-react";
import {
  FaSmile,
  FaPaperPlane,
  FaCheck,
  FaCrown,
  FaStar,
  FaArrowLeft,
  FaCommentDots,
  FaUserPlus,
  FaComments,
  FaCamera,
  FaShieldAlt,
  FaStore,
  FaTimes,
} from "react-icons/fa";
import { PiHandCoinsDuotone } from "react-icons/pi";
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
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const noUserAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png";
const fallbackProductImageUrl =
  'data:image/svg+xml;charset=UTF8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23e0e0e0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16px" fill="%23999">Error</text></svg>';

const SafeHtmlRenderer = ({ htmlContent }) => {
  const cleanHtml = DOMPurify.sanitize(htmlContent, {
    USE_PROFILES: { html: true },
  });

  const parts = cleanHtml.split(/(\*\*.*?\*\*|🛡️)/g).filter(Boolean);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part === "🛡️") {
          return <FaShieldAlt key={index} className="mx-1" />;
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};

const ParticipantAvatar = ({ participant, size = 40, t }) => {
  if (!participant) return null;

  const getRole = (p) => {
    if (p.roleLabel) return p.roleLabel.toLowerCase();
    if (p.userRole) return p.userRole.toLowerCase();
    return "user";
  };

  const role = getRole(participant);
  const avatarUrl = participant.avatarUrl
    ? participant.avatarUrl.startsWith("http")
      ? participant.avatarUrl
      : `${BACKEND_URL}${participant.avatarUrl}`
    : noUserAvatar;

  let roleIcon = null;
  if (role.includes("admin")) {
    roleIcon = (
      <FaCrown
        className="participant-role-icon admin-icon"
        title={t("mediationChatPage.admin")}
      />
    );
  } else if (role.includes("mediator")) {
    roleIcon = (
      <FaShieldAlt
        className="participant-role-icon mediator-icon"
        title={t("mediationChatPage.mediator")}
      />
    );
  } else if (role.includes("seller")) {
    roleIcon = (
      <FaStore
        className="participant-role-icon seller-icon"
        title={t("mediationChatPage.seller")}
      />
    );
  } else if (role.includes("buyer")) {
    roleIcon = (
      <PiHandCoinsDuotone
        className="participant-role-icon buyer-icon"
        title={t("mediationChatPage.buyer")}
      />
    );
  }

  return (
    <div
      className="position-relative avatar-wrapper"
      style={{ width: size, height: size }}
    >
      <Image
        src={avatarUrl}
        roundedCircle
        width={size}
        height={size}
        alt={participant.fullName || t("mediationChatPage.user")}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = noUserAvatar;
        }}
        className="participant-avatar-img"
      />
      {roleIcon}
    </div>
  );
};

const MediationChatPage = () => {
  const { t, i18n } = useTranslation();

  const formatCurrency = useCallback(
    (amount, currencyCode = "TND") => {
      const num = Number(amount);
      if (isNaN(num) || amount == null) return "N/A";
      let safeCurrencyCode = currencyCode;
      if (typeof currencyCode !== "string" || currencyCode.trim() === "")
        safeCurrencyCode = "TND";
      try {
        return new Intl.NumberFormat(i18n.language, {
          style: "currency",
          currency: safeCurrencyCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);
      } catch (error) {
        return `${num.toFixed(2)} ${safeCurrencyCode}`;
      }
    },
    [i18n.language]
  );

  const { mediationRequestId } = useParams();
  const navigate = useNavigate();

  const formatMessageTimestampForDisplay = useCallback(
    (timestamp) => {
      if (!timestamp) return "";
      const messageDate = new Date(timestamp);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const timeOptions = { hour: "2-digit", minute: "2-digit" };

      if (messageDate.toDateString() === today.toDateString()) {
        return messageDate.toLocaleTimeString(i18n.language, timeOptions);
      }
      if (messageDate.toDateString() === yesterday.toDateString()) {
        return `${t(
          "mediationChatPage.yesterday"
        )}, ${messageDate.toLocaleTimeString(i18n.language, timeOptions)}`;
      }
      if (now.getFullYear() === messageDate.getFullYear()) {
        return `${messageDate.toLocaleDateString(i18n.language, {
          month: "short",
          day: "numeric",
        })}, ${messageDate.toLocaleTimeString(i18n.language, timeOptions)}`;
      }
      return `${messageDate.toLocaleDateString(i18n.language, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}, ${messageDate.toLocaleTimeString(i18n.language, timeOptions)}`;
    },
    [t, i18n.language]
  );
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

  const handleSubChatFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("mediationChatPage.fileTooLarge"));
        return;
      }
      setSubChatFile(file);
      setSubChatImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveSubChatImage = () => {
    setSubChatFile(null);
    setSubChatImagePreview(null);
    if (subChatFileInputRef.current) {
      subChatFileInputRef.current.value = "";
    }
  };

  const adminSubChatsList = useMemo(() => {
    return adminSubChats?.list || [];
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
      if (!token) throw new Error(t("mediationChatPage.authTokenMissing"));
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(
        `${BACKEND_URL}/mediation/chat/${mediationRequestId}/history`,
        config
      );
      setMessages(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setChatError(
        err.response?.data?.msg || t("mediationChatPage.failedToLoadHistory")
      );
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [mediationRequestId, t]);

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
      if (data.mediationRequestId === mediationRequestId)
        setHasJoinedRoom(true);
    };
    const handleJoinError = (error) => setChatError(error.message);
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
    const handleNewMessage = (message) =>
      setMessages((prev) =>
        prev.some((m) => m._id === message._id) ? prev : [...prev, message]
      );
    const handleTyping = (data) => {
      if (data.userId !== currentUserId)
        setTypingUsers((prev) => ({ ...prev, [data.userId]: { ...data } }));
    };
    const handleStopTyping = (data) =>
      setTypingUsers((prev) => {
        const u = { ...prev };
        delete u[data.userId];
        return u;
      });
    const handleMessagesReadUpdate = (data) => {
      if (data.mediationRequestId === mediationRequestId) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            const updatedInfo = data.updatedMessages.find(
              (uMsg) => uMsg._id === msg._id
            );
            if (
              updatedInfo?.reader &&
              !msg.readBy?.some(
                (r) => r?.readerId === updatedInfo.reader.readerId
              )
            ) {
              return {
                ...msg,
                readBy: [...(msg.readBy || []), updatedInfo.reader],
              };
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
    if (
      socket?.connected &&
      adminSubChatsList.length > 0 &&
      mediationRequestId &&
      currentUserId
    ) {
      adminSubChatsList.forEach((subChat) => {
        const isParticipant = subChat.participants?.some(
          (p) => p.userId?._id === currentUserId
        );
        if (isParticipant) {
          socket.emit("joinAdminSubChat", {
            mediationRequestId,
            subChatId: subChat.subChatId,
            userId: currentUserId,
            userRole: currentUserRole,
          });
        }
      });
    }
  }, [
    socket,
    adminSubChatsList,
    mediationRequestId,
    currentUserId,
    currentUserRole,
  ]);

  useEffect(() => {
    if (showSubChatModal && socket?.connected && activeSubChatId) {
      const unreadMessages = activeSubChatMessages.filter(
        (msg) =>
          (msg.sender?._id || msg.sender) !== currentUserId &&
          !msg.readBy?.some(
            (reader) =>
              (reader.readerId?._id || reader.readerId)?.toString() ===
              currentUserId
          )
      );
      if (unreadMessages.length > 0) {
        socket.emit("markAdminSubChatMessagesRead", {
          mediationRequestId,
          subChatId: activeSubChatId,
          messageIds: unreadMessages.map((msg) => msg._id),
          readerUserId: currentUserId,
        });
      }
      const handleNewMessageWhileOpen = (data) => {
        if (
          data.subChatId === activeSubChatId &&
          (data.message.sender?._id || data.message.sender) !== currentUserId
        ) {
          socket.emit("markAdminSubChatMessagesRead", {
            mediationRequestId,
            subChatId: activeSubChatId,
            messageIds: [data.message._id],
            readerUserId: currentUserId,
          });
        }
      };
      const handleSubChatUserTyping = (data) => {
        if (data.userId !== currentUserId && data.subChatId === activeSubChatId)
          setSubChatTypingUsers((prev) => ({
            ...prev,
            [data.userId]: { ...data },
          }));
      };
      const handleSubChatUserStoppedTyping = (data) => {
        if (data.subChatId === activeSubChatId)
          setSubChatTypingUsers((prev) => {
            const u = { ...prev };
            delete u[data.userId];
            return u;
          });
      };
      socket.on("new_admin_sub_chat_message", handleNewMessageWhileOpen);
      socket.on("adminSubChatUserTyping", handleSubChatUserTyping);
      socket.on(
        "adminSubChatUserStoppedTyping",
        handleSubChatUserStoppedTyping
      );
      return () => {
        socket.off("new_admin_sub_chat_message", handleNewMessageWhileOpen);
        socket.off("adminSubChatUserTyping", handleSubChatUserTyping);
        socket.off(
          "adminSubChatUserStoppedTyping",
          handleSubChatUserStoppedTyping
        );
      };
    }
  }, [
    showSubChatModal,
    socket,
    activeSubChatId,
    activeSubChatMessages,
    mediationRequestId,
    currentUserId,
  ]);

  useEffect(() => {
    if (messages.length === 0 || !hasJoinedRoom || !currentUserId) return;
    const unreadMessages = messages.filter(
      (msg) =>
        msg.sender?._id !== currentUserId &&
        !msg.readBy?.some(
          (reader) => reader.readerId?.toString() === currentUserId
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
    if (!socket) return;
    const handleMediationDetailsUpdate = (data) => {
      if (data.mediationRequestId === mediationRequestId)
        dispatch(
          updateMediationDetailsFromSocket(data.updatedMediationRequestData)
        );
    };
    const handleSocketDisconnect = () => {
      setChatError(t("mediationChatPage.connectionLost"));
      setHasJoinedRoom(false);
    };
    socket.on("mediation_request_updated", handleMediationDetailsUpdate);
    socket.on("disconnect", handleSocketDisconnect);
    return () => {
      socket.off("mediation_request_updated", handleMediationDetailsUpdate);
      socket.off("disconnect", handleSocketDisconnect);
    };
  }, [socket, mediationRequestId, dispatch, t]);

  const participants = useMemo(() => {
    if (!mediationDetails) return [];
    const parts = [];
    const addParticipant = (p, roleLabel) => {
      if (p && p._id && !parts.some((existing) => existing._id === p._id)) {
        parts.push({ ...p, roleLabel });
      }
    };
    addParticipant(mediationDetails.seller, t("mediationChatPage.seller"));
    addParticipant(mediationDetails.buyer, t("mediationChatPage.buyer"));
    addParticipant(mediationDetails.mediator, t("mediationChatPage.mediator"));
    (mediationDetails.disputeOverseers || []).forEach((admin) =>
      addParticipant(admin, t("mediationChatPage.admin"))
    );
    if (
      currentUserRole === "Admin" &&
      !parts.some((p) => p._id === currentUserId)
    ) {
      addParticipant(
        currentUser,
        `${t("mediationChatPage.admin")} (${t("mediationChatPage.you")})`
      );
    }
    return parts;
  }, [mediationDetails, currentUser, currentUserId, currentUserRole, t]);

  const otherParticipants = useMemo(
    () => participants.filter((p) => p._id !== currentUserId),
    [participants, currentUserId]
  );

  const lastReadMessageByParticipant = useMemo(() => {
    if (!otherParticipants.length || !messages.length) return {};
    const indicators = {};
    otherParticipants.forEach((participant) => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].type === "system") continue;
        if (
          messages[i].readBy?.some(
            (r) =>
              r &&
              (r.readerId === participant._id ||
                r.readerId?._id === participant._id)
          )
        ) {
          if (!indicators[messages[i]._id]) indicators[messages[i]._id] = [];
          if (
            !indicators[messages[i]._id].some(
              (p) => p.readerId === participant._id
            )
          ) {
            const participantInfo =
              participants.find((p) => p._id === participant._id) ||
              participant;
            indicators[messages[i]._id].push({
              ...participantInfo,
              readerId: participant._id,
            });
          }
          break;
        }
      }
    });
    return indicators;
  }, [messages, otherParticipants, participants]);

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
        if (
          message.readBy?.some(
            (r) =>
              r &&
              (r.readerId === participant.userId._id ||
                r.readerId?._id === participant.userId._id)
          )
        ) {
          if (!indicators[message._id]) indicators[message._id] = [];
          if (
            !indicators[message._id].some(
              (p) => p.readerId === participant.userId._id
            )
          ) {
            indicators[message._id].push({
              ...participant.userId,
              readerId: participant.userId._id,
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
      if (!typingTimeoutRef.current && e.target.value.trim() !== "")
        socket.emit("start_typing", {
          mediationRequestId,
          userId: currentUserId,
          fullName: currentUserFullName,
          avatarUrl: currentUserAvatarUrl,
        });
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
        imageUrl: null,
      });
      setNewMessage("");
      setShowEmojiPicker(false);
    }
  };

  const handleImageUpload = async (fileToUpload, forSubChat = false) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error(t("mediationChatPage.authError"));
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
            messageText: "",
            imageUrl,
          });
        } else {
          socket.emit("sendMediationMessage", {
            mediationRequestId,
            messageText: "",
            imageUrl,
          });
        }
      }
    } catch (error) {
      toast.error(
        error.response?.data?.msg || t("mediationChatPage.imageUploadFailed")
      );
    }
  };

  const handleSubChatInputChange = (e) => {
    setNewSubChatMessage(e.target.value);
    if (socket?.connected && activeSubChatId) {
      if (!subChatTypingTimeoutRef.current && e.target.value.trim() !== "")
        socket.emit("adminSubChatStartTyping", {
          mediationRequestId,
          subChatId: activeSubChatId,
          userId: currentUserId,
          fullName: currentUserFullName,
          avatarUrl: currentUserAvatarUrl,
        });
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
    const textToSend = newSubChatMessage.trim();
    if (!textToSend && !subChatFile) return;
    if (!socket?.connected || !activeSubChatId) {
      toast.error(t("mediationChatPage.notConnected"));
      return;
    }
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
        const formData = new FormData();
        formData.append("image", subChatFile);
        const response = await axios.post(
          `${BACKEND_URL}/mediation/chat/upload-image`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        imageUrlToSend = response.data.imageUrl;
      } catch (uploadError) {
        toast.error(
          uploadError.response?.data?.msg ||
            t("mediationChatPage.subChatImageUploadFailed")
        );
      }
    }
    socket.emit("sendAdminSubChatMessage", {
      mediationRequestId,
      subChatId: activeSubChatId,
      messageText: textToSend,
      imageUrl: imageUrlToSend,
    });
    setNewSubChatMessage("");
    handleRemoveSubChatImage();
    setShowSubChatEmojiPicker(false);
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
        (r) => r.rater === currentUserId || r.rater?._id === currentUserId
      )
      .map((r) => r.ratedUser?._id || r.ratedUser);
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
      toast.error(t("mediationChatPage.couldNotLoadImage"));
    }
  };

  const handleCloseImageModal = () => setShowImageModal(false);

  const handleImageErrorInModal = useCallback(
    (e) => {
      toast.error(t("mediationChatPage.failedToLoadFullSizeImage"));
      e.target.src = fallbackProductImageUrl;
    },
    [t]
  );

  const handleConfirmReceipt = useCallback(async () => {
    if (!mediationDetails?._id || isConfirmingReceipt) return;
    if (window.confirm(t("mediationChatPage.confirmReceiptFinal"))) {
      setIsConfirmingReceipt(true);
      try {
        await dispatch(buyerConfirmReceipt(mediationDetails._id));
        toast.success(t("mediationChatPage.receiptConfirmed"));
      } catch (error) {
        console.error("Error confirming receipt:", error);
      } finally {
        setIsConfirmingReceipt(false);
      }
    }
  }, [dispatch, mediationDetails?._id, isConfirmingReceipt, t]);

  const handleOpenDispute = useCallback(async () => {
    if (
      !mediationDetails?._id ||
      isOpeningDispute ||
      mediationDetails.status !== "InProgress"
    )
      return;
    if (window.confirm(t("mediationChatPage.openDisputeAdmin"))) {
      setIsOpeningDispute(true);
      try {
        await dispatch(openDisputeAction(mediationDetails._id));
        toast.info(t("mediationChatPage.disputeOpened"));
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
    t,
  ]);

  const handleResolveDispute = async (winnerRole) => {
    if (
      !mediationDetails?._id ||
      mediationDetails.status !== "Disputed" ||
      currentUserRole !== "Admin" ||
      isResolvingDispute
    )
      return;
    if (!resolutionNotes.trim()) {
      toast.warn(t("mediationChatPage.resolutionNotesRequired"));
      return;
    }
    let winnerId, loserId;
    if (winnerRole === "buyer") {
      winnerId = mediationDetails.buyer?._id;
      loserId = mediationDetails.seller?._id;
    } else if (winnerRole === "seller") {
      winnerId = mediationDetails.seller?._id;
      loserId = mediationDetails.buyer?._id;
    } else return;
    if (!winnerId || !loserId) {
      toast.error(t("mediationChatPage.cannotDetermineWinner"));
      return;
    }
    if (
      !window.confirm(
        t("mediationChatPage.confirmRuleInFavor", {
          winnerRole,
          notes: resolutionNotes,
        })
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
    )
      return;
    if (
      !window.confirm(
        t("mediationChatPage.confirmCancelMediation", {
          notes: resolutionNotes,
        })
      )
    )
      return;
    setIsResolvingDispute(true);
    const resData = {
      resolutionNotes:
        resolutionNotes.trim() || t("mediationChatPage.cancelledByAdmin"),
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
          <Spinner animation="border" size="sm" />{" "}
          {t("mediationChatPage.loadingRatings")}
        </div>
      );
    if (!mediationDetails)
      return (
        <Alert variant="warning" className="m-3">
          {t("mediationChatPage.detailsUnavailable")}
        </Alert>
      );
    if (mediationDetails.status !== "Completed")
      return (
        <Alert variant="info" className="m-3">
          {t("mediationChatPage.ratingsAvailableOnCompletion")}
        </Alert>
      );
    return (
      <>
        <div
          className="d-flex justify-content-between align-items-center mb-0 p-3 border-bottom sticky-top bg-light"
          style={{ zIndex: 1 }}
        >
          <h5 className="mb-0">{t("mediationChatPage.rateParticipants")}</h5>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setSidebarView("details")}
          >
            <FaArrowLeft className="me-1" /> {t("mediationChatPage.back")}
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
              {t("mediationChatPage.allParticipantsRated")}
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
    if (!participantUser || !participantUser._id) return;
    setSubChatTitle(
      t("mediationChatPage.discussionWith", { name: participantUser.fullName })
    );
    setSelectedParticipants([participantUser._id]);
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
      toast.warn(t("mediationChatPage.selectOneParticipant"));
      return;
    }
    const subChatData = {
      participantUserIds: selectedParticipants,
      title: subChatTitle.trim() || t("mediationChatPage.privateDiscussion"),
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
      toast.error(t("mediationChatPage.couldNotOpenPrivateChat"));
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
          <h5 className="mb-3 sidebar-section-title">
            {t("mediationChatPage.participants")}
          </h5>
          <ListGroup variant="flush" className="mb-4 participant-list">
            {participants.map((p) => {
              if (!p?._id) return null;
              const isOnline = onlineUserIds.includes(p._id.toString());
              const isCurrentUserAdmin = currentUserRole === "Admin";
              const isNotSelf = p._id !== currentUserId;
              return (
                <ListGroup.Item
                  key={p._id}
                  className="d-flex align-items-center bg-transparent border-0 px-0 py-2 participant-item"
                >
                  <div className="position-relative me-3">
                    <ParticipantAvatar participant={p} size={35} t={t} />
                    <span
                      className={`online-status-indicator-sidebar ${
                        isOnline ? "online" : "offline"
                      }`}
                      title={
                        isOnline
                          ? t("mediationChatPage.online")
                          : t("mediationChatPage.offline")
                      }
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
                          <Tooltip id={`tooltip-chat-${p._id}`}>
                            {t("mediationChatPage.startPrivateChatWith", {
                              name: p.fullName,
                            })}
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
          <h5 className="mb-3 sidebar-section-title">
            {t("mediationChatPage.transactionDetails")}
          </h5>
          {mediationDetails?.product ? (
            <div className="transaction-details-widget mb-4 small">
              <p className="mb-1">
                <strong>{t("mediationChatPage.product")}</strong>{" "}
                {mediationDetails.product.title}
              </p>
              <p className="mb-1">
                <strong>{t("mediationChatPage.agreedPrice")}</strong>
                {formatCurrency(
                  mediationDetails.bidAmount,
                  mediationDetails.bidCurrency
                )}
              </p>
              <p className="mb-1">
                <strong>{t("mediationChatPage.escrowed")}</strong>
                {mediationDetails.escrowedAmount
                  ? formatCurrency(
                      mediationDetails.escrowedAmount,
                      mediationDetails.escrowedCurrency
                    )
                  : t("mediationChatPage.notYet")}
              </p>
              <p className="mb-1">
                <strong>{t("mediationChatPage.mediatorFee")}</strong>
                {formatCurrency(
                  mediationDetails.calculatedMediatorFee,
                  mediationDetails.mediationFeeCurrency
                )}
              </p>
              <p className="mb-1">
                <strong>{t("mediationChatPage.status")}</strong>
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
            <p>{t("mediationChatPage.loadingTransactionDetails")}</p>
          )}
          {currentUserRole === "Admin" && isDisputed && (
            <div className="admin-dispute-tools mt-4 pt-3 border-top">
              <h5 className="mb-3 text-danger sidebar-section-title">
                {t("mediationChatPage.adminDisputeControls")}
              </h5>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold">
                  {t("mediationChatPage.resolutionNotes")}
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder={t(
                    "mediationChatPage.resolutionNotesPlaceholder"
                  )}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </Form.Group>
              <p className="text-muted small mb-1">
                {t("mediationChatPage.decision")}
              </p>
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
                    t("mediationChatPage.ruleInFavorOfBuyer")
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
                    t("mediationChatPage.ruleInFavorOfSeller")
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
                    t("mediationChatPage.cancelMediation")
                  )}
                </Button>
              </div>
            </div>
          )}
          {mediationDetails?.status === "Disputed" && (
            <div className="subchats-section mt-4 pt-3 border-top">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0 sidebar-section-title text-info">
                  <FaComments className="me-1" />{" "}
                  {t("mediationChatPage.privateChats")}
                </h5>
                {currentUserRole === "Admin" && (
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip id="tooltip-new-subchat">
                        {t("mediationChatPage.createPrivateChat")}
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
              {!subChatsList || subChatsList.length === 0 ? (
                <p className="text-muted small fst-italic mt-2">
                  {t("mediationChatPage.noPrivateChats")}
                </p>
              ) : (
                <ListGroup variant="flush" className="subchat-display-list">
                  {subChatsList.map((subChat) => {
                    const otherUsersInSubChat = subChat.participants
                      ?.filter((par) => par.userId?._id !== currentUserId)
                      .map((par) => par.userId?.fullName);
                    let chatDisplayName =
                      subChat.title ||
                      (otherUsersInSubChat?.length === 1
                        ? t("mediationChatPage.chatWith", {
                            name: otherUsersInSubChat[0],
                          })
                        : otherUsersInSubChat?.length > 1
                        ? t("mediationChatPage.groupChat", {
                            name: otherUsersInSubChat.slice(0, 1).join(", "),
                            count: otherUsersInSubChat.length - 1,
                          })
                        : t("mediationChatPage.privateDiscussion"));
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
                          <div className="subchat-item-avatars me-2 d-flex">
                            {subChat.participants
                              ?.filter((p) => p.userId?._id !== currentUserId)
                              .slice(0, 2)
                              .map(
                                (p) =>
                                  p.userId && (
                                    <ParticipantAvatar
                                      key={p.userId._id}
                                      participant={p.userId}
                                      size={24}
                                      t={t}
                                    />
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
                                  subChat.lastMessageAt,
                                  t
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
                    {t("mediationChatPage.confirming")}
                  </>
                ) : (
                  t("mediationChatPage.confirmReceipt")
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
                    {t("mediationChatPage.opening")}
                  </>
                ) : (
                  t("mediationChatPage.openDispute")
                )}
              </Button>
            )}
          {isDisputed && mediationDetails?.status === "Disputed" && (
            <Button variant="outline-secondary" className="w-100" disabled>
              {t("mediationChatPage.disputeInProgress")}
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
              <FaStar className="me-1" />{" "}
              {t("mediationChatPage.rateParticipants")}
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
        <p>{t("mediationChatPage.loadingUser")}</p>
      </Container>
    );
  if (loadingDetails && !mediationDetails)
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />{" "}
        <p>{t("mediationChatPage.loadingDetails")}</p>
      </Container>
    );
  if (errorDetails && !mediationDetails)
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <h4>{t("mediationChatPage.error")}</h4>
          <p>{errorDetails}</p>
          <Button onClick={() => navigate(-1)}>
            {t("mediationChatPage.back")}
          </Button>
        </Alert>
      </Container>
    );
  if (!mediationDetails && !loadingDetails && !errorDetails)
    return (
      <Container className="py-5 text-center">
        <Alert variant="warning">
          {t("mediationChatPage.detailsUnavailable")}
        </Alert>
        <Button onClick={() => navigate(-1)}>
          {t("mediationChatPage.back")}
        </Button>
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
                    {t("mediationChatPage.mediation")}{" "}
                    {mediationDetails?.product?.title ||
                      t("mediationChatPage.chat")}
                  </h5>
                  <small className="text-muted">
                    {t("mediationChatPage.id")} {mediationRequestId.slice(-6)}
                  </small>
                </Col>
                <Col xs="auto" className="d-md-none">
                  <Button
                    variant="outline-info"
                    size="sm"
                    onClick={handleShowDetailsOffcanvas}
                  >
                    {t("mediationChatPage.details")}
                  </Button>
                </Col>
                <Col xs="auto">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => navigate(-1)}
                  >
                    {t("mediationChatPage.back")}
                  </Button>
                </Col>
              </Row>
              {isDisputed && (
                <Alert
                  variant="warning"
                  className="mt-2 mb-0 text-center small p-2"
                >
                  <strong>{t("mediationChatPage.inDispute")}</strong>
                </Alert>
              )}
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
                  <Spinner size="sm" /> {t("mediationChatPage.loadingHistory")}
                </div>
              )}
              <ListGroup variant="flush" className="p-3">
                {!isLoadingHistory && messages.length === 0 && !chatError && (
                  <ListGroup.Item className="text-center text-muted border-0 py-5">
                    {t("mediationChatPage.noMessages")}
                  </ListGroup.Item>
                )}
                {messages.map((msg, index) => {
                  const previousMessage = messages[index - 1];
                  const showAvatar =
                    !previousMessage ||
                    previousMessage.sender?._id !== msg.sender?._id ||
                    msg.type === "system";
                  const isMyMessage = msg.sender?._id === currentUserId;
                  const senderInfo =
                    participants.find((p) => p._id === msg.sender?._id) ||
                    msg.sender;
                  const avatarsForThisMessage =
                    lastReadMessageByParticipant[msg._id];
                  if (msg.type === "system") {
                    return (
                      <ListGroup.Item
                        key={msg._id || `msg-sys-${index}`}
                        className="message-item system-message text-center my-2 border-0"
                      >
                        <div className="d-inline-block p-2 rounded bg-light-subtle text-muted small">
                          <SafeHtmlRenderer htmlContent={msg.message} />
                          <div className="message-timestamp mt-1">
                            {formatMessageTimestampForDisplay(msg.timestamp, t)}
                          </div>
                        </div>
                      </ListGroup.Item>
                    );
                  }
                  return (
                    <React.Fragment
                      key={msg._id || `msg-${index}-${msg.timestamp}`}
                    >
                      <ListGroup.Item
                        className={`d-flex mb-1 message-item border-0 ${
                          isMyMessage ? "sent" : "received"
                        } ${showAvatar ? "mt-2" : "mt-1"}`}
                      >
                        {!isMyMessage && (
                          <div
                            className="avatar-container me-2 flex-shrink-0"
                            style={{
                              visibility:
                                showAvatar && msg.sender ? "visible" : "hidden",
                            }}
                          >
                            {showAvatar && senderInfo && (
                              <ParticipantAvatar
                                participant={senderInfo}
                                size={40}
                                t={t}
                              />
                            )}
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
                            {showAvatar && !isMyMessage && senderInfo && (
                              <strong className="d-block mb-1">
                                {senderInfo?.fullName ||
                                  t("mediationChatPage.user")}
                              </strong>
                            )}
                            {msg.type === "image" && msg.imageUrl ? (
                              <Image
                                src={
                                  msg.imageUrl.startsWith("http")
                                    ? msg.imageUrl
                                    : `${BACKEND_URL}${msg.imageUrl}`
                                }
                                alt="Chat content"
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
                              isMyMessage
                                ? "justify-content-end"
                                : "justify-content-start"
                            } align-items-center mt-1`}
                          >
                            <small className="text-muted message-timestamp">
                              {formatMessageTimestampForDisplay(
                                msg.timestamp,
                                t
                              )}
                            </small>
                            {isMyMessage &&
                              (!avatarsForThisMessage ||
                                avatarsForThisMessage.length === 0) && (
                                <FaCheck
                                  title={t("mediationChatPage.sent")}
                                  className="text-muted ms-1"
                                />
                              )}
                          </div>
                        </div>
                      </ListGroup.Item>
                      {isMyMessage && avatarsForThisMessage?.length > 0 && (
                        <div className="d-flex justify-content-end pe-3 mb-2 read-indicators-wrapper">
                          <div className="read-by-indicators-cluster d-flex align-items-center">
                            {avatarsForThisMessage.map((reader, idx) => (
                              <OverlayTrigger
                                key={reader.readerId || `reader-${idx}`}
                                placement="top"
                                overlay={
                                  <Tooltip>
                                    {t("mediationChatPage.seenBy", {
                                      name: reader.fullName,
                                    })}
                                  </Tooltip>
                                }
                              >
                                <div className="d-inline-block">
                                  <ParticipantAvatar
                                    participant={reader}
                                    size={16}
                                    t={t}
                                  />
                                </div>
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
                      onClick={() => setShowEmojiPicker((p) => !p)}
                      className="btn-icon-round"
                      disabled={!isChatActuallyActiveForInput}
                    >
                      <FaSmile />
                    </Button>
                  </Col>
                  <Col xs="auto">
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files[0] &&
                        handleImageUpload(e.target.files[0], false)
                      }
                      style={{ display: "none" }}
                      ref={fileInputRef}
                    />
                    <Button
                      variant="light"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-icon-round"
                      disabled={!isChatActuallyActiveForInput}
                    >
                      <FaCamera />
                    </Button>
                  </Col>
                  <Col>
                    <Form.Control
                      type="text"
                      placeholder={
                        isChatActuallyActiveForInput
                          ? t("mediationChatPage.typeMessage")
                          : t("mediationChatPage.chatNotActive")
                      }
                      value={newMessage}
                      onChange={handleInputChange}
                      disabled={!isChatActuallyActiveForInput}
                      autoFocus
                    />
                  </Col>
                  <Col xs="auto">
                    <Button
                      type="submit"
                      className="btn-icon-round"
                      disabled={
                        !newMessage.trim() || !isChatActuallyActiveForInput
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
                  className="emoji-picker-container main-chat-emoji-picker"
                >
                  <EmojiPicker onEmojiClick={(e) => onEmojiClick(e, false)} />
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
            ) : (
              <div className="text-center p-3">
                <Spinner />
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
            {t("mediationChatPage.detailsAndActions")}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="d-flex flex-column p-0">
          {mediationDetails ? (
            sidebarView === "details" ? (
              renderTransactionDetailsAndActions(adminSubChatsList)
            ) : (
              renderRatingsPanel()
            )
          ) : (
            <div className="p-3">
              <Alert variant="warning">
                {t("mediationChatPage.detailsUnavailable")}
              </Alert>
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
        <Modal.Header closeButton></Modal.Header>
        <Modal.Body>
          <Image
            src={currentImageInModal}
            fluid
            onError={handleImageErrorInModal}
          />
        </Modal.Body>
      </Modal>
      <Modal
        show={showCreateSubChatModal}
        onHide={handleCloseCreateSubChatModal}
        centered
        dialogClassName="themed-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>{t("mediationChatPage.createPrivateChat")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errorCreatingSubChat && (
            <Alert variant="danger">{errorCreatingSubChat}</Alert>
          )}
          <Form onSubmit={handleCreateSubChat}>
            <Form.Group className="mb-3">
              <Form.Label>
                {t("mediationChatPage.chatTitleOptional")}
              </Form.Label>
              <Form.Control
                type="text"
                value={subChatTitle}
                onChange={(e) => setSubChatTitle(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>
                {t("mediationChatPage.selectParticipants")}
              </Form.Label>
              {participants
                .filter((p) => p._id !== currentUserId)
                .map((party) => (
                  <Form.Check
                    type="checkbox"
                    key={party._id}
                    id={`p-${party._id}`}
                    className="participant-checkbox-item"
                    label={
                      <>
                        <ParticipantAvatar
                          participant={party}
                          size={24}
                          t={t}
                        />
                        <span className="ms-2">{party.fullName}</span>
                      </>
                    }
                    checked={selectedParticipants.includes(party._id)}
                    onChange={() => handleParticipantSelection(party._id)}
                  />
                ))}
            </Form.Group>
            <Button
              variant="primary"
              type="submit"
              disabled={creatingSubChat || selectedParticipants.length === 0}
              className="w-100"
            >
              {creatingSubChat ? (
                <Spinner size="sm" />
              ) : (
                t("mediationChatPage.startPrivateChat")
              )}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
      <Modal
        show={showSubChatModal}
        onHide={handleCloseSubChatModal}
        dialogClassName="sub-chat-modal"
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaComments className="me-2 text-primary" />
            {activeSubChatDetails?.title ||
              t("mediationChatPage.privateDiscussion")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          <ListGroup
            variant="flush"
            className="sub-chat-messages-list custom-scrollbar"
          >
            {loadingActiveSubChatMessages && (
              <div className="text-center p-5">
                <Spinner />
              </div>
            )}
            {!loadingActiveSubChatMessages &&
              activeSubChatMessages.length === 0 && (
                <ListGroup.Item className="text-center text-muted border-0">
                  {t("mediationChatPage.noMessages")}
                </ListGroup.Item>
              )}
            {activeSubChatMessages.map((msg, index) => {
              const isMySubChatMessage =
                (msg.sender?._id || msg.sender) === currentUserId;
              const showSubChatAvatar =
                !activeSubChatMessages[index - 1] ||
                (activeSubChatMessages[index - 1].sender?._id ||
                  activeSubChatMessages[index - 1].sender) !==
                  (msg.sender?._id || msg.sender);
              const subChatAvatarsForThisMessage =
                lastReadMessageBySubChatParticipant[msg._id];
              const subChatSenderInfo =
                activeSubChatDetails?.participants?.find(
                  (p) => p.userId?._id === (msg.sender?._id || msg.sender)
                )?.userId || msg.sender;
              if (msg.type === "system")
                return (
                  <ListGroup.Item
                    key={msg._id}
                    className="text-center my-2 border-0"
                  >
                    <div className="d-inline-block p-2 small bg-light text-muted rounded">
                      {msg.message}
                    </div>
                  </ListGroup.Item>
                );
              return (
                <React.Fragment key={msg._id}>
                  <ListGroup.Item
                    className={`d-flex mb-1 message-item border-0 ${
                      isMySubChatMessage ? "sent" : "received"
                    } ${showSubChatAvatar ? "mt-2" : "mt-1"}`}
                  >
                    {!isMySubChatMessage && (
                      <div className="avatar-container me-2">
                        {showSubChatAvatar && subChatSenderInfo && (
                          <ParticipantAvatar
                            participant={subChatSenderInfo}
                            t={t}
                          />
                        )}
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
                          subChatSenderInfo && (
                            <strong>{subChatSenderInfo.fullName}</strong>
                          )}
                        {msg.type === "image" ? (
                          <Image
                            src={msg.imageUrl}
                            className="chat-image-preview"
                            onClick={() => handleShowImageInModal(msg.imageUrl)}
                          />
                        ) : (
                          <div className="message-text">{msg.message}</div>
                        )}
                      </div>
                      <div className="message-meta d-flex">
                        <small className="text-muted">
                          {formatMessageTimestampForDisplay(msg.timestamp, t)}
                        </small>
                        {isMySubChatMessage &&
                          (!subChatAvatarsForThisMessage ||
                            subChatAvatarsForThisMessage.length === 0) && (
                            <FaCheck className="ms-1" />
                          )}
                      </div>
                    </div>
                  </ListGroup.Item>
                  {isMySubChatMessage && subChatAvatarsForThisMessage && (
                    <div className="d-flex justify-content-end pe-3">
                      <div className="read-by-indicators-cluster d-flex align-items-center">
                        {subChatAvatarsForThisMessage.map((r) => (
                          <ParticipantAvatar
                            key={r.readerId}
                            participant={r}
                            size={16}
                            t={t}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            <div ref={subChatMessagesEndRef} />
          </ListGroup>
        </Modal.Body>
        <div className="sub-chat-modal-footer">
          <div className="typing-indicator-container">
            <TypingIndicator
              typingUsers={subChatTypingUsers}
              currentUserId={currentUserId}
            />
          </div>
          {subChatImagePreview && (
            <div className="subchat-image-preview-container">
              <Image
                src={subChatImagePreview}
                className="subchat-preview-thumb"
                onClick={() => handleShowImageInModal(subChatImagePreview)}
                style={{ cursor: "pointer" }}
              />
              <div className="subchat-preview-filename">
                {subChatFile?.name}
              </div>
              <Button
                variant="light"
                size="sm"
                className="subchat-preview-remove"
                onClick={handleRemoveSubChatImage}
                title={t("mediationChatPage.removeImage")}
              >
                <FaTimes />
              </Button>
            </div>
          )}
          <Form onSubmit={handleSendSubChatMessage} className="w-100">
            <Row className="g-2 align-items-center">
              <Col xs="auto">
                <Button
                  variant="light"
                  className="btn-icon-round"
                  onClick={() => setShowSubChatEmojiPicker((p) => !p)}
                >
                  <FaSmile />
                </Button>
              </Col>
              <Col xs="auto">
                <Form.Control
                  type="file"
                  accept="image/*"
                  ref={subChatFileInputRef}
                  style={{ display: "none" }}
                  onChange={handleSubChatFileSelect}
                />
                <Button
                  variant="light"
                  className="btn-icon-round"
                  onClick={() => subChatFileInputRef.current.click()}
                >
                  <FaCamera />
                </Button>
              </Col>
              <Col>
                <Form.Control
                  type="text"
                  className="subchat-input-field"
                  placeholder={
                    subChatFile
                      ? t("mediationChatPage.addCaption")
                      : t("mediationChatPage.typeMessage")
                  }
                  value={newSubChatMessage}
                  onChange={handleSubChatInputChange}
                  autoFocus
                />
              </Col>
              <Col xs="auto">
                <Button
                  type="submit"
                  className="btn-icon-round"
                  disabled={!newSubChatMessage.trim() && !subChatFile}
                >
                  <FaPaperPlane />
                </Button>
              </Col>
            </Row>
          </Form>
          {showSubChatEmojiPicker && (
            <div className="subchat-emoji-picker">
              <EmojiPicker onEmojiClick={(e) => onEmojiClick(e, true)} />
            </div>
          )}
        </div>
      </Modal>
    </Container>
  );
};

export default MediationChatPage;