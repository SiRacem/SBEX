// src/redux/actions/ticketAction.js
import axios from 'axios';
import * as types from '../actionTypes/ticketActionTypes';

// [!!!] دالة مساعدة جديدة لمعالجة الأخطاء وإرجاع مفتاح ترجمة [!!!]
const handleError = (error, defaultKey = 'apiErrors.unknownError') => {
    if (error.response) {
        if (error.response.data.translationKey) return { key: error.response.data.translationKey };
        if (error.response.data.msg) {
            const fallback = error.response.data.msg;
            // نحول رسالة الخطأ إلى مفتاح (مثال: "Auth required." -> "apiErrors.Auth_required")
            const key = `apiErrors.${fallback.replace(/\s+/g, '_').replace(/[!'.]/g, '')}`;
            return { key, fallback };
        }
        return { key: 'apiErrors.requestFailedWithCode', params: { code: error.response.status } };
    } else if (error.request) {
        return { key: 'apiErrors.networkError' };
    }
    return { key: defaultKey, params: { message: error.message } };
};

const getTokenConfig = (isFormData = false) => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const headers = { 'Authorization': `Bearer ${token}` };
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    return { headers };
};

const API_PREFIX = '/support';

// --- إنشاء تذكرة جديدة ---
export const createTicketAction = (ticketData, files = []) => async (dispatch) => {
    dispatch({ type: types.CREATE_TICKET_REQUEST });
    const config = getTokenConfig(true);
    if (!config) {
        const errorMessage = { key: 'apiErrors.notAuthorized' };
        dispatch({ type: types.CREATE_TICKET_FAIL, payload: { errorMessage } });
        return Promise.reject(new Error("Authorization required."));
    }

    const formData = new FormData();
    formData.append('title', ticketData.title);
    formData.append('description', ticketData.description);
    formData.append('category', ticketData.category);
    if (ticketData.priority) formData.append('priority', ticketData.priority);
    if (files && files.length > 0) {
        files.forEach(file => formData.append('attachments', file));
    }

    try {
        const { data } = await axios.post(`${API_PREFIX}/tickets`, formData, config);
        dispatch({ type: types.CREATE_TICKET_SUCCESS, payload: { ...data.ticket, successMessage: 'tickets.createSuccess' } });
        return data.ticket;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'tickets.createFail');
        dispatch({ type: types.CREATE_TICKET_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const resetCreateTicketStatus = () => ({ type: types.CREATE_TICKET_RESET });

// --- جلب تذاكر المستخدم الحالي ---
export const getUserTicketsAction = (params = {}) => async (dispatch) => {
    dispatch({ type: types.GET_USER_TICKETS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: types.GET_USER_TICKETS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.get(`${API_PREFIX}/tickets`, { ...config, params });
        dispatch({ type: types.GET_USER_TICKETS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'tickets.loadUserTicketsFail');
        dispatch({ type: types.GET_USER_TICKETS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

// --- جلب تفاصيل تذكرة معينة ---
export const getTicketDetailsAction = (ticketId) => async (dispatch) => {
    dispatch({ type: types.GET_TICKET_DETAILS_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: types.GET_TICKET_DETAILS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.get(`${API_PREFIX}/tickets/${ticketId}`, config);
        dispatch({ type: types.GET_TICKET_DETAILS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'tickets.loadDetailsFail');
        dispatch({ type: types.GET_TICKET_DETAILS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

// --- إضافة رد على تذكرة ---
export const addTicketReplyAction = (ticketId, replyData, files = []) => async (dispatch) => {
    dispatch({ type: types.ADD_TICKET_REPLY_REQUEST, payload: { ticketId } });
    const config = getTokenConfig(true);
    if (!config) {
        return dispatch({ type: types.ADD_TICKET_REPLY_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    const formData = new FormData();
    formData.append('message', replyData.message);
    if (files && files.length > 0) {
        files.forEach(file => formData.append('attachments', file));
    }
    try {
        const { data } = await axios.post(`${API_PREFIX}/tickets/${ticketId}/replies`, formData, config);
        dispatch({ type: types.ADD_TICKET_REPLY_SUCCESS, payload: { reply: data.reply, ticketId, updatedTicketStatus: data.updatedTicketStatus } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'tickets.replyFail');
        dispatch({ type: types.ADD_TICKET_REPLY_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

// --- إضافة رد على تذكرة من قبل الأدمن ---
export const adminAddTicketReplyAction = (ticketId, replyData, files = []) => async (dispatch) => {
    dispatch({ type: types.ADD_TICKET_REPLY_REQUEST, payload: { ticketId } });
    const config = getTokenConfig(true);
    if (!config) {
        return dispatch({ type: types.ADD_TICKET_REPLY_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    }
    const formData = new FormData();
    formData.append('message', replyData.message);
    if (files && files.length > 0) {
        files.forEach(file => formData.append('attachments', file));
    }
    try {
        const { data } = await axios.post(`${API_PREFIX}/panel/tickets/${ticketId}/replies`, formData, config);
        dispatch({ type: types.ADD_TICKET_REPLY_SUCCESS, payload: { reply: data.reply, ticketId, updatedTicketStatus: data.updatedTicketStatus } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'tickets.adminReplyFail');
        dispatch({ type: types.ADD_TICKET_REPLY_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const clearTicketDetailsAction = () => ({ type: types.CLEAR_TICKET_DETAILS });
export const resetAddTicketReplyStatus = () => ({ type: types.ADD_TICKET_REPLY_RESET });

// --- المستخدم يغلق تذكرته ---
export const closeTicketByUserAction = (ticketId) => async (dispatch) => {
    dispatch({ type: types.CLOSE_TICKET_BY_USER_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: types.CLOSE_TICKET_BY_USER_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.put(`${API_PREFIX}/tickets/${ticketId}/close`, {}, config);
        dispatch({ type: types.CLOSE_TICKET_BY_USER_SUCCESS, payload: { ticketId, updatedTicket: data.ticket, successMessage: 'tickets.closeSuccessUser' } });
        return data.ticket;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'tickets.closeFailUser');
        dispatch({ type: types.CLOSE_TICKET_BY_USER_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

// --- Admin/Support Actions ---
export const adminGetAllTicketsAction = (params = {}) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_ALL_TICKETS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_GET_ALL_TICKETS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.get(`${API_PREFIX}/panel/tickets`, { ...config, params });
        dispatch({ type: types.ADMIN_GET_ALL_TICKETS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.tickets.loadFail');
        dispatch({ type: types.ADMIN_GET_ALL_TICKETS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminGetTicketDetailsAction = (ticketId) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_TICKET_DETAILS_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: types.ADMIN_GET_TICKET_DETAILS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    }
    try {
        const { data } = await axios.get(`${API_PREFIX}/panel/tickets/${ticketId}`, config);
        dispatch({ type: types.GET_TICKET_DETAILS_SUCCESS, payload: data }); // Reuses the same success type
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.tickets.loadDetailsFail');
        dispatch({ type: types.ADMIN_GET_TICKET_DETAILS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminUpdateTicketStatusAction = (ticketId, statusData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_UPDATE_TICKET_STATUS_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_UPDATE_TICKET_STATUS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`${API_PREFIX}/panel/tickets/${ticketId}/status`, statusData, config);
        dispatch({ type: types.ADMIN_UPDATE_TICKET_STATUS_SUCCESS, payload: { ticketId, updatedTicket: data.ticket, successMessage: 'admin.tickets.statusUpdateSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.tickets.statusUpdateFail');
        dispatch({ type: types.ADMIN_UPDATE_TICKET_STATUS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminUpdateTicketPriorityAction = (ticketId, priorityData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_UPDATE_TICKET_PRIORITY_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_UPDATE_TICKET_PRIORITY_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`${API_PREFIX}/panel/tickets/${ticketId}/priority`, priorityData, config);
        dispatch({ type: types.ADMIN_UPDATE_TICKET_PRIORITY_SUCCESS, payload: { ticketId, updatedTicket: data.ticket, successMessage: 'admin.tickets.priorityUpdateSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.tickets.priorityUpdateFail');
        dispatch({ type: types.ADMIN_UPDATE_TICKET_PRIORITY_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminAssignTicketAction = (ticketId, assignmentData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_ASSIGN_TICKET_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_ASSIGN_TICKET_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`${API_PREFIX}/panel/tickets/${ticketId}/assign`, assignmentData, config);
        dispatch({ type: types.ADMIN_ASSIGN_TICKET_SUCCESS, payload: { ticketId, updatedTicket: data.ticket, successMessage: 'admin.tickets.assignSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.tickets.assignFail');
        dispatch({ type: types.ADMIN_ASSIGN_TICKET_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const clearTicketErrors = () => ({ type: types.CLEAR_TICKET_ERRORS });