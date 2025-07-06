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
import { toast } from 'react-toastify';
import { clearNotifications } from './notificationAction';
import { clearTransactions as clearWalletTransactions } from './transactionAction';

const getTokenConfig = (isFormData = false) => {
    const token = localStorage.getItem("token");
    if (!token || token === 'null' || token === 'undefined') {
        console.warn("getTokenConfig: No token found in localStorage.");
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
        const { data } = await axios.post("/user/register", newUser);
        dispatch({ type: REGISTER_SUCCESS });

    } catch (error) {
        // --- [!!!] التعديل هنا [!!!] ---
        // بدلاً من نص إنجليزي، نمرر مفتاحًا يمكن ترجمته
        const message = error.response?.data?.msg || 'unknownRegistrationError';
        dispatch({ type: REGISTER_FAIL, payload: message });
    }
};

export const clearRegistrationStatus = () => ({ type: CLEAR_REGISTRATION_STATUS });
export const clearUserErrors = () => ({ type: CLEAR_USER_ERRORS });

export const loginUser = (loggedUser) => async (dispatch) => {
    dispatch({ type: LOGIN_REQUEST });
    dispatch(clearUserErrors());
    try {
        const { data } = await axios.post("/user/login", loggedUser);
        if (!data.token || !data.user) throw new Error("Login response missing token or user data.");

        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.user._id);

        if (data.user.blocked) {
            data.errorMessage = "auth.toast.accountBlocked";
        } else {
            data.successMessage = "auth.toast.welcomeBack";
            data.successMessageParams = { name: data.user.fullName || 'User' };
        }
        dispatch({ type: LOGIN_SUCCESS, payload: data });

    } catch (error) {
        const message = error.response?.data?.msg || 'Login failed. Please check credentials.';
        dispatch({ type: LOGIN_FAIL, payload: message });
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
    }
};

export const getProfile = () => async (dispatch, getState) => {
    if (getState().userReducer.loading) {
        console.log("getProfile: Another profile fetch is already in progress. Skipping.");
        return;
    }
    dispatch({ type: GET_PROFILE_REQUEST });
    const config = getTokenConfig();

    if (!config) {
        console.warn("getProfile: No token config. Dispatching GET_PROFILE_FAIL and LOGOUT.");
        dispatch({ type: GET_PROFILE_FAIL, payload: "Not authorized. Token not found." });
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        dispatch({ type: LOGOUT }); // Ensure full state cleanup
        return;
    }

    try {
        const response = await axios.get("/user/auth", config);
        // --- Log التفصيلي للاستجابة ---
        console.log("getProfile raw response from /user/auth:", JSON.stringify(response, null, 2));
        // ---------------------------------

        if (response && response.data && response.data.user) {
            dispatch({ type: GET_PROFILE_SUCCESS, payload: response.data });
        } else {
            const errorMessage = "Profile data malformed or user object missing in response from /user/auth. Raw response logged.";
            console.error("getProfile Error (Malformed Response):", errorMessage, "Status:", response?.status);
            // لا تقم بإلقاء خطأ هنا، بل أرسل فشلًا مع رسالة واضحة
            dispatch({ type: GET_PROFILE_FAIL, payload: errorMessage });
            // لا تقم بتسجيل الخروج تلقائيًا هنا إذا لم يكن خطأ 401/403
            // دع reducer يقرر بناءً على نوع الخطأ (كما تم تعديله سابقًا)
        }
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch profile';
        console.error("Get Profile Catch Error:", message, "Status:", error.response?.status, "Response Data:", error.response?.data);

        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            dispatch({ type: GET_PROFILE_FAIL, payload: "Session expired or invalid. Please login again." });
            dispatch(logoutUser()); // تسجيل الخروج مبرر هنا
        } else {
            // لأخطاء أخرى (مثل خطأ الشبكة، خطأ 500، أو الخطأ من الشرط أعلاه)
            dispatch({ type: GET_PROFILE_FAIL, payload: message });
            // لا تقم بتسجيل الخروج تلقائيًا هنا
        }
    }
};

export const logoutUser = () => (dispatch) => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    dispatch({ type: LOGOUT });
    dispatch(clearNotifications());
    dispatch(clearWalletTransactions());
};

