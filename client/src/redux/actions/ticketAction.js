// src/redux/actions/ticketAction.js
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    CREATE_TICKET_REQUEST, CREATE_TICKET_SUCCESS, CREATE_TICKET_FAIL, CREATE_TICKET_RESET,
    GET_USER_TICKETS_REQUEST, GET_USER_TICKETS_SUCCESS, GET_USER_TICKETS_FAIL,
    GET_TICKET_DETAILS_REQUEST, GET_TICKET_DETAILS_SUCCESS, GET_TICKET_DETAILS_FAIL, CLEAR_TICKET_DETAILS,
    ADD_TICKET_REPLY_REQUEST, ADD_TICKET_REPLY_SUCCESS, ADD_TICKET_REPLY_FAIL, ADD_TICKET_REPLY_RESET,
    CLOSE_TICKET_BY_USER_REQUEST, CLOSE_TICKET_BY_USER_SUCCESS, CLOSE_TICKET_BY_USER_FAIL,
    ADMIN_GET_ALL_TICKETS_REQUEST, ADMIN_GET_ALL_TICKETS_SUCCESS, ADMIN_GET_ALL_TICKETS_FAIL,
    ADMIN_UPDATE_TICKET_STATUS_REQUEST, ADMIN_UPDATE_TICKET_STATUS_SUCCESS, ADMIN_UPDATE_TICKET_STATUS_FAIL,
    ADMIN_UPDATE_TICKET_PRIORITY_REQUEST, ADMIN_UPDATE_TICKET_PRIORITY_SUCCESS, ADMIN_UPDATE_TICKET_PRIORITY_FAIL,
    ADMIN_ASSIGN_TICKET_REQUEST, ADMIN_ASSIGN_TICKET_SUCCESS, ADMIN_ASSIGN_TICKET_FAIL, CLEAR_TICKET_ERRORS,
    ADMIN_GET_TICKET_DETAILS_REQUEST, ADMIN_GET_TICKET_DETAILS_SUCCESS, ADMIN_GET_TICKET_DETAILS_FAIL
} from '../actionTypes/ticketActionTypes';

// Helper للحصول على التوكن وإعدادات الطلب
const getTokenConfig = (isFormData = false) => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const headers = { 'Authorization': `Bearer ${token}` };
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    return { headers };
};

const API_PREFIX = '/support'; // البادئة المستخدمة في server.js

// --- إنشاء تذكرة جديدة ---
export const createTicketAction = (ticketData, files = []) => async (dispatch) => {
    dispatch({ type: CREATE_TICKET_REQUEST });
    const config = getTokenConfig(true);
    if (!config) {
        dispatch({ type: CREATE_TICKET_FAIL, payload: "Authorization required." });
        toast.error("Please login to create a ticket.");
        return Promise.reject(new Error("Authorization required."));
    }

    const formData = new FormData();
    formData.append('title', ticketData.title);
    formData.append('description', ticketData.description);
    formData.append('category', ticketData.category);
    if (ticketData.priority) formData.append('priority', ticketData.priority);

    if (files && files.length > 0) {
        files.forEach(file => {
            formData.append('attachments', file);
        });
    }

    try {
        const { data } = await axios.post(`${API_PREFIX}/tickets`, formData, config);
        dispatch({ type: CREATE_TICKET_SUCCESS, payload: data.ticket });
        toast.success(data.msg || "Ticket created successfully!");
        return data.ticket;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to create ticket.";
        dispatch({ type: CREATE_TICKET_FAIL, payload: message });
        toast.error(message);
        throw error;
    }
};

export const resetCreateTicketStatus = () => ({ type: CREATE_TICKET_RESET });

