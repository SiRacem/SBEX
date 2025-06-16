import axios from 'axios';
import { toast } from 'react-toastify';
import {
    CREATE_DEPOSIT_REQUEST, CREATE_DEPOSIT_SUCCESS, CREATE_DEPOSIT_FAIL, CREATE_DEPOSIT_RESET,
    // --- استخدام الأنواع الجديدة لجلب طلبات المستخدم ---
    GET_USER_DEPOSITS_REQUEST, GET_USER_DEPOSITS_SUCCESS, GET_USER_DEPOSITS_FAIL,
    // -----------------------------------------------
    ADMIN_GET_DEPOSITS_REQUEST, ADMIN_GET_DEPOSITS_SUCCESS, ADMIN_GET_DEPOSITS_FAIL,
    ADMIN_APPROVE_DEPOSIT_REQUEST, ADMIN_APPROVE_DEPOSIT_SUCCESS, ADMIN_APPROVE_DEPOSIT_FAIL,
    ADMIN_REJECT_DEPOSIT_REQUEST, ADMIN_REJECT_DEPOSIT_SUCCESS, ADMIN_REJECT_DEPOSIT_FAIL,
    CLEAR_DEPOSIT_ERRORS
    // --- إزالة أو إبقاء الأنواع القديمة معلقة ---
    // GET_DEPOSIT_HISTORY_REQUEST, GET_DEPOSIT_HISTORY_SUCCESS, GET_DEPOSIT_HISTORY_FAIL,
} from '../actionTypes/depositActionType'; // <-- تأكد من اسم الملف الصحيح
import { getProfile } from './userAction'; // لجلب البروفايل بعد الموافقة
import { getTransactions } from './transactionAction'; // <-- أضف هذا الاستيراد

const PAGE_LIMIT = 15;

// Helper (يفضل استيراده من ملف مشترك)
const getTokenConfig = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
};

// --- Actions للمستخدم ---

