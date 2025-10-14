// client/src/components/vendor/CountdownCircle.jsx

import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

const CountdownCircle = ({ assignmentTime, onComplete }) => {
  const { t } = useTranslation();
  const DURATION_MINUTES = 10; // 10 دقائق مهلة

  // استخدام useMemo لضمان حساب الوقت المستهدف مرة واحدة فقط
  const targetTime = useMemo(() => {
    if (!assignmentTime) return null;
    const assignmentDate = new Date(assignmentTime);
    return assignmentDate.getTime() + DURATION_MINUTES * 60 * 1000;
  }, [assignmentTime]);

  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!targetTime) {
      setTimeLeft(0);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = targetTime - now;
      return difference > 0 ? difference : 0;
    };

    // ضبط الوقت المتبقي عند تحميل المكون
    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (onComplete) {
          onComplete(); // استدعاء الدالة عند انتهاء الوقت
        }
      }
    }, 1000);

    // تنظيف المؤقت عند إلغاء تحميل المكون
    return () => clearInterval(interval);
  }, [targetTime, onComplete]);

  if (timeLeft === null || !assignmentTime) {
    // يعرض 00:00 كقيمة افتراضية إذا لم يتم توفير الوقت أو أثناء التحميل الأولي
    return (
      <div
        className="countdown-container"
        title={t("myProductsPage.countdown.calculating", "Calculating...")}
      >
        <span className="countdown-text">00:00</span>
      </div>
    );
  }

  const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);

  const displayTime = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;

  // حساب نسبة التقدم للـ SVG
  const totalDurationMs = DURATION_MINUTES * 60 * 1000;
  const progress = timeLeft / totalDurationMs;
  const circumference = 2 * Math.PI * 18; // 2 * pi * radius
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className="countdown-container"
      title={t(
        "myProductsPage.countdown.tooltip",
        "Time for mediator to accept"
      )}
    >
      <svg className="countdown-svg" width="40" height="40" viewBox="0 0 40 40">
        <circle className="countdown-circle-bg" cx="20" cy="20" r="18" />
        <circle
          className="countdown-circle-progress"
          cx="20"
          cy="20"
          r="18"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <span className="countdown-text">{displayTime}</span>
    </div>
  );
};

export default CountdownCircle;