// src/redux/actions/withdrawalRequestAction.js

import axios from 'axios';
import { toast } from 'react-toastify';
import {
    CREATE_WITHDRAWAL_REQUEST, CREATE_WITHDRAWAL_SUCCESS,
    CREATE_WITHDRAWAL_FAIL, CREATE_WITHDRAWAL_RESET,
    ADMIN_GET_WITHDRAWALS_REQUEST, ADMIN_GET_WITHDRAWALS_SUCCESS, ADMIN_GET_WITHDRAWALS_FAIL,
    ADMIN_GET_WITHDRAWAL_DETAILS_REQUEST, ADMIN_GET_WITHDRAWAL_DETAILS_SUCCESS, ADMIN_GET_WITHDRAWAL_DETAILS_FAIL,
    ADMIN_CLEAR_WITHDRAWAL_DETAILS,
    ADMIN_COMPLETE_WITHDRAWAL_REQUEST, ADMIN_COMPLETE_WITHDRAWAL_SUCCESS, ADMIN_COMPLETE_WITHDRAWAL_FAIL,
    ADMIN_REJECT_WITHDRAWAL_REQUEST, ADMIN_REJECT_WITHDRAWAL_SUCCESS, ADMIN_REJECT_WITHDRAWAL_FAIL,
    ADMIN_CLEAR_WITHDRAWAL_ERROR,
    GET_USER_WITHDRAWALS_REQUEST, GET_USER_WITHDRAWALS_SUCCESS, GET_USER_WITHDRAWALS_FAIL // تأكد من وجود هذه الأنواع
} from '../actionTypes/withdrawalRequestActionType';
import { getProfile } from './userAction';
// يمكنك إزالة استيراد getTransactions إذا لم تعد تستخدمه هنا
// import { getTransactions } from './transactionAction';

// Helper للحصول على التوكن
const getTokenConfig = () => {
    const token = localStorage.getItem('token');
    if (!token || token === 'null' || token === 'undefined') {
        console.error("Auth token missing in getTokenConfig");
        return null;
    }
    return { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
};

// --- Actions للمستخدم ---

// 1. إنشاء طلب سحب
export const createWithdrawalRequest = (withdrawalData) => async (dispatch) => {
    dispatch({ type: CREATE_WITHDRAWAL_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: CREATE_WITHDRAWAL_FAIL, payload: 'Authorization failed.' });
        toast.error("Authorization Error. Please log in again.");
        return false;
    }

    try {
        console.log("Action: Sending withdrawal request data:", withdrawalData);
        // تأكد أن المسار صحيح (بدون /api إذا كان كذلك)
        const { data } = await axios.post('/withdrawals', withdrawalData, config);

        dispatch({ type: CREATE_WITHDRAWAL_SUCCESS, payload: data });
        toast.success(data.msg || "Withdrawal request submitted successfully!");

        // --- [مهم] إعادة جلب قائمة طلبات السحب للمستخدم ---
        console.log("Withdrawal request success, fetching updated user requests...");
        dispatch(getUserWithdrawalRequests()); // <-- استدعاء لجلب القائمة المحدثة
        // --------------------------------------------------

        // تحديث بيانات المستخدم (الرصيد المخصوم)
        dispatch(getProfile());

        return true; // للإشارة للنجاح

    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to submit withdrawal request.';
        console.error("Action Error: Creating withdrawal request:", error.response || error);
        dispatch({ type: CREATE_WITHDRAWAL_FAIL, payload: message });
        toast.error(`Error: ${message}`);
        return false; // للإشارة للفشل
    }
};

// إعادة تعيين حالة إنشاء الطلب
export const resetCreateWithdrawal = () => ({ type: CREATE_WITHDRAWAL_RESET });


// 2. جلب طلبات السحب الخاصة بالمستخدم
export const getUserWithdrawalRequests = (params = {}) => async (dispatch) => {
    dispatch({ type: GET_USER_WITHDRAWALS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: GET_USER_WITHDRAWALS_FAIL, payload: 'Authorization failed.' });
        return;
    }

    try {
        // تأكد أن المسار '/withdrawals/my-requests' صحيح وموجود في الـ Backend Router
        console.log("Action: Fetching user withdrawal requests...");
        const { data } = await axios.get('/withdrawals/my-requests', { ...config, params });
        // افترض أن الـ Backend يرجع { requests: [...] }
        console.log("Action: Received user withdrawal requests data:", data);
        dispatch({ type: GET_USER_WITHDRAWALS_SUCCESS, payload: data });

    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch your withdrawal requests.';
        console.error("Action Error: Fetching user withdrawal requests:", error.response || error);
        dispatch({ type: GET_USER_WITHDRAWALS_FAIL, payload: message });
    }
};


// --- Actions للأدمن ---

