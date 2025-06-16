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
    ADMIN_GET_DISPUTED_MEDIATIONS_FAIL, GET_MEDIATION_DETAILS_BY_ID_REQUEST, GET_MEDIATION_DETAILS_BY_ID_SUCCESS, GET_MEDIATION_DETAILS_BY_ID_FAIL,
    UPDATE_MEDIATION_DETAILS_FROM_SOCKET, CLEAR_ACTIVE_MEDIATION_DETAILS, ADMIN_RESOLVE_DISPUTE_REQUEST,
    ADMIN_RESOLVE_DISPUTE_SUCCESS, ADMIN_RESOLVE_DISPUTE_FAIL,
    ADMIN_CREATE_SUBCHAT_REQUEST, ADMIN_CREATE_SUBCHAT_SUCCESS, ADMIN_CREATE_SUBCHAT_FAIL, ADMIN_CREATE_SUBCHAT_RESET,
    ADMIN_GET_ALL_SUBCHATS_REQUEST, ADMIN_GET_ALL_SUBCHATS_SUCCESS, ADMIN_GET_ALL_SUBCHATS_FAIL,
    ADMIN_GET_SUBCHAT_MESSAGES_REQUEST, ADMIN_GET_SUBCHAT_MESSAGES_SUCCESS, ADMIN_GET_SUBCHAT_MESSAGES_FAIL,
    CLEAR_ACTIVE_SUBCHAT_MESSAGES,
    ADMIN_SUBCHAT_CREATED_SOCKET, NEW_ADMIN_SUBCHAT_MESSAGE_SOCKET, ADMIN_SUBCHAT_MESSAGES_STATUS_UPDATED_SOCKET,
    SET_ACTIVE_SUBCHAT_ID
} from '../actionTypes/mediationActionTypes';
import { getProfile } from './userAction';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const getTokenConfig = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
};

export const adminGetPendingAssignments = (params = {}) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_FAIL, payload: 'Authorization Error' });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/admin/pending-assignment`, { ...config, params });
        dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch pending assignments.';
        dispatch({ type: ADMIN_GET_PENDING_ASSIGNMENTS_FAIL, payload: message });
        toast.error(message);
    }
};

export const adminAssignMediator = (requestId, mediatorId) => async (dispatch) => {
    dispatch({ type: ADMIN_ASSIGN_MEDIATOR_REQUEST, payload: { requestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_ASSIGN_MEDIATOR_FAIL, payload: { requestId, error: 'Authorization Error' } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/admin/assign/${requestId}`, { mediatorId }, config);
        dispatch({ type: ADMIN_ASSIGN_MEDIATOR_SUCCESS, payload: { updatedRequest: data.mediationRequest } });
        toast.success(data.msg || 'Mediator assigned!');
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to assign mediator.';
        dispatch({ type: ADMIN_ASSIGN_MEDIATOR_FAIL, payload: { requestId, error: message } });
        toast.error(message);
    }
};

export const adminResetAssignMediatorStatus = () => ({ type: ADMIN_ASSIGN_MEDIATOR_RESET });
export const adminClearMediationErrors = () => ({ type: ADMIN_CLEAR_MEDIATION_ERRORS });

