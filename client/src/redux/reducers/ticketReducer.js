// src/redux/reducers/ticketReducer.js
import {
    CREATE_TICKET_REQUEST, CREATE_TICKET_SUCCESS, CREATE_TICKET_FAIL, CREATE_TICKET_RESET,
    GET_USER_TICKETS_REQUEST, GET_USER_TICKETS_SUCCESS, GET_USER_TICKETS_FAIL,
    GET_TICKET_DETAILS_REQUEST, GET_TICKET_DETAILS_SUCCESS, GET_TICKET_DETAILS_FAIL, CLEAR_TICKET_DETAILS,
    ADD_TICKET_REPLY_REQUEST, ADD_TICKET_REPLY_SUCCESS, ADD_TICKET_REPLY_FAIL, ADD_TICKET_REPLY_RESET,
    CLOSE_TICKET_BY_USER_REQUEST, CLOSE_TICKET_BY_USER_SUCCESS, CLOSE_TICKET_BY_USER_FAIL,
    ADMIN_GET_ALL_TICKETS_REQUEST, ADMIN_GET_ALL_TICKETS_SUCCESS, ADMIN_GET_ALL_TICKETS_FAIL,
    ADMIN_GET_TICKET_DETAILS_REQUEST, ADMIN_GET_TICKET_DETAILS_SUCCESS, ADMIN_GET_TICKET_DETAILS_FAIL,
    ADMIN_UPDATE_TICKET_STATUS_REQUEST, ADMIN_UPDATE_TICKET_STATUS_SUCCESS, ADMIN_UPDATE_TICKET_STATUS_FAIL,
    ADMIN_UPDATE_TICKET_PRIORITY_REQUEST, ADMIN_UPDATE_TICKET_PRIORITY_SUCCESS, ADMIN_UPDATE_TICKET_PRIORITY_FAIL,
    ADMIN_ASSIGN_TICKET_REQUEST, ADMIN_ASSIGN_TICKET_SUCCESS, ADMIN_ASSIGN_TICKET_FAIL,
    CLEAR_TICKET_ERRORS, ADMIN_ADD_NEW_TICKET_REALTIME, UPDATE_TICKET_DETAILS_REALTIME,
    REALTIME_ADD_TICKET_REPLY
} from '../actionTypes/ticketActionTypes';

const initialState = {
    loadingCreate: false,
    successCreate: false,
    errorCreate: null,
    createdTicket: null,
    userTickets: [],
    loadingUserTickets: false,
    errorUserTickets: null,
    userTicketsPagination: {},
    activeTicketDetails: null,
    activeTicketReplies: [],
    loadingTicketDetails: false,
    errorTicketDetails: null,
    loadingAddReply: false,
    successAddReply: false,
    errorAddReply: null,
    loadingCloseTicket: false,
    errorCloseTicket: null,
    adminTickets: [],
    loadingAdminTickets: false,
    errorAdminTickets: null,
    adminTicketsPagination: {},
    loadingAdminUpdate: false,
    errorAdminUpdate: null,
    successAdminUpdate: false,
};

