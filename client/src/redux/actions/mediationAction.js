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
    GET_MY_MEDIATION_SUMMARIES_REQUEST, GET_MY_MEDIATION_SUMMARIES_SUCCESS, GET_MY_MEDIATION_SUMMARIES_FAIL,
    MARK_MEDIATION_AS_READ_IN_LIST, UPDATE_UNREAD_COUNT_FROM_SOCKET, BUYER_CONFIRM_RECEIPT_REQUEST,
    BUYER_CONFIRM_RECEIPT_SUCCESS, BUYER_CONFIRM_RECEIPT_FAIL, OPEN_DISPUTE_REQUEST, OPEN_DISPUTE_SUCCESS,
    OPEN_DISPUTE_FAIL, GET_MEDIATOR_DISPUTED_CASES_REQUEST, GET_MEDIATOR_DISPUTED_CASES_SUCCESS,
    GET_MEDIATOR_DISPUTED_CASES_FAIL, ADMIN_GET_DISPUTED_MEDIATIONS_REQUEST, ADMIN_GET_DISPUTED_MEDIATIONS_SUCCESS,
    ADMIN_GET_DISPUTED_MEDIATIONS_FAIL,
} from '../actionTypes/mediationActionTypes'; // تأكد من المسار الصحيح
import { getProfile } from './userAction'; // لجلب البروفايل المحدث (الرصيد)