export const assignSelectedMediator = (mediationRequestId, selectedMediatorId) => async (dispatch) => {
    dispatch({ type: ASSIGN_MEDIATOR_REQUEST, payload: { mediationRequestId, selectedMediatorId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ASSIGN_MEDIATOR_FAIL, payload: { error: "Not authorized." } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/assign-selected/${mediationRequestId}`, { selectedMediatorId }, config);
        dispatch({ type: ASSIGN_MEDIATOR_SUCCESS, payload: { responseData: data, mediationRequestId } });
        toast.success(data.msg || "Mediator assigned!");
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to assign mediator.';
        dispatch({ type: ASSIGN_MEDIATOR_FAIL, payload: { error: message, mediationRequestId } });
        toast.error(message);
        throw error;
    }
};

export const getMediatorAssignments = (page = 1, limit = 10) => async (dispatch) => {
    dispatch({ type: GET_MEDIATOR_ASSIGNMENTS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: GET_MEDIATOR_ASSIGNMENTS_FAIL, payload: "Not authorized." });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/mediator/my-assignments?page=${page}&limit=${limit}`, config);
        dispatch({ type: GET_MEDIATOR_ASSIGNMENTS_SUCCESS, payload: data });
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch assignments.';
        dispatch({ type: GET_MEDIATOR_ASSIGNMENTS_FAIL, payload: message });
        toast.error(message);
        throw error;
    }
};

export const mediatorAcceptAssignmentAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: MEDIATOR_ACCEPT_ASSIGNMENT_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: MEDIATOR_ACCEPT_ASSIGNMENT_FAIL, payload: { mediationRequestId, error: "Not authorized." } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/mediator/accept/${mediationRequestId}`, {}, config);
        dispatch({ type: MEDIATOR_ACCEPT_ASSIGNMENT_SUCCESS, payload: { mediationRequestId, responseData: data } });
        toast.success(data.msg || "Assignment accepted!");
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to accept assignment.';
        dispatch({ type: MEDIATOR_ACCEPT_ASSIGNMENT_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(message);
        throw error;
    }
};

export const mediatorRejectAssignmentAction = (mediationRequestId, reason) => async (dispatch) => {
    dispatch({ type: MEDIATOR_REJECT_ASSIGNMENT_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: MEDIATOR_REJECT_ASSIGNMENT_FAIL, payload: { mediationRequestId, error: "Not authorized." } });
    if (!reason || reason.trim() === "") {
        const errorMsg = "Rejection reason is required.";
        dispatch({ type: MEDIATOR_REJECT_ASSIGNMENT_FAIL, payload: { mediationRequestId, error: errorMsg } });
        toast.warn(errorMsg);
        throw new Error(errorMsg);
    }
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/mediator/reject/${mediationRequestId}`, { reason }, config);
        dispatch({ type: MEDIATOR_REJECT_ASSIGNMENT_SUCCESS, payload: { mediationRequestId, responseData: data } });
        toast.info(data.msg || "Assignment rejected.");
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to reject assignment.';
        dispatch({ type: MEDIATOR_REJECT_ASSIGNMENT_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(message);
        throw error;
    }
};

export const getMediatorAcceptedAwaitingPartiesAction = (page = 1, limit = 10) => async (dispatch) => {
    dispatch({ type: GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_FAIL, payload: "Not authorized." });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/mediator/accepted-awaiting-parties?page=${page}&limit=${limit}`, config);
        dispatch({ type: GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_SUCCESS, payload: data });
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch accepted assignments.';
        dispatch({ type: GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_FAIL, payload: message });
        toast.error(message);
        throw error;
    }
};

export const sellerConfirmReadinessAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: SELLER_CONFIRM_READINESS_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: SELLER_CONFIRM_READINESS_FAIL, payload: { error: "Not authorized." } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/seller/confirm-readiness/${mediationRequestId}`, {}, config);
        dispatch({ type: SELLER_CONFIRM_READINESS_SUCCESS, payload: { mediationRequestId, responseData: data } });
        toast.success(data.msg || "Readiness confirmed!");
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to confirm readiness.';
        dispatch({ type: SELLER_CONFIRM_READINESS_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(message);
        throw error;
    }
};

export const buyerConfirmReadinessAndEscrowAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: BUYER_CONFIRM_READINESS_ESCROW_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: BUYER_CONFIRM_READINESS_ESCROW_FAIL, payload: { error: "Not authorized." } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/buyer/confirm-readiness-and-escrow/${mediationRequestId}`, {}, config);
        dispatch({ type: BUYER_CONFIRM_READINESS_ESCROW_SUCCESS, payload: { mediationRequestId, responseData: data } });
        toast.success(data.msg || "Readiness confirmed & funds escrowed!");
        if (data.updatedBuyerBalance !== undefined) {
            dispatch({ type: 'UPDATE_USER_BALANCE', payload: { balance: data.updatedBuyerBalance } });
        } else {
            dispatch(getProfile());
        }
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to confirm or escrow.';
        dispatch({ type: BUYER_CONFIRM_READINESS_ESCROW_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(message);
        throw error;
    }
};

export const getBuyerMediationRequestsAction = (page = 1, limit = 10, statusFilter = '') => async (dispatch) => {
    dispatch({ type: GET_BUYER_MEDIATION_REQUESTS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: GET_BUYER_MEDIATION_REQUESTS_FAIL, payload: "Not authorized." });
    const queryParams = { page, limit };
    if (statusFilter && typeof statusFilter === 'string' && statusFilter.trim() !== "") {
        queryParams.status = statusFilter.trim();
    }
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/buyer/my-requests`, { ...config, params: queryParams });
        dispatch({ type: GET_BUYER_MEDIATION_REQUESTS_SUCCESS, payload: data });
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to fetch buyer's requests.";
        dispatch({ type: GET_BUYER_MEDIATION_REQUESTS_FAIL, payload: message });
        toast.error(message);
        throw error;
    }
};

