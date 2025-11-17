import axios from 'axios';
import { toast } from 'react-toastify';
import * as types from '../actionTypes/mediationActionTypes';
import { getProfile } from './userAction';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

// دالة مساعدة لمعالجة الأخطاء وإرجاع مفتاح ترجمة
const handleError = (error, defaultKey = 'apiErrors.unknownError') => {
    if (error.response) {
        // [!!!] هذا هو الجزء الأهم [!!!]
        if (error.response.data.translationKey) {
            return {
                key: error.response.data.translationKey,
                params: error.response.data.translationParams || {} // تأكد من تمرير params
            };
        }
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

const getTokenConfig = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
};

// --- Admin Actions ---
export const adminGetPendingAssignments = (params = {}) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_GET_PENDING_ASSIGNMENTS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/admin/pending-assignment`, { ...config, params });
        dispatch({ type: types.ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.admin.loadPendingFail');
        dispatch({ type: types.ADMIN_GET_PENDING_ASSIGNMENTS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const getMyAllMediationRequestsAction = (page = 1, limit = 10, statusFilter = '') => async (dispatch) => {
    dispatch({ type: types.GET_BUYER_MEDIATION_REQUESTS_REQUEST }); // يمكن إعادة استخدام نفس النوع
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.GET_BUYER_MEDIATION_REQUESTS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });

    const queryParams = { page, limit };
    if (statusFilter) queryParams.status = statusFilter;

    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/my-requests/all`, { ...config, params: queryParams });
        dispatch({ type: types.GET_BUYER_MEDIATION_REQUESTS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediationRequestsPage.errorTitle');
        dispatch({ type: types.GET_BUYER_MEDIATION_REQUESTS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminAssignMediator = (requestId, mediatorId) => async (dispatch) => {
    dispatch({ type: types.ADMIN_ASSIGN_MEDIATOR_REQUEST, payload: { requestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_ASSIGN_MEDIATOR_FAIL, payload: { requestId, errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/admin/assign/${requestId}`, { mediatorId }, config);
        dispatch({ type: types.ADMIN_ASSIGN_MEDIATOR_SUCCESS, payload: { updatedRequest: data.mediationRequest, successMessage: 'mediation.admin.assignSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.admin.assignFail');
        dispatch({ type: types.ADMIN_ASSIGN_MEDIATOR_FAIL, payload: { requestId, errorMessage: { key, fallback, params } } });
    }
};

export const adminGetDisputedMediationsAction = (page = 1, limit = 10) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_DISPUTED_MEDIATIONS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_GET_DISPUTED_MEDIATIONS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/admin/disputed-cases`, { ...config, params: { page, limit } });
        dispatch({ type: types.ADMIN_GET_DISPUTED_MEDIATIONS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.admin.loadDisputesFail');
        dispatch({ type: types.ADMIN_GET_DISPUTED_MEDIATIONS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminResolveDisputeAction = (mediationRequestId, resolutionData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_RESOLVE_DISPUTE_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_RESOLVE_DISPUTE_FAIL, payload: { mediationRequestId, errorMessage: { key: "apiErrors.notAuthorizedAdmin" } } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/admin/resolve-dispute/${mediationRequestId}`, resolutionData, config);
        dispatch({ type: types.ADMIN_RESOLVE_DISPUTE_SUCCESS, payload: { mediationRequestId, updatedMediationRequest: data.mediationRequest, successMessage: 'mediation.admin.resolveSuccess' } });
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.admin.resolveFail');
        dispatch({ type: types.ADMIN_RESOLVE_DISPUTE_FAIL, payload: { mediationRequestId, errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const adminCreateSubChat = (mediationRequestId, subChatData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_CREATE_SUBCHAT_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        const errorMessage = { key: 'apiErrors.notAuthorizedAdmin' };
        dispatch({ type: types.ADMIN_CREATE_SUBCHAT_FAIL, payload: { errorMessage } });
        throw new Error('Authorization Error');
    }
    try {
        const { data } = await axios.post(`${BACKEND_URL}/mediation/${mediationRequestId}/admin/subchats`, subChatData, config);
        dispatch({ type: types.ADMIN_CREATE_SUBCHAT_SUCCESS, payload: { ...data, successMessage: 'mediation.subchat.createSuccess' } });
        return data.subChat;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.subchat.createFail');
        dispatch({ type: types.ADMIN_CREATE_SUBCHAT_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const adminGetAllSubChats = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_ALL_SUBCHATS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_GET_ALL_SUBCHATS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/${mediationRequestId}/admin/subchats`, config);
        dispatch({ type: types.ADMIN_GET_ALL_SUBCHATS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.subchat.loadAllFail');
        dispatch({ type: types.ADMIN_GET_ALL_SUBCHATS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminGetSubChatMessages = (mediationRequestId, subChatId) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_SUBCHAT_MESSAGES_REQUEST, payload: { subChatId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_GET_SUBCHAT_MESSAGES_FAIL, payload: { subChatId, errorMessage: { key: 'apiErrors.notAuthorized' } } });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/${mediationRequestId}/admin/subchats/${subChatId}/messages`, config);
        dispatch({ type: types.ADMIN_GET_SUBCHAT_MESSAGES_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.subchat.loadMessagesFail');
        dispatch({ type: types.ADMIN_GET_SUBCHAT_MESSAGES_FAIL, payload: { subChatId, errorMessage: { key, fallback, params } } });
    }
};

// --- Seller Actions ---
export const assignSelectedMediator = (mediationRequestId, selectedMediatorId) => async (dispatch) => {
    dispatch({ type: types.ASSIGN_MEDIATOR_REQUEST, payload: { mediationRequestId, selectedMediatorId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ASSIGN_MEDIATOR_FAIL, payload: { errorMessage: { key: "apiErrors.notAuthorized" } } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/assign-selected/${mediationRequestId}`, { selectedMediatorId }, config);
        // 1. إرسال أكشن النجاح لـ mediationReducer (لإيقاف التحميل مثلاً)
        dispatch({
            type: types.ASSIGN_MEDIATOR_SUCCESS,
            payload: {
                responseData: data,
                mediationRequestId,
            }
        });

        // 2. إذا عادت البيانات الكاملة، قم بإرسال أكشن منفصل ومباشر لتحديث المنتج
        if (data.mediationRequest && data.mediationRequest.product) {
            dispatch({
                type: 'UPDATE_SINGLE_PRODUCT_IN_STORE', // استخدم هذا الأكشن الموثوق
                payload: data.mediationRequest.product
            });
            console.log('[assignSelectedMediator Action] Dispatched UPDATE_SINGLE_PRODUCT_IN_STORE with full product data.');
        }
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.seller.assignFail');
        dispatch({ type: types.ASSIGN_MEDIATOR_FAIL, payload: { errorMessage: { key, fallback, params }, mediationRequestId } });
        throw error;
    }
};

export const sellerConfirmReadinessAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: types.SELLER_CONFIRM_READINESS_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.SELLER_CONFIRM_READINESS_FAIL, payload: { errorMessage: { key: "apiErrors.notAuthorized" } } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/seller/confirm-readiness/${mediationRequestId}`, {}, config);
        // 1. قم بعمل dispatch لـ action النجاح الأصلي (لـ mediationReducer)
        dispatch({
            type: types.SELLER_CONFIRM_READINESS_SUCCESS,
            payload: {
                mediationRequestId,
                responseData: data,
                successMessage: data.msg // استخدم الرسالة من الخادم
            }
        });

        // 2. قم بعمل dispatch لـ action جديد ومباشر لتحديث المنتج في productReducer
        //    مرر `mediationRequest` المحدث من استجابة الخادم
        if (data.mediationRequest) {
            dispatch({
                type: 'UPDATE_PRODUCT_FROM_MEDIATION_ACTION', // <-- action جديد سنقوم بإنشائه
                payload: data.mediationRequest
            });
        }
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.seller.confirmFail');
        dispatch({ type: types.SELLER_CONFIRM_READINESS_FAIL, payload: { mediationRequestId, errorMessage: { key, fallback, params } } });
        throw error;
    }
};

// --- Buyer Actions ---
export const getBuyerMediationRequestsAction = (page = 1, limit = 10, statusFilter = '') => async (dispatch) => {
    dispatch({ type: types.GET_BUYER_MEDIATION_REQUESTS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.GET_BUYER_MEDIATION_REQUESTS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });

    const queryParams = { page, limit };
    if (statusFilter) queryParams.status = statusFilter;

    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/buyer/my-requests`, { ...config, params: queryParams });
        dispatch({ type: types.GET_BUYER_MEDIATION_REQUESTS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.buyer.loadRequestsFail');
        dispatch({ type: types.GET_BUYER_MEDIATION_REQUESTS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const buyerConfirmReadinessAndEscrowAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: types.BUYER_CONFIRM_READINESS_ESCROW_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.BUYER_CONFIRM_READINESS_ESCROW_FAIL, payload: { errorMessage: { key: "apiErrors.notAuthorized" } } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/buyer/confirm-readiness-and-escrow/${mediationRequestId}`, {}, config);
        dispatch({ type: types.BUYER_CONFIRM_READINESS_ESCROW_SUCCESS, payload: { mediationRequestId, responseData: data, successMessage: 'mediation.buyer.confirmSuccess' } });
        if (data.updatedBuyerBalance !== undefined) {
            dispatch({ type: 'UPDATE_USER_BALANCE', payload: { balance: data.updatedBuyerBalance } });
        } else {
            dispatch(getProfile());
        }
        return data;
    } catch (error) {
        const errorObject = handleError(error, 'mediation.buyer.confirmFail');
        dispatch({
            type: types.BUYER_CONFIRM_READINESS_ESCROW_FAIL,
            payload: {
                mediationRequestId,
                errorMessage: errorObject
            }
        });
        // [!!!] تمرير الكائن الكامل الذي تم إرجاعه من handleError [!!!]
        return Promise.reject(errorObject);
    }
};

export const buyerRejectMediationAction = (mediationRequestId, reason) => async (dispatch) => {
    dispatch({ type: types.BUYER_REJECT_MEDIATION_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.BUYER_REJECT_MEDIATION_FAIL, payload: { errorMessage: { key: "apiErrors.notAuthorized" } } });
    if (!reason || reason.trim() === "") {
        const errorMessage = { key: "mediation.buyer.reasonRequired" };
        dispatch({ type: types.BUYER_REJECT_MEDIATION_FAIL, payload: { mediationRequestId, errorMessage } });
        throw new Error("Rejection reason is required.");
    }
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/buyer/reject-mediation/${mediationRequestId}`, { reason }, config);
        dispatch({ type: types.BUYER_REJECT_MEDIATION_SUCCESS, payload: { mediationRequestId, responseData: data, successMessage: 'mediation.buyer.rejectSuccess' } });
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.buyer.rejectFail');
        dispatch({ type: types.BUYER_REJECT_MEDIATION_FAIL, payload: { mediationRequestId, errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const buyerConfirmReceipt = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: types.BUYER_CONFIRM_RECEIPT_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.BUYER_CONFIRM_RECEIPT_FAIL, payload: { errorMessage: { key: "apiErrors.notAuthorized" } } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/buyer/confirm-receipt/${mediationRequestId}`, {}, config);
        dispatch({ type: types.BUYER_CONFIRM_RECEIPT_SUCCESS, payload: { mediationRequestId, updatedMediationRequest: data.mediationRequest, successMessage: 'mediation.buyer.receiptSuccess' } });
        dispatch(getProfile());
        if (data.mediationRequest && data.mediationRequest.product) {
            const productId = typeof data.mediationRequest.product === 'string' ? data.mediationRequest.product : data.mediationRequest.product._id;
            const buyerIdForProduct = typeof data.mediationRequest.buyer === 'string' ? data.mediationRequest.buyer : data.mediationRequest.buyer._id;
            if (productId) {
                dispatch({ type: 'UPDATE_PRODUCT_STATUS_SOLD', payload: { productId, newStatus: 'sold', soldAt: new Date().toISOString(), buyerId: buyerIdForProduct } });
            }
        }
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.buyer.receiptFail');
        dispatch({ type: types.BUYER_CONFIRM_RECEIPT_FAIL, payload: { mediationRequestId, errorMessage: { key, fallback, params } } });
        throw error;
    }
};

// --- Mediator Actions ---
export const getMediatorAssignments = (page = 1, limit = 10) => async (dispatch) => {
    dispatch({ type: types.GET_MEDIATOR_ASSIGNMENTS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.GET_MEDIATOR_ASSIGNMENTS_FAIL, payload: { errorMessage: { key: "apiErrors.notAuthorized" } } });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/mediator/my-assignments?page=${page}&limit=${limit}`, config);
        dispatch({ type: types.GET_MEDIATOR_ASSIGNMENTS_SUCCESS, payload: data });
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.mediator.loadAssignmentsFail');
        dispatch({ type: types.GET_MEDIATOR_ASSIGNMENTS_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const mediatorAcceptAssignmentAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: types.MEDIATOR_ACCEPT_ASSIGNMENT_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.MEDIATOR_ACCEPT_ASSIGNMENT_FAIL, payload: { mediationRequestId, errorMessage: { key: "apiErrors.notAuthorized" } } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/mediator/accept/${mediationRequestId}`, {}, config);
        dispatch({ type: types.MEDIATOR_ACCEPT_ASSIGNMENT_SUCCESS, payload: { mediationRequestId, responseData: data, successMessage: 'mediation.mediator.acceptSuccess' } });
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.mediator.acceptFail');
        dispatch({ type: types.MEDIATOR_ACCEPT_ASSIGNMENT_FAIL, payload: { mediationRequestId, errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const mediatorRejectAssignmentAction = (mediationRequestId, reason) => async (dispatch) => {
    dispatch({ type: types.MEDIATOR_REJECT_ASSIGNMENT_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.MEDIATOR_REJECT_ASSIGNMENT_FAIL, payload: { mediationRequestId, errorMessage: { key: "apiErrors.notAuthorized" } } });
    if (!reason || reason.trim() === "") {
        const errorMessage = { key: "mediation.mediator.reasonRequired" };
        dispatch({ type: types.MEDIATOR_REJECT_ASSIGNMENT_FAIL, payload: { mediationRequestId, errorMessage } });
        throw new Error("Rejection reason is required.");
    }
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/mediator/reject/${mediationRequestId}`, { reason }, config);
        dispatch({ type: types.MEDIATOR_REJECT_ASSIGNMENT_SUCCESS, payload: { mediationRequestId, responseData: data, successMessage: 'mediation.mediator.rejectSuccess' } });
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.mediator.rejectFail');
        dispatch({ type: types.MEDIATOR_REJECT_ASSIGNMENT_FAIL, payload: { mediationRequestId, errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const getMediatorAcceptedAwaitingPartiesAction = (page = 1, limit = 10) => async (dispatch) => {
    dispatch({ type: types.GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_FAIL, payload: { errorMessage: { key: "apiErrors.notAuthorized" } } });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/mediator/accepted-awaiting-parties?page=${page}&limit=${limit}`, config);
        dispatch({ type: types.GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_SUCCESS, payload: data });
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.mediator.loadAcceptedFail');
        dispatch({ type: types.GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const getMediatorDisputedCasesAction = (page = 1, limit = 10) => async (dispatch) => {
    dispatch({ type: types.GET_MEDIATOR_DISPUTED_CASES_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.GET_MEDIATOR_DISPUTED_CASES_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/mediator/disputed-cases`, { ...config, params: { page, limit } });
        dispatch({ type: types.GET_MEDIATOR_DISPUTED_CASES_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.mediator.loadDisputesFail');
        dispatch({ type: types.GET_MEDIATOR_DISPUTED_CASES_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

// --- Shared Actions ---
export const openDisputeAction = (mediationRequestId, reason = null) => async (dispatch) => {
    dispatch({ type: types.OPEN_DISPUTE_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.OPEN_DISPUTE_FAIL, payload: { errorMessage: { key: "apiErrors.notAuthorized" } } });
    try {
        const body = reason ? { reason } : {};
        const { data } = await axios.put(`${BACKEND_URL}/mediation/open-dispute/${mediationRequestId}`, body, config);
        dispatch({ type: types.OPEN_DISPUTE_SUCCESS, payload: { mediationRequestId, updatedMediationRequest: data.mediationRequest, successMessage: 'mediation.dispute.openSuccess' } });
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.dispute.openFail');
        dispatch({ type: types.OPEN_DISPUTE_FAIL, payload: { mediationRequestId, errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const getMyMediationSummaries = () => async (dispatch) => {
    dispatch({ type: types.GET_MY_MEDIATION_SUMMARIES_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.GET_MY_MEDIATION_SUMMARIES_FAIL, payload: { errorMessage: { key: "apiErrors.notAuthorized" } } });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/my-summaries`, config);
        dispatch({ type: types.GET_MY_MEDIATION_SUMMARIES_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.summaries.loadFail');
        dispatch({ type: types.GET_MY_MEDIATION_SUMMARIES_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const getMediationDetailsByIdAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: types.GET_MEDIATION_DETAILS_BY_ID_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.GET_MEDIATION_DETAILS_BY_ID_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/request-details/${mediationRequestId}`, config);
        dispatch({ type: types.GET_MEDIATION_DETAILS_BY_ID_SUCCESS, payload: data.mediationRequest || data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'mediation.details.loadFail');
        dispatch({ type: types.GET_MEDIATION_DETAILS_BY_ID_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

// --- Socket and other simple actions (no API calls) ---
export const updateMediationDetailsFromSocket = (updatedDetails) => ({ type: types.UPDATE_MEDIATION_DETAILS_FROM_SOCKET, payload: updatedDetails });
export const clearActiveMediationDetails = () => ({ type: types.CLEAR_ACTIVE_MEDIATION_DETAILS });
export const adminResetCreateSubChat = () => ({ type: types.ADMIN_CREATE_SUBCHAT_RESET });
export const setActiveSubChatId = (subChatId) => ({ type: types.SET_ACTIVE_SUBCHAT_ID, payload: subChatId });
export const clearActiveSubChatMessages = () => ({ type: types.CLEAR_ACTIVE_SUBCHAT_MESSAGES });
export const handleAdminSubChatCreatedSocket = (data) => ({ type: types.ADMIN_SUBCHAT_CREATED_SOCKET, payload: data });
export const handleNewAdminSubChatMessageSocket = (data) => (dispatch, getState) => {
    const currentUserId = getState().userReducer.user?._id;
    if (!currentUserId) return;
    dispatch({ type: types.NEW_ADMIN_SUBCHAT_MESSAGE_SOCKET, payload: { ...data, currentUserId } });
};
export const handleAdminSubChatMessagesStatusUpdatedSocket = (data) => ({ type: types.ADMIN_SUBCHAT_MESSAGES_STATUS_UPDATED_SOCKET, payload: data });
export const markSubChatAsReadInList = (subChatId) => ({ type: types.MARK_SUBCHAT_AS_READ_IN_LIST, payload: { subChatId } });
export const markMediationAsReadInList = (mediationId) => ({ type: types.MARK_MEDIATION_AS_READ_IN_LIST, payload: { mediationId } });
export const updateUnreadCountFromSocket = (mediationId, unreadCount, lastMessageTimestamp, productTitle, otherPartyForRecipient) => ({
    type: types.UPDATE_UNREAD_COUNT_FROM_SOCKET,
    payload: { mediationId, unreadCount, lastMessageTimestamp, productTitle, otherPartyForRecipient }
});