export const adminGetAvailableMediators = () => async (dispatch) => {
    dispatch({ type: ADMIN_GET_MEDIATORS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADMIN_GET_MEDIATORS_FAIL, payload: 'Auth Error: Token not found' });
        return;
    }
    try {
        const { data } = await axios.get('/user/admin/mediators', config);
        dispatch({ type: ADMIN_GET_MEDIATORS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch mediators.';
        dispatch({ type: ADMIN_GET_MEDIATORS_FAIL, payload: message });
        toast.error(`Error fetching mediators: ${message}`);
    }
};

export const applyForMediator = (applicationType) => async (dispatch) => {
    dispatch({ type: APPLY_MEDIATOR_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: APPLY_MEDIATOR_FAIL, payload: 'Authorization Error' });
        toast.error('Authorization Error: Please login.');
        return;
    }
    try {
        const { data } = await axios.post('/user/apply-mediator', { applicationType }, config);
        dispatch({
            type: APPLY_MEDIATOR_SUCCESS,
            payload: { msg: data.msg, newStatus: data.newStatus || 'Pending' }
        });
        toast.success(data.msg || "Application submitted successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to submit application.';
        dispatch({ type: APPLY_MEDIATOR_FAIL, payload: message });
        toast.error(`Application failed: ${message}`);
    }
};

export const resetApplyMediatorStatus = () => ({ type: APPLY_MEDIATOR_RESET });

export const adminGetPendingMediatorApplications = (params = {}) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_MEDIATOR_APPS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADMIN_GET_MEDIATOR_APPS_FAIL, payload: 'Auth Error: Token not found' });
        toast.error('Auth Error: Cannot fetch applications.');
        return;
    }
    try {
        const { data } = await axios.get('/user/admin/mediator-applications', { ...config, params });
        dispatch({ type: ADMIN_GET_MEDIATOR_APPS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch applications.';
        dispatch({ type: ADMIN_GET_MEDIATOR_APPS_FAIL, payload: message });
        toast.error(`Error fetching applications: ${message}`);
    }
};

export const adminProcessMediatorApplication = (userId, action, reason = null) => async (dispatch) => {
    dispatch({ type: ADMIN_PROCESS_MEDIATOR_APP_REQUEST, payload: { userId, action } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADMIN_PROCESS_MEDIATOR_APP_FAIL, payload: { userId, action, error: 'Auth Error: Token not found' } });
        toast.error('Auth Error: Cannot process application.');
        return;
    }
    const url = `/user/admin/mediator-application/${userId}/${action}`;
    const body = action === 'reject' && reason ? { reason } : {};
    try {
        const { data } = await axios.put(url, body, config);
        dispatch({
            type: ADMIN_PROCESS_MEDIATOR_APP_SUCCESS,
            payload: { userId, action, updatedUser: data.user, msg: data.msg }
        });
        toast.success(data.msg || `Application ${action}ed successfully!`);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || `Failed to ${action} application.`;
        dispatch({ type: ADMIN_PROCESS_MEDIATOR_APP_FAIL, payload: { userId, action, error: message } });
        toast.error(`Failed to ${action} application: ${message}`);
    }
};

export const adminResetProcessMediatorAppStatus = () => ({ type: ADMIN_PROCESS_MEDIATOR_APP_RESET });

export const updateMediatorStatus = (newStatus) => async (dispatch) => {
    dispatch({ type: 'UPDATE_MEDIATOR_STATUS_REQUEST' });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: 'UPDATE_MEDIATOR_STATUS_FAIL', payload: 'Auth Error: Token not found' });
        toast.error('Auth Error: Cannot update status.');
        return;
    }
    try {
        const { data } = await axios.put('/user/mediator/status', { status: newStatus }, config);
        dispatch({ type: 'UPDATE_MEDIATOR_STATUS_SUCCESS', payload: { newStatus: data.newStatus } });
        toast.success(`Your status is now set to ${data.newStatus}.`);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to update status.';
        dispatch({ type: 'UPDATE_MEDIATOR_STATUS_FAIL', payload: message });
        toast.error(`Status update failed: ${message}`);
    }
};

export const updateProfilePicture = (formData) => async (dispatch) => {
    dispatch({ type: UPDATE_AVATAR_REQUEST });
    const config = getTokenConfig(true);
    if (!config) {
        const errorMsg = "Authorization Error: Please login.";
        dispatch({ type: UPDATE_AVATAR_FAIL, payload: errorMsg });
        toast.error(errorMsg);
        return Promise.reject({ error: errorMsg });
    }
    try {
        const { data } = await axios.put("/user/profile/avatar", formData, config);
        dispatch({ type: UPDATE_AVATAR_SUCCESS, payload: data });
        toast.success(data.msg || "Profile picture updated successfully!");
        return Promise.resolve(data);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to update profile picture.';
        dispatch({ type: UPDATE_AVATAR_FAIL, payload: message });
        toast.error(`Update failed: ${message}`);
        return Promise.reject({ error: message });
    }
};

export const resetUpdateAvatarStatus = () => ({ type: UPDATE_AVATAR_RESET });

export const setOnlineUsers = (onlineUserIds) => ({
    type: SET_ONLINE_USERS,
    payload: onlineUserIds,
});

export const updateUserBalances = (balanceData) => (dispatch) => {
  dispatch({
    type: UPDATE_USER_BALANCES_SOCKET,
    payload: balanceData
  });
};