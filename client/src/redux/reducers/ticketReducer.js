// src/redux/reducers/ticketReducer.js
import {
    CREATE_TICKET_REQUEST, CREATE_TICKET_SUCCESS, CREATE_TICKET_FAIL, CREATE_TICKET_RESET,
    GET_USER_TICKETS_REQUEST, GET_USER_TICKETS_SUCCESS, GET_USER_TICKETS_FAIL,
    GET_TICKET_DETAILS_REQUEST, GET_TICKET_DETAILS_SUCCESS, GET_TICKET_DETAILS_FAIL, CLEAR_TICKET_DETAILS,
    ADD_TICKET_REPLY_REQUEST, ADD_TICKET_REPLY_SUCCESS, ADD_TICKET_REPLY_FAIL, ADD_TICKET_REPLY_RESET,
    CLOSE_TICKET_BY_USER_REQUEST, CLOSE_TICKET_BY_USER_SUCCESS, CLOSE_TICKET_BY_USER_FAIL,
    ADMIN_GET_ALL_TICKETS_REQUEST, ADMIN_GET_ALL_TICKETS_SUCCESS, ADMIN_GET_ALL_TICKETS_FAIL,
    ADMIN_GET_TICKET_DETAILS_REQUEST, ADMIN_GET_TICKET_DETAILS_SUCCESS, ADMIN_GET_TICKET_DETAILS_FAIL, // Action types للأدمن
    ADMIN_UPDATE_TICKET_STATUS_REQUEST, ADMIN_UPDATE_TICKET_STATUS_SUCCESS, ADMIN_UPDATE_TICKET_STATUS_FAIL,
    ADMIN_UPDATE_TICKET_PRIORITY_REQUEST, ADMIN_UPDATE_TICKET_PRIORITY_SUCCESS, ADMIN_UPDATE_TICKET_PRIORITY_FAIL,
    ADMIN_ASSIGN_TICKET_REQUEST, ADMIN_ASSIGN_TICKET_SUCCESS, ADMIN_ASSIGN_TICKET_FAIL,
    CLEAR_TICKET_ERRORS,
    // افترض أنك أضفت هذا في actionTypes.js
    // import { REALTIME_ADD_TICKET_REPLY } from '../actionTypes/ticketActionTypes';
    REALTIME_ADD_TICKET_REPLY // استخدام السلسلة مباشرة هنا للتبسيط، أو استيرادها
} from '../actionTypes/ticketActionTypes';

const initialState = {
    // حالة إنشاء تذكرة
    loadingCreate: false,
    successCreate: false,
    errorCreate: null,
    createdTicket: null,

    // قائمة تذاكر المستخدم
    userTickets: [],
    loadingUserTickets: false,
    errorUserTickets: null,
    userTicketsPagination: {}, // لتخزين معلومات الت分页

    // تفاصيل التذكرة المحددة وردودها (تستخدم لكل من المستخدم والأدمن)
    activeTicketDetails: null,
    activeTicketReplies: [],
    loadingTicketDetails: false, // يمكن استخدامها لـ GET_TICKET_DETAILS_REQUEST و ADMIN_GET_TICKET_DETAILS_REQUEST
    errorTicketDetails: null,  // يمكن استخدامها لـ GET_TICKET_DETAILS_FAIL و ADMIN_GET_TICKET_DETAILS_FAIL

    // حالة إضافة رد
    loadingAddReply: false,
    successAddReply: false,
    errorAddReply: null,

    // حالة إغلاق التذكرة بواسطة المستخدم
    loadingCloseTicket: false,
    errorCloseTicket: null,

    // حالة الأدمن/الدعم
    adminTickets: [],
    loadingAdminTickets: false,
    errorAdminTickets: null,
    adminTicketsPagination: {},

    loadingAdminUpdate: false, // للعمليات مثل تحديث الحالة، الأولوية، التعيين
    errorAdminUpdate: null,
    successAdminUpdate: false, // لتتبع نجاح عمليات تحديث الأدمن
};

