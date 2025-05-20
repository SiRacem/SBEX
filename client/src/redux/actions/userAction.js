import axios from "axios";
import {
    REGISTER_REQUEST, REGISTER_SUCCESS, REGISTER_FAIL, CLEAR_REGISTRATION_STATUS,
    LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAIL, CLEAR_LOGIN_SUCCESS_MESSAGE,
    GET_PROFILE_REQUEST, GET_PROFILE_SUCCESS, GET_PROFILE_FAIL,
    LOGOUT, CLEAR_USER_ERRORS,
    APPLY_MEDIATOR_REQUEST, APPLY_MEDIATOR_SUCCESS, APPLY_MEDIATOR_FAIL, APPLY_MEDIATOR_RESET,
    ADMIN_GET_MEDIATOR_APPS_REQUEST, ADMIN_GET_MEDIATOR_APPS_SUCCESS, ADMIN_GET_MEDIATOR_APPS_FAIL,
    ADMIN_PROCESS_MEDIATOR_APP_REQUEST, ADMIN_PROCESS_MEDIATOR_APP_SUCCESS, ADMIN_PROCESS_MEDIATOR_APP_FAIL,
    ADMIN_PROCESS_MEDIATOR_APP_RESET,
    // الأنواع الخاصة بجلب الوسطاء المتاحين (التي أضفناها سابقًا يجب أن تكون هنا أيضًا)
    ADMIN_GET_MEDIATORS_REQUEST, ADMIN_GET_MEDIATORS_SUCCESS, ADMIN_GET_MEDIATORS_FAIL,
    UPDATE_AVATAR_REQUEST, // --- NEW ---
    UPDATE_AVATAR_SUCCESS, // --- NEW ---
    UPDATE_AVATAR_FAIL,    // --- NEW ---
    UPDATE_AVATAR_RESET, // --- NEW (Optional) ---
    SET_ONLINE_USERS, // --- NEW ---
    SET_USER_BALANCES // --- NEW ---
} from "../actionTypes/userActionType";
import { toast } from 'react-toastify';

const getTokenConfig = (isFormData = false) => { // --- MODIFIED ---: Added isFormData
    const token = localStorage.getItem("token");
    if (!token || token === 'null' || token === 'undefined') return null;

    const headers = { 'Authorization': `Bearer ${token}` };
    if (!isFormData) { // --- MODIFIED ---: Set Content-Type only if not FormData
        headers['Content-Type'] = 'application/json';
    }
    // For FormData, axios will set the correct Content-Type (multipart/form-data) with boundary
    return { headers };
};

export const registerUser = (newUser) => async (dispatch) => {
    dispatch({ type: REGISTER_REQUEST });
    try {
        await axios.post("/user/register", newUser);
        dispatch({ type: REGISTER_SUCCESS, payload: { msg: "Registration successful! Please login." } });
    } catch (error) {
        const message = error.response?.data?.errors?.[0]?.msg || error.response?.data?.msg || error.message || 'Registration failed';
        dispatch({ type: REGISTER_FAIL, payload: message });
    }
};

export const clearRegistrationStatus = () => ({ type: CLEAR_REGISTRATION_STATUS });
export const clearUserErrors = () => ({ type: CLEAR_USER_ERRORS });
export const clearLoginSuccessMessage = () => ({ type: CLEAR_LOGIN_SUCCESS_MESSAGE }); // <-- مضاف

export const loginUser = (loggedUser) => async (dispatch) => {
    dispatch({ type: LOGIN_REQUEST });
    dispatch(clearUserErrors());
    try {
        const { data } = await axios.post("/user/login", loggedUser);
        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.user._id);

        // إرسال بيانات المستخدم والتوكن إلى Reducer
        dispatch({
            type: LOGIN_SUCCESS,
            payload: data
        });

        // --- [!] تعديل منطق الـ Toast ---
        if (data.user.blocked) {
            // عرض رسالة خطأ/تحذير للحساب المحظور
            toast.error("Your account is currently blocked.", {
                theme: "colored",
                autoClose: 5000, // مدة أطول قليلاً
                toastId: "blocked-account-msg",
            });
        } else {
            // عرض رسالة الترحيب العادية
            const welcomeMessage = `Welcome back, ${data.user.fullName || 'User'}!`;
            toast.success(welcomeMessage, {
                theme: "colored",
                autoClose: 2500,
                toastId: "welcome-msg",
            });
        }
        // --- نهاية تعديل الـ Toast ---

    } catch (error) {
        // التعامل مع أخطاء API (مثل كلمة مرور خاطئة)
        const message = error.response?.data?.msg || error.message || 'Login failed. Please check credentials.';
        dispatch({ type: LOGIN_FAIL, payload: message });
        toast.error(message, { theme: "colored", autoClose: 4000, toastId: "login-error" });
    }
};

