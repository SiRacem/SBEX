import {
    ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST, ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS, ADMIN_GET_PENDING_ASSIGNMENTS_FAIL,
    ADMIN_ASSIGN_MEDIATOR_REQUEST, ADMIN_ASSIGN_MEDIATOR_SUCCESS, ADMIN_ASSIGN_MEDIATOR_FAIL,
    ADMIN_ASSIGN_MEDIATOR_RESET, ADMIN_CLEAR_MEDIATION_ERRORS, ASSIGN_MEDIATOR_REQUEST,
    ASSIGN_MEDIATOR_SUCCESS, ASSIGN_MEDIATOR_FAIL, GET_MEDIATOR_ASSIGNMENTS_REQUEST, GET_MEDIATOR_ASSIGNMENTS_SUCCESS,
    GET_MEDIATOR_ASSIGNMENTS_FAIL, MEDIATOR_ACCEPT_ASSIGNMENT_REQUEST, MEDIATOR_ACCEPT_ASSIGNMENT_SUCCESS,
    MEDIATOR_ACCEPT_ASSIGNMENT_FAIL, MEDIATOR_REJECT_ASSIGNMENT_REQUEST,
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
    ADD_PENDING_ASSIGNMENT_FROM_SOCKET,
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
        case ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST:
            return { ...state, loadingPendingAdmin: true, errorPendingAdmin: null };
        case ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS:
            return { ...state, loadingPendingAdmin: false, pendingAssignmentsAdmin: payload || { requests: [], totalPages: 0, currentPage: 1, totalRequests: 0 } };
        case ADMIN_GET_PENDING_ASSIGNMENTS_FAIL:
            return { ...state, loadingPendingAdmin: false, errorPendingAdmin: payload };

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

        case ASSIGN_MEDIATOR_REQUEST:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.mediationRequestId]: true }, errorAssign: null, successAssign: false };
        case ASSIGN_MEDIATOR_SUCCESS:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.mediationRequestId]: false }, successAssign: true, errorAssign: null };
        case ASSIGN_MEDIATOR_FAIL:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.mediationRequestId]: false }, errorAssign: payload.error, successAssign: false };

        case GET_MEDIATOR_ASSIGNMENTS_REQUEST:
            return { ...state, loadingPendingDecision: true, errorPendingDecision: null, actionSuccess: false };
        case GET_MEDIATOR_ASSIGNMENTS_SUCCESS:
            return { ...state, loadingPendingDecision: false, pendingDecisionAssignments: { list: payload.assignments || [], totalPages: payload.totalPages || 1, currentPage: payload.currentPage || 1, totalCount: payload.totalAssignments || 0 } };
        case GET_MEDIATOR_ASSIGNMENTS_FAIL:
            return { ...state, loadingPendingDecision: false, errorPendingDecision: payload, pendingDecisionAssignments: { ...initialState.pendingDecisionAssignments } };

        case GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_REQUEST:
            return { ...state, loadingAcceptedAwaitingParties: true, errorAcceptedAwaitingParties: null, actionSuccess: false };
        case GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_SUCCESS:
            return { ...state, loadingAcceptedAwaitingParties: false, acceptedAwaitingPartiesAssignments: { list: payload.assignments || [], totalPages: payload.totalPages || 1, currentPage: payload.currentPage || 1, totalCount: payload.totalAssignments || 0 } };
        case GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_FAIL:
            return { ...state, loadingAcceptedAwaitingParties: false, errorAcceptedAwaitingParties: payload, acceptedAwaitingPartiesAssignments: { ...initialState.acceptedAwaitingPartiesAssignments } };

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

        case MEDIATOR_REJECT_ASSIGNMENT_REQUEST:
            return { ...state, actionLoading: true, actionError: null, actionSuccess: false };
        case MEDIATOR_ACCEPT_ASSIGNMENT_SUCCESS: {
            const acceptedRequest = payload.responseData?.mediationRequest || payload.responseData; // Get the updated request object
            if (!acceptedRequest || !acceptedRequest._id) {
                // If for some reason the accepted request data isn't there, just remove from pending
                return {
                    ...state, actionLoading: false, actionSuccess: true,
                    pendingDecisionAssignments: {
                        ...state.pendingDecisionAssignments,
                        list: state.pendingDecisionAssignments.list.filter(assignment => assignment._id !== payload.mediationRequestId),
                        totalCount: Math.max(0, state.pendingDecisionAssignments.totalCount - 1),
                    },
                };
            }

            // Remove from pendingDecisionAssignments
            const updatedPendingList = state.pendingDecisionAssignments.list.filter(
                assignment => assignment._id !== payload.mediationRequestId
            );
            const newPendingTotal = Math.max(0, state.pendingDecisionAssignments.totalCount - 1);

            // Add to acceptedAwaitingPartiesAssignments (or update if somehow already there)
            // Ensure it's not a duplicate if list already contains it (shouldn't happen for a new acceptance)
            const existingAcceptedList = state.acceptedAwaitingPartiesAssignments.list || [];
            let updatedAcceptedList;
            const existingAcceptedIndex = existingAcceptedList.findIndex(req => req._id === acceptedRequest._id);

            if (existingAcceptedIndex > -1) { // Should ideally not happen for a fresh acceptance
                updatedAcceptedList = existingAcceptedList.map(req =>
                    req._id === acceptedRequest._id ? acceptedRequest : req
                );
            } else {
                updatedAcceptedList = [acceptedRequest, ...existingAcceptedList];
            }

            // Sort the updatedAcceptedList, e.g., by updatedAt or createdAt descending
            updatedAcceptedList.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));


            const newAcceptedTotal = state.acceptedAwaitingPartiesAssignments.totalCount ?
                (existingAcceptedIndex > -1 ? state.acceptedAwaitingPartiesAssignments.totalCount : state.acceptedAwaitingPartiesAssignments.totalCount + 1)
                : 1;


            return {
                ...state,
                actionLoading: false,
                actionSuccess: true,
                pendingDecisionAssignments: {
                    ...state.pendingDecisionAssignments,
                    list: updatedPendingList,
                    totalCount: newPendingTotal,
                },
                acceptedAwaitingPartiesAssignments: {
                    ...state.acceptedAwaitingPartiesAssignments,
                    list: updatedAcceptedList,
                    totalCount: newAcceptedTotal,
                    // currentPage will be reset by subsequent fetch in component, or handle pagination more carefully if needed
                },
            };
        }
        case MEDIATOR_REJECT_ASSIGNMENT_FAIL:
            return { ...state, actionLoading: false, actionError: payload.error, actionSuccess: false };

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

        case GET_BUYER_MEDIATION_REQUESTS_REQUEST:
            return { ...state, loadingBuyerRequests: true, errorBuyerRequests: null };
        case GET_BUYER_MEDIATION_REQUESTS_SUCCESS:
            return { ...state, loadingBuyerRequests: false, buyerRequests: { list: payload.requests || [], totalPages: payload.totalPages || 1, currentPage: payload.currentPage || 1, totalCount: payload.totalRequests || 0 }, errorBuyerRequests: null };
        case GET_BUYER_MEDIATION_REQUESTS_FAIL:
            return { ...state, loadingBuyerRequests: false, errorBuyerRequests: payload, buyerRequests: { ...initialState.buyerRequests } };

        case BUYER_REJECT_MEDIATION_REQUEST:
            return { ...state, actionLoading: true, actionError: null, actionSuccess: false };
        case BUYER_REJECT_MEDIATION_SUCCESS: {
            const updatedRequestFromApi = payload.responseData?.mediationRequest;

            // إذا لم تصل البيانات المحدثة من الـ API، لا تفعل شيئًا وانتظر تحديث السوكيت
            // هذا أفضل من حذف العنصر
            if (!updatedRequestFromApi) {
                console.warn("BUYER_REJECT_MEDIATION_SUCCESS did not receive updated request data. Waiting for socket update.");
                return { ...state, actionLoading: false, actionSuccess: true };
            }

            // إذا وصلت البيانات المحدثة، قم بتحديث العنصر في القائمة فورًا
            console.log("[Reducer] Updating buyer request list immediately after API success.", updatedRequestFromApi);
            return {
                ...state,
                actionLoading: false,
                actionSuccess: true,
                buyerRequests: {
                    ...state.buyerRequests,
                    list: state.buyerRequests.list.map(req =>
                        req._id === updatedRequestFromApi._id ? updatedRequestFromApi : req
                    ),
                },
                activeMediationDetails: state.activeMediationDetails?._id === updatedRequestFromApi._id
                    ? updatedRequestFromApi
                    : state.activeMediationDetails,
            };
            }
        case BUYER_REJECT_MEDIATION_FAIL:
            return { ...state, actionLoading: false, actionError: payload.error, actionSuccess: false };

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

        case GET_MEDIATOR_DISPUTED_CASES_REQUEST:
            return { ...state, loadingDisputedCases: true, errorDisputedCases: null };
        case GET_MEDIATOR_DISPUTED_CASES_SUCCESS:
            return { ...state, loadingDisputedCases: false, disputedCases: { list: payload.assignments || payload.requests || [], totalPages: payload.totalPages || 1, currentPage: payload.currentPage || 1, totalCount: payload.totalAssignments || payload.totalRequests || 0 } };
        case GET_MEDIATOR_DISPUTED_CASES_FAIL:
            return { ...state, loadingDisputedCases: false, errorDisputedCases: payload, disputedCases: { ...initialState.disputedCases } };

        case ADMIN_GET_DISPUTED_MEDIATIONS_REQUEST:
            return { ...state, loadingAdminDisputed: true, errorAdminDisputed: null };
        case ADMIN_GET_DISPUTED_MEDIATIONS_SUCCESS:
            return { ...state, loadingAdminDisputed: false, adminDisputedMediations: { list: payload.requests || payload.mediations || [], totalPages: payload.totalPages || 1, currentPage: payload.currentPage || 1, totalCount: payload.totalRequests || payload.totalMediations || 0 } };
        case ADMIN_GET_DISPUTED_MEDIATIONS_FAIL:
            return { ...state, loadingAdminDisputed: false, errorAdminDisputed: payload, adminDisputedMediations: { ...initialState.adminDisputedMediations } };

        case GET_MEDIATION_DETAILS_BY_ID_REQUEST:
            return { ...state, loadingActiveMediationDetails: true, errorActiveMediationDetails: null };
        case GET_MEDIATION_DETAILS_BY_ID_SUCCESS: {
            const currentUserId = state.userReducer?.user?._id;

            const processedSubChats = (payload.adminSubChats || []).map(sc => {
                let unreadCount = 0;
                const lastMessage = sc.messages && sc.messages.length > 0 ? sc.messages[sc.messages.length - 1] : null;

                if (sc.messages && currentUserId) {
                    sc.messages.forEach(msg => {
                        const senderId = msg.sender?._id || msg.sender;
                        if (senderId && senderId.toString() !== currentUserId &&
                            (!msg.readBy || !msg.readBy.some(r => r.readerId && (r.readerId._id || r.readerId).toString() === currentUserId))) {
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
        case UPDATE_MEDIATION_DETAILS_FROM_SOCKET: {
            const updatedRequest = payload;

            if (!updatedRequest || !updatedRequest._id) {
                console.warn("[Reducer] UPDATE_MEDIATION_DETAILS_FROM_SOCKET received with invalid payload. Aborting update.");
                return state;
            }

            console.log(`[Reducer] Handling UPDATE_MEDIATION_DETAILS_FROM_SOCKET for request: ${updatedRequest._id}, New Status: ${updatedRequest.status}`);

            if (updatedRequest.status === 'Cancelled') {
                console.log("%c[mediationReducer] Received CANCELLED request from socket. Data:", "color: red; font-weight: bold;", updatedRequest);
            }

            // ========================================================================
            // دالة مساعدة عامة لتحديث قوائم مهام الوسيط
            // ========================================================================
            const updateMediatorTaskList = (originalListObject) => {
                const currentList = originalListObject.list || [];
                const currentTotal = originalListObject.totalCount || 0;
                const itemIndex = currentList.findIndex(req => req._id === updatedRequest._id);

                if (itemIndex > -1) {
                    const newList = [...currentList];
                    newList[itemIndex] = updatedRequest; // استبدال العنصر بالكامل

                    // [!!!] أضف هذا الـ Log هنا [!!!]
                    if (updatedRequest.status === 'Cancelled') {
                        console.log("[mediationReducer] UPDATING buyer's list. New list will contain:", newList);
                    }

                    return { ...originalListObject, list: newList };
                }
                return originalListObject;

                const isFinished = ['Cancelled', 'Completed', 'AdminResolved'].includes(updatedRequest.status);

                if (isFinished) {
                    console.log(`   -> Request ${updatedRequest._id} has status '${updatedRequest.status}'. Removing from an active mediator list.`);
                    return {
                        ...originalListObject,
                        list: currentList.filter(req => req._id !== updatedRequest._id),
                        totalCount: Math.max(0, currentTotal - 1)
                    };
                } else {
                    console.log(`   -> Request ${updatedRequest._id} has status '${updatedRequest.status}'. Updating in an active mediator list.`);
                    const newList = [...currentList];
                    newList[itemIndex] = updatedRequest;
                    return {
                        ...originalListObject,
                        list: newList
                    };
                }
            };

            // ========================================================================
            // دالة خاصة بقائمة طلبات المشتري (لأنها تحتفظ بالطلبات الملغاة)
            // ========================================================================
            const updateBuyerRequestList = (originalListObject) => {
                const currentList = originalListObject.list || [];
                const itemIndex = currentList.findIndex(req => req._id === updatedRequest._id);

                if (itemIndex === -1) {
                    // إذا لم يكن موجودًا وكان للمستخدم الحالي، أضفه (حالة نادرة)
                    if (updatedRequest.buyer?._id === state.userReducer?.user?._id) {
                        return {
                            ...originalListObject,
                            list: [updatedRequest, ...currentList],
                            totalCount: (originalListObject.totalCount || 0) + 1,
                        };
                    }
                    return originalListObject;
                }

                console.log(`   -> Request ${updatedRequest._id} found in buyer's list. Updating with status '${updatedRequest.status}'.`);
                const newList = [...currentList];
                newList[itemIndex] = updatedRequest;
                return {
                    ...originalListObject,
                    list: newList
                };
            };

            // ========================================================================
            // بناء الـ state الجديد
            // ========================================================================
            return {
                ...state,
                activeMediationDetails: state.activeMediationDetails?._id === updatedRequest._id
                    ? updatedRequest
                    : state.activeMediationDetails,

                pendingDecisionAssignments: updateMediatorTaskList(state.pendingDecisionAssignments),
                acceptedAwaitingPartiesAssignments: updateMediatorTaskList(state.acceptedAwaitingPartiesAssignments),
                disputedCases: updateMediatorTaskList(state.disputedCases),

                buyerRequests: updateBuyerRequestList(state.buyerRequests),
            };
            }
        case CLEAR_ACTIVE_MEDIATION_DETAILS:
            return { ...state, activeMediationDetails: null, loadingActiveMediationDetails: false, errorActiveMediationDetails: null, adminSubChats: { ...initialState.adminSubChats }, activeSubChat: { ...initialState.activeSubChat } };

        case ADMIN_RESOLVE_DISPUTE_REQUEST:
            return { ...state, loadingResolveDispute: { ...state.loadingResolveDispute, [payload.mediationRequestId]: true }, errorResolveDispute: { ...state.errorResolveDispute, [payload.mediationRequestId]: null } };
        case ADMIN_RESOLVE_DISPUTE_SUCCESS:
            const updatedActiveDetails = state.activeMediationDetails?._id === payload.mediationRequestId ? payload.updatedMediationRequest : state.activeMediationDetails;
            return { ...state, loadingResolveDispute: { ...state.loadingResolveDispute, [payload.mediationRequestId]: false }, activeMediationDetails: updatedActiveDetails };
        case ADMIN_RESOLVE_DISPUTE_FAIL:
            return { ...state, loadingResolveDispute: { ...state.loadingResolveDispute, [payload.mediationRequestId]: false }, errorResolveDispute: { ...state.errorResolveDispute, [payload.mediationRequestId]: payload.error } };

        case ADMIN_CREATE_SUBCHAT_REQUEST:
            return { ...state, creatingSubChat: true, errorCreatingSubChat: null, successCreatingSubChat: false };
        case ADMIN_CREATE_SUBCHAT_SUCCESS:
            const newSubChatData = payload.subChat;
            const addAndSortSubChats = (list = []) => {
                if (list.some(sc => sc.subChatId === newSubChatData.subChatId)) {
                    return list;
                }
                return [...list, newSubChatData]
                    .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));
            };
            return {
                ...state,
                creatingSubChat: false,
                successCreatingSubChat: true,
                activeMediationDetails: state.activeMediationDetails ? {
                    ...state.activeMediationDetails,
                    adminSubChats: addAndSortSubChats(state.activeMediationDetails.adminSubChats)
                } : state.activeMediationDetails,
                adminSubChats: {
                    ...state.adminSubChats,
                    list: addAndSortSubChats(state.adminSubChats.list)
                }
            };
        case ADMIN_CREATE_SUBCHAT_FAIL:
            return { ...state, creatingSubChat: false, errorCreatingSubChat: payload, successCreatingSubChat: false };
        case ADMIN_CREATE_SUBCHAT_RESET:
            return { ...state, creatingSubChat: false, errorCreatingSubChat: null, successCreatingSubChat: false };

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
                                const senderId = msg.sender?._id || msg.sender;
                                if (senderId && senderId.toString() !== currentAdminIdForAllSub.toString() &&
                                    (!msg.readBy || !msg.readBy.some(r => r.readerId && (r.readerId._id || r.readerId).toString() === currentAdminIdForAllSub.toString()))) {
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

        case ADMIN_SUBCHAT_CREATED_SOCKET:
            if (state.activeMediationDetails?._id === payload.mediationRequestId) {
                const newSubChatFromSocket = { ...payload.subChat, unreadMessagesCount: 0 };
                const currentUserIdForCreated = state.userReducer?.user?._id;
                const isAdminUser = state.userReducer?.user?.userRole === 'Admin';

                const isCurrentUserParticipantOrAdmin = isAdminUser ||
                    newSubChatFromSocket.participants.some(p => p.userId?._id === currentUserIdForCreated);

                if (isCurrentUserParticipantOrAdmin) {
                    const existingActiveMediationSubChats = state.activeMediationDetails.adminSubChats || [];
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
            const { subChatId, message, currentUserId } = payload;
            const senderId = message.sender?._id || message.sender;

            // دالة مساعدة لإنشاء مقتطف من الرسالة
            const createSnippet = (msg) => {
                if (!msg) return "No messages yet.";
                if (msg.type === 'system') return "Chat started.";
                if (msg.type === 'image') return "[Image]";
                if (msg.message) return msg.message.substring(0, 25) + (msg.message.length > 25 ? "..." : "");
                return "New message";
            };

            // دالة آمنة لتحديث قائمة الشاتات
            const updateChatList = (originalList = []) => {
                const chatIndex = originalList.findIndex(sc => sc.subChatId === subChatId);

                // إذا لم يتم العثور على الشات، لا تفعل شيئًا لتجنب الأخطاء
                if (chatIndex === -1) {
                    return originalList;
                }

                // إنشاء نسخة جديدة من الشات الذي سيتم تحديثه
                const chatToUpdate = { ...originalList[chatIndex] };

                // تجنب إضافة رسالة مكررة
                if (chatToUpdate.messages?.some(m => m._id === message._id)) {
                    return originalList;
                }

                // تحديث خصائص الشات
                chatToUpdate.messages = [...(chatToUpdate.messages || []), message];
                chatToUpdate.lastMessageAt = message.timestamp;
                chatToUpdate.lastMessageSnippet = createSnippet(message);

                // زيادة العداد فقط إذا كانت الرسالة من شخص آخر
                const isFromOtherUser = senderId?.toString() !== currentUserId.toString();
                if (isFromOtherUser) {
                    chatToUpdate.unreadMessagesCount = (chatToUpdate.unreadMessagesCount || 0) + 1;
                }

                // [!!] هذا هو الجزء الحاسم [!!]
                // إنشاء مصفوفة جديدة بالكامل، وإعادة ترتيبها
                const newList = [
                    chatToUpdate, // الشات المحدث في المقدمة
                    ...originalList.slice(0, chatIndex), // كل العناصر قبل الشات القديم
                    ...originalList.slice(chatIndex + 1) // كل العناصر بعد الشات القديم
                ];

                return newList;
            };

            // تطبيق التحديث على جميع أجزاء الـ state ذات الصلة
            return {
                ...state,

                // إنشاء كائن جديد لـ adminSubChats ومصفوفة جديدة لـ list
                adminSubChats: {
                    ...state.adminSubChats,
                    list: updateChatList(state.adminSubChats.list),
                },

                // إنشاء كائن جديد لـ activeSubChat إذا تم تحديثه
                activeSubChat: state.activeSubChat.id === subChatId ? {
                    ...state.activeSubChat,
                    messages: [...state.activeSubChat.messages, message]
                } : state.activeSubChat,

                // إنشاء كائن جديد لـ activeMediationDetails إذا تم تحديثه
                activeMediationDetails: state.activeMediationDetails ? {
                    ...state.activeMediationDetails,
                    adminSubChats: updateChatList(state.activeMediationDetails.adminSubChats || []),
                } : null,
            };
        }

        case ADMIN_SUBCHAT_MESSAGES_STATUS_UPDATED_SOCKET: {
            const { subChatId, readerInfo, messageIds } = payload;

            if (!Array.isArray(messageIds) || !readerInfo || !readerInfo.readerId) {
                console.error("Reducer: Received ADMIN_SUBCHAT_MESSAGES_STATUS_UPDATED_SOCKET without a valid payload.", { payload });
                return state;
            }

            const updateMessagesWithReadStatus = (messages = []) => {
                return messages.map(msg => {
                    if (messageIds.includes(msg._id)) {
                        const readByArray = msg.readBy || [];
                        if (!readByArray.some(r => (r.readerId?._id || r.readerId)?.toString() === readerInfo.readerId.toString())) {
                            return { ...msg, readBy: [...readByArray, readerInfo] };
                        }
                    }
                    return msg;
                });
            };

            const updateSubChatList = (list = []) => {
                return list.map(chat => {
                    if (chat.subChatId === subChatId) {
                        const updatedMessages = updateMessagesWithReadStatus(chat.messages || []);
                        return { ...chat, messages: updatedMessages };
                    }
                    return chat;
                });
            };

            return {
                ...state,
                adminSubChats: {
                    ...state.adminSubChats,
                    list: updateSubChatList(state.adminSubChats.list),
                },
                activeSubChat: {
                    ...state.activeSubChat,
                    messages: state.activeSubChat.id === subChatId
                        ? updateMessagesWithReadStatus(state.activeSubChat.messages)
                        : state.activeSubChat.messages,
                },
                activeMediationDetails: state.activeMediationDetails
                    ? {
                        ...state.activeMediationDetails,
                        adminSubChats: updateSubChatList(state.activeMediationDetails.adminSubChats),
                    }
                    : null,
            };
        }

        case UPDATE_SINGLE_MEDIATION_REQUEST_IN_STORE:
            const updatedRequest = action.payload;
            if (!updatedRequest || !updatedRequest._id) return state;

            const buyerList = state.buyerRequests.list || [];
            const buyerRequestExists = buyerList.some(req => req._id === updatedRequest._id);
            let updatedBuyerRequestsList;

            if (buyerRequestExists) {
                updatedBuyerRequestsList = buyerList.map(req =>
                    req._id === updatedRequest._id ? updatedRequest : req
                );
            } else {
                if (updatedRequest.buyer?._id === state.userReducer?.user?._id) {
                    updatedBuyerRequestsList = [updatedRequest, ...buyerList];
                } else {
                    updatedBuyerRequestsList = buyerList;
                }
            }

            return {
                ...state,
                buyerRequests: {
                    ...state.buyerRequests,
                    list: updatedBuyerRequestsList
                },
            };

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

        case 'MARK_SUBCHAT_AS_READ_IN_LIST': {
            const { subChatId } = payload;
            const updateList = (list) => {
                if (!list) return [];
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
                activeMediationDetails: state.activeMediationDetails
                    ? {
                        ...state.activeMediationDetails,
                        adminSubChats: updateList(state.activeMediationDetails.adminSubChats),
                    }
                    : null,
            };
        }

        case ADD_PENDING_ASSIGNMENT_FROM_SOCKET: {
            const newAssignment = payload;
            const list = state.pendingDecisionAssignments.list || [];

            // تأكد من عدم إضافة نسخة مكررة
            if (list.some(item => item._id === newAssignment._id)) {
                return state;
            }

            return {
                ...state,
                pendingDecisionAssignments: {
                    ...state.pendingDecisionAssignments,
                    list: [newAssignment, ...list], // أضف المهمة الجديدة في بداية القائمة
                    totalCount: (state.pendingDecisionAssignments.totalCount || 0) + 1,
                },
            };
        }

        default:
            return state;
    }
};

export default mediationReducer;