// تأكد من أن لديك axios مثبتًا في مشروعك
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000"; // <-- أضف هذا إذا لم يكن موجودًا

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
    console.log(`[Action getBuyerMediationRequestsAction] Dispatching REQUEST. Page: ${page}, Limit: ${limit}, StatusFilter: '${statusFilter}'`);
    dispatch({ type: GET_BUYER_MEDIATION_REQUESTS_REQUEST });

    const config = getTokenConfig();

    if (!config) {
        const errorMsg = "Not authorized. Please login to view your mediation requests.";
        console.error("[Action getBuyerMediationRequestsAction] Authorization error:", errorMsg);
        dispatch({
            type: GET_BUYER_MEDIATION_REQUESTS_FAIL,
            payload: errorMsg
        });
        toast.error("Authorization required.");
        return Promise.reject({ error: errorMsg });
    }

    // بناء كائن الـ query parameters
    const queryParams = {
        page: page,
        limit: limit
    };

    // إذا تم توفير statusFilter (وليس سلسلة فارغة)، أضفه إلى الـ query parameters
    if (statusFilter && typeof statusFilter === 'string' && statusFilter.trim() !== "") {
        queryParams.status = statusFilter.trim();
        console.log("[Action getBuyerMediationRequestsAction] Applying status filter to queryParams:", queryParams.status);
    } else {
        console.log("[Action getBuyerMediationRequestsAction] No specific status filter provided by action call. Backend will use its default list of statuses.");
        // لا نرسل queryParams.status إذا لم يتم توفير فلتر،
        // ليعتمد الخادم على قائمته الافتراضية التي تشمل 'Disputed'.
    }

    try {
        const baseUrl = `${BACKEND_URL}/mediation/buyer/my-requests`;
        console.log(`[Action getBuyerMediationRequestsAction] Sending GET request to: ${baseUrl} with params:`, queryParams);

        const { data } = await axios.get(baseUrl, {
            ...config,      // دمج إعدادات التوكن (headers)
            params: queryParams  // تمرير الـ query parameters هنا
        });

        console.log("[Action getBuyerMediationRequestsAction] Successfully fetched requests. Payload from server:", data);
        dispatch({
            type: GET_BUYER_MEDIATION_REQUESTS_SUCCESS,
            payload: data // الـ payload هو الكائن المستلم من الخادم (يفترض أنه يحتوي على requests, totalPages, etc.)
        });
        return Promise.resolve(data); // أرجع Promise ناجحًا مع البيانات للاستخدام في المكون إذا لزم الأمر

    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to fetch your mediation requests.";
        const statusCode = error.response?.status;
        console.error(`[Action getBuyerMediationRequestsAction] Error fetching requests (Status: ${statusCode}):`, message, error.response || error);

        dispatch({
            type: GET_BUYER_MEDIATION_REQUESTS_FAIL,
            payload: message
        });
        toast.error(`Error fetching requests: ${message}`);
        return Promise.reject({ error: message, statusCode }); // أرجع Promise مرفوضًا مع رسالة الخطأ وربما رمز الحالة
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

/**
 * Action لجلب ملخصات الوساطات للمستخدم الحالي
 */
export const getMyMediationSummaries = () => async (dispatch, getState) => {
    try {
        dispatch({ type: GET_MY_MEDIATION_SUMMARIES_REQUEST });

        // يمكنك استخدام getTokenConfig أو الحصول على التوكن مباشرة
        const tokenFromState = getState().userReducer?.token; // افتراض أن التوكن مخزن في userReducer
        const tokenFromStorage = localStorage.getItem('token');
        const token = tokenFromState || tokenFromStorage;

        if (!token) {
            // يمكنك التعامل مع هذا بشكل أفضل، ربما dispatch لـ LOGOUT_USER
            dispatch({
                type: GET_MY_MEDIATION_SUMMARIES_FAIL,
                payload: "User not authenticated for fetching mediation summaries.",
            });
            toast.error("Authentication required.");
            return; // إنهاء التنفيذ إذا لم يكن هناك توكن
        }

        const config = {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        };

        // Endpoint جديد سنقوم بإنشائه في الخادم
        const { data } = await axios.get(`${BACKEND_URL}/mediation/my-summaries`, config);
        // نتوقع أن data يكون كائنًا يحتوي على:
        // data.requests: مصفوفة من ملخصات الوساطات
        // data.totalUnreadMessages: العدد الإجمالي للرسائل غير المقروءة عبر جميع الوساطات

        dispatch({
            type: GET_MY_MEDIATION_SUMMARIES_SUCCESS,
            payload: data, // data = { requests: [], totalUnreadMessages: 0 }
        });

    } catch (error) {
        const errorMessage = error.response && error.response.data && error.response.data.msg
            ? error.response.data.msg
            : error.message;
        console.error("Error fetching mediation summaries:", errorMessage, error.response || error);
        dispatch({
            type: GET_MY_MEDIATION_SUMMARIES_FAIL,
            payload: errorMessage,
        });
        // لا تعرض toast هنا بالضرورة، يمكن للمكون الذي يستدعي هذا الـ action التعامل مع الخطأ
    }
};
// --- [!!!] نهاية الدالة المضافة [!!!] ---

// Action (اختياري) لتحديث واجهة المستخدم عند فتح محادثة من القائمة
// (لجعل عدد الرسائل غير المقروءة لتلك المحادثة = 0 فورًا في القائمة)
export const markMediationAsReadInList = (mediationId) => (dispatch) => {
    dispatch({
        type: MARK_MEDIATION_AS_READ_IN_LIST,
        payload: { mediationId },
    });
};

// Action (اختياري) لتحديث عدد الرسائل غير المقروءة عند استقبال رسالة جديدة عبر socket
export const updateUnreadCountFromSocket = (mediationId, newUnreadCount) => (dispatch) => {
    dispatch({
        type: UPDATE_UNREAD_COUNT_FROM_SOCKET,
        payload: { mediationId, unreadCount: newUnreadCount }
    });
};

export const buyerConfirmReceipt = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: BUYER_CONFIRM_RECEIPT_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig(); // افترض أن لديك هذه الدالة المساعدة
    if (!config) {
        const errorMsg = "Authorization Error.";
        dispatch({ type: BUYER_CONFIRM_RECEIPT_FAIL, payload: { error: errorMsg } });
        toast.error(errorMsg);
        throw new Error(errorMsg); // لكي يتمكن .catch في المكون من التقاط الخطأ
    }

    try {
        const { data } = await axios.put(
            `${BACKEND_URL}/mediation/buyer/confirm-receipt/${mediationRequestId}`,
            {}, // لا يوجد body مطلوب عادةً
            config
        );

        dispatch({
            type: BUYER_CONFIRM_RECEIPT_SUCCESS,
            payload: {
                mediationRequestId,
                updatedMediationRequest: data.mediationRequest, // الخادم يجب أن يعيد الطلب المحدث
                // يمكنك أيضًا إرجاع أرصدة محدثة إذا كان الـ backend يفعل ذلك
            }
        });
        toast.success(data.msg || "Receipt confirmed and funds processed!");

        dispatch(getProfile());

        // --- [!!!] تحديث حالة المنتج في productReducer [!!!] ---
        if (data.mediationRequest && data.mediationRequest.product) {
            const productId = typeof data.mediationRequest.product === 'string'
                ? data.mediationRequest.product
                : data.mediationRequest.product._id;
            const buyerIdForProduct = typeof data.mediationRequest.buyer === 'string'
                ? data.mediationRequest.buyer
                : data.mediationRequest.buyer._id;

            if (productId) {
                dispatch({
                    type: 'UPDATE_PRODUCT_STATUS_SOLD', // ستحتاج لإنشاء هذا الـ actionType والـ case في productReducer
                    payload: {
                        productId,
                        newStatus: 'sold', // أو 'Completed'
                        soldAt: new Date().toISOString(), // تاريخ البيع
                        buyerId: buyerIdForProduct // مشتري المنتج
                    }
                });
            }
        }
        // -----------------------------------------------------
        return data;

    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to confirm receipt.';
        dispatch({
            type: BUYER_CONFIRM_RECEIPT_FAIL,
            payload: { mediationRequestId, error: message }
        });
        toast.error(message);
        throw error; // إعادة رمي الخطأ ليتم التقاطه في المكون
    }
};

