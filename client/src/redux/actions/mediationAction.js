// src/redux/actions/mediationAction.js
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST, ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS, ADMIN_GET_PENDING_ASSIGNMENTS_FAIL,
    ADMIN_ASSIGN_MEDIATOR_REQUEST, ADMIN_ASSIGN_MEDIATOR_SUCCESS, ADMIN_ASSIGN_MEDIATOR_FAIL, ADMIN_ASSIGN_MEDIATOR_RESET,
    ADMIN_CLEAR_MEDIATION_ERRORS, ASSIGN_MEDIATOR_REQUEST, ASSIGN_MEDIATOR_SUCCESS, ASSIGN_MEDIATOR_FAIL,
    GET_MEDIATOR_ASSIGNMENTS_REQUEST, GET_MEDIATOR_ASSIGNMENTS_SUCCESS, GET_MEDIATOR_ASSIGNMENTS_FAIL,
    MEDIATOR_ACCEPT_ASSIGNMENT_REQUEST, MEDIATOR_ACCEPT_ASSIGNMENT_SUCCESS, MEDIATOR_ACCEPT_ASSIGNMENT_FAIL,
    MEDIATOR_REJECT_ASSIGNMENT_REQUEST, MEDIATOR_REJECT_ASSIGNMENT_SUCCESS, MEDIATOR_REJECT_ASSIGNMENT_FAIL,
    GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_REQUEST, GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_SUCCESS, GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_FAIL,
    SELLER_CONFIRM_READINESS_REQUEST, SELLER_CONFIRM_READINESS_SUCCESS, SELLER_CONFIRM_READINESS_FAIL,
    BUYER_CONFIRM_READINESS_ESCROW_REQUEST, BUYER_CONFIRM_READINESS_ESCROW_SUCCESS, BUYER_CONFIRM_READINESS_ESCROW_FAIL,
    GET_BUYER_MEDIATION_REQUESTS_REQUEST, GET_BUYER_MEDIATION_REQUESTS_SUCCESS, GET_BUYER_MEDIATION_REQUESTS_FAIL,
    BUYER_REJECT_MEDIATION_REQUEST, BUYER_REJECT_MEDIATION_SUCCESS, BUYER_REJECT_MEDIATION_FAIL,
    } from '../actionTypes/mediationActionTypes'; // تأكد من المسار الصحيح

// Helper للحصول على التوكن (يمكن استيراده من ملف مشترك)
const getTokenConfig = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
};

/**
 * [Admin] جلب طلبات الوساطة التي تنتظر تعيين وسيط
 */
export const adminGetPendingAssignments = (params = {}) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_FAIL, payload: 'Authorization Error' });

    try {
        // استدعاء المسار الصحيح في الـ Backend
        const { data } = await axios.get('/mediation/admin/pending-assignment', { ...config, params });
        console.log("Action: Received pending mediation assignments:", data);
        // الـ Backend يرجع كائنًا يحتوي على requests, totalPages, etc.
        dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch pending mediation requests.';
        console.error("Action Error: Fetching pending assignments:", error.response || error);
        dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_FAIL, payload: message });
        toast.error(`Error fetching requests: ${message}`);
    }
};

/**
 * [Admin] تعيين وسيط لطلب محدد
 */
export const adminAssignMediator = (requestId, mediatorId) => async (dispatch) => {
    dispatch({ type: ADMIN_ASSIGN_MEDIATOR_REQUEST, payload: { requestId } }); // تشير إلى أن هذا الطلب قيد المعالجة
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_ASSIGN_MEDIATOR_FAIL, payload: { requestId, error: 'Authorization Error' } });

    try {
        console.log(`Action: Assigning mediator ${mediatorId} to request ${requestId}`);
        // استدعاء المسار الصحيح في الـ Backend وإرسال mediatorId في الـ body
        const { data } = await axios.put(`/mediation/admin/assign/${requestId}`, { mediatorId }, config);
        console.log("Action: Mediator assigned successfully:", data);

        dispatch({
            type: ADMIN_ASSIGN_MEDIATOR_SUCCESS,
            payload: {
                updatedRequest: data.mediationRequest // الطلب المحدث بعد التعيين
            }
        });
        toast.success(data.msg || 'Mediator assigned successfully!');
        // لا حاجة لإعادة الجلب هنا، الـ Reducer سيقوم بإزالة الطلب من قائمة Pending

    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to assign mediator.';
        console.error("Action Error: Assigning mediator:", error.response || error);
        dispatch({ type: ADMIN_ASSIGN_MEDIATOR_FAIL, payload: { requestId, error: message } });
        toast.error(`Error assigning mediator: ${message}`);
    }
};

