// src/redux/reducers/notificationReducer.js
import {
    GET_NOTIFICATIONS_REQUEST, GET_NOTIFICATIONS_SUCCESS, GET_NOTIFICATIONS_FAIL,
    MARK_READ_REQUEST, MARK_READ_SUCCESS, MARK_READ_FAIL, CLEAR_NOTIFICATIONS, ADD_NOTIFICATION_REALTIME
} from '../actionTypes/notificationActionType';

const initialState = { notifications: [], unreadCount: 0, loading: false, error: null, loadingMarkRead: false };

const notificationReducer = (state = initialState, action) => {
    const { type, payload } = action;
    switch (type) {
        case GET_NOTIFICATIONS_REQUEST: return { ...state, loading: true, error: null };
        case GET_NOTIFICATIONS_SUCCESS: return { ...state, loading: false, notifications: Array.isArray(payload?.notifications) ? payload.notifications : state.notifications, unreadCount: typeof payload?.unreadCount === 'number' ? payload.unreadCount : state.unreadCount, error: null };
        case GET_NOTIFICATIONS_FAIL: return { ...state, loading: false, error: payload };
        case MARK_READ_REQUEST: return { ...state, loadingMarkRead: true };
        case MARK_READ_SUCCESS: const readIds = payload || []; const newNotifications = state.notifications.map(notif => readIds.includes(notif._id) ? { ...notif, isRead: true } : notif); const newUnreadCount = newNotifications.filter(n => !n.isRead).length; return { ...state, loadingMarkRead: false, notifications: newNotifications, unreadCount: newUnreadCount }; // حساب unreadCount بدقة
        case MARK_READ_FAIL: return { ...state, loadingMarkRead: false, error: payload };
        case CLEAR_NOTIFICATIONS: return { ...initialState }; // <-- مضاف لإعادة التعيين عند الخروج

        case ADD_NOTIFICATION_REALTIME:
            // تحقق من أن الإشعار صالح وليس مكررًا
            if (!payload?._id || state.notifications.some(n => n._id === payload._id)) {
                return state;
            }

            // قم بإنشاء نسخة جديدة من مصفوفة الإشعارات مع الإشعار الجديد في الأعلى
            const updatedNotifications = [payload, ...state.notifications];

            return {
                ...state,
                notifications: updatedNotifications,
                unreadCount: state.unreadCount + 1,
            };

        default: return state;
    }
};
export default notificationReducer;