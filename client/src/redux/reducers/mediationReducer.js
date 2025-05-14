// src/redux/reducers/mediationReducer.js
import {
    ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST, ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS, ADMIN_GET_PENDING_ASSIGNMENTS_FAIL,
    ADMIN_ASSIGN_MEDIATOR_REQUEST, ADMIN_ASSIGN_MEDIATOR_SUCCESS, ADMIN_ASSIGN_MEDIATOR_FAIL,
    ADMIN_ASSIGN_MEDIATOR_RESET, ADMIN_CLEAR_MEDIATION_ERRORS, ASSIGN_MEDIATOR_REQUEST, 
    ASSIGN_MEDIATOR_SUCCESS, ASSIGN_MEDIATOR_FAIL, GET_MEDIATOR_ASSIGNMENTS_REQUEST, GET_MEDIATOR_ASSIGNMENTS_SUCCESS, 
    GET_MEDIATOR_ASSIGNMENTS_FAIL, MEDIATOR_ACCEPT_ASSIGNMENT_REQUEST, MEDIATOR_ACCEPT_ASSIGNMENT_SUCCESS, 
    MEDIATOR_ACCEPT_ASSIGNMENT_FAIL, MEDIATOR_REJECT_ASSIGNMENT_REQUEST, MEDIATOR_REJECT_ASSIGNMENT_SUCCESS, 
    MEDIATOR_REJECT_ASSIGNMENT_FAIL, GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_REQUEST, 
    GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_SUCCESS,GET_MEDIATOR_ACCEPTED_AWAITING_PARTIES_FAIL, 
    SELLER_CONFIRM_READINESS_REQUEST, SELLER_CONFIRM_READINESS_SUCCESS, SELLER_CONFIRM_READINESS_FAIL, 
    BUYER_CONFIRM_READINESS_ESCROW_REQUEST, BUYER_CONFIRM_READINESS_ESCROW_SUCCESS, BUYER_CONFIRM_READINESS_ESCROW_FAIL, 
    GET_BUYER_MEDIATION_REQUESTS_REQUEST, GET_BUYER_MEDIATION_REQUESTS_SUCCESS, GET_BUYER_MEDIATION_REQUESTS_FAIL,
    BUYER_REJECT_MEDIATION_REQUEST, BUYER_REJECT_MEDIATION_SUCCESS, BUYER_REJECT_MEDIATION_FAIL,
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

        default:
            return state;
    }
};

export default mediationReducer;