// --- إنشاء طلب إيداع (المستخدم) ---
export const createDepositRequest = (depositData) => async (dispatch) => {
    dispatch({ type: CREATE_DEPOSIT_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        const errorMsg = "Not authorized. Please login.";
        toast.error(errorMsg);
        return dispatch({ type: CREATE_DEPOSIT_FAIL, payload: errorMsg });
    }

    try {
        console.log("Action: Submitting deposit data:", depositData);
        // --- [!] إرسال الطلب الفعلي للخادم ---
        // تأكد من أن المسار `/api/deposits` صحيح ويتطابق مع Router
        console.log("Action: Data being sent to /deposits:", JSON.stringify(depositData, null, 2));
        if (!depositData || Object.keys(depositData).length === 0) {
            console.error("Action: Attempting to send empty or invalid depositData!");
            return dispatch({ type: CREATE_DEPOSIT_FAIL, payload: 'Invalid deposit data.' });
        }
        console.log("Action: Request config headers:", config?.headers); // <-- أضف هذه الطباعة
        const { data } = await axios.post('/deposits', depositData, config);
        // --------------------------------------

        console.log("Action: Deposit request success:", data);
        dispatch({ type: CREATE_DEPOSIT_SUCCESS, payload: data.request }); // إرسال الطلب المُنشأ كـ payload
        toast.success("Your deposit request has been submitted for review.");
        // --- [!] إضافة هذا السطر ---
        dispatch(getUserDepositRequests());
        dispatch(getTransactions()); // <-- تحديث قائمة المعاملات

    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to submit deposit request.';
        console.error("Action: Deposit submission error:", error.response || error);
        dispatch({ type: CREATE_DEPOSIT_FAIL, payload: message });
        toast.error(`Error: ${message}`);
        throw new Error(message);
    }
};

// Action لإعادة تعيين حالة إنشاء طلب الإيداع.
export const resetCreateDeposit = () => ({ type: CREATE_DEPOSIT_RESET });

// --- جلب تاريخ الإيداع (المستخدم) ---
// --- [معدل] جلب طلبات الإيداع الخاصة بالمستخدم ---
export const getUserDepositRequests = (params = {}) => async (dispatch) => { // <-- تم تغيير اسم الدالة
    dispatch({ type: GET_USER_DEPOSITS_REQUEST }); // <-- استخدام النوع الجديد
    const config = getTokenConfig();
    if (!config) return dispatch({ type: GET_USER_DEPOSITS_FAIL, payload: "Not authorized." }); // <-- استخدام النوع الجديد
    try {
        // --- [مهم] تأكد من وجود هذا المسار في deposit.router.js ---
        // إذا لم يكن موجوداً، يجب إضافته في الروتر والكونترولر
        const { data } = await axios.get('/deposits/my-requests', { ...config, params }); // <-- افترضنا هذا المسار
        // ------------------------------------------------------
        console.log("Action: Received user deposit requests data:", data);
        dispatch({ type: GET_USER_DEPOSITS_SUCCESS, payload: data }); // <-- استخدام النوع الجديد
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch your deposit requests.';
        console.error("Action Error: Fetching user deposit requests:", error.response || error);
        dispatch({ type: GET_USER_DEPOSITS_FAIL, payload: message }); // <-- استخدام النوع الجديد
        // لا تعرض toast هنا للمستخدم عادةً، يكفي معالجة الخطأ في الواجهة
    }
};

// --- جلب طلبات الإيداع (الأدمن) ---
export const adminGetDeposits = (filters = {}) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_DEPOSITS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_GET_DEPOSITS_FAIL, payload: "Not authorized." });

    try {
        // بناء الـ Query String يدوياً
        // --- [!] استخدام الثابت المعرف ---
        const { page = 1, limit = PAGE_LIMIT, status = '' } = filters; // <-- يستخدم PAGE_LIMIT المعرف في الأعلى
        // --------------------------------
        let queryString = `?page=${page}&limit=${limit}`;
        if (status) {
            queryString += `&status=${status}`;
        }

        console.log(`[Action adminGetDeposits] Requesting URL: /deposits/admin${queryString}`);

        const { data } = await axios.get(`/deposits/admin${queryString}`, config);

        // --- [!] تأكد من أن payload يطابق بنية الاستجابة من الخادم ---
        // الـ reducer يتوقع أن payload يحتوي على requests, currentPage, totalPages
        dispatch({ type: ADMIN_GET_DEPOSITS_SUCCESS, payload: data });
        // ---------------------------------------------------------
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch deposit requests.';
        // --- [!] هنا يتم إرسال الخطأ الذي يظهر في الـ Toast ---
        dispatch({ type: ADMIN_GET_DEPOSITS_FAIL, payload: message });
        toast.error(message); // <-- وهذا سبب ظهور الـ Toast الأحمر
        // ---------------------------------------------------
    }
};

// --- الموافقة على الإيداع (الأدمن) ---
export const adminApproveDeposit = (requestId) => async (dispatch) => {
    dispatch({ type: ADMIN_APPROVE_DEPOSIT_REQUEST, payload: { requestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_APPROVE_DEPOSIT_FAIL, payload: { requestId, error: "Not authorized." } });
    try {
        const { data } = await axios.put(`/deposits/admin/${requestId}/approve`, {}, config); // تأكد من المسار
        dispatch({ type: ADMIN_APPROVE_DEPOSIT_SUCCESS, payload: data.request });
        toast.success("Deposit approved successfully!");
        dispatch(getProfile(data.request.user)); // تحديث بروفايل المستخدم المتأثر
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to approve deposit.';
        dispatch({ type: ADMIN_APPROVE_DEPOSIT_FAIL, payload: { requestId, error: message } });
        toast.error(message);
    }
};

// --- رفض الإيداع (الأدمن) ---
export const adminRejectDeposit = (requestId, reason) => async (dispatch) => {
    dispatch({ type: ADMIN_REJECT_DEPOSIT_REQUEST, payload: { requestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_REJECT_DEPOSIT_FAIL, payload: { requestId, error: "Not authorized." } });
    try {
        const { data } = await axios.put(`/deposits/admin/${requestId}/reject`, { reason }, config); // تأكد من المسار
        dispatch({ type: ADMIN_REJECT_DEPOSIT_SUCCESS, payload: data.request });
        toast.info("Deposit rejected.");
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to reject deposit.';
        dispatch({ type: ADMIN_REJECT_DEPOSIT_FAIL, payload: { requestId, error: message } });
        toast.error(message);
    }
};

// --- مسح الأخطاء ---
export const clearDepositErrors = () => ({ type: CLEAR_DEPOSIT_ERRORS });