export const buyerRejectMediationAction = (mediationRequestId, reason) => async (dispatch) => {
    dispatch({ type: BUYER_REJECT_MEDIATION_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: BUYER_REJECT_MEDIATION_FAIL, payload: { error: "Not authorized." } });
    if (!reason || reason.trim() === "") {
        const errorMsg = "Rejection reason is required.";
        dispatch({ type: BUYER_REJECT_MEDIATION_FAIL, payload: { mediationRequestId, error: errorMsg } });
        toast.warn(errorMsg);
        throw new Error(errorMsg);
    }
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/buyer/reject-mediation/${mediationRequestId}`, { reason }, config);
        dispatch({ type: BUYER_REJECT_MEDIATION_SUCCESS, payload: { mediationRequestId, responseData: data } });
        toast.info(data.msg || "Mediation cancelled.");
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to cancel mediation.';
        dispatch({ type: BUYER_REJECT_MEDIATION_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(message);
        throw error;
    }
};

export const getMyMediationSummaries = () => async (dispatch, getState) => {
    dispatch({ type: GET_MY_MEDIATION_SUMMARIES_REQUEST });
    const token = localStorage.getItem('token');
    if (!token) return dispatch({ type: GET_MY_MEDIATION_SUMMARIES_FAIL, payload: "Not authenticated." });
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/my-summaries`, config);
        dispatch({ type: GET_MY_MEDIATION_SUMMARIES_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch summaries.';
        dispatch({ type: GET_MY_MEDIATION_SUMMARIES_FAIL, payload: message });
    }
};

export const markMediationAsReadInList = (mediationId) => ({ type: MARK_MEDIATION_AS_READ_IN_LIST, payload: { mediationId } });
export const updateUnreadCountFromSocket = (mediationId, unreadCount, lastMessageTimestamp, productTitle, otherPartyForRecipient) => ({
    type: UPDATE_UNREAD_COUNT_FROM_SOCKET,
    payload: { mediationId, unreadCount, lastMessageTimestamp, productTitle, otherPartyForRecipient }
});


export const buyerConfirmReceipt = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: BUYER_CONFIRM_RECEIPT_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: BUYER_CONFIRM_RECEIPT_FAIL, payload: { error: "Authorization Error." } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/buyer/confirm-receipt/${mediationRequestId}`, {}, config);
        dispatch({ type: BUYER_CONFIRM_RECEIPT_SUCCESS, payload: { mediationRequestId, updatedMediationRequest: data.mediationRequest } });
        toast.success(data.msg || "Receipt confirmed!");
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
        const message = error.response?.data?.msg || error.message || 'Failed to confirm receipt.';
        dispatch({ type: BUYER_CONFIRM_RECEIPT_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(message);
        throw error;
    }
};

export const openDisputeAction = (mediationRequestId, reason = null) => async (dispatch) => {
    dispatch({ type: OPEN_DISPUTE_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: OPEN_DISPUTE_FAIL, payload: { error: "Authorization Error." } });
    try {
        const body = reason ? { reason } : {};
        const { data } = await axios.put(`${BACKEND_URL}/mediation/open-dispute/${mediationRequestId}`, body, config);
        dispatch({ type: OPEN_DISPUTE_SUCCESS, payload: { mediationRequestId, updatedMediationRequest: data.mediationRequest } });
        toast.info(data.msg || "Dispute opened.");
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to open dispute.';
        dispatch({ type: OPEN_DISPUTE_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(message);
        throw error;
    }
};

export const getMediatorDisputedCasesAction = (page = 1, limit = 10) => async (dispatch) => {
    dispatch({ type: GET_MEDIATOR_DISPUTED_CASES_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: GET_MEDIATOR_DISPUTED_CASES_FAIL, payload: 'Authorization Error' });
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
    if (!config) return dispatch({ type: ADMIN_GET_DISPUTED_MEDIATIONS_FAIL, payload: 'Authorization Error' });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/admin/disputed-cases?page=${page}&limit=${limit}`, config);
        dispatch({ type: ADMIN_GET_DISPUTED_MEDIATIONS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch disputed mediations.';
        dispatch({ type: ADMIN_GET_DISPUTED_MEDIATIONS_FAIL, payload: message });
        toast.error(message);
    }
};

