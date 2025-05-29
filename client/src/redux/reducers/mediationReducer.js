// src/redux/reducers/mediationReducer.js
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
    ADMIN_RESOLVE_DISPUTE_SUCCESS, ADMIN_RESOLVE_DISPUTE_FAIL
} from '../actionTypes/mediationActionTypes';

const initialState = {
    // حالة خاصة بمهام الأدمن
    pendingAssignmentsAdmin: { // تم تغيير الاسم ليكون أوضح أنه للأدمن
        requests: [],
        totalPages: 0,
        currentPage: 1,
        totalRequests: 0,
    },
    loadingPendingAdmin: false,
    errorPendingAdmin: null,

    // حالة خاصة بتعيين الوسيط (سواء من الأدمن أو البائع)
    assigningMediator: {}, // { [requestId]: true }
    errorAssign: null,
    successAssign: false,

    // حالة خاصة بمهام الوسيط الحالية التي تنتظر قراره
    pendingDecisionAssignments: {
        list: [],
        totalPages: 1,
        currentPage: 1,
        totalCount: 0,
    },
    loadingPendingDecision: false,
    errorPendingDecision: null,

    // حالة خاصة بالمهام التي قبلها الوسيط وتنتظر تأكيد الأطراف
    acceptedAwaitingPartiesAssignments: {
        list: [],
        totalPages: 1,
        currentPage: 1,
        totalCount: 0,
    },
    loadingAcceptedAwaitingParties: false,
    errorAcceptedAwaitingParties: null,

    // حالة لعمليات القبول/الرفض التي يقوم بها الوسيط
    actionLoading: false,
    actionError: null,
    actionSuccess: false,

    buyerRequests: { // <--- حالة جديدة لطلبات المشتري
        list: [],
        totalPages: 1,
        currentPage: 1,
        totalCount: 0,
    },
    loadingBuyerRequests: false,
    errorBuyerRequests: null,

    confirmingReadiness: false, // مثال لحالة تحميل عامة لتأكيد الاستعداد
    confirmReadinessError: null,

    myMediationSummaries: {
        requests: [], // كان اسمه mediationRequests، تم توحيده مع payload
        loading: false,
        error: null,
        totalUnreadMessagesCount: 0,
    },

    disputedCases: { list: [], totalPages: 1, currentPage: 1, totalCount: 0 },
    loadingDisputedCases: false,
    errorDisputedCases: null,

    adminDisputedMediations: { list: [], totalPages: 1, currentPage: 1, totalCount: 0 },
    loadingAdminDisputed: false,
    errorAdminDisputed: null,

    activeMediationDetails: null,
    loadingActiveMediationDetails: false,
    errorActiveMediationDetails: null,

    loadingResolveDispute: {}, // لتتبع حالة تحميل حل النزاع لكل طلب
    errorResolveDispute: {},   // لتتبع أخطاء حل النزاع
};

