// src/components/chat/TypingIndicator.jsx

import React from "react";
import { Image } from "react-bootstrap";
import "./TypingIndicator.css";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const noUserAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png";

const TypingIndicator = ({ typingUsers, currentUserId }) => {
  const otherTypingUsers = Object.values(typingUsers || {}).filter(
    (user) => user && user.userId !== currentUserId
  );

  if (otherTypingUsers.length === 0) {
    return null;
  }

  // --- START OF THE FIX ---
  // سنبني أجزاء الواجهة هنا
  const typingUsersElements = otherTypingUsers
    .slice(0, 2)
    .map((user, index, arr) => (
      // نضع كل مجموعة في <span> ونعطيه المفتاح
      <span key={user.userId || `typing-${index}`}>
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
          alt={user.fullName || "User"}
          title={user.fullName || "User"} // Add a title for hover
        />
        <span className="typing-user-name-indicator">
          {user.fullName || "Someone"}
        </span>
        {/* أضف الفاصلة فقط إذا لم يكن هذا هو العنصر الأخير في القائمة المعروضة */}
        {index < arr.length - 1 && <span className="mx-1">,</span>}
      </span>
    ));
  // --- END OF THE FIX ---

  return (
    <div className="typing-indicator small text-muted mb-1 d-flex align-items-center">
      {typingUsersElements} {/* عرض العناصر التي تم بناؤها */}
      {otherTypingUsers.length > 2 && (
        <span className="ms-1">and {otherTypingUsers.length - 2} other(s)</span>
      )}
      <span className="is-typing-text-indicator mx-1">
        {otherTypingUsers.length > 1 ? "are typing" : "is typing"}
      </span>
      <div className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
};

export default TypingIndicator;