import axios from 'axios';
import {
    GET_NOTIFICATIONS_REQUEST, GET_NOTIFICATIONS_SUCCESS, GET_NOTIFICATIONS_FAIL,
    MARK_READ_REQUEST, MARK_READ_SUCCESS, MARK_READ_FAIL, CLEAR_NOTIFICATIONS, ADD_NOTIFICATION_REALTIME
} from '../actionTypes/notificationActionType';

const handleError = (error, defaultKey = 'apiErrors.unknownError') => {
    if (error.response) {
        if (error.response.data.translationKey) return { key: error.response.data.translationKey };
        if (error.response.data.msg) {
            const fallback = error.response.data.msg;
            const key = `apiErrors.${fallback.replace(/\s+/g, '_').replace(/[!'.]/g, '')}`;
            return { key, fallback };
        }
        return { key: 'apiErrors.requestFailedWithCode', params: { code: error.response.status } };
    } else if (error.request) {
        return { key: 'apiErrors.networkError' };
    }
    return { key: defaultKey, params: { message: error.message } };
};

const getTokenConfig = (isJson = true) => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const headers = { 'Authorization': `Bearer ${token}` };
    if (isJson) headers['Content-Type'] = 'application/json';
    return { headers };
};

export const getNotifications = () => async (dispatch) => {
    dispatch({ type: GET_NOTIFICATIONS_REQUEST });
    const config = getTokenConfig(false);
    if (!config) {
        const { key, fallback, params } = handleError({}, 'notifications.authFail');
        return dispatch({ type: GET_NOTIFICATIONS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
    try {
        const { data } = await axios.get('/notifications', config);
        dispatch({ type: GET_NOTIFICATIONS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'notifications.loadFail');
        dispatch({ type: GET_NOTIFICATIONS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const markNotificationsRead = (notificationIds) => async (dispatch) => {
    dispatch({ type: MARK_READ_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        const { key, fallback, params } = handleError({}, 'notifications.authFail');
        return dispatch({ type: MARK_READ_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        const errorMessage = { key: 'notifications.noIds' };
        return dispatch({ type: MARK_READ_FAIL, payload: { errorMessage } });
    }
    try {
        await axios.put('/notifications/read', { notificationIds }, config);
        dispatch({ type: MARK_READ_SUCCESS, payload: notificationIds });
        dispatch(getNotifications());
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'notifications.markReadFail');
        dispatch({ type: MARK_READ_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const clearNotifications = () => ({ type: CLEAR_NOTIFICATIONS });

export const addNotificationFromSocket = (notification) => (dispatch) => {
    // يمكنك إضافة أي منطق هنا إذا احتجت في المستقبل
    dispatch({
        type: ADD_NOTIFICATION_REALTIME,
        payload: notification
    });
};