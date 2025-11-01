// src/redux/actions/userAction.js
import axios from "axios";
import {
    REGISTER_REQUEST, REGISTER_SUCCESS, REGISTER_FAIL, CLEAR_REGISTRATION_STATUS,
    LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAIL,
    GET_PROFILE_REQUEST, GET_PROFILE_SUCCESS, GET_PROFILE_FAIL,
    LOGOUT, CLEAR_USER_ERRORS,
    APPLY_MEDIATOR_REQUEST, APPLY_MEDIATOR_SUCCESS, APPLY_MEDIATOR_FAIL, APPLY_MEDIATOR_RESET,
    ADMIN_GET_MEDIATOR_APPS_REQUEST, ADMIN_GET_MEDIATOR_APPS_SUCCESS, ADMIN_GET_MEDIATOR_APPS_FAIL,
    ADMIN_PROCESS_MEDIATOR_APP_REQUEST, ADMIN_PROCESS_MEDIATOR_APP_SUCCESS, ADMIN_PROCESS_MEDIATOR_APP_FAIL,
    ADMIN_PROCESS_MEDIATOR_APP_RESET,
    ADMIN_GET_MEDIATORS_REQUEST, ADMIN_GET_MEDIATORS_SUCCESS, ADMIN_GET_MEDIATORS_FAIL,
    UPDATE_AVATAR_REQUEST,
    UPDATE_AVATAR_SUCCESS,
    UPDATE_AVATAR_FAIL,
    UPDATE_AVATAR_RESET,
    SET_ONLINE_USERS,
    UPDATE_USER_BALANCES_SOCKET,
} from "../actionTypes/userActionType";
import { clearNotifications } from './notificationAction';
import { clearTransactions as clearWalletTransactions } from './transactionAction';
import { toast } from 'react-toastify';
import i18n from '../../i18n';

const handleError = (error, defaultKey = 'apiErrors.unknownError') => {
    // 1. تحقق من بنية الخطأ الجديدة أولاً (الأكثر تفصيلاً)
    if (error.response?.data?.errorMessage?.key) {
        return error.response.data.errorMessage;
    }
    // 2. تحقق من البنية القديمة (للتوافق مع الأجزاء الأخرى من الكود)
    if (error.response?.data?.translationKey) {
        return {
            key: error.response.data.translationKey,
            params: error.response.data.translationParams || {}
        };
    }
    // 3. التعامل مع رسائل الخطأ النصية العادية
    if (error.response?.data?.msg) {
        const fallback = error.response.data.msg;
        const key = `apiErrors.${fallback.replace(/\s+/g, '_').replace(/[!'.]/g, '')}`;
        return { key, fallback };
    }
    // 4. الحالات العامة
    if (error.response) {
        return { key: 'apiErrors.requestFailedWithCode', params: { code: error.response.status }, fallback: `Request failed with status code ${error.response.status}` };
    } else if (error.request) {
        return { key: 'apiErrors.networkError', fallback: 'Network Error. Please check your connection.' };
    }
    // 5. الخطأ الافتراضي
    return { key: defaultKey, params: { message: error.message }, fallback: 'An unknown error occurred.' };
};

const getTokenConfig = (isFormData = false) => {
    const token = localStorage.getItem("token");
    if (!token || token === 'null' || token === 'undefined') {
        return null;
    }
    const headers = { 'Authorization': `Bearer ${token}` };
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    return { headers };
};

export const registerUser = (newUser) => async (dispatch) => {
    dispatch({ type: REGISTER_REQUEST });
    try {
        await axios.post("/user/register", newUser);
        dispatch({ type: REGISTER_SUCCESS, payload: { successMessage: 'auth.toast.registerSuccess' } });
    } catch (error) {
        const errorMessage = handleError(error, 'auth.toast.registerFail');
        dispatch({ type: REGISTER_FAIL, payload: { errorMessage } });
    }
};

export const clearRegistrationStatus = () => ({ type: CLEAR_REGISTRATION_STATUS });
export const clearUserErrors = () => ({ type: CLEAR_USER_ERRORS });

export const loginUser = (loggedUser) => async (dispatch) => {
    dispatch(clearUserErrors());
    dispatch({ type: 'LOGIN_REQUEST' });

    try {
        const { data } = await axios.post("/user/login", loggedUser);
        if (!data.token || !data.user) throw new Error("Login response missing token or user data.");

        /* if (data.user.blocked) {
            const errorMessage = { key: "auth.toast.accountBlocked", fallback: 'Your account is blocked.' };
            dispatch({ type: 'LOGIN_FAIL', payload: { errorMessage } });loginUser 
            return; // توقف هنا
        } */

        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.user._id);

        const payload = {
            ...data,
            successMessage: "auth.toast.welcomeBack",
            successMessageParams: { name: data.user.fullName || 'User' }
        };
        dispatch({ type: 'LOGIN_SUCCESS', payload });

    } catch (error) {
        const errorMessage = handleError(error);
        // [!!!] فقط قم بإرسال الخطأ إلى Redux. لا تعرض أي toast من هنا. [!!!]
        dispatch({ type: 'LOGIN_FAIL', payload: { errorMessage } });
    }
};

export const getProfile = () => async (dispatch, getState) => {
    if (getState().userReducer.loading) {
        return;
    }
    dispatch({ type: GET_PROFILE_REQUEST });
    const config = getTokenConfig();

    if (!config) {
        dispatch({ type: LOGOUT });
        return;
    }

    try {
        const response = await axios.get("/user/auth", config);
        if (response?.data?.user) {
            dispatch({ type: GET_PROFILE_SUCCESS, payload: response.data });
        } else {
            throw new Error("Profile data is missing in the response.");
        }
    } catch (error) {
        const errorMessage = handleError(error, 'apiErrors.getProfileFail');
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            dispatch({ type: GET_PROFILE_FAIL, payload: { errorMessage: { key: 'apiErrors.sessionExpired' } } });
            dispatch(logoutUser());
        } else {
            dispatch({ type: GET_PROFILE_FAIL, payload: { errorMessage } });
        }
    }
};

