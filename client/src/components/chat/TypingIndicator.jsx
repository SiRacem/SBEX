// src/components/chat/TypingIndicator.jsx
import React from "react";
import { Image } from "react-bootstrap";
import "./TypingIndicator.css";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const noUserAvatar = "https://bootdey.com/img/Content/avatar/avatar7.png";

const TypingIndicator = ({ typingUsers, currentUserId }) => {
  // تصفية المستخدم الحالي والحصول على مصفوفة من المستخدمين الذين يكتبون
  const otherTypingUsersArray = Object.entries(typingUsers)
    .filter(([userId]) => userId !== currentUserId) // لا تعرض مؤشر للمستخدم الحالي
    .map(([userId, userData]) => ({
      // userData هو { fullName, avatarUrl }
      id: userId,
      name: userData.fullName || "Someone", // اسم افتراضي إذا لم يكن الاسم موجوداً
      avatarUrl: userData.avatarUrl,
    }));

  if (otherTypingUsersArray.length === 0) {
    return (
      <div
        className="typing-indicator-area-placeholder mb-1"
        style={{ height: "20px" }}
      ></div>
    ); // عنصر فارغ ليحافظ على التخطيط
  }

  return (
    <div className="typing-indicator-area mb-1">
      {otherTypingUsersArray.slice(0, 2).map(
        (
          user,
          index // عرض أول اثنين فقط مثلاً
        ) => (
          <React.Fragment key={user.id}>
            <Image
              src={
                user.avatarUrl && !user.avatarUrl.startsWith("http")
                  ? `${BACKEND_URL}/${user.avatarUrl}`
                  : user.avatarUrl || noUserAvatar
              }
              roundedCircle
              width={18} // حجم أصغر لمؤشر الكتابة
              height={18}
              className="me-1 typing-avatar-indicator"
              alt={user.name}
              onError={(e) => {
                e.target.src = noUserAvatar;
              }}
            />
            <span className="typing-user-name-indicator me-1">{user.name}</span>
            {index < otherTypingUsersArray.slice(0, 2).length - 1 && (
              <span className="mx-1">,</span>
            )}
          </React.Fragment>
        )
      )}
      {otherTypingUsersArray.length > 2 && (
        <span className="mx-1">and others</span>
      )}
      <span className="is-typing-text-indicator mx-1">
        {otherTypingUsersArray.length > 1 ? "are" : "is"}
      </span>
      <div className="typing-dots-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
};

export default TypingIndicator;
