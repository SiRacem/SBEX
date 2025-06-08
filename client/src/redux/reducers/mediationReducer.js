import {
    ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST, ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS, ADMIN_GET_PENDING_ASSIGNMENTS_FAIL,
    ADMIN_ASSIGN_MEDIATOR_REQUEST, ADMIN_ASSIGN_MEDIATOR_SUCCESS, ADMIN_ASSIGN_MEDIATOR_FAIL,
    ADMIN_ASSIGN_MEDIATOR_RESET, ADMIN_CLEAR_MEDIATION_ERRORS, ASSIGN_MEDIATOR_REQUEST,
    ASSIGN_MEDIATOR_SUCCESS, ASSIGN_MEDIATOR_FAIL, GET_MEDIATOR_ASSIGNMENTS_REQUEST, GET_MEDIATOR_ASSIGNMENTS_SUCCESS,
    GET_MEDIATOR_ASSIGNMENTS_FAIL, MEDIATOR_ACCEPT_ASSIGNMENT_REQUEST, MEDIATOR_ACCEPT_ASSIGNMENT_SUCCESS,
    MEDIATOR_ACCEPT_ASSIGNMENT_FAIL, MEDIATOR_REJECT_ASSIGNMENT_REQUEST, MEDIATOR_REJECT_ASSIGNMENT_SUCCESS,
    MEDIATOR_REJECT_ASSIGNMENT_FAIL, GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_REQUEST,
    GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_SUCCESS, GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_FAIL,
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
    ADMIN_RESOLVE_DISPUTE_SUCCESS, ADMIN_RESOLVE_DISPUTE_FAIL, UPDATE_SINGLE_MEDIATION_REQUEST_IN_STORE,
    ADMIN_CREATE_SUBCHAT_REQUEST, ADMIN_CREATE_SUBCHAT_SUCCESS, ADMIN_CREATE_SUBCHAT_FAIL, ADMIN_CREATE_SUBCHAT_RESET,
    ADMIN_GET_ALL_SUBCHATS_REQUEST, ADMIN_GET_ALL_SUBCHATS_SUCCESS, ADMIN_GET_ALL_SUBCHATS_FAIL,
    ADMIN_GET_SUBCHAT_MESSAGES_REQUEST, ADMIN_GET_SUBCHAT_MESSAGES_SUCCESS, ADMIN_GET_SUBCHAT_MESSAGES_FAIL,
    CLEAR_ACTIVE_SUBCHAT_MESSAGES,
    ADMIN_SUBCHAT_CREATED_SOCKET, NEW_ADMIN_SUBCHAT_MESSAGE_SOCKET, ADMIN_SUBCHAT_MESSAGES_STATUS_UPDATED_SOCKET,
    SET_ACTIVE_SUBCHAT_ID,
    ADD_SUB_CHAT_TO_MEDIATION,
    UPDATE_SUBCHAT_MESSAGES_READ_STATUS
} from '../actionTypes/mediationActionTypes';

const initialState = {
    pendingAssignmentsAdmin: { requests: [], totalPages: 0, currentPage: 1, totalRequests: 0 },
    loadingPendingAdmin: false,
    errorPendingAdmin: null,
    assigningMediator: {},
    errorAssign: null,
    successAssign: false,
    pendingDecisionAssignments: { list: [], totalPages: 1, currentPage: 1, totalCount: 0 },
    loadingPendingDecision: false,
    errorPendingDecision: null,
    acceptedAwaitingPartiesAssignments: { list: [], totalPages: 1, currentPage: 1, totalCount: 0 },
    loadingAcceptedAwaitingParties: false,
    errorAcceptedAwaitingParties: null,
    actionLoading: false,
    actionError: null,
    actionSuccess: false,
    buyerRequests: { list: [], totalPages: 1, currentPage: 1, totalCount: 0 },
    sellerRequests: { list: [], totalPages: 1, currentPage: 1, totalCount: 0 },
    loadingBuyerRequests: false,
    errorBuyerRequests: null,
    confirmingReadiness: false,
    confirmReadinessError: null,
    myMediationSummaries: { requests: [], loading: false, error: null, totalUnreadMessagesCount: 0 },
    disputedCases: { list: [], totalPages: 1, currentPage: 1, totalCount: 0 },
    loadingDisputedCases: false,
    errorDisputedCases: null,
    adminDisputedMediations: { list: [], totalPages: 1, currentPage: 1, totalCount: 0 },
    loadingAdminDisputed: false,
    errorAdminDisputed: null,
    activeMediationDetails: null,
    loadingActiveMediationDetails: false,
    errorActiveMediationDetails: null,
    loadingResolveDispute: {},
    errorResolveDispute: {},
    adminSubChats: { list: [], loading: false, error: null },
    activeSubChat: { details: null, messages: [], loadingMessages: false, errorMessages: null, id: null },
    creatingSubChat: false,
    errorCreatingSubChat: null,
    successCreatingSubChat: false,
};