export const logoutUser = () => (dispatch) => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    dispatch({ type: LOGOUT, payload: { successMessage: 'auth.toast.loggedOut' } });
    dispatch(clearNotifications());
    dispatch(clearWalletTransactions());
};

// ... (rest of the file remains the same) ...
export const adminGetAvailableMediators = () => async (dispatch) => {
    dispatch({ type: ADMIN_GET_MEDIATORS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADMIN_GET_MEDIATORS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
        return;
    }
    try {
        const { data } = await axios.get('/user/admin/mediators', config);
        dispatch({ type: ADMIN_GET_MEDIATORS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediatorApplication.loadMediatorsFail');
        dispatch({ type: ADMIN_GET_MEDIATORS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const applyForMediator = (applicationType) => async (dispatch) => {
    dispatch({ type: APPLY_MEDIATOR_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: APPLY_MEDIATOR_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
        return;
    }
    try {
        const { data } = await axios.post('/user/apply-mediator', { applicationType }, config);
        dispatch({
            type: APPLY_MEDIATOR_SUCCESS,
            payload: {
                msg: data.msg,
                newStatus: data.newStatus || 'Pending',
                successMessage: 'mediatorApplication.application.applySuccess'
            }
        });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediatorApplication.application.applyError');
        dispatch({ type: APPLY_MEDIATOR_FAIL, payload: { errorMessage: { key, fallback, params: { error: fallback } } } });
    }
};

export const resetApplyMediatorStatus = () => ({ type: APPLY_MEDIATOR_RESET });

export const adminGetPendingMediatorApplications = (params = {}) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_MEDIATOR_APPS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADMIN_GET_MEDIATOR_APPS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
        return;
    }
    try {
        const { data } = await axios.get('/user/admin/mediator-applications', { ...config, params });
        dispatch({ type: ADMIN_GET_MEDIATOR_APPS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.mediatorApps.loadFail');
        dispatch({ type: ADMIN_GET_MEDIATOR_APPS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminProcessMediatorApplication = (userId, action, reason = null) => async (dispatch) => {
    dispatch({ type: ADMIN_PROCESS_MEDIATOR_APP_REQUEST, payload: { userId, action } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADMIN_PROCESS_MEDIATOR_APP_FAIL, payload: { userId, action, errorMessage: { key: 'apiErrors.notAuthorized' } } });
        return;
    }
    const url = `/user/admin/mediator-application/${userId}/${action}`;
    const body = action === 'reject' && reason ? { reason } : {};
    try {
        const { data } = await axios.put(url, body, config);
        dispatch({
            type: ADMIN_PROCESS_MEDIATOR_APP_SUCCESS,
            payload: { userId, action, updatedUser: data.user, msg: data.msg, successMessage: `admin.mediatorApps.${action}Success` }
        });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.mediatorApps.processFail');
        dispatch({ type: ADMIN_PROCESS_MEDIATOR_APP_FAIL, payload: { userId, action, errorMessage: { key, fallback, params } } });
    }
};

export const adminResetProcessMediatorAppStatus = () => ({ type: ADMIN_PROCESS_MEDIATOR_APP_RESET });

export const updateMediatorStatus = (newStatus) => async (dispatch) => {
    dispatch({ type: 'UPDATE_MEDIATOR_STATUS_REQUEST' });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: 'UPDATE_MEDIATOR_STATUS_FAIL', payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
        return;
    }
    try {
        const { data } = await axios.put('/user/mediator/status', { status: newStatus }, config);
        dispatch({ type: 'UPDATE_MEDIATOR_STATUS_SUCCESS', payload: { newStatus: data.newStatus, successMessage: 'mediatorApplication.qualified.statusUpdateSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediatorApplication.qualified.statusUpdateFail');
        dispatch({ type: 'UPDATE_MEDIATOR_STATUS_FAIL', payload: { errorMessage: { key, fallback, params } } });
    }
};

export const updateProfilePicture = (formData) => async (dispatch) => {
    dispatch({ type: UPDATE_AVATAR_REQUEST });
    const config = getTokenConfig(true);
    if (!config) {
        const errorMessage = { key: "apiErrors.notAuthorized" };
        dispatch({ type: UPDATE_AVATAR_FAIL, payload: { errorMessage } });
        return Promise.reject({ error: errorMessage });
    }
    try {
        const { data } = await axios.put("/user/profile/avatar", formData, config);
        dispatch({ type: UPDATE_AVATAR_SUCCESS, payload: { ...data, successMessage: 'profilePage.avatar.updateSuccess' } });
        return Promise.resolve(data);
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'profilePage.avatarUpdateFail');
        dispatch({ type: UPDATE_AVATAR_FAIL, payload: { errorMessage: { key, fallback, params } } });
        return Promise.reject({ error: { key, fallback, params } });
    }
};

export const resetUpdateAvatarStatus = () => ({ type: UPDATE_AVATAR_RESET });
export const setOnlineUsers = (onlineUserIds) => ({ type: SET_ONLINE_USERS, payload: onlineUserIds });
export const updateUserBalances = (balanceData) => (dispatch) => { dispatch({ type: UPDATE_USER_BALANCES_SOCKET, payload: balanceData }); };