export const ticketReducer = (state = initialState, action) => {
    switch (action.type) {
        case CREATE_TICKET_REQUEST:
            return { ...state, loadingCreate: true, successCreate: false, errorCreate: null, createdTicket: null };
        case CREATE_TICKET_SUCCESS:
            return { ...state, loadingCreate: false, successCreate: true, createdTicket: action.payload };
        case CREATE_TICKET_FAIL:
            return { ...state, loadingCreate: false, errorCreate: action.payload };
        case CREATE_TICKET_RESET:
            return { ...state, loadingCreate: false, successCreate: false, errorCreate: null, createdTicket: null };

        case GET_USER_TICKETS_REQUEST:
            return { ...state, loadingUserTickets: true, errorUserTickets: null };
        case GET_USER_TICKETS_SUCCESS:
            return {
                ...state,
                loadingUserTickets: false,
                userTickets: action.payload.docs,
                userTicketsPagination: {
                    totalDocs: action.payload.totalDocs, limit: action.payload.limit, page: action.payload.page,
                    totalPages: action.payload.totalPages, hasNextPage: action.payload.hasNextPage, hasPrevPage: action.payload.hasPrevPage,
                }
            };
        case GET_USER_TICKETS_FAIL:
            return { ...state, loadingUserTickets: false, errorUserTickets: action.payload, userTickets: [] };

        case GET_TICKET_DETAILS_REQUEST:
        case ADMIN_GET_TICKET_DETAILS_REQUEST:
            return { ...state, loadingTicketDetails: true, errorTicketDetails: null, activeTicketDetails: null, activeTicketReplies: [] };

        case GET_TICKET_DETAILS_SUCCESS:
        case ADMIN_GET_TICKET_DETAILS_SUCCESS:
            return {
                ...state,
                loadingTicketDetails: false,
                activeTicketDetails: action.payload.ticket,
                activeTicketReplies: action.payload.replies || []
            };

        case GET_TICKET_DETAILS_FAIL:
        case ADMIN_GET_TICKET_DETAILS_FAIL:
            return { ...state, loadingTicketDetails: false, errorTicketDetails: action.payload };

        case CLEAR_TICKET_DETAILS:
            return { ...state, activeTicketDetails: null, activeTicketReplies: [], errorTicketDetails: null, loadingTicketDetails: false };

        case ADD_TICKET_REPLY_REQUEST:
            return { ...state, loadingAddReply: true, successAddReply: false, errorAddReply: null };
        case ADD_TICKET_REPLY_SUCCESS:
            const replyExists = state.activeTicketReplies.some(r => r._id === action.payload.reply._id);
            return {
                ...state,
                loadingAddReply: false,
                successAddReply: true,
                activeTicketReplies: replyExists ? state.activeTicketReplies : [...state.activeTicketReplies, action.payload.reply],
                activeTicketDetails: state.activeTicketDetails && state.activeTicketDetails._id === action.payload.ticketId
                    ? { ...state.activeTicketDetails, status: action.payload.updatedTicketStatus, lastReplyAt: action.payload.reply.createdAt, lastRepliedBy: action.payload.reply.user }
                    : state.activeTicketDetails,
                userTickets: state.userTickets.map(ticket =>
                    ticket._id === action.payload.ticketId
                        ? { ...ticket, status: action.payload.updatedTicketStatus, lastReplyAt: action.payload.reply.createdAt, lastRepliedBy: action.payload.reply.user }
                        : ticket
                ),
                adminTickets: state.adminTickets.map(ticket =>
                    ticket._id === action.payload.ticketId
                        ? { ...ticket, status: action.payload.updatedTicketStatus, lastReplyAt: action.payload.reply.createdAt, lastRepliedBy: action.payload.reply.user }
                        : ticket
                )
            };
        case ADD_TICKET_REPLY_FAIL:
            return { ...state, loadingAddReply: false, errorAddReply: action.payload };
        case ADD_TICKET_REPLY_RESET:
            return { ...state, loadingAddReply: false, successAddReply: false, errorAddReply: null };

        case REALTIME_ADD_TICKET_REPLY:
            if (state.activeTicketDetails && state.activeTicketDetails._id === action.payload.ticketId && !state.activeTicketReplies.find(r => r._id === action.payload.reply._id)) {
                return {
                    ...state,
                    activeTicketReplies: [...state.activeTicketReplies, action.payload.reply],
                    activeTicketDetails: {
                        ...state.activeTicketDetails,
                        lastReplyAt: action.payload.reply.createdAt,
                        lastRepliedBy: action.payload.reply.user,
                        status: action.payload.updatedTicketStatus || state.activeTicketDetails.status,
                    },
                    userTickets: state.userTickets.map(ticket =>
                        ticket._id === action.payload.ticketId
                            ? { ...ticket, status: action.payload.updatedTicketStatus || ticket.status, lastReplyAt: action.payload.reply.createdAt, lastRepliedBy: action.payload.reply.user }
                            : ticket
                    ),
                    adminTickets: state.adminTickets.map(ticket =>
                        ticket._id === action.payload.ticketId
                            ? { ...ticket, status: action.payload.updatedTicketStatus || ticket.status, lastReplyAt: action.payload.reply.createdAt, lastRepliedBy: action.payload.reply.user }
                            : ticket
                    )
                };
            }
            return state;

        case CLOSE_TICKET_BY_USER_REQUEST:
            return { ...state, loadingCloseTicket: true, errorCloseTicket: null };

        // [!!!] START: هذا هو الإصلاح النهائي [!!!]
        case CLOSE_TICKET_BY_USER_SUCCESS:
            const updatedTicketOnUserClose = action.payload.updatedTicket;
            return {
                ...state,
                loadingCloseTicket: false,
                // تحديث التفاصيل إذا كانت هذه هي التذكرة النشطة
                activeTicketDetails: state.activeTicketDetails && state.activeTicketDetails._id === updatedTicketOnUserClose._id
                    ? { ...state.activeTicketDetails, status: 'Closed', closedAt: updatedTicketOnUserClose.closedAt }
                    : state.activeTicketDetails,
                // تحديث التذكرة في قائمة تذاكر المستخدم
                userTickets: state.userTickets.map(t => t._id === updatedTicketOnUserClose._id ? { ...t, status: 'Closed', closedAt: updatedTicketOnUserClose.closedAt } : t),
                // تحديث التذكرة في قائمة تذاكر المسؤول (للتناسق)
                adminTickets: state.adminTickets.map(t => t._id === updatedTicketOnUserClose._id ? { ...t, status: 'Closed', closedAt: updatedTicketOnUserClose.closedAt } : t)
            };
        // [!!!] END: نهاية الإصلاح النهائي [!!!]

        case CLOSE_TICKET_BY_USER_FAIL:
            return { ...state, loadingCloseTicket: false, errorCloseTicket: action.payload };

        case ADMIN_GET_ALL_TICKETS_REQUEST:
            return { ...state, loadingAdminTickets: true, errorAdminTickets: null };
        case ADMIN_GET_ALL_TICKETS_SUCCESS:
            return {
                ...state,
                loadingAdminTickets: false,
                adminTickets: action.payload.docs,
                adminTicketsPagination: {
                    totalDocs: action.payload.totalDocs, limit: action.payload.limit, page: action.payload.page,
                    totalPages: action.payload.totalPages, hasNextPage: action.payload.hasNextPage, hasPrevPage: action.payload.hasPrevPage,
                }
            };
        case ADMIN_GET_ALL_TICKETS_FAIL:
            return { ...state, loadingAdminTickets: false, errorAdminTickets: action.payload, adminTickets: [] };

        case ADMIN_UPDATE_TICKET_STATUS_REQUEST:
        case ADMIN_UPDATE_TICKET_PRIORITY_REQUEST:
        case ADMIN_ASSIGN_TICKET_REQUEST:
            return { ...state, loadingAdminUpdate: true, errorAdminUpdate: null, successAdminUpdate: false };

        case ADMIN_UPDATE_TICKET_STATUS_SUCCESS:
        case ADMIN_UPDATE_TICKET_PRIORITY_SUCCESS:
        case ADMIN_ASSIGN_TICKET_SUCCESS:
            const updatedTicketByAdmin = action.payload.updatedTicket;
            return {
                ...state,
                loadingAdminUpdate: false,
                successAdminUpdate: true,
                activeTicketDetails: state.activeTicketDetails && state.activeTicketDetails._id === updatedTicketByAdmin._id
                    ? updatedTicketByAdmin
                    : state.activeTicketDetails,
                adminTickets: state.adminTickets.map(t => t._id === updatedTicketByAdmin._id ? updatedTicketByAdmin : t),
                userTickets: state.userTickets.map(t => t._id === updatedTicketByAdmin._id ? updatedTicketByAdmin : t)
            };

        case ADMIN_UPDATE_TICKET_STATUS_FAIL:
        case ADMIN_UPDATE_TICKET_PRIORITY_FAIL:
        case ADMIN_ASSIGN_TICKET_FAIL:
            return { ...state, loadingAdminUpdate: false, errorAdminUpdate: action.payload, successAdminUpdate: false };

        case CLEAR_TICKET_ERRORS:
            return {
                ...state,
                errorCreate: null, errorUserTickets: null, errorTicketDetails: null,
                errorAddReply: null, errorCloseTicket: null, errorAdminTickets: null,
                errorAdminUpdate: null,
            };

        case ADMIN_ADD_NEW_TICKET_REALTIME:
            const ticketExists = state.adminTickets.some(ticket => ticket._id === action.payload._id);
            if (ticketExists) {
                return state;
            }
            return {
                ...state,
                adminTickets: [action.payload, ...state.adminTickets],
                adminTicketsPagination: {
                    ...state.adminTicketsPagination,
                    totalDocs: (state.adminTicketsPagination.totalDocs || 0) + 1,
                }
            };

        case UPDATE_TICKET_DETAILS_REALTIME:
            const updatedTicket = action.payload;
            return {
                ...state,
                activeTicketDetails: state.activeTicketDetails && state.activeTicketDetails._id === updatedTicket._id
                    ? updatedTicket
                    : state.activeTicketDetails,
                adminTickets: state.adminTickets.map(t =>
                    t._id === updatedTicket._id ? updatedTicket : t
                ),
                userTickets: state.userTickets.map(t =>
                    t._id === updatedTicket._id ? updatedTicket : t
                ),
            };

        default:
            return state;
    }
};