export const openDisputeAction = (mediationRequestId, reason = null) => async (dispatch) => {
    dispatch({ type: OPEN_DISPUTE_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) {
        const errorMsg = "Authorization Error.";
        dispatch({ type: OPEN_DISPUTE_FAIL, payload: { error: errorMsg } });
        toast.error(errorMsg);
        throw new Error(errorMsg);
    }

    try {
        const body = reason ? { reason } : {};
        const { data } = await axios.put(
            `${BACKEND_URL}/mediation/open-dispute/${mediationRequestId}`,
            body,
            config
        );

        dispatch({
            type: OPEN_DISPUTE_SUCCESS,
            payload: {
                mediationRequestId,
                updatedMediationRequest: data.mediationRequest,
            }
        });
        toast.info(data.msg || "Dispute opened successfully. A mediator will be notified.");
        // لا حاجة لإعادة جلب البروفايل هنا عادةً، لكن يمكن إعادة جلب ملخصات الوساطة
        // dispatch(getMyMediationSummaries()); 
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to open dispute.';
        dispatch({
            type: OPEN_DISPUTE_FAIL,
            payload: { mediationRequestId, error: message }
        });
        toast.error(message);
        throw error;
    }
};

export const getMediatorDisputedCasesAction = (page = 1, limit = 10) => async (dispatch) => {
    dispatch({ type: GET_MEDIATOR_DISPUTED_CASES_REQUEST });
    const config = getTokenConfig();
    if (!config) { 
    dispatch({ type: GET_MEDIATOR_DISPUTED_CASES_FAIL, payload: 'Authorization Error' });
        return; }
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/mediator/disputed-cases?page=${page}&limit=${limit}`, config);
        dispatch({ type: GET_MEDIATOR_DISPUTED_CASES_SUCCESS, payload: data });
    } catch (error) { 
        const message = error.response?.data?.msg || error.message || 'Failed to fetch disputed cases.';
        dispatch({ type: GET_MEDIATOR_DISPUTED_CASES_FAIL, payload: message });
        toast.error(message);
    }
};

export const adminGetDisputedMediationsAction = (page = 1, limit = 10) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_DISPUTED_MEDIATIONS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADMIN_GET_DISPUTED_MEDIATIONS_FAIL, payload: 'Authorization Error' });
        toast.error("Authorization required.");
        return; }

    try {
        // Endpoint جديد للخادم لجلب جميع الوساطات المتنازع عليها
        const { data } = await axios.get(`${BACKEND_URL}/mediation/admin/disputed-cases?page=${page}&limit=${limit}`, config);
        dispatch({ type: ADMIN_GET_DISPUTED_MEDIATIONS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch disputed mediations.';
        dispatch({ type: ADMIN_GET_DISPUTED_MEDIATIONS_FAIL, payload: message });
        toast.error(message);
    }
};