/**
 * إعادة تعيين حالة نجاح/فشل عملية تعيين الوسيط
 */
export const adminResetAssignMediatorStatus = () => ({ type: ADMIN_ASSIGN_MEDIATOR_RESET });

/**
 * مسح أخطاء عمليات الوساطة للأدمن
 */
export const adminClearMediationErrors = () => ({ type: ADMIN_CLEAR_MEDIATION_ERRORS });

// --- [!] تعديل userAction.js لإضافة جلب الوسطاء ---
// أضف هذه الدالة إلى ملف src/redux/actions/userAction.js
export const adminGetAvailableMediators = () => async (dispatch) => {
    dispatch({ type: 'ADMIN_GET_MEDIATORS_REQUEST' }); // <-- تعريف هذا النوع في userActionTypes
    const config = getTokenConfig();
    if (!config) return dispatch({ type: 'ADMIN_GET_MEDIATORS_FAIL', payload: 'Auth Error' }); // <-- تعريف هذا النوع

    try {
        const { data } = await axios.get('/user/admin/mediators', config);
        dispatch({ type: 'ADMIN_GET_MEDIATORS_SUCCESS', payload: data }); // <-- تعريف هذا النوع
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch mediators.';
        dispatch({ type: 'ADMIN_GET_MEDIATORS_FAIL', payload: message });
        toast.error(`Error fetching mediators: ${message}`);
    }
};

export const assignSelectedMediator = (mediationRequestId, selectedMediatorId) => async (dispatch) => {
    dispatch({ type: ASSIGN_MEDIATOR_REQUEST, payload: { mediationRequestId, selectedMediatorId } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ASSIGN_MEDIATOR_FAIL, payload: { error: "Not authorized." } });
        toast.error("Authorization required.");
        return Promise.reject({ error: "Not authorized." });
    }

    try {
        const { data } = await axios.put(
            `/mediation/assign-selected/${mediationRequestId}`,
            { selectedMediatorId }, // الـ body للطلب
            config
        );

        dispatch({
            type: ASSIGN_MEDIATOR_SUCCESS,
            payload: { responseData: data, mediationRequestId } // تمرير requestId هنا أيضًا
        });
        toast.success(data.msg || "Mediator assigned successfully and notified!");
        return Promise.resolve(data);

    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to assign mediator.';
        dispatch({ type: ASSIGN_MEDIATOR_FAIL, payload: { error: message, mediationRequestId } });
        toast.error(`Failed to assign mediator: ${message}`);
        return Promise.reject({ error: message });
    }
};