const mediationReducer = (state = initialState, action) => {
    const { type, payload } = action;

    switch (type) {
        // --- Admin: Get Pending Assignments (لتعيين الوسيط من قبل الأدمن) ---
        case ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST:
            return { ...state, loadingPendingAdmin: true, errorPendingAdmin: null };
        case ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS:
            return {
                ...state,
                loadingPendingAdmin: false,
                pendingAssignmentsAdmin: payload || { requests: [], totalPages: 0, currentPage: 1, totalRequests: 0 }
            };
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
                successAssign: true,
                errorAssign: null
            };
        case ADMIN_ASSIGN_MEDIATOR_FAIL:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.requestId]: false }, errorAssign: payload.error, successAssign: false };
        case ADMIN_ASSIGN_MEDIATOR_RESET:
            return { ...state, successAssign: false, errorAssign: null };
        case ADMIN_CLEAR_MEDIATION_ERRORS:
            return { ...state, errorPendingAdmin: null, errorAssign: null };

        // --- Seller: Assign Selected Mediator ---
        case ASSIGN_MEDIATOR_REQUEST:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.mediationRequestId]: true }, errorAssign: null, successAssign: false };
        case ASSIGN_MEDIATOR_SUCCESS:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.mediationRequestId]: false }, successAssign: true, errorAssign: null };
        case ASSIGN_MEDIATOR_FAIL:
            return { ...state, assigningMediator: { ...state.assigningMediator, [payload.mediationRequestId]: false }, errorAssign: payload.error, successAssign: false };

        // --- Mediator: Get Own Assignments (Pending Decision - Status: MediatorAssigned) ---
        case GET_MEDIATOR_ASSIGNMENTS_REQUEST:
            return { ...state, loadingPendingDecision: true, errorPendingDecision: null, actionSuccess: false }; // إعادة تعيين actionSuccess
        case GET_MEDIATOR_ASSIGNMENTS_SUCCESS:
            return {
                ...state,
                loadingPendingDecision: false,
                pendingDecisionAssignments: {
                    list: payload.assignments || [],
                    totalPages: payload.totalPages || 1,
                    currentPage: payload.currentPage || 1,
                    totalCount: payload.totalAssignments || 0,
                }
            };
        case GET_MEDIATOR_ASSIGNMENTS_FAIL:
            return { ...state, loadingPendingDecision: false, errorPendingDecision: payload, pendingDecisionAssignments: { ...initialState.pendingDecisionAssignments } };

        // --- Mediator: Get Accepted Assignments Awaiting Parties (Status: MediationOfferAccepted) ---
        case GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_REQUEST:
            return { ...state, loadingAcceptedAwaitingParties: true, errorAcceptedAwaitingParties: null, actionSuccess: false };
        case GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_SUCCESS:
            return {
                ...state,
                loadingAcceptedAwaitingParties: false,
                acceptedAwaitingPartiesAssignments: {
                    list: payload.assignments || [],
                    totalPages: payload.totalPages || 1,
                    currentPage: payload.currentPage || 1,
                    totalCount: payload.totalAssignments || 0,
                }
            };
        case GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_FAIL:
            return { ...state, loadingAcceptedAwaitingParties: false, errorAcceptedAwaitingParties: payload, acceptedAwaitingPartiesAssignments: { ...initialState.acceptedAwaitingPartiesAssignments } };

        // --- Mediator: Accept Assignment ---
        case MEDIATOR_ACCEPT_ASSIGNMENT_REQUEST:
            return { ...state, actionLoading: true, actionError: null, actionSuccess: false };
        case MEDIATOR_ACCEPT_ASSIGNMENT_SUCCESS:
            return {
                ...state,
                actionLoading: false,
                actionSuccess: true,
                pendingDecisionAssignments: {
                    ...state.pendingDecisionAssignments,
                    list: state.pendingDecisionAssignments.list.filter(
                        (assignment) => assignment._id !== payload.mediationRequestId
                    ),
                    totalCount: Math.max(0, state.pendingDecisionAssignments.totalCount - 1),
                },
                // لا نحدّث acceptedAwaitingPartiesAssignments هنا مباشرة، نعتمد على إعادة الجلب أو تحديث متفائل إذا لزم الأمر
            };
        case MEDIATOR_ACCEPT_ASSIGNMENT_FAIL:
            return { ...state, actionLoading: false, actionError: payload.error, actionSuccess: false };

        // --- Mediator: Reject Assignment ---
        case MEDIATOR_REJECT_ASSIGNMENT_REQUEST:
            return { ...state, actionLoading: true, actionError: null, actionSuccess: false };
        case MEDIATOR_REJECT_ASSIGNMENT_SUCCESS:
            return {
                ...state,
                actionLoading: false,
                actionSuccess: true,
                pendingDecisionAssignments: {
                    ...state.pendingDecisionAssignments,
                    list: state.pendingDecisionAssignments.list.filter(
                        (assignment) => assignment._id !== payload.mediationRequestId
                    ),
                    totalCount: Math.max(0, state.pendingDecisionAssignments.totalCount - 1),
                },
            };
        case MEDIATOR_REJECT_ASSIGNMENT_FAIL:
            return { ...state, actionLoading: false, actionError: payload.error, actionSuccess: false };

        // --- Seller Confirm Readiness ---
        case SELLER_CONFIRM_READINESS_REQUEST:
            return { ...state, confirmingReadiness: true, confirmReadinessError: null, actionSuccess: false };
        case SELLER_CONFIRM_READINESS_SUCCESS:
            // تحديث حالة طلب الوساطة المعني في إحدى القوائم إذا لزم الأمر
            // الـ backend يعيد mediationRequest المحدث، يمكن استخدامه لتحديث الحالة محليًا
            // أو الاعتماد على getProducts/getAssignments لإعادة الجلب
            return {
                ...state,
                confirmingReadiness: false,
                actionSuccess: true, // للإشارة إلى نجاح العملية
                // مثال لتحديث الطلب في قائمة acceptedAwaitingPartiesAssignments إذا كان موجودًا هناك
                acceptedAwaitingPartiesAssignments: {
                    ...state.acceptedAwaitingPartiesAssignments,
                    list: state.acceptedAwaitingPartiesAssignments.list.map(req =>
                        req._id === payload.mediationRequestId ? payload.responseData.mediationRequest : req
                    )
                }
            };
        case SELLER_CONFIRM_READINESS_FAIL:
            return { ...state, confirmingReadiness: false, confirmReadinessError: payload.error, actionSuccess: false };

        // --- Buyer Confirm Readiness & Escrow ---
        case BUYER_CONFIRM_READINESS_ESCROW_REQUEST:
            return { ...state, confirmingReadiness: true, confirmReadinessError: null, actionSuccess: false };
        case BUYER_CONFIRM_READINESS_ESCROW_SUCCESS:
            return {
                ...state,
                confirmingReadiness: false,
                actionSuccess: true,
                acceptedAwaitingPartiesAssignments: {
                    ...state.acceptedAwaitingPartiesAssignments,
                    list: state.acceptedAwaitingPartiesAssignments.list.map(req =>
                        req._id === payload.mediationRequestId ? payload.responseData.mediationRequest : req
                    )
                }
            };
        case BUYER_CONFIRM_READINESS_ESCROW_FAIL:
            return { ...state, confirmingReadiness: false, confirmReadinessError: payload.error, actionSuccess: false };

        // --- [!!!] تأكد من وجود هذه الحالات [!!!] ---
        case GET_BUYER_MEDIATION_REQUESTS_REQUEST:
            return { ...state, loadingBuyerRequests: true, errorBuyerRequests: null };
        case GET_BUYER_MEDIATION_REQUESTS_SUCCESS:
            return {
                ...state,
                loadingBuyerRequests: false,
                buyerRequests: {
                    list: payload.requests || [],
                    totalPages: payload.totalPages || 1,
                    currentPage: payload.currentPage || 1,
                    totalCount: payload.totalRequests || 0,
                },
                errorBuyerRequests: null, // مسح أي خطأ سابق عند النجاح
            };
        case GET_BUYER_MEDIATION_REQUESTS_FAIL:
            return {
                ...state,
                loadingBuyerRequests: false,
                errorBuyerRequests: payload,
                buyerRequests: { ...initialState.buyerRequests } // إعادة للقيم الأولية عند الفشل
            };

        // --- Buyer Reject Mediation ---
        case BUYER_REJECT_MEDIATION_REQUEST:
            return { ...state, actionLoading: true, actionError: null, actionSuccess: false }; // استخدام actionLoading العام
        case BUYER_REJECT_MEDIATION_SUCCESS:
            return {
                ...state,
                actionLoading: false,
                actionSuccess: true, // للإشارة إلى نجاح عملية الرفض
                // إزالة الطلب الملغى من قائمة المشتري
                buyerRequests: {
                    ...state.buyerRequests,
                    list: state.buyerRequests.list.filter(req => req._id !== payload.mediationRequestId),
                    totalCount: Math.max(0, state.buyerRequests.totalCount - 1),
                }
            };
        case BUYER_REJECT_MEDIATION_FAIL:
            return { ...state, actionLoading: false, actionError: payload.error, actionSuccess: false };

        // --- Get My Mediation Summaries (for messages/chats list) ---
        case GET_MY_MEDIATION_SUMMARIES_REQUEST:
            return {
                ...state,
                myMediationSummaries: {
                    ...state.myMediationSummaries, // الحفاظ على البيانات القديمة أثناء التحميل
                    loading: true,
                    error: null,
                },
            };
        case GET_MY_MEDIATION_SUMMARIES_SUCCESS:
            return {
                ...state,
                myMediationSummaries: {
                    requests: payload.requests || [],
                    loading: false,
                    error: null,
                    // payload.totalUnreadMessagesCount هو الاسم الذي تستخدمه في MainDashboard
                    // payload.totalUnreadMessages هو الاسم الذي استخدمته في مثال سابق للخادم
                    // تأكد من تطابق هذا الاسم مع ما يرسله الخادم getMyMediationSummariesController
                    totalUnreadMessagesCount: payload.totalUnreadMessagesCount || payload.totalUnreadMessages || 0,
                },
            };
        case GET_MY_MEDIATION_SUMMARIES_FAIL:
            return {
                ...state,
                myMediationSummaries: {
                    ...state.myMediationSummaries, // الحفاظ على البيانات القديمة عند الخطأ
                    requests: [], // أو الحفاظ على البيانات القديمة
                    loading: false,
                    error: payload,
                    totalUnreadMessagesCount: 0, // أو الحفاظ على القيمة القديمة
                },
            };
        case MARK_MEDIATION_AS_READ_IN_LIST:
            // payload: { mediationId }
            const updatedRequestsMarkRead = state.myMediationSummaries.requests.map(med =>
                med._id === payload.mediationId
                    ? { ...med, unreadMessagesCount: 0 } // تصفير العداد لهذه الوساطة
                    : med
            );
            const newTotalUnreadMarkRead = updatedRequestsMarkRead.reduce((total, med) => {
                return total + (med.unreadMessagesCount || 0);
            }, 0);

            return {
                ...state,
                myMediationSummaries: {
                    ...state.myMediationSummaries,
                    requests: updatedRequestsMarkRead,
                    totalUnreadMessagesCount: newTotalUnreadMarkRead
                }
            };
        case UPDATE_UNREAD_COUNT_FROM_SOCKET:
            console.log("[Reducer MEDIATION] Handling UPDATE_UNREAD_COUNT_FROM_SOCKET. Payload:", payload);
            let foundMediation = false;
            const updatedRequestsSocket = state.myMediationSummaries.requests.map(med => {
                if (med._id === payload.mediationId) {
                    foundMediation = true;
                    return {
                        ...med,
                        unreadMessagesCount: payload.unreadCount,
                        lastMessageTimestamp: payload.lastMessageTimestamp || med.lastMessageTimestamp
                    };
                }
                return med;
            });

            let finalRequests = updatedRequestsSocket;
            let newTotalUnreadSocket = 0; // سيتم إعادة حسابه

            if (!foundMediation && payload.productTitle && payload.otherPartyForRecipient) {
                const newMediationSummary = {
                    _id: payload.mediationId,
                    product: { title: payload.productTitle, imageUrl: payload.otherPartyForRecipient?.avatarUrl /* مثال */ },
                    status: 'InProgress', // أو الحالة التي تأتي من payload إذا كانت موجودة
                    otherParty: payload.otherPartyForRecipient,
                    unreadMessagesCount: payload.unreadCount,
                    lastMessageTimestamp: payload.lastMessageTimestamp,
                    updatedAt: payload.lastMessageTimestamp,
                };
                finalRequests = [newMediationSummary, ...updatedRequestsSocket];
                console.log("[Reducer MEDIATION] Added new mediation summary from socket:", newMediationSummary);
            }

            // إعادة ترتيب القائمة
            finalRequests.sort((a, b) => {
                if (a._id === payload.mediationId && b._id !== payload.mediationId) return -1;
                if (a._id !== payload.mediationId && b._id === payload.mediationId) return 1;
                if (a.unreadMessagesCount > 0 && b.unreadMessagesCount === 0) return -1;
                if (a.unreadMessagesCount === 0 && b.unreadMessagesCount > 0) return 1;
                return new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp);
            });

            // إعادة حساب الإجمالي بناءً على finalRequests المحدثة
            newTotalUnreadSocket = finalRequests.reduce((total, med) => {
                return total + (med.unreadMessagesCount || 0);
            }, 0);

            console.log("[Reducer MEDIATION] New totalUnreadMessagesCount:", newTotalUnreadSocket);
            console.log("[Reducer MEDIATION] Final requests for summary:", finalRequests);

            return {
                ...state,
                myMediationSummaries: {
                    ...state.myMediationSummaries,
                    requests: finalRequests, // <--- استخدام finalRequests المحدثة
                    totalUnreadMessagesCount: newTotalUnreadSocket, // <--- استخدام الإجمالي الجديد
                    loading: false, // تأكد من أن loading false إذا لم يكن هناك طلب API هنا
                    error: null,   // مسح أي خطأ سابق
                }
            };

        // --- Buyer Confirm Receipt ---
        case BUYER_CONFIRM_RECEIPT_REQUEST:
            return {
                ...state,
                // يمكنك استخدام actionLoading العام أو حالة تحميل مخصصة
                actionLoading: true,
                actionError: null,
                // confirmingReceipt: { ...state.confirmingReceipt, [payload.mediationRequestId]: true },
            };
        case BUYER_CONFIRM_RECEIPT_SUCCESS:
            // تحديث حالة الوساطة في قائمة الملخصات (myMediationSummaries.requests)
            // وتحديثها في أي مكان آخر قد تكون موجودة فيه (مثل buyerRequests إذا كانت مختلفة)
            const updateRequestInList = (list) => list.map(req =>
                req._id === payload.mediationRequestId
                    ? payload.updatedMediationRequest // استخدام الطلب المحدث بالكامل من الخادم
                    : req
            );

            return {
                ...state,
                actionLoading: false,
                actionSuccess: true, // للإشارة العامة لنجاح عملية ما
                myMediationSummaries: {
                    ...state.myMediationSummaries,
                    requests: updateRequestInList(state.myMediationSummaries.requests),
                },
                buyerRequests: { // إذا كان لديك buyerRequests منفصل
                    ...state.buyerRequests,
                    list: updateRequestInList(state.buyerRequests.list),
                },
                // يمكنك تحديث تفاصيل الوساطة الحالية إذا كانت معروضة في مكان ما
                // currentMediationDetails: state.currentMediationDetails?._id === payload.mediationRequestId 
                //    ? payload.updatedMediationRequest 
                //    : state.currentMediationDetails,
            };
        case BUYER_CONFIRM_RECEIPT_FAIL:
            return {
                ...state,
                actionLoading: false,
                actionError: payload.error,
            };

        // --- Open Dispute ---
        case OPEN_DISPUTE_REQUEST:
            return {
                ...state,
                actionLoading: true,
                actionError: null,
            };
        case OPEN_DISPUTE_SUCCESS:
            const updateRequestInListsOpenDispute = (list) => list.map(req =>
                req._id === payload.mediationRequestId
                    ? payload.updatedMediationRequest
                    : req
            );
            return {
                ...state,
                actionLoading: false,
                actionSuccess: true,
                myMediationSummaries: {
                    ...state.myMediationSummaries,
                    requests: updateRequestInListsOpenDispute(state.myMediationSummaries.requests),
                },
                buyerRequests: { // إذا كان لديك buyerRequests منفصل
                    ...state.buyerRequests,
                    list: updateRequestInListsOpenDispute(state.buyerRequests.list),
                },
                // يمكنك تحديث أي قائمة أخرى قد تحتوي على هذا الطلب
            };
        case OPEN_DISPUTE_FAIL:
            return {
                ...state,
                actionLoading: false,
                actionError: payload.error,
            };

        case GET_MEDIATOR_DISPUTED_CASES_REQUEST:
            return { ...state, loadingDisputedCases: true, errorDisputedCases: null };
        case GET_MEDIATOR_DISPUTED_CASES_SUCCESS:
            return {
                ...state,
                loadingDisputedCases: false,
                disputedCases: {
                    list: payload.assignments || payload.requests || [], // تأكد من اسم الحقل من الخادم
                    totalPages: payload.totalPages || 1,
                    currentPage: payload.currentPage || 1,
                    totalCount: payload.totalAssignments || payload.totalRequests || 0,
                }
            };
        case GET_MEDIATOR_DISPUTED_CASES_FAIL:
            return { ...state, loadingDisputedCases: false, errorDisputedCases: payload, disputedCases: { list: [], totalPages: 1, currentPage: 1, totalCount: 0 } };

        case ADMIN_GET_DISPUTED_MEDIATIONS_REQUEST:
            return { ...state, loadingAdminDisputed: true, errorAdminDisputed: null };
        case ADMIN_GET_DISPUTED_MEDIATIONS_SUCCESS:
            return {
                ...state,
                loadingAdminDisputed: false,
                adminDisputedMediations: {
                    list: payload.requests || payload.mediations || [],
                    totalPages: payload.totalPages || 1,
                    currentPage: payload.currentPage || 1,
                    totalCount: payload.totalRequests || payload.totalMediations || 0,
                },
            };
        case ADMIN_GET_DISPUTED_MEDIATIONS_FAIL:
            return { ...state, loadingAdminDisputed: false, errorAdminDisputed: payload, adminDisputedMediations: { list: [], totalPages: 1, currentPage: 1, totalCount: 0 } };

        case GET_MEDIATION_DETAILS_BY_ID_REQUEST:
            return {
                ...state,
                loadingActiveMediationDetails: true,
                errorActiveMediationDetails: null,
                // يمكنك اختيار مسح التفاصيل القديمة هنا أو عند النجاح فقط
                // activeMediationDetails: null,
            };
        case GET_MEDIATION_DETAILS_BY_ID_SUCCESS:
            return {
                ...state,
                loadingActiveMediationDetails: false,
                activeMediationDetails: payload,
            };
        case GET_MEDIATION_DETAILS_BY_ID_FAIL:
            return {
                ...state,
                loadingActiveMediationDetails: false,
                errorActiveMediationDetails: payload,
            };
        case UPDATE_MEDIATION_DETAILS_FROM_SOCKET:
            // تأكد من أن الـ payload هو كائن تفاصيل الوساطة المحدث
            // وأن الـ ID يطابق الوساطة النشطة الحالية (إذا كان هناك واحدة)
            if (state.activeMediationDetails && state.activeMediationDetails._id === payload._id) {
                return {
                    ...state,
                    activeMediationDetails: payload,
                };
            }
            return state; // إذا لم تكن الوساطة النشطة أو لا يوجد payload
        case CLEAR_ACTIVE_MEDIATION_DETAILS:
            return {
                ...state,
                activeMediationDetails: null,
                loadingActiveMediationDetails: false,
                errorActiveMediationDetails: null,
            };

        case ADMIN_RESOLVE_DISPUTE_REQUEST:
            return {
                ...state,
                loadingResolveDispute: {
                    ...state.loadingResolveDispute,
                    [action.payload.mediationRequestId]: true,
                },
                errorResolveDispute: {
                    ...state.errorResolveDispute,
                    [action.payload.mediationRequestId]: null,
                }
            };
        case ADMIN_RESOLVE_DISPUTE_SUCCESS:
            // تحديث activeMediationDetails إذا كان هذا هو الطلب النشط
            const updatedActiveDetails = state.activeMediationDetails?._id === action.payload.mediationRequestId
                ? action.payload.updatedMediationRequest
                : state.activeMediationDetails;

            // (اختياري) تحديث قائمة النزاعات إذا كانت موجودة في هذا الـ reducer
            // const updatedDisputedCases = (state.adminDisputedMediations?.requests || []).map(req =>
            //     req._id === action.payload.mediationRequestId ? action.payload.updatedMediationRequest : req
            // );

            return {
                ...state,
                loadingResolveDispute: {
                    ...state.loadingResolveDispute,
                    [action.payload.mediationRequestId]: false,
                },
                activeMediationDetails: updatedActiveDetails,
                // adminDisputedMediations: state.adminDisputedMediations ? {
                //     ...state.adminDisputedMediations,
                //     requests: updatedDisputedCases
                // } : state.adminDisputedMediations,
                // يمكنك أيضًا إزالة الطلب من قائمة النزاعات إذا أصبحت حالته "AdminResolved"
            };
        case ADMIN_RESOLVE_DISPUTE_FAIL:
            return {
                ...state,
                loadingResolveDispute: {
                    ...state.loadingResolveDispute,
                    [action.payload.mediationRequestId]: false,
                },
                errorResolveDispute: {
                    ...state.errorResolveDispute,
                    [action.payload.mediationRequestId]: action.payload.error,
                }
            };

        default:
            return state;
    }
};

export default mediationReducer;