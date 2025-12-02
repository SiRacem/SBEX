// src/utils/notificationUtils.js
import React from 'react';

// استيراد جميع الأيقونات المستخدمة من مكتبة react-icons
import {
    FaBell,
    FaCheckCircle,
    FaCommentDots,
    FaDollarSign,
    FaGavel,
    FaHandshake,
    FaHourglassHalf,
    FaMedal,
    FaMoneyBillWave,
    FaRegEnvelope,
    FaRegEnvelopeOpen,
    FaTimesCircle,
    FaUserShield,
    FaUsersCog,
    FaBullhorn,
    FaShoppingBag
} from "react-icons/fa";
import {
    FiAlertTriangle,
    FiTrendingDown,
    FiTrendingUp
} from "react-icons/fi";


export const getNotificationIcon = (type, isRead) => {
    // تحديد لون الأيقونة بناءً على حالة القراءة
    const iconColor = !isRead ? "primary" : "secondary";

    // استخدام switch case لتغطية جميع أنواع الإشعارات
    switch (type) {
        // --- رسائل المحادثات ---
        case 'NEW_CHAT_MESSAGE':
        case 'NEW_ADMIN_SUBCHAT_MESSAGE':
            return <FaCommentDots size={20} className={`text-${iconColor}`} />;

        // --- المنتجات والمزايدات ---
        case 'PRODUCT_APPROVED':
        case 'BID_ACCEPTED_BUYER':
        case 'BID_ACCEPTED_SELLER':
            return <FaCheckCircle size={20} className="text-success" />;
        case 'PRODUCT_REJECTED':
        case 'PRODUCT_DELETED':
        case 'BID_REJECTED':
        case 'BID_REJECTED_BY_YOU':
        case 'BID_CANCELLED_BY_UPDATE':
            return <FaTimesCircle size={20} className="text-danger" />;
        case 'NEW_PRODUCT_PENDING':
        case 'PRODUCT_UPDATE_PENDING':
            return <FaHourglassHalf size={20} className="text-warning" />;
        case 'NEW_BID':
        case 'BID_UPDATED':
            return <FaBullhorn size={20} className={`text-${iconColor}`} />;

        // --- الوساطة والوسطاء ---
        case 'MEDIATOR_SELECTED_BY_SELLER':
        case 'MEDIATION_ASSIGNED':
            return <FaUserShield size={20} className={`text-${iconColor}`} />;
        case 'MEDIATOR_APP_APPROVED':
        case 'MEDIATION_TASK_ACCEPTED_SELF':
        case 'MEDIATION_ACCEPTED_BY_MEDIATOR':
        case 'PARTY_CONFIRMED_READINESS':
        case 'PRODUCT_RECEIPT_CONFIRMED':
            return <FaCheckCircle size={20} className="text-success" />;
        case 'MEDIATOR_APP_REJECTED':
        case 'MEDIATION_TASK_REJECTED_SELF':
        case 'MEDIATION_REJECTED_BY_BUYER':
        case 'MEDIATION_REJECTED_BY_MEDIATOR_SELECT_NEW':
        case 'MEDIATION_CANCELLED':
        case 'MEDIATION_CANCELLATION_CONFIRMED':
            return <FaTimesCircle size={20} className="text-danger" />;
        case 'MEDIATION_STARTED':
            return <FaGavel size={20} className="text-info" />;
        case 'MEDIATION_COMPLETED':
        case 'MEDIATION_FEE_RECEIVED':
            return <FaMedal size={20} className="text-warning" />; // استخدام أيقونة الميدالية للإنجاز
        case 'MEDIATION_DISPUTED':
        case 'DISPUTE_RESOLVED_ADMIN':
            return <FiAlertTriangle size={20} className="text-danger" />;
        case 'NEW_MEDIATOR_APPLICATION':
        case 'MEDIATOR_APP_PENDING':
            return <FaUsersCog size={20} className={`text-${iconColor}`} />;
        case 'PARTIES_CONFIRMED_AWAITING_CHAT':
        case 'SELLER_CONFIRMED_AWAITING_YOUR_ACTION':
        case 'BUYER_CONFIRMED_AWAITING_YOUR_ACTION':
            return <FaHandshake size={20} className={`text-${iconColor}`} />;

        // --- الأمور المالية (إيداع، سحب، أرصدة) ---
        case 'FUNDS_RECEIVED':
        case 'DEPOSIT_APPROVED':
        case 'WITHDRAWAL_COMPLETED':
        case 'ADMIN_BALANCE_ADJUSTMENT':
        case 'FUNDS_NOW_AVAILABLE': // النوع الجديد الذي أضفناه
        case 'LEVEL_UP_REWARD':
            return <FaDollarSign size={20} className="text-success" />;
        case 'FUNDS_SENT':
        case 'USER_BALANCE_ADJUSTED':
        case 'SALE_FUNDS_PENDING':
            return <FaMoneyBillWave size={20} className={`text-${iconColor}`} />;
        case 'NEW_DEPOSIT_REQUEST':
        case 'DEPOSIT_PENDING':
            return <FiTrendingUp size={20} className="text-info" />;
        case 'DEPOSIT_REJECTED':
            return <FiTrendingUp size={20} className="text-danger" />; // نفس الأيقونة ولكن بلون مختلف
        case 'NEW_WITHDRAWAL_REQUEST':
        case 'WITHDRAWAL_PROCESSING':
        case 'WITHDRAWAL_APPROVED': // الموافقة لا تزال خطوة في العملية
            return <FiTrendingDown size={20} className="text-info" />;
        case 'WITHDRAWAL_REJECTED':
            return <FiTrendingDown size={20} className="text-danger" />;

        // --- التذاكر والتقارير ---
        case 'NEW_TICKET_CREATED':
        case 'TICKET_REPLY':
        case 'TICKET_REPLY_UNASSIGNED':
        case 'TICKET_STATUS_UPDATED':
        case 'TICKET_ASSIGNED_TO_YOU':
            return <FaCommentDots size={20} className="text-info" />;
        case 'TICKET_CLOSED_BY_USER':
            return <FaCheckCircle size={20} className="text-secondary" />; // لون محايد للإغلاق
        case 'NEW_USER_REPORT':
        case 'REPORT_STATUS_UPDATE':
            return <FiAlertTriangle size={20} className="text-warning" />;

        // --- الحساب والإشعارات العامة ---
        case 'WELCOME':
            return <FaHandshake size={20} className="text-primary" />;
        case 'RATING_RECEIVED':
            return <FaMedal size={20} className="text-warning" />;
        case 'ACCOUNT_BLOCKED':
            return <FaTimesCircle size={20} className="text-danger" />;
        case 'ACCOUNT_UNBLOCKED':
            return <FaCheckCircle size={20} className="text-success" />;

        case 'ACHIEVEMENT_UNLOCKED':
            // يمكنك استخدام FaMedal أو FaTrophy
            return <FaMedal size={20} className="text-warning" />;

        case 'NEW_PRODUCT_FROM_FOLLOWED':
            return <FaShoppingBag size={20} className="text-primary" />;

        // --- أيقونة افتراضية ---
        default:
            return !isRead ? (
                <FaRegEnvelope size={20} className={`text-${iconColor}`} />
            ) : (
                <FaRegEnvelopeOpen size={20} className={`text-${iconColor}`} />
            );
    }
};