export const getProfile = () => async (dispatch) => {
    dispatch({ type: GET_PROFILE_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: GET_PROFILE_FAIL, payload: "Token not found." });
        // لا تقم بتسجيل الخروج تلقائيًا هنا، دع App.js يعالج إعادة التوجيه
        return;
    }
    try {
        const { data } = await axios.get("/user/auth", config);
        dispatch({ type: GET_PROFILE_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch profile';
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.error("Auth Error:", message);
            // عند فشل المصادقة، يجب تسجيل الخروج
            dispatch(logoutUser()); // <-- استدعاء logoutUser action
            // إرسال رسالة خطأ أوضح
            dispatch({ type: GET_PROFILE_FAIL, payload: "Session expired or invalid. Please login again." });
        } else {
            console.error("Get Profile Error:", message, error.response?.data);
            dispatch({ type: GET_PROFILE_FAIL, payload: message });
        }
    }
};

export const logoutUser = () => (dispatch) => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    dispatch({ type: LOGOUT });
    // يمكنك إضافة dispatch لمسح حالات أخرى هنا
    // dispatch({ type: 'CLEAR_NOTIFICATIONS' });
    // dispatch({ type: 'CLEAR_PRODUCTS' });
};

// --- [!] جلب الوسطاء المتاحين للأدمن (تأكد من وجود هذه) [!] ---
export const adminGetAvailableMediators = () => async (dispatch) => {
    dispatch({ type: ADMIN_GET_MEDIATORS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_GET_MEDIATORS_FAIL, payload: 'Auth Error' });
    try {
        const { data } = await axios.get('/user/admin/mediators', config);
        dispatch({ type: ADMIN_GET_MEDIATORS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch mediators.';
        dispatch({ type: ADMIN_GET_MEDIATORS_FAIL, payload: message });
        toast.error(`Error fetching mediators: ${message}`);
    }
};

// --- [!!!] Action: تقديم طلب الانضمام كوسيط [!!!] ---
export const applyForMediator = (applicationType) => async (dispatch) => {
    dispatch({ type: APPLY_MEDIATOR_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: APPLY_MEDIATOR_FAIL, payload: 'Authorization Error' });

    try {
        const { data } = await axios.post('/user/apply-mediator', { applicationType }, config);
        dispatch({
            type: APPLY_MEDIATOR_SUCCESS,
            payload: { msg: data.msg, newStatus: 'Pending' } // نرسل الحالة الجديدة
        });
        toast.success(data.msg || "Application submitted successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to submit application.';
        dispatch({ type: APPLY_MEDIATOR_FAIL, payload: message });
        toast.error(`Application failed: ${message}`);
    }
};

export const resetApplyMediatorStatus = () => ({ type: APPLY_MEDIATOR_RESET });

// --- [!!!] Action: جلب طلبات الانضمام المعلقة (للأدمن) [!!!] ---
export const adminGetPendingMediatorApplications = (params = {}) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_MEDIATOR_APPS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_GET_MEDIATOR_APPS_FAIL, payload: 'Auth Error' });

    try {
        const { data } = await axios.get('/user/admin/mediator-applications', { ...config, params });
        dispatch({ type: ADMIN_GET_MEDIATOR_APPS_SUCCESS, payload: data }); // payload is { applications, totalPages, ... }
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch applications.';
        dispatch({ type: ADMIN_GET_MEDIATOR_APPS_FAIL, payload: message });
        toast.error(`Error fetching applications: ${message}`);
    }
};