// --- جلب تذاكر المستخدم الحالي ---
export const getUserTicketsAction = (params = {}) => async (dispatch) => {
    dispatch({ type: GET_USER_TICKETS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: GET_USER_TICKETS_FAIL, payload: "Auth required." });
        return;
    }

    try {
        const { data } = await axios.get(`${API_PREFIX}/tickets`, { ...config, params });
        dispatch({ type: GET_USER_TICKETS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to fetch tickets.";
        dispatch({ type: GET_USER_TICKETS_FAIL, payload: message });
        toast.error(message);
    }
};

// --- جلب تفاصيل تذكرة معينة ---
export const getTicketDetailsAction = (ticketId) => async (dispatch) => {
    dispatch({ type: GET_TICKET_DETAILS_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: GET_TICKET_DETAILS_FAIL, payload: "Auth required." });
        return;
    }

    try {
        const { data } = await axios.get(`${API_PREFIX}/tickets/${ticketId}`, config);
        dispatch({ type: GET_TICKET_DETAILS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to fetch ticket details.";
        dispatch({ type: GET_TICKET_DETAILS_FAIL, payload: message });
        if (error.response?.status === 403) {
            toast.error("Access Denied: You do not have permission to view this ticket.");
        } else if (error.response?.status === 404) {
            toast.error("Ticket not found.");
        } else {
            toast.error(message);
        }
    }
};

// --- إضافة رد على تذكرة ---
export const addTicketReplyAction = (ticketId, replyData, files = []) => async (dispatch) => {
    dispatch({ type: ADD_TICKET_REPLY_REQUEST, payload: { ticketId } });
    const config = getTokenConfig(true); // isFormData is true
    if (!config) {
        dispatch({ type: ADD_TICKET_REPLY_FAIL, payload: "Auth required." });
        toast.error("Please login to reply.");
        return Promise.reject(new Error("Auth required."));
    }

    const formData = new FormData();
    formData.append('message', replyData.message);
    if (files && files.length > 0) {
        files.forEach(file => formData.append('attachments', file));
    }

    try {
        const { data } = await axios.post(`${API_PREFIX}/tickets/${ticketId}/replies`, formData, config);
        dispatch({
            type: ADD_TICKET_REPLY_SUCCESS,
            payload: {
                reply: data.reply,
                ticketId: ticketId,
                updatedTicketStatus: data.updatedTicketStatus
            }
        });
        // الـ toast سيظهر في المكون
    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to add reply.";
        dispatch({ type: ADD_TICKET_REPLY_FAIL, payload: message });
        toast.error(message);
        throw error;
    }
};

// --- إضافة رد على تذكرة من قبل الأدمن ---
export const adminAddTicketReplyAction = (ticketId, replyData, files = []) => async (dispatch) => {
    dispatch({ type: ADD_TICKET_REPLY_REQUEST, payload: { ticketId } });
    const config = getTokenConfig(true); // isFormData is true
    if (!config) {
        dispatch({ type: ADD_TICKET_REPLY_FAIL, payload: "Auth required." });
        toast.error("Please login to reply.");
        return Promise.reject(new Error("Auth required."));
    }

    const formData = new FormData();
    formData.append('message', replyData.message);
    if (files && files.length > 0) {
        files.forEach(file => formData.append('attachments', file));
    }

    try {
        const { data } = await axios.post(`${API_PREFIX}/panel/tickets/${ticketId}/replies`, formData, config);
        dispatch({
            type: ADD_TICKET_REPLY_SUCCESS,
            payload: {
                reply: data.reply,
                ticketId: ticketId,
                updatedTicketStatus: data.updatedTicketStatus
            }
        });
        // الـ toast سيظهر في المكون
    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to add reply as support.";
        dispatch({ type: ADD_TICKET_REPLY_FAIL, payload: message });
        toast.error(message);
        throw error;
    }
};

export const clearTicketDetailsAction = () => ({ type: CLEAR_TICKET_DETAILS });
export const resetAddTicketReplyStatus = () => ({ type: ADD_TICKET_REPLY_RESET });

// --- المستخدم يغلق تذكرته ---
export const closeTicketByUserAction = (ticketId) => async (dispatch) => {
    dispatch({ type: CLOSE_TICKET_BY_USER_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: CLOSE_TICKET_BY_USER_FAIL, payload: "Auth required." });
        return Promise.reject(new Error("Auth required."));
    }

    try {
        const { data } = await axios.put(`${API_PREFIX}/tickets/${ticketId}/close`, {}, config);
        dispatch({ type: CLOSE_TICKET_BY_USER_SUCCESS, payload: { ticketId: ticketId, updatedTicket: data.ticket } });
        toast.success(data.msg || "Ticket closed successfully.");
        return data.ticket;
    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to close ticket.";
        dispatch({ type: CLOSE_TICKET_BY_USER_FAIL, payload: message });
        toast.error(message);
        throw error;
    }
};

// --- Admin/Support Actions ---
export const adminGetAllTicketsAction = (params = {}) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_ALL_TICKETS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_GET_ALL_TICKETS_FAIL, payload: "Auth required." });

    try {
        const { data } = await axios.get(`${API_PREFIX}/panel/tickets`, { ...config, params });
        dispatch({ type: ADMIN_GET_ALL_TICKETS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to fetch admin tickets.";
        dispatch({ type: ADMIN_GET_ALL_TICKETS_FAIL, payload: message });
        toast.error(message);
    }
};

export const adminUpdateTicketStatusAction = (ticketId, statusData) => async (dispatch) => {
    dispatch({ type: ADMIN_UPDATE_TICKET_STATUS_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_UPDATE_TICKET_STATUS_FAIL, payload: "Auth required." });

    try {
        const { data } = await axios.put(`${API_PREFIX}/panel/tickets/${ticketId}/status`, statusData, config);
        dispatch({ type: ADMIN_UPDATE_TICKET_STATUS_SUCCESS, payload: { ticketId: ticketId, updatedTicket: data.ticket } });
        toast.success(data.msg || `Ticket status updated to ${statusData.status}.`);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to update ticket status.";
        dispatch({ type: ADMIN_UPDATE_TICKET_STATUS_FAIL, payload: message });
        toast.error(message);
    }
};

export const adminGetTicketDetailsAction = (ticketId) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_TICKET_DETAILS_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADMIN_GET_TICKET_DETAILS_FAIL, payload: "Auth required." });
        toast.error("Authentication required.");
        return;
    }

    try {
        const { data } = await axios.get(`${API_PREFIX}/panel/tickets/${ticketId}`, config);
        dispatch({ type: GET_TICKET_DETAILS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || "Failed to fetch ticket details for admin.";
        dispatch({ type: ADMIN_GET_TICKET_DETAILS_FAIL, payload: message });
        toast.error(message);
    }
};

export const adminUpdateTicketPriorityAction = (ticketId, priorityData) => async (dispatch) => {
    dispatch({ type: ADMIN_UPDATE_TICKET_PRIORITY_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_UPDATE_TICKET_PRIORITY_FAIL, payload: "Auth required." });
    try {
        const { data } = await axios.put(`${API_PREFIX}/panel/tickets/${ticketId}/priority`, priorityData, config);
        dispatch({ type: ADMIN_UPDATE_TICKET_PRIORITY_SUCCESS, payload: { ticketId, updatedTicket: data.ticket } });
        toast.success(data.msg || "Ticket priority updated.");
    } catch (error) {
        const message = error.response?.data?.msg || "Failed to update priority.";
        dispatch({ type: ADMIN_UPDATE_TICKET_PRIORITY_FAIL, payload: message });
        toast.error(message);
    }
};

export const adminAssignTicketAction = (ticketId, assignmentData) => async (dispatch) => {
    dispatch({ type: ADMIN_ASSIGN_TICKET_REQUEST, payload: { ticketId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_ASSIGN_TICKET_FAIL, payload: "Auth required." });
    try {
        const { data } = await axios.put(`${API_PREFIX}/panel/tickets/${ticketId}/assign`, assignmentData, config);
        dispatch({ type: ADMIN_ASSIGN_TICKET_SUCCESS, payload: { ticketId, updatedTicket: data.ticket } });
        toast.success(data.msg || "Ticket assignment updated.");
    } catch (error) {
        const message = error.response?.data?.msg || "Failed to assign ticket.";
        dispatch({ type: ADMIN_ASSIGN_TICKET_FAIL, payload: message });
        toast.error(message);
    }
};

export const clearTicketErrors = () => ({ type: CLEAR_TICKET_ERRORS });