// 3. جلب قائمة طلبات السحب للأدمن (مع فلترة/ترقيم صفحات)
export const adminGetWithdrawalRequests = (params = {}) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_WITHDRAWALS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_GET_WITHDRAWALS_FAIL, payload: 'Auth Error' });
    try {
        console.log("Action: Admin fetching withdrawal requests with params:", params);
        const { data } = await axios.get('/withdrawals/admin', { ...config, params });
        console.log("Action: Admin received withdrawal requests data:", data);
        dispatch({ type: ADMIN_GET_WITHDRAWALS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch withdrawal requests.';
        console.error("Action Error: Admin fetching withdrawal requests:", error.response || error);
        dispatch({ type: ADMIN_GET_WITHDRAWALS_FAIL, payload: message });
        toast.error(`Error fetching requests: ${message}`);
    }
};

// 4. جلب تفاصيل طلب سحب محدد للأدمن
export const adminGetWithdrawalDetails = (requestId) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_WITHDRAWAL_DETAILS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_GET_WITHDRAWAL_DETAILS_FAIL, payload: 'Auth Error' });
    try {
        console.log("Action: Admin fetching withdrawal details for ID:", requestId);
        const { data } = await axios.get(`/withdrawals/admin/${requestId}`, config);
        console.log("Action: Admin received withdrawal details:", data);
        dispatch({ type: ADMIN_GET_WITHDRAWAL_DETAILS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch withdrawal details.';
        console.error("Action Error: Admin fetching withdrawal details:", error.response || error);
        dispatch({ type: ADMIN_GET_WITHDRAWAL_DETAILS_FAIL, payload: message });
        toast.error(`Error fetching details: ${message}`);
    }
};

// مسح تفاصيل الطلب الحالي
export const adminClearWithdrawalDetails = () => ({ type: ADMIN_CLEAR_WITHDRAWAL_DETAILS });


// 5. إكمال طلب سحب (الموافقة بعد الدفع اليدوي)
export const adminCompleteWithdrawal = (requestId, details = {}) => async (dispatch) => {
    dispatch({ type: ADMIN_COMPLETE_WITHDRAWAL_REQUEST, payload: { requestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_COMPLETE_WITHDRAWAL_FAIL, payload: { requestId, error: 'Auth Error' } });
    try {
        const { data } = await axios.put(`/withdrawals/admin/${requestId}/complete`, details, config);

        // --- [!!!] START: MODIFICATION [!!!] ---
        // First, dispatch success to stop the spinner for the specific item
        dispatch({ type: ADMIN_COMPLETE_WITHDRAWAL_SUCCESS, payload: { requestId, updatedRequest: data.updatedRequest } });
        toast.success(data.msg || "Withdrawal completed successfully!");

        // Then, re-fetch the list of PENDING withdrawals
        dispatch(adminGetWithdrawalRequests({ status: 'pending' }));
        // --- [!!!] END: MODIFICATION [!!!] ---

        return true;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to complete withdrawal.';
        console.error("Action Error: Admin completing withdrawal:", error.response || error);
        dispatch({ type: ADMIN_COMPLETE_WITHDRAWAL_FAIL, payload: { requestId, error: message } });
        toast.error(`Error completing withdrawal: ${message}`);
        return false;
    }
};

// 6. رفض طلب سحب
export const adminRejectWithdrawal = (requestId, rejectionReason) => async (dispatch) => {
    dispatch({ type: ADMIN_REJECT_WITHDRAWAL_REQUEST, payload: { requestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_REJECT_WITHDRAWAL_FAIL, payload: { requestId, error: 'Auth Error' } });
    try {
        // The body should be { rejectionReason }
        const { data } = await axios.put(`/withdrawals/admin/${requestId}/reject`, { rejectionReason }, config);

        // --- [!!!] START: MODIFICATION [!!!] ---
        dispatch({ type: ADMIN_REJECT_WITHDRAWAL_SUCCESS, payload: { requestId, updatedRequest: data.updatedRequest } });
        toast.success(data.msg || "Withdrawal rejected successfully!");
        dispatch(getProfile()); // This is fine for user's balance

        // Then, re-fetch the list of PENDING withdrawals
        dispatch(adminGetWithdrawalRequests({ status: 'pending' }));
        // --- [!!!] END: MODIFICATION [!!!] ---

        return true;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to reject withdrawal.';
        console.error("Action Error: Admin rejecting withdrawal:", error.response || error);
        dispatch({ type: ADMIN_REJECT_WITHDRAWAL_FAIL, payload: { requestId, error: message } });
        toast.error(`Error rejecting withdrawal: ${message}`);
        return false;
    }
};

// مسح أخطاء عمليات الأدمن
export const adminClearWithdrawalError = () => ({ type: ADMIN_CLEAR_WITHDRAWAL_ERROR });