// --- [!!!] Action: معالجة طلب الانضمام (موافقة/رفض للأدمن) [!!!] ---
export const adminProcessMediatorApplication = (userId, action, reason = null) => async (dispatch) => {
    dispatch({ type: ADMIN_PROCESS_MEDIATOR_APP_REQUEST, payload: { userId, action } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_PROCESS_MEDIATOR_APP_FAIL, payload: { userId, action, error: 'Auth Error' } });

    const url = `/user/admin/mediator-application/${userId}/${action}`; // 'approve' or 'reject'
    const body = action === 'reject' ? { reason } : {};

    try {
        const { data } = await axios.put(url, body, config);
        dispatch({
            type: ADMIN_PROCESS_MEDIATOR_APP_SUCCESS,
            payload: { userId, action, updatedUser: data.user } // إرسال المستخدم المحدث
        });
        toast.success(`Application ${action}ed successfully!`);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || `Failed to ${action} application.`;
        dispatch({ type: ADMIN_PROCESS_MEDIATOR_APP_FAIL, payload: { userId, action, error: message } });
        toast.error(`Failed to ${action} application: ${message}`);
    }
};

export const adminResetProcessMediatorAppStatus = () => ({ type: ADMIN_PROCESS_MEDIATOR_APP_RESET });

export const updateMediatorStatus = (newStatus) => async (dispatch) => {
    dispatch({ type: 'UPDATE_MEDIATOR_STATUS_REQUEST' }); // <-- تأكد من تعريف النوع
    const config = getTokenConfig();
    if (!config) return dispatch({ type: 'UPDATE_MEDIATOR_STATUS_FAIL', payload: 'Auth Error' });

    try {
        // --- [!!!] تأكد من وجود هذا المسار والـ Controller في الـ Backend [!!!] ---
        const { data } = await axios.put('/user/mediator/status', { status: newStatus }, config);
        // --------------------------------------------------------------------
        dispatch({ type: 'UPDATE_MEDIATOR_STATUS_SUCCESS', payload: { newStatus: data.newStatus } }); // <-- الـ Backend يعيد الحالة الجديدة
        toast.success(`Your status is now set to ${data.newStatus}.`);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to update status.';
        dispatch({ type: 'UPDATE_MEDIATOR_STATUS_FAIL', payload: message });
        toast.error(`Status update failed: ${message}`);
    }
};

// --- NEW ACTION: Update Profile Picture ---
export const updateProfilePicture = (formData) => async (dispatch) => {
    dispatch({ type: UPDATE_AVATAR_REQUEST });
    const config = getTokenConfig(true); // --- MODIFIED ---: Pass true for FormData

    if (!config) {
        const errorMsg = "Authorization Error: Please login.";
        dispatch({ type: UPDATE_AVATAR_FAIL, payload: errorMsg });
        toast.error(errorMsg);
        return Promise.reject({ error: errorMsg }); // Return a rejected promise
    }

    try {
        // The backend route will be something like '/user/profile/avatar'
        // Ensure this route exists and is configured to handle file uploads (e.g., using Multer)
        const { data } = await axios.put("/user/profile/avatar", formData, config);
        // The backend should return the updated user object or at least the new avatarUrl

        dispatch({
            type: UPDATE_AVATAR_SUCCESS,
            payload: data.user // Assuming backend returns { user: { ..., avatarUrl: 'new_url' } } or data.avatarUrl
        });
        toast.success(data.msg || "Profile picture updated successfully!");
        dispatch(getProfile()); // --- ADDED ---: Re-fetch profile to ensure all user data is fresh
        return Promise.resolve(data); // Return a resolved promise
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to update profile picture.';
        dispatch({ type: UPDATE_AVATAR_FAIL, payload: message });
        toast.error(`Update failed: ${message}`);
        return Promise.reject({ error: message }); // Return a rejected promise
    }
};

export const resetUpdateAvatarStatus = () => ({ type: UPDATE_AVATAR_RESET });

export const setOnlineUsers = (onlineUserIds) => ({
    type: SET_ONLINE_USERS,
    payload: onlineUserIds,
});

export const updateUserBalances = (balances) => ({
    type: SET_USER_BALANCES,
    payload: balances
});