export const getMediationDetailsByIdAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: GET_MEDIATION_DETAILS_BY_ID_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: GET_MEDIATION_DETAILS_BY_ID_FAIL, payload: 'Authorization required.' });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/request-details/${mediationRequestId}`, config);
        dispatch({ type: GET_MEDIATION_DETAILS_BY_ID_SUCCESS, payload: data.mediationRequest || data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to load mediation details.';
        dispatch({ type: GET_MEDIATION_DETAILS_BY_ID_FAIL, payload: message });
    }
};

export const updateMediationDetailsFromSocket = (updatedDetails) => ({ type: UPDATE_MEDIATION_DETAILS_FROM_SOCKET, payload: updatedDetails });
export const clearActiveMediationDetails = () => ({ type: CLEAR_ACTIVE_MEDIATION_DETAILS });

export const adminResolveDisputeAction = (mediationRequestId, resolutionData) => async (dispatch) => {
    dispatch({ type: ADMIN_RESOLVE_DISPUTE_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_RESOLVE_DISPUTE_FAIL, payload: { mediationRequestId, error: "Admin authorization required." } });
    try {
        const { data } = await axios.put(`${BACKEND_URL}/mediation/admin/resolve-dispute/${mediationRequestId}`, resolutionData, config);
        dispatch({ type: ADMIN_RESOLVE_DISPUTE_SUCCESS, payload: { mediationRequestId, updatedMediationRequest: data.mediationRequest } });
        toast.success(data.msg || "Dispute resolved!");
        return data;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to resolve dispute.';
        dispatch({ type: ADMIN_RESOLVE_DISPUTE_FAIL, payload: { mediationRequestId, error: message } });
        toast.error(message);
        throw error;
    }
};


// --- Admin Sub-Chat Actions ---
export const adminCreateSubChat = (mediationRequestId, subChatData) => async (dispatch) => {
    dispatch({ type: ADMIN_CREATE_SUBCHAT_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADMIN_CREATE_SUBCHAT_FAIL, payload: 'Authorization Error' });
        toast.error('Authorization Error');
        throw new Error('Authorization Error');
    }
    try {
        const { data } = await axios.post(`${BACKEND_URL}/mediation/${mediationRequestId}/admin/subchats`, subChatData, config);
        dispatch({ type: ADMIN_CREATE_SUBCHAT_SUCCESS, payload: data });
        toast.success(data.msg || "Private chat created!");
        return data.subChat;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to create private chat.';
        dispatch({ type: ADMIN_CREATE_SUBCHAT_FAIL, payload: message });
        toast.error(message);
        throw error;
    }
};

export const adminResetCreateSubChat = () => ({ type: ADMIN_CREATE_SUBCHAT_RESET });

export const adminGetAllSubChats = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_ALL_SUBCHATS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADMIN_GET_ALL_SUBCHATS_FAIL, payload: 'Authorization Error' });
        return;
    }
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/${mediationRequestId}/admin/subchats`, config);
        dispatch({ type: ADMIN_GET_ALL_SUBCHATS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch private chats.';
        dispatch({ type: ADMIN_GET_ALL_SUBCHATS_FAIL, payload: message });
    }
};

export const setActiveSubChatId = (subChatId) => ({ type: SET_ACTIVE_SUBCHAT_ID, payload: subChatId });

export const adminGetSubChatMessages = (mediationRequestId, subChatId) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_SUBCHAT_MESSAGES_REQUEST, payload: { subChatId } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADMIN_GET_SUBCHAT_MESSAGES_FAIL, payload: { subChatId, error: 'Authorization Error' } });
        return;
    }
    try {
        const { data } = await axios.get(`${BACKEND_URL}/mediation/${mediationRequestId}/admin/subchats/${subChatId}/messages`, config);
        dispatch({ type: ADMIN_GET_SUBCHAT_MESSAGES_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch private chat messages.';
        dispatch({ type: ADMIN_GET_SUBCHAT_MESSAGES_FAIL, payload: { subChatId, error: message } });
    }
};

export const clearActiveSubChatMessages = () => ({ type: CLEAR_ACTIVE_SUBCHAT_MESSAGES });

export const handleAdminSubChatCreatedSocket = (data) => ({ type: ADMIN_SUBCHAT_CREATED_SOCKET, payload: data });

export const handleNewAdminSubChatMessageSocket = (data) => (dispatch, getState) => {
    // احصل على ID المستخدم الحالي من حالة Redux
    const currentUserId = getState().userReducer.user?._id;

    if (!currentUserId) {
        console.warn("handleNewAdminSubChatMessageSocket: Could not find currentUserId in state. Aborting dispatch.");
        return;
    }

    // أرسل كل شيء إلى الـ reducer
    dispatch({
        type: NEW_ADMIN_SUBCHAT_MESSAGE_SOCKET,
        payload: { ...data, currentUserId }, // ==> هذا يمرر ID المستخدم الحالي
    });
};

export const handleAdminSubChatMessagesStatusUpdatedSocket = (data) => ({ type: ADMIN_SUBCHAT_MESSAGES_STATUS_UPDATED_SOCKET, payload: data });

export const markSubChatAsReadInList = (subChatId) => ({
    type: 'MARK_SUBCHAT_AS_READ_IN_LIST',
    payload: { subChatId },
});