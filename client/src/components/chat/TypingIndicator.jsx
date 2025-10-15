// client/src/components/chat/TypingIndicator.jsx

import React from "react";
import { Image } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import "./TypingIndicator.css"; // تأكد من أن هذا الملف موجود

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const noUserAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png";

const TypingIndicator = ({ typingUsers, currentUserId }) => {
  const { t } = useTranslation();

  const activeTypingUsers = Object.values(typingUsers || {}).filter(
    (user) => user && user.userId !== currentUserId
  );

  if (activeTypingUsers.length === 0) {
    return <div className="typing-indicator-area-placeholder" />;
  }

  const renderTypingMessage = () => {
    const names = activeTypingUsers.map((u) => u.fullName || "Someone");
    let message;

    if (names.length === 1) {
      message = t("mediationChatPage.isTyping", { name: names[0] });
    } else if (names.length === 2) {
      message = t("mediationChatPage.areTyping", {
        name1: names[0],
        name2: names[1],
      });
    } else {
      message = t("mediationChatPage.multipleTyping", { count: names.length });
    }

    return (
      <>
        <span className="is-typing-text-indicator">{message}</span>
        <div className="typing-dots-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </>
    );
  };

  return (
    <div className="typing-indicator-area">
      {activeTypingUsers.slice(0, 1).map((user) => (
        <Image
          key={user.userId}
          src={
            user.avatarUrl && !user.avatarUrl.startsWith("http")
              ? `${BACKEND_URL}${user.avatarUrl}`
              : user.avatarUrl || noUserAvatar
          }
          roundedCircle
          width={16}
          height={16}
          className="typing-avatar-indicator"
          alt={user.fullName || "User"}
        />
      ))}
      {renderTypingMessage()}
    </div>
  );
};

export default TypingIndicator;