export const ticketReducer = (state = initialState, action) => {
    switch (action.type) {
        // --- إنشاء تذكرة ---
        case CREATE_TICKET_REQUEST:
            return { ...state, loadingCreate: true, successCreate: false, errorCreate: null, createdTicket: null };
        case CREATE_TICKET_SUCCESS:
            return { ...state, loadingCreate: false, successCreate: true, createdTicket: action.payload };
        case CREATE_TICKET_FAIL:
            return { ...state, loadingCreate: false, errorCreate: action.payload };
        case CREATE_TICKET_RESET:
            return { ...state, loadingCreate: false, successCreate: false, errorCreate: null, createdTicket: null };

        // --- جلب تذاكر المستخدم ---
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

        // --- جلب تفاصيل التذكرة (للمستخدم والأدمن) ---
        case GET_TICKET_DETAILS_REQUEST:
        case ADMIN_GET_TICKET_DETAILS_REQUEST: // نفس حالة التحميل
            return { ...state, loadingTicketDetails: true, errorTicketDetails: null, activeTicketDetails: null, activeTicketReplies: [] };

        case GET_TICKET_DETAILS_SUCCESS:
        case ADMIN_GET_TICKET_DETAILS_SUCCESS: // نفس معالجة النجاح
            return {
                ...state,
                loadingTicketDetails: false,
                activeTicketDetails: action.payload.ticket,
                activeTicketReplies: action.payload.replies || [] // تأكد من أن replies دائمًا مصفوفة
            };

        case GET_TICKET_DETAILS_FAIL:
        case ADMIN_GET_TICKET_DETAILS_FAIL: // نفس معالجة الفشل
            return { ...state, loadingTicketDetails: false, errorTicketDetails: action.payload };

        case CLEAR_TICKET_DETAILS:
            return { ...state, activeTicketDetails: null, activeTicketReplies: [], errorTicketDetails: null, loadingTicketDetails: false };

        // --- إضافة رد ---
        case ADD_TICKET_REPLY_REQUEST:
            return { ...state, loadingAddReply: true, successAddReply: false, errorAddReply: null };
        case ADD_TICKET_REPLY_SUCCESS:
            // التحقق مما إذا كان الرد الجديد موجودًا بالفعل لتجنب التكرار من السوكيت
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

        // --- تحديث الردود في الوقت الفعلي من السوكيت ---
        case REALTIME_ADD_TICKET_REPLY:
            if (state.activeTicketDetails &&
                state.activeTicketDetails._id === action.payload.ticketId &&
                !state.activeTicketReplies.find(r => r._id === action.payload.reply._id)) { // تحقق من عدم التكرار
                return {
                    ...state,
                    activeTicketReplies: [...state.activeTicketReplies, action.payload.reply],
                    activeTicketDetails: { // تحديث معلومات التذكرة الرئيسية أيضًا
                        ...state.activeTicketDetails,
                        lastReplyAt: action.payload.reply.createdAt,
                        lastRepliedBy: action.payload.reply.user, // افترض أن الـ payload من السوكيت يحتوي على user object كامل للرد
                        status: action.payload.updatedTicketStatus || state.activeTicketDetails.status, // إذا أرسل الـ backend الحالة المحدثة
                    },
                    // تحديث حالة التذكرة في قائمة userTickets إذا كانت موجودة
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

        // --- إغلاق التذكرة بواسطة المستخدم ---
        case CLOSE_TICKET_BY_USER_REQUEST:
            return { ...state, loadingCloseTicket: true, errorCloseTicket: null };
        case CLOSE_TICKET_BY_USER_SUCCESS:
            const updatedTicketOnUserClose = action.payload.updatedTicket;
            return {
                ...state,
                loadingCloseTicket: false,
                activeTicketDetails: state.activeTicketDetails && state.activeTicketDetails._id === updatedTicketOnUserClose._id
                    ? updatedTicketOnUserClose
                    : state.activeTicketDetails,
                userTickets: state.userTickets.map(t => t._id === updatedTicketOnUserClose._id ? updatedTicketOnUserClose : t),
                adminTickets: state.adminTickets.map(t => t._id === updatedTicketOnUserClose._id ? updatedTicketOnUserClose : t)
            };
        case CLOSE_TICKET_BY_USER_FAIL:
            return { ...state, loadingCloseTicket: false, errorCloseTicket: action.payload };

        // --- دوال الأدمن ---
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
                    ? updatedTicketByAdmin // تحديث التفاصيل إذا كانت هذه هي التذكرة النشطة
                    : state.activeTicketDetails,
                // تحديث التذكرة في قائمة تذاكر الأدمن
                adminTickets: state.adminTickets.map(t => t._id === updatedTicketByAdmin._id ? updatedTicketByAdmin : t),
                // تحديث التذكرة في قائمة تذاكر المستخدم إذا كانت موجودة (للتناسق)
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
        default:
            return state;
    }
};