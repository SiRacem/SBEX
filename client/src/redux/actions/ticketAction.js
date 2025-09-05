// src/redux/actions/ticketAction.js
import axios from 'axios';
import * as types from '../actionTypes/ticketActionTypes';

// Helper function to navigate on rate limit error
const handleRateLimitError = (error, navigate) => {
    if (navigate && error.response?.data?.errorMessage?.key === 'apiErrors.tooManyRequests') {
        const resetTime = error.response.data.rateLimit?.resetTime;
        if (resetTime) {
            localStorage.setItem('rateLimitResetTime', resetTime);
        }
        navigate('/rate-limit-exceeded');
        return true; // Indicates the error was handled
    }
    return false;
};

const handleError = (error, defaultKey = 'apiErrors.unknownError') => {
    if (error.response) {
        if (error.response.data?.errorMessage?.key === 'apiErrors.tooManyRequests') {
            return {
                ...error.response.data.errorMessage,
                rateLimit: error.response.data.rateLimit
            };
        }
        if (error.response.data.translationKey) return { key: error.response.data.translationKey };
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

export const createTicketAction = (ticketData, files = [], navigate) => async (dispatch) => {
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
        if (handleRateLimitError(error, navigate)) return;
        const { key, fallback, params } = handleError(error, 'tickets.createFail');
        dispatch({ type: types.CREATE_TICKET_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const resetCreateTicketStatus = () => ({ type: types.CREATE_TICKET_RESET });

export const getUserTicketsAction = (params = {}, navigate) => async (dispatch) => {
    dispatch({ type: types.GET_USER_TICKETS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: types.GET_USER_TICKETS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.get(`${API_PREFIX}/tickets`, { ...config, params });
        dispatch({ type: types.GET_USER_TICKETS_SUCCESS, payload: data });
    } catch (error) {
        if (handleRateLimitError(error, navigate)) return;
        const { key, fallback, params } = handleError(error, 'tickets.loadUserTicketsFail');
        dispatch({ type: types.GET_USER_TICKETS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const getTicketDetailsAction = (ticketId, navigate) => async (dispatch) => {
    dispatch({ type: types.GET_TICKET_DETAILS_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: types.GET_TICKET_DETAILS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.get(`${API_PREFIX}/tickets/${ticketId}`, config);
        dispatch({ type: types.GET_TICKET_DETAILS_SUCCESS, payload: data });
    } catch (error) {
        if (handleRateLimitError(error, navigate)) return;
        const { key, fallback, params } = handleError(error, 'tickets.loadDetailsFail');
        dispatch({ type: types.GET_TICKET_DETAILS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const addTicketReplyAction = (ticketId, replyData, files = [], navigate) => async (dispatch) => {
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
        if (handleRateLimitError(error, navigate)) return;
        const { key, fallback, params } = handleError(error, 'tickets.replyFail');
        dispatch({ type: types.ADD_TICKET_REPLY_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const adminAddTicketReplyAction = (ticketId, replyData, files = [], navigate) => async (dispatch) => {
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
        if (handleRateLimitError(error, navigate)) return;
        const { key, fallback, params } = handleError(error, 'tickets.adminReplyFail');
        dispatch({ type: types.ADD_TICKET_REPLY_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const clearTicketDetailsAction = () => ({ type: types.CLEAR_TICKET_DETAILS });
export const resetAddTicketReplyStatus = () => ({ type: types.ADD_TICKET_REPLY_RESET });

export const closeTicketByUserAction = (ticketId, navigate) => async (dispatch) => {
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
        if (handleRateLimitError(error, navigate)) return;
        const { key, fallback, params } = handleError(error, 'tickets.closeFailUser');
        dispatch({ type: types.CLOSE_TICKET_BY_USER_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

// ... (rest of the admin actions will also be updated)
export const adminGetAllTicketsAction = (params = {}, navigate) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_ALL_TICKETS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_GET_ALL_TICKETS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.get(`${API_PREFIX}/panel/tickets`, { ...config, params });
        dispatch({ type: types.ADMIN_GET_ALL_TICKETS_SUCCESS, payload: data });
    } catch (error) {
        if (handleRateLimitError(error, navigate)) return;
        const { key, fallback, params } = handleError(error, 'admin.tickets.loadFail');
        dispatch({ type: types.ADMIN_GET_ALL_TICKETS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminGetTicketDetailsAction = (ticketId, navigate) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_TICKET_DETAILS_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: types.ADMIN_GET_TICKET_DETAILS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    }
    try {
        const { data } = await axios.get(`${API_PREFIX}/panel/tickets/${ticketId}`, config);
        dispatch({ type: types.GET_TICKET_DETAILS_SUCCESS, payload: data }); // Reuses the same success type
    } catch (error) {
        if (handleRateLimitError(error, navigate)) return;
        const { key, fallback, params } = handleError(error, 'admin.tickets.loadDetailsFail');
        dispatch({ type: types.ADMIN_GET_TICKET_DETAILS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminUpdateTicketStatusAction = (ticketId, statusData, navigate) => async (dispatch) => {
    dispatch({ type: types.ADMIN_UPDATE_TICKET_STATUS_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_UPDATE_TICKET_STATUS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`${API_PREFIX}/panel/tickets/${ticketId}/status`, statusData, config);
        dispatch({ type: types.ADMIN_UPDATE_TICKET_STATUS_SUCCESS, payload: { ticketId, updatedTicket: data.ticket, successMessage: 'admin.tickets.statusUpdateSuccess' } });
    } catch (error) {
        if (handleRateLimitError(error, navigate)) return;
        const { key, fallback, params } = handleError(error, 'admin.tickets.statusUpdateFail');
        dispatch({ type: types.ADMIN_UPDATE_TICKET_STATUS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminUpdateTicketPriorityAction = (ticketId, priorityData, navigate) => async (dispatch) => {
    dispatch({ type: types.ADMIN_UPDATE_TICKET_PRIORITY_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_UPDATE_TICKET_PRIORITY_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`${API_PREFIX}/panel/tickets/${ticketId}/priority`, priorityData, config);
        dispatch({ type: types.ADMIN_UPDATE_TICKET_PRIORITY_SUCCESS, payload: { ticketId, updatedTicket: data.ticket, successMessage: 'admin.tickets.priorityUpdateSuccess' } });
    } catch (error) {
        if (handleRateLimitError(error, navigate)) return;
        const { key, fallback, params } = handleError(error, 'admin.tickets.priorityUpdateFail');
        dispatch({ type: types.ADMIN_UPDATE_TICKET_PRIORITY_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminAssignTicketAction = (ticketId, assignmentData, navigate) => async (dispatch) => {
    dispatch({ type: types.ADMIN_ASSIGN_TICKET_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_ASSIGN_TICKET_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`${API_PREFIX}/panel/tickets/${ticketId}/assign`, assignmentData, config);
        dispatch({ type: types.ADMIN_ASSIGN_TICKET_SUCCESS, payload: { ticketId, updatedTicket: data.ticket, successMessage: 'admin.tickets.assignSuccess' } });
    } catch (error) {
        if (handleRateLimitError(error, navigate)) return;
        const { key, fallback, params } = handleError(error, 'admin.tickets.assignFail');
        dispatch({ type: types.ADMIN_ASSIGN_TICKET_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const clearTicketErrors = () => ({ type: types.CLEAR_TICKET_ERRORS });