export const getMediatorAssignments = (page = 1, limit = 10) => async (dispatch) => {
    dispatch({ type: GET_MEDIATOR_ASSIGNMENTS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        const errorMsg = "Not authorized to fetch assignments.";
        dispatch({ type: GET_MEDIATOR_ASSIGNMENTS_FAIL, payload: errorMsg });
        // toast.error(errorMsg); // يمكن إزالة الـ toast من هنا إذا تم التعامل معه في المكون
        return Promise.reject({ error: errorMsg });
    }
    try {
        const { data } = await axios.get(`/mediation/mediator/my-assignments?page=${page}&limit=${limit}`, config);
        dispatch({ type: GET_MEDIATOR_ASSIGNMENTS_SUCCESS, payload: data });
        return Promise.resolve(data);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch assignments.';
        dispatch({ type: GET_MEDIATOR_ASSIGNMENTS_FAIL, payload: message });
        toast.error(message); // الـ toast هنا جيد لإعلام المستخدم بالخطأ
        return Promise.reject({ error: message });
    }
};

// --- [!!!] Action لقبول الوسيط للمهمة [!!!] ---
export const mediatorAcceptAssignmentAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: MEDIATOR_ACCEPT_ASSIGNMENT_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) {
        const errorMsg = "Not authorized to accept assignment.";
        dispatch({ type: MEDIATOR_ACCEPT_ASSIGNMENT_FAIL, payload: { mediationRequestId, error: errorMsg } });
        toast.error(errorMsg);
        return Promise.reject({ error: errorMsg });
    }

    try {
        const { data } = await axios.put(`/mediation/mediator/accept/${mediationRequestId}`, {}, config); // لا يوجد body مطلوب للقبول
        dispatch({
            type: MEDIATOR_ACCEPT_ASSIGNMENT_SUCCESS,
            payload: { mediationRequestId, responseData: data } // أرسل الـ ID لتحديث الحالة في الـ reducer
        });
        toast.success(data.msg || "Assignment accepted successfully!");
        return Promise.resolve(data);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to accept assignment.';
        dispatch({ type: MEDIATOR_ACCEPT_ASSIGNMENT_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(`Acceptance failed: ${message}`);
        return Promise.reject({ error: message });
    }
};
// ---------------------------------------------

// --- [!!!] Action لرفض الوسيط للمهمة [!!!] ---
export const mediatorRejectAssignmentAction = (mediationRequestId, reason) => async (dispatch) => {
    dispatch({ type: MEDIATOR_REJECT_ASSIGNMENT_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) {
        const errorMsg = "Not authorized to reject assignment.";
        dispatch({ type: MEDIATOR_REJECT_ASSIGNMENT_FAIL, payload: { mediationRequestId, error: errorMsg } });
        toast.error(errorMsg);
        return Promise.reject({ error: errorMsg });
    }

    if (!reason || reason.trim() === "") {
        const errorMsg = "Rejection reason is required.";
        dispatch({ type: MEDIATOR_REJECT_ASSIGNMENT_FAIL, payload: { mediationRequestId, error: errorMsg } });
        toast.warn(errorMsg); // استخدام warn لخطأ إدخال
        return Promise.reject({ error: errorMsg });
    }

    try {
        const { data } = await axios.put(`/mediation/mediator/reject/${mediationRequestId}`, { reason }, config); // إرسال السبب في الـ body
        dispatch({
            type: MEDIATOR_REJECT_ASSIGNMENT_SUCCESS,
            payload: { mediationRequestId, responseData: data } // أرسل الـ ID لتحديث الحالة في الـ reducer
        });
        toast.info(data.msg || "Assignment rejected successfully."); // استخدام info للرفض
        return Promise.resolve(data);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to reject assignment.';
        dispatch({ type: MEDIATOR_REJECT_ASSIGNMENT_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(`Rejection failed: ${message}`);
        return Promise.reject({ error: message });
    }
};

export const getMediatorAcceptedAwaitingPartiesAction = (page = 1, limit = 10) => async (dispatch) => {
    dispatch({ type: GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        const errorMsg = "Not authorized to fetch assignments.";
        dispatch({ type: GET_MEDIATOR_ASSIGNMENTS_FAIL, payload: errorMsg });
        // toast.error(errorMsg); // يمكن إزالة الـ toast من هنا إذا تم التعامل معه في المكون
        return Promise.reject({ error: errorMsg });
    }
    try {
        const { data } = await axios.get(`/mediation/mediator/accepted-awaiting-parties?page=${page}&limit=${limit}`, config);
        dispatch({ type: GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_SUCCESS, payload: data });
        return Promise.resolve(data);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch accepted assignments.';
        dispatch({ type: GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_FAIL, payload: message });
        toast.error(message);
        return Promise.reject({ error: message });
    }
};

// --- [!!!] Action لتأكيد استعداد البائع [!!!] ---
export const sellerConfirmReadinessAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: SELLER_CONFIRM_READINESS_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();

    if (!config) {
        dispatch({ type: ASSIGN_MEDIATOR_FAIL, payload: { error: "Not authorized." } });
        toast.error("Authorization required.");
        return Promise.reject({ error: "Not authorized." });
    }

    try {
        const { data } = await axios.put(`/mediation/seller/confirm-readiness/${mediationRequestId}`, {}, config);
        dispatch({
            type: SELLER_CONFIRM_READINESS_SUCCESS,
            payload: { mediationRequestId, responseData: data } // أرسل الـ ID وربما الطلب المحدث
        });
        toast.success(data.msg || "Your readiness has been confirmed!");
        return Promise.resolve(data);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to confirm readiness.';
        dispatch({ type: SELLER_CONFIRM_READINESS_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(`Confirmation failed: ${message}`);
        return Promise.reject({ error: message });
    }
};

// --- [!!!] Action لتأكيد استعداد المشتري وتجميد الرصيد [!!!] ---
export const buyerConfirmReadinessAndEscrowAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: BUYER_CONFIRM_READINESS_ESCROW_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    
    if (!config) {
        dispatch({ type: ASSIGN_MEDIATOR_FAIL, payload: { error: "Not authorized." } });
        toast.error("Authorization required.");
        return Promise.reject({ error: "Not authorized." });
    }

    try {
        const { data } = await axios.put(`/mediation/buyer/confirm-readiness-and-escrow/${mediationRequestId}`, {}, config);
        dispatch({
            type: BUYER_CONFIRM_READINESS_ESCROW_SUCCESS,
            payload: { mediationRequestId, responseData: data }
        });
        toast.success(data.msg || "Your readiness confirmed and funds are in escrow!");
        // --- [!!!] مهم: تحديث رصيد المستخدم في Redux [!!!] ---
        if (data.updatedBuyerBalance !== undefined) { // إذا أعاد الـ API الرصيد المحدث
            dispatch({ 
                type: 'UPDATE_USER_BALANCE', // ستحتاج لإنشاء هذا الـ action type والـ case في userReducer
                payload: { balance: data.updatedBuyerBalance }
            });
        } else {
            // أو يمكنك استدعاء getProfile لجلب البروفايل بالكامل مع الرصيد المحدث
            // dispatch(getProfile()); // افترض أن getProfile موجودة في userActions
        }
        // ----------------------------------------------------
        return Promise.resolve(data);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to confirm or escrow funds.';
        dispatch({ type: BUYER_CONFIRM_READINESS_ESCROW_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(`Action failed: ${message}`);
        return Promise.reject({ error: message });
    }
};

// --- [!!!] Action لجلب طلبات وساطة المشتري [!!!] ---
export const getBuyerMediationRequestsAction = (page = 1, limit = 10, statusFilter = '') => async (dispatch) => {
    dispatch({ type: GET_BUYER_MEDIATION_REQUESTS_REQUEST });
    const config = getTokenConfig();
    
    if (!config) {
        dispatch({ type: ASSIGN_MEDIATOR_FAIL, payload: { error: "Not authorized." } });
        toast.error("Authorization required.");
        return Promise.reject({ error: "Not authorized." });
    }

    try {
        let url = `/mediation/buyer/my-requests?page=${page}&limit=${limit}`;
        if (statusFilter) {
            url += `&status=${statusFilter}`;
        }
        const { data } = await axios.get(url, config);
        dispatch({ type: GET_BUYER_MEDIATION_REQUESTS_SUCCESS, payload: data });
        return Promise.resolve(data);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to fetch your mediation requests.";
        dispatch({ type: GET_BUYER_MEDIATION_REQUESTS_FAIL, payload: message });
        toast.error(message);
        return Promise.reject({ error: message });
    }
};

// --- [!!!] Action لرفض المشتري للوساطة [!!!] ---
export const buyerRejectMediationAction = (mediationRequestId, reason) => async (dispatch) => {
    dispatch({ type: BUYER_REJECT_MEDIATION_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();

    if (!config) {
        dispatch({ type: ASSIGN_MEDIATOR_FAIL, payload: { error: "Not authorized." } });
        toast.error("Authorization required.");
        return Promise.reject({ error: "Not authorized." });
    }

    if (!reason || reason.trim() === "") {
        const errorMsg = "Rejection reason is required.";
        dispatch({ type: BUYER_REJECT_MEDIATION_FAIL, payload: { mediationRequestId, error: errorMsg } });
        toast.warn(errorMsg);
        return Promise.reject({ error: errorMsg });
    }

    try {
        const { data } = await axios.put(`/mediation/buyer/reject-mediation/${mediationRequestId}`, { reason }, config);
        dispatch({
            type: BUYER_REJECT_MEDIATION_SUCCESS,
            payload: { mediationRequestId, responseData: data }
        });
        toast.info(data.msg || "Mediation has been cancelled.");
        return Promise.resolve(data);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to cancel mediation.';
        dispatch({ type: BUYER_REJECT_MEDIATION_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(`Cancellation failed: ${message}`);
        return Promise.reject({ error: message });
    }
};