const mediationReducer = (state = initialState, action) => {
    const { type, payload } = action;

    switch (type) {
        // --- Admin: Get Pending Assignments ---
        case ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST:
            return { ...state, loadingPendingAdmin: true, errorPendingAdmin: null };
        case ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS:
            return { ...state, loadingPendingAdmin: false, pendingAssignmentsAdmin: payload || { requests: [], totalPages: 0, currentPage: 1, totalRequests: 0 } };
        case ADMIN_GET_PENDING_ASSIGNMENTS_FAIL:
            return { ...state, loadingPendingAdmin: false, errorPendingAdmin: payload };

        // --- Admin: Assign Mediator ---
        case ADMIN_ASSIGN_MEDIATOR_REQUEST:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.requestId]: true }, errorAssign: null, successAssign: false };
        case ADMIN_ASSIGN_MEDIATOR_SUCCESS:
            const assignedRequestIdAdmin = payload.updatedRequest?._id || payload.requestId;
            return {
                ...state,
                assigningMediator: { ...state.assigningMediator, [assignedRequestIdAdmin]: false },
                pendingAssignmentsAdmin: {
                    ...state.pendingAssignmentsAdmin,
                    requests: state.pendingAssignmentsAdmin.requests.filter(req => req._id !== assignedRequestIdAdmin),
                    totalRequests: Math.max(0, state.pendingAssignmentsAdmin.totalRequests - 1)
                },
                successAssign: true, errorAssign: null
            };
        case ADMIN_ASSIGN_MEDIATOR_FAIL:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.requestId]: false }, errorAssign: payload.error, successAssign: false };
        case ADMIN_ASSIGN_MEDIATOR_RESET:
            return { ...state, successAssign: false, errorAssign: null };
        case ADMIN_CLEAR_MEDIATION_ERRORS:
            return { ...state, errorPendingAdmin: null, errorAssign: null, actionError: null, errorCreatingSubChat: null };

        // --- Seller: Assign Selected Mediator ---
        case ASSIGN_MEDIATOR_REQUEST:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.mediationRequestId]: true }, errorAssign: null, successAssign: false };
        case ASSIGN_MEDIATOR_SUCCESS:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.mediationRequestId]: false }, successAssign: true, errorAssign: null };
        case ASSIGN_MEDIATOR_FAIL:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.mediationRequestId]: false }, errorAssign: payload.error, successAssign: false };

        // --- Mediator: Get Own Assignments (Pending Decision) ---
        case GET_MEDIATOR_ASSIGNMENTS_REQUEST:
            return { ...state, loadingPendingDecision: true, errorPendingDecision: null, actionSuccess: false };
        case GET_MEDIATOR_ASSIGNMENTS_SUCCESS:
            return { ...state, loadingPendingDecision: false, pendingDecisionAssignments: { list: payload.assignments || [], totalPages: payload.totalPages || 1, currentPage: payload.currentPage || 1, totalCount: payload.totalAssignments || 0 } };
        case GET_MEDIATOR_ASSIGNMENTS_FAIL:
            return { ...state, loadingPendingDecision: false, errorPendingDecision: payload, pendingDecisionAssignments: { ...initialState.pendingDecisionAssignments } };

        // --- Mediator: Get Accepted Assignments Awaiting Parties ---
        case GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_REQUEST:
            return { ...state, loadingAcceptedAwaitingParties: true, errorAcceptedAwaitingParties: null, actionSuccess: false };
        case GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_SUCCESS:
            return { ...state, loadingAcceptedAwaitingParties: false, acceptedAwaitingPartiesAssignments: { list: payload.assignments || [], totalPages: payload.totalPages || 1, currentPage: payload.currentPage || 1, totalCount: payload.totalAssignments || 0 } };
        case GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_FAIL:
            return { ...state, loadingAcceptedAwaitingParties: false, errorAcceptedAwaitingParties: payload, acceptedAwaitingPartiesAssignments: { ...initialState.acceptedAwaitingPartiesAssignments } };

        // --- Mediator: Accept Assignment ---
        case MEDIATOR_ACCEPT_ASSIGNMENT_REQUEST:
            return { ...state, actionLoading: true, actionError: null, actionSuccess: false };
        case MEDIATOR_ACCEPT_ASSIGNMENT_SUCCESS:
            return {
                ...state, actionLoading: false, actionSuccess: true,
                pendingDecisionAssignments: {
                    ...state.pendingDecisionAssignments,
                    list: state.pendingDecisionAssignments.list.filter(assignment => assignment._id !== payload.mediationRequestId),
                    totalCount: Math.max(0, state.pendingDecisionAssignments.totalCount - 1),
                },
            };
        case MEDIATOR_ACCEPT_ASSIGNMENT_FAIL:
            return { ...state, actionLoading: false, actionError: payload.error, actionSuccess: false };

        // --- Mediator: Reject Assignment ---
        case MEDIATOR_REJECT_ASSIGNMENT_REQUEST:
            return { ...state, actionLoading: true, actionError: null, actionSuccess: false };
        case MEDIATOR_REJECT_ASSIGNMENT_SUCCESS:
            return {
                ...state, actionLoading: false, actionSuccess: true,
                pendingDecisionAssignments: {
                    ...state.pendingDecisionAssignments,
                    list: state.pendingDecisionAssignments.list.filter(assignment => assignment._id !== payload.mediationRequestId),
                    totalCount: Math.max(0, state.pendingDecisionAssignments.totalCount - 1),
                },
            };
        case MEDIATOR_REJECT_ASSIGNMENT_FAIL:
            return { ...state, actionLoading: false, actionError: payload.error, actionSuccess: false };

        // --- Seller Confirm Readiness ---
        case SELLER_CONFIRM_READINESS_REQUEST:
            return { ...state, confirmingReadiness: true, confirmReadinessError: null, actionSuccess: false };
        case SELLER_CONFIRM_READINESS_SUCCESS:
            return {
                ...state, confirmingReadiness: false, actionSuccess: true,
                acceptedAwaitingPartiesAssignments: {
                    ...state.acceptedAwaitingPartiesAssignments,
                    list: state.acceptedAwaitingPartiesAssignments.list.map(req => req._id === payload.mediationRequestId ? payload.responseData.mediationRequest : req)
                },
                activeMediationDetails: state.activeMediationDetails?._id === payload.mediationRequestId ? payload.responseData.mediationRequest : state.activeMediationDetails,
            };
        case SELLER_CONFIRM_READINESS_FAIL:
            return { ...state, confirmingReadiness: false, confirmReadinessError: payload.error, actionSuccess: false };

        // --- Buyer Confirm Readiness & Escrow ---
        case BUYER_CONFIRM_READINESS_ESCROW_REQUEST:
            return { ...state, confirmingReadiness: true, confirmReadinessError: null, actionSuccess: false };
        case BUYER_CONFIRM_READINESS_ESCROW_SUCCESS:
            return {
                ...state, confirmingReadiness: false, actionSuccess: true,
                acceptedAwaitingPartiesAssignments: {
                    ...state.acceptedAwaitingPartiesAssignments,
                    list: state.acceptedAwaitingPartiesAssignments.list.map(req => req._id === payload.mediationRequestId ? payload.responseData.mediationRequest : req)
                },
                activeMediationDetails: state.activeMediationDetails?._id === payload.mediationRequestId ? payload.responseData.mediationRequest : state.activeMediationDetails,
            };
        case BUYER_CONFIRM_READINESS_ESCROW_FAIL:
            return { ...state, confirmingReadiness: false, confirmReadinessError: payload.error, actionSuccess: false };

        // --- Get Buyer Mediation Requests ---
        case GET_BUYER_MEDIATION_REQUESTS_REQUEST:
            return { ...state, loadingBuyerRequests: true, errorBuyerRequests: null };
        case GET_BUYER_MEDIATION_REQUESTS_SUCCESS:
            return { ...state, loadingBuyerRequests: false, buyerRequests: { list: payload.requests || [], totalPages: payload.totalPages || 1, currentPage: payload.currentPage || 1, totalCount: payload.totalRequests || 0 }, errorBuyerRequests: null };
        case GET_BUYER_MEDIATION_REQUESTS_FAIL:
            return { ...state, loadingBuyerRequests: false, errorBuyerRequests: payload, buyerRequests: { ...initialState.buyerRequests } };

        // --- Buyer Reject Mediation ---
        case BUYER_REJECT_MEDIATION_REQUEST:
            return { ...state, actionLoading: true, actionError: null, actionSuccess: false };
        case BUYER_REJECT_MEDIATION_SUCCESS:
            return {
                ...state, actionLoading: false, actionSuccess: true,
                buyerRequests: {
                    ...state.buyerRequests,
                    list: state.buyerRequests.list.filter(req => req._id !== payload.mediationRequestId),
                    totalCount: Math.max(0, state.buyerRequests.totalCount - 1),
                },
                activeMediationDetails: state.activeMediationDetails?._id === payload.mediationRequestId ? payload.responseData.mediationRequest : state.activeMediationDetails,
            };
        case BUYER_REJECT_MEDIATION_FAIL:
            return { ...state, actionLoading: false, actionError: payload.error, actionSuccess: false };

        // --- Get My Mediation Summaries ---
        case GET_MY_MEDIATION_SUMMARIES_REQUEST:
            return { ...state, myMediationSummaries: { ...state.myMediationSummaries, loading: true, error: null } };
        case GET_MY_MEDIATION_SUMMARIES_SUCCESS:
            return { ...state, myMediationSummaries: { requests: payload.requests || [], loading: false, error: null, totalUnreadMessagesCount: payload.totalUnreadMessagesCount || 0 } };
        case GET_MY_MEDIATION_SUMMARIES_FAIL:
            return { ...state, myMediationSummaries: { ...state.myMediationSummaries, requests: [], loading: false, error: payload, totalUnreadMessagesCount: 0 } };
        case MARK_MEDIATION_AS_READ_IN_LIST:
            const updatedRequestsMarkRead = state.myMediationSummaries.requests.map(med => med._id === payload.mediationId ? { ...med, unreadMessagesCount: 0 } : med);
            const newTotalUnreadMarkRead = updatedRequestsMarkRead.reduce((total, med) => total + (med.unreadMessagesCount || 0), 0);
            return { ...state, myMediationSummaries: { ...state.myMediationSummaries, requests: updatedRequestsMarkRead, totalUnreadMessagesCount: newTotalUnreadMarkRead } };
        case UPDATE_UNREAD_COUNT_FROM_SOCKET:
            let foundMediation = false;
            const updatedRequestsSocket = state.myMediationSummaries.requests.map(med => {
                if (med._id === payload.mediationId) {
                    foundMediation = true;
                    return { ...med, unreadMessagesCount: payload.unreadCount, lastMessageTimestamp: payload.lastMessageTimestamp || med.lastMessageTimestamp };
                }
                return med;
            });
            let finalRequests = updatedRequestsSocket;
            if (!foundMediation && payload.productTitle && payload.otherPartyForRecipient) {
                const newMediationSummary = { _id: payload.mediationId, product: { title: payload.productTitle, imageUrl: payload.otherPartyForRecipient?.avatarUrl }, status: 'InProgress', otherParty: payload.otherPartyForRecipient, unreadMessagesCount: payload.unreadCount, lastMessageTimestamp: payload.lastMessageTimestamp, updatedAt: payload.lastMessageTimestamp };
                finalRequests = [newMediationSummary, ...updatedRequestsSocket];
            }
            finalRequests.sort((a, b) => {
                if (a._id === payload.mediationId && b._id !== payload.mediationId) return -1;
                if (a._id !== payload.mediationId && b._id === payload.mediationId) return 1;
                if (a.unreadMessagesCount > 0 && b.unreadMessagesCount === 0) return -1;
                if (a.unreadMessagesCount === 0 && b.unreadMessagesCount > 0) return 1;
                return new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp);
            });
            const newTotalUnreadSocket = finalRequests.reduce((total, med) => total + (med.unreadMessagesCount || 0), 0);
            return { ...state, myMediationSummaries: { ...state.myMediationSummaries, requests: finalRequests, totalUnreadMessagesCount: newTotalUnreadSocket, loading: false, error: null } };

        // --- Buyer Confirm Receipt ---
        case BUYER_CONFIRM_RECEIPT_REQUEST:
            return { ...state, actionLoading: true, actionError: null };
        case BUYER_CONFIRM_RECEIPT_SUCCESS:
            const updateListWithConfirmed = (list) => list.map(req => req._id === payload.mediationRequestId ? payload.updatedMediationRequest : req);
            return {
                ...state, actionLoading: false, actionSuccess: true,
                myMediationSummaries: { ...state.myMediationSummaries, requests: updateListWithConfirmed(state.myMediationSummaries.requests) },
                buyerRequests: { ...state.buyerRequests, list: updateListWithConfirmed(state.buyerRequests.list) },
                activeMediationDetails: state.activeMediationDetails?._id === payload.mediationRequestId ? payload.updatedMediationRequest : state.activeMediationDetails,
            };
        case BUYER_CONFIRM_RECEIPT_FAIL:
            return { ...state, actionLoading: false, actionError: payload.error };

        // --- Open Dispute ---
        case OPEN_DISPUTE_REQUEST:
            return { ...state, actionLoading: true, actionError: null };
        case OPEN_DISPUTE_SUCCESS:
            const updateListWithDisputed = (list) => list.map(req => req._id === payload.mediationRequestId ? payload.updatedMediationRequest : req);
            return {
                ...state, actionLoading: false, actionSuccess: true,
                myMediationSummaries: { ...state.myMediationSummaries, requests: updateListWithDisputed(state.myMediationSummaries.requests) },
                buyerRequests: { ...state.buyerRequests, list: updateListWithDisputed(state.buyerRequests.list) },
                activeMediationDetails: state.activeMediationDetails?._id === payload.mediationRequestId ? payload.updatedMediationRequest : state.activeMediationDetails,
            };
        case OPEN_DISPUTE_FAIL:
            return { ...state, actionLoading: false, actionError: payload.error };

        // --- Mediator Get Disputed Cases ---
        case GET_MEDIATOR_DISPUTED_CASES_REQUEST:
            return { ...state, loadingDisputedCases: true, errorDisputedCases: null };
        case GET_MEDIATOR_DISPUTED_CASES_SUCCESS:
            return { ...state, loadingDisputedCases: false, disputedCases: { list: payload.assignments || payload.requests || [], totalPages: payload.totalPages || 1, currentPage: payload.currentPage || 1, totalCount: payload.totalAssignments || payload.totalRequests || 0 } };
        case GET_MEDIATOR_DISPUTED_CASES_FAIL:
            return { ...state, loadingDisputedCases: false, errorDisputedCases: payload, disputedCases: { ...initialState.disputedCases } };

        // --- Admin Get Disputed Mediations ---
        case ADMIN_GET_DISPUTED_MEDIATIONS_REQUEST:
            return { ...state, loadingAdminDisputed: true, errorAdminDisputed: null };
        case ADMIN_GET_DISPUTED_MEDIATIONS_SUCCESS:
            return { ...state, loadingAdminDisputed: false, adminDisputedMediations: { list: payload.requests || payload.mediations || [], totalPages: payload.totalPages || 1, currentPage: payload.currentPage || 1, totalCount: payload.totalRequests || payload.totalMediations || 0 } };
        case ADMIN_GET_DISPUTED_MEDIATIONS_FAIL:
            return { ...state, loadingAdminDisputed: false, errorAdminDisputed: payload, adminDisputedMediations: { ...initialState.adminDisputedMediations } };

        // --- Get Mediation Details By ID ---
        case GET_MEDIATION_DETAILS_BY_ID_SUCCESS: {
            const currentUserId = state.userReducer?.user?._id;

            const processedSubChats = (payload.adminSubChats || []).map(sc => {
                let unreadCount = 0;
                const lastMessage = sc.messages && sc.messages.length > 0 ? sc.messages[sc.messages.length - 1] : null;

                if (sc.messages && currentUserId) {
                    sc.messages.forEach(msg => {
                        if (msg.sender?._id !== currentUserId &&
                            (!msg.readBy || !msg.readBy.some(r => r.readerId === currentUserId))) {
                            unreadCount++;
                        }
                    });
                }

                const createSnippet = (msg) => {
                    if (!msg) return "No messages yet.";
                    if (msg.type === 'system') return "Chat started.";
                    if (msg.type === 'image') return "[Image]";
                    if (msg.message) return msg.message.substring(0, 25) + (msg.message.length > 25 ? "..." : "");
                    return "New message";
                };

                return {
                    ...sc,
                    unreadMessagesCount: unreadCount,
                    lastMessageSnippet: createSnippet(lastMessage),
                };
            }).sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));

            return {
                ...state,
                loadingActiveMediationDetails: false,
                activeMediationDetails: { ...payload, adminSubChats: processedSubChats },
                adminSubChats: {
                    ...state.adminSubChats,
                    list: processedSubChats,
                    loading: false,
                    error: null,
                },
            };
        }
        case GET_MEDIATION_DETAILS_BY_ID_FAIL:
            return { ...state, loadingActiveMediationDetails: false, errorActiveMediationDetails: payload };
        case UPDATE_MEDIATION_DETAILS_FROM_SOCKET:
            if (state.activeMediationDetails && state.activeMediationDetails._id === payload._id) {
                const currentAdminForSocket = state.userReducer?.user;
                const currentAdminIdForSocket = currentAdminForSocket?._id;
                return {
                    ...state,
                    activeMediationDetails: payload,
                    adminSubChats: { // تحديث قائمة الشاتات الفرعية أيضًا إذا تغيرت
                        ...state.adminSubChats,
                        list: (payload.adminSubChats || []).map(sc => {
                            let unreadCount = 0;
                            if (sc.messages && currentAdminIdForSocket) {
                                sc.messages.forEach(msg => {
                                    if (msg.sender?._id !== currentAdminIdForSocket && (!msg.readBy || !msg.readBy.some(r => r.readerId === currentAdminIdForSocket))) {
                                        unreadCount++;
                                    }
                                });
                            }
                            return { ...sc, unreadMessagesCount: unreadCount };
                        }).sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt)),
                    }
                };
            }
            return state;
        case CLEAR_ACTIVE_MEDIATION_DETAILS:
            return { ...state, activeMediationDetails: null, loadingActiveMediationDetails: false, errorActiveMediationDetails: null, adminSubChats: { ...initialState.adminSubChats }, activeSubChat: { ...initialState.activeSubChat } };

        // --- Admin Resolve Dispute ---
        case ADMIN_RESOLVE_DISPUTE_REQUEST:
            return { ...state, loadingResolveDispute: { ...state.loadingResolveDispute, [payload.mediationRequestId]: true }, errorResolveDispute: { ...state.errorResolveDispute, [payload.mediationRequestId]: null } };
        case ADMIN_RESOLVE_DISPUTE_SUCCESS:
            const updatedActiveDetails = state.activeMediationDetails?._id === payload.mediationRequestId ? payload.updatedMediationRequest : state.activeMediationDetails;
            return { ...state, loadingResolveDispute: { ...state.loadingResolveDispute, [payload.mediationRequestId]: false }, activeMediationDetails: updatedActiveDetails };
        case ADMIN_RESOLVE_DISPUTE_FAIL:
            return { ...state, loadingResolveDispute: { ...state.loadingResolveDispute, [payload.mediationRequestId]: false }, errorResolveDispute: { ...state.errorResolveDispute, [payload.mediationRequestId]: payload.error } };

        // --- Admin Create Sub-Chat ---
        case ADMIN_CREATE_SUBCHAT_REQUEST:
            return { ...state, creatingSubChat: true, errorCreatingSubChat: null, successCreatingSubChat: false };
        case ADMIN_CREATE_SUBCHAT_SUCCESS:
            const newSubChatData = payload.subChat;
            return {
                ...state, creatingSubChat: false, successCreatingSubChat: true,
                activeMediationDetails: state.activeMediationDetails ? { ...state.activeMediationDetails, adminSubChats: [...(state.activeMediationDetails.adminSubChats || []), newSubChatData].sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt)) } : state.activeMediationDetails,
                adminSubChats: { ...state.adminSubChats, list: [...state.adminSubChats.list, { ...newSubChatData, unreadMessagesCount: 0 }].sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt)) }
            };
        case ADMIN_CREATE_SUBCHAT_FAIL:
            return { ...state, creatingSubChat: false, errorCreatingSubChat: payload, successCreatingSubChat: false };
        case ADMIN_CREATE_SUBCHAT_RESET:
            return { ...state, creatingSubChat: false, errorCreatingSubChat: null, successCreatingSubChat: false };

        // --- Admin Get All Sub-Chats ---
        case ADMIN_GET_ALL_SUBCHATS_REQUEST:
            return { ...state, adminSubChats: { ...state.adminSubChats, loading: true, error: null } };
        case ADMIN_GET_ALL_SUBCHATS_SUCCESS:
            const currentAdminForAllSub = state.userReducer?.user;
            const currentAdminIdForAllSub = currentAdminForAllSub?._id;
            return {
                ...state,
                adminSubChats: {
                    list: (payload.subChats || []).map(sc => {
                        let unreadCount = 0;
                        if (sc.messages && currentAdminIdForAllSub) {
                            sc.messages.forEach(msg => {
                                if (msg.sender && msg.sender._id && msg.sender._id.toString() !== currentAdminIdForAllSub.toString() &&
                                    (!msg.readBy || !msg.readBy.some(r => r.readerId && r.readerId.toString() === currentAdminIdForAllSub.toString()))) {
                                    unreadCount++;
                                }
                            });
                        }
                        const otherParticipantsDisplay = sc.participants?.filter(p => p.userId?._id?.toString() !== currentAdminIdForAllSub?.toString()).map(p => p.userId?.fullName).join(', ') || "participants";
                        const lastMessage = sc.messages && sc.messages.length > 0 ? sc.messages[sc.messages.length - 1] : null;
                        let lastMessageSnippet = "No messages yet.";
                        if (lastMessage) {
                            if (lastMessage.type === 'text' && lastMessage.message) {
                                lastMessageSnippet = lastMessage.message.substring(0, 30) + (lastMessage.message.length > 30 ? "..." : "");
                            } else if (lastMessage.type === 'image') {
                                lastMessageSnippet = "[Image]";
                            } else if (lastMessage.type === 'file') {
                                lastMessageSnippet = "[File]";
                            } else if (lastMessage.type === 'system' && lastMessage.message) {
                                lastMessageSnippet = `[System] ${lastMessage.message.substring(0, 20)}...`;
                            }
                        }
                        return { ...sc, unreadMessagesCount: unreadCount, otherPartyDisplay: otherParticipantsDisplay, lastMessageSnippet: lastMessageSnippet };
                    }).sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt)),
                    loading: false, error: null
                }
            };
        case ADMIN_GET_ALL_SUBCHATS_FAIL:
            return { ...state, adminSubChats: { ...state.adminSubChats, list: [], loading: false, error: payload } };

        // --- Admin Get Messages for a Specific Sub-Chat ---
        case SET_ACTIVE_SUBCHAT_ID:
            return { ...state, activeSubChat: { ...initialState.activeSubChat, id: payload } };
        case ADMIN_GET_SUBCHAT_MESSAGES_REQUEST:
            return { ...state, activeSubChat: { ...state.activeSubChat, id: payload.subChatId, loadingMessages: true, errorMessages: null, messages: state.activeSubChat.id === payload.subChatId ? state.activeSubChat.messages : [] } };
        case ADMIN_GET_SUBCHAT_MESSAGES_SUCCESS:
            if (state.activeSubChat.id === payload.subChatId) {
                return { ...state, activeSubChat: { details: { subChatId: payload.subChatId, title: payload.title, createdBy: payload.createdBy, participants: payload.participants }, messages: payload.messages || [], loadingMessages: false, errorMessages: null, id: payload.subChatId } };
            }
            return state;
        case ADMIN_GET_SUBCHAT_MESSAGES_FAIL:
            if (state.activeSubChat.id === payload.subChatId) {
                return { ...state, activeSubChat: { ...state.activeSubChat, loadingMessages: false, errorMessages: payload.error } };
            }
            return state;
        case CLEAR_ACTIVE_SUBCHAT_MESSAGES:
            return { ...state, activeSubChat: { ...initialState.activeSubChat } };

        // --- Socket IO Updates for Admin Sub-Chats ---
        case ADMIN_SUBCHAT_CREATED_SOCKET:
            // payload هو { mediationRequestId, subChat }
            // subChat هو الكائن الكامل للشات الفرعي الجديد مع populated participants, createdBy, messages
            if (state.activeMediationDetails?._id === payload.mediationRequestId) {
                const newSubChatFromSocket = { ...payload.subChat, unreadMessagesCount: 0 }; // افترض أن الشات الجديد ليس به رسائل غير مقروءة للمستقبل عند الإنشاء
                const currentUserIdForCreated = state.userReducer?.user?._id;
                const isAdminUser = state.userReducer?.user?.userRole === 'Admin';

                // تحقق إذا كان المستخدم الحالي مشاركًا في هذا الشات الجديد أو هو أدمن
                const isCurrentUserParticipantOrAdmin = isAdminUser ||
                    newSubChatFromSocket.participants.some(p => p.userId?._id === currentUserIdForCreated);

                if (isCurrentUserParticipantOrAdmin) {
                    const existingActiveMediationSubChats = state.activeMediationDetails.adminSubChats || [];
                    // تجنب إضافة الشات إذا كان موجودًا بالفعل (قد يحدث إذا كان الأدمن هو من أنشأه وتلقى الحدث أيضًا)
                    if (existingActiveMediationSubChats.some(sc => sc.subChatId === newSubChatFromSocket.subChatId)) {
                        return state;
                    }
                    const updatedAdminSubChatsForDetails = [...existingActiveMediationSubChats, newSubChatFromSocket]
                        .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));

                    let updatedAdminListForAdminUser = state.adminSubChats.list;
                    if (isAdminUser) {
                        if (!state.adminSubChats.list.some(sc => sc.subChatId === newSubChatFromSocket.subChatId)) {
                            updatedAdminListForAdminUser = [...state.adminSubChats.list, newSubChatFromSocket]
                                .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));
                        }
                    }

                    return {
                        ...state,
                        activeMediationDetails: {
                            ...state.activeMediationDetails,
                            adminSubChats: updatedAdminSubChatsForDetails
                        },
                        adminSubChats: isAdminUser ? {
                            ...state.adminSubChats,
                            list: updatedAdminListForAdminUser
                        } : state.adminSubChats
                    };
                }
            }
            return state;

        case NEW_ADMIN_SUBCHAT_MESSAGE_SOCKET: {
            const { mediationRequestId, subChatId, message, currentUserId } = payload;

            const createSnippet = (msg) => {
                if (!msg) return "No messages yet.";
                if (msg.type === 'system') return "Chat started.";
                if (msg.type === 'image') return "[Image]";
                if (msg.message) return msg.message.substring(0, 25) + (msg.message.length > 25 ? "..." : "");
                return "New message";
            };

            const getUpdatedSubChatList = (list = []) => {
                const chatIndex = list.findIndex(sc => sc.subChatId === subChatId);
                if (chatIndex === -1) return list;

                const newList = [...list];
                const originalChat = JSON.parse(JSON.stringify(newList[chatIndex]));

                // --- START OF THE CRITICAL FIX ---
                // 1. Add the new message to a temporary array to calculate the new unread count.
                const newMessagesArray = [...originalChat.messages, message];

                // 2. Recalculate the entire unread count from the new array of messages.
                const newUnreadCount = newMessagesArray.filter(
                    msg => {
                        // A message is unread if:
                        // 1. It has a sender.
                        // 2. The sender is not the current user.
                        // 3. The current user's ID is NOT in the readBy array.
                        const senderId = msg.sender?._id || msg.sender;
                        if (!senderId || senderId.toString() === currentUserId.toString()) {
                            return false;
                        }
                        const isReadByCurrentUser = msg.readBy?.some(
                            reader => (reader.readerId?._id || reader.readerId)?.toString() === currentUserId.toString()
                        );
                        return !isReadByCurrentUser;
                    }
                ).length;
                // --- END OF THE CRITICAL FIX ---

                const updatedChat = {
                    ...originalChat,
                    messages: newMessagesArray, // Use the new messages array
                    lastMessageAt: message.timestamp,
                    lastMessageSnippet: createSnippet(message),
                    unreadMessagesCount: newUnreadCount, // Use the newly calculated count
                };

                newList[chatIndex] = updatedChat;
                return newList.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
            };

            let newState = { ...state };
            if (state.activeSubChat.id === subChatId) {
                newState = {
                    ...newState,
                    activeSubChat: {
                        ...newState.activeSubChat,
                        messages: [...newState.activeSubChat.messages, message],
                    },
                };
            }
            newState = {
                ...newState,
                adminSubChats: {
                    ...newState.adminSubChats,
                    list: getUpdatedSubChatList(state.adminSubChats.list),
                },
            };
            if (newState.activeMediationDetails?._id === mediationRequestId) {
                newState = {
                    ...newState,
                    activeMediationDetails: {
                        ...newState.activeMediationDetails,
                        adminSubChats: getUpdatedSubChatList(newState.activeMediationDetails.adminSubChats),
                    },
                };
            }
            return newState;
        }

        case ADMIN_SUBCHAT_MESSAGES_STATUS_UPDATED_SOCKET:
            if (state.activeMediationDetails?._id === payload.mediationRequestId && state.activeSubChat.id === payload.subChatId) {
                return {
                    ...state,
                    activeSubChat: {
                        ...state.activeSubChat,
                        messages: state.activeSubChat.messages.map(msg => {
                            const updateInfo = payload.updatedMessages.find(um => um._id === msg._id);
                            if (updateInfo) {
                                const existingReadBy = msg.readBy || [];
                                const newReadByEntries = updateInfo.readBy.filter(newEntry =>
                                    !existingReadBy.some(existingEntry => existingEntry.readerId === newEntry.readerId)
                                );
                                return { ...msg, readBy: [...existingReadBy, ...newReadByEntries] };
                            }
                            return msg;
                        })
                    }
                };
            }
            return state;


        case UPDATE_SINGLE_MEDIATION_REQUEST_IN_STORE:
            const updatedRequest = action.payload;
            if (!updatedRequest || !updatedRequest._id) return state;

            // تحديث قائمة طلبات المشتري
            const buyerList = state.buyerRequests.list || []; // تأكد من وجود قائمة ابتدائية
            const buyerRequestExists = buyerList.some(req => req._id === updatedRequest._id);
            let updatedBuyerRequestsList;

            if (buyerRequestExists) {
                updatedBuyerRequestsList = buyerList.map(req =>
                    req._id === updatedRequest._id ? updatedRequest : req
                );
            } else {
                // إذا كان هذا الطلب يخص المشتري الحالي، أضفه (مهم لسيناريو 'new_mediation_request_for_buyer')
                // وفي هذا السيناريو (mediatorAcceptAssignment)، الطلب يجب أن يكون موجودًا بالفعل في قائمة المشتري.
                // ولكن، لن يضر التحقق والإضافة إذا لم يكن موجودًا لسبب ما.
                if (updatedRequest.buyer?._id === state.userReducer?.user?._id) { // تأكد من وجود state.userReducer.user
                    updatedBuyerRequestsList = [updatedRequest, ...buyerList];
                } else {
                    updatedBuyerRequestsList = buyerList;
                }
            }

            // يمكنك إضافة منطق مماثل لتحديث قائمة البائع sellerRequests إذا كانت لديك
            return {
                ...state,
                buyerRequests: {
                    ...state.buyerRequests, // حافظ على بقية خصائص buyerRequests مثل totalPages
                    list: updatedBuyerRequestsList
                },
                // sellerRequests: { ... }
            };

        // [!!! إضافة جديدة: case لإضافة شات فرعي جديد من Socket !!!]
        case ADD_SUB_CHAT_TO_MEDIATION: {
            if (!state.activeMediationDetails || state.activeMediationDetails._id !== payload.mediationRequestId) {
                return state;
            }
            const existingSubChats = state.activeMediationDetails.adminSubChats || [];
            if (existingSubChats.some(sc => sc.subChatId === payload.subChat.subChatId)) {
                return state;
            }
            return {
                ...state,
                activeMediationDetails: {
                    ...state.activeMediationDetails,
                    adminSubChats: [...existingSubChats, payload.subChat]
                }
            };
        }

        case 'ADMIN_SUBCHAT_MESSAGES_STATUS_UPDATED_SOCKET': {
            const { subChatId, readerInfo, messageIds } = payload;

            // This function updates the readBy array for messages in a chat list
            const updateReadStatusInList = (list) => {
                const chatIndex = list.findIndex(sc => sc.subChatId === subChatId);
                if (chatIndex === -1) return list;

                const newList = [...list];
                const chatToUpdate = JSON.parse(JSON.stringify(newList[chatIndex]));

                chatToUpdate.messages.forEach(msg => {
                    // If this message is one of the messages that were just read
                    if (messageIds.includes(msg._id)) {
                        // And if the reader is not already in the readBy array
                        if (!msg.readBy.some(r => (r.readerId?._id || r.readerId)?.toString() === readerInfo.readerId.toString())) {
                            msg.readBy.push(readerInfo);
                        }
                    }
                });
                newList[chatIndex] = chatToUpdate;
                return newList;
            };

            return {
                ...state,
                adminSubChats: {
                    ...state.adminSubChats,
                    list: updateReadStatusInList(state.adminSubChats.list),
                },
                activeSubChat: {
                    ...state.activeSubChat,
                    // Also update the messages in the currently open chat window
                    messages: state.activeSubChat.id === subChatId
                        ? updateReadStatusInList([{ messages: state.activeSubChat.messages }])[0].messages
                        : state.activeSubChat.messages,
                }
            };
        }

        case 'MARK_SUBCHAT_AS_READ_IN_LIST': {
            const { subChatId } = payload;
            const updateList = (list) => {
                if (!list) return []; // Safety check
                return list.map(sc =>
                    sc.subChatId === subChatId ? { ...sc, unreadMessagesCount: 0 } : sc
                );
            };

            return {
                ...state,
                adminSubChats: {
                    ...state.adminSubChats,
                    list: updateList(state.adminSubChats.list),
                },
                // Also update the list within activeMediationDetails to keep them in sync
                activeMediationDetails: state.activeMediationDetails
                    ? {
                        ...state.activeMediationDetails,
                        adminSubChats: updateList(state.activeMediationDetails.adminSubChats),
                    }
                    : null,
            };
        }

        default:
            return state;
    }
};

export default mediationReducer;