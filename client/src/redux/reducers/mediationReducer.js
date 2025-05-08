// src/redux/reducers/mediationReducer.js
import {
    ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST, ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS, ADMIN_GET_PENDING_ASSIGNMENTS_FAIL,
    ADMIN_ASSIGN_MEDIATOR_REQUEST, ADMIN_ASSIGN_MEDIATOR_SUCCESS, ADMIN_ASSIGN_MEDIATOR_FAIL, ADMIN_ASSIGN_MEDIATOR_RESET,
    ADMIN_CLEAR_MEDIATION_ERRORS
} from '../actionTypes/mediationActionTypes';

const initialState = {
    pendingAssignments: { // لتخزين طلبات التعيين المعلقة
        requests: [],
        totalPages: 0,
        currentPage: 1,
        totalRequests: 0,
    },
    loadingPending: false,
    errorPending: null,

    assigningMediator: {}, // لتتبع الطلبات التي يتم تعيين وسيط لها حاليًا { requestId: true }
    errorAssign: null,
    successAssign: false, // للإشارة إلى نجاح آخر عملية تعيين
};

const mediationReducer = (state = initialState, action) => {
    const { type, payload } = action;

    switch (type) {
        // جلب الطلبات المعلقة
        case ADMIN_GET_PENDING_ASSIGNMENTS_REQUEST:
            return { ...state, loadingPending: true, errorPending: null };
        case ADMIN_GET_PENDING_ASSIGNMENTS_SUCCESS:
            return {
                ...state,
                loadingPending: false,
                pendingAssignments: payload || { requests: [], totalPages: 0, currentPage: 1, totalRequests: 0 }
            };
        case ADMIN_GET_PENDING_ASSIGNMENTS_FAIL:
            return { ...state, loadingPending: false, errorPending: payload };

        // تعيين وسيط
        case ADMIN_ASSIGN_MEDIATOR_REQUEST:
            return {
                ...state,
                assigningMediator: { ...state.assigningMediator, [payload.requestId]: true },
                errorAssign: null,
                successAssign: false
            };
        case ADMIN_ASSIGN_MEDIATOR_SUCCESS:
            // إزالة الطلب الذي تم تعيين وسيط له من قائمة pendingAssignments
            const assignedRequestId = payload.updatedRequest?._id;
            return {
                ...state,
                assigningMediator: { ...state.assigningMediator, [assignedRequestId]: false },
                pendingAssignments: {
                    ...state.pendingAssignments,
                    requests: state.pendingAssignments.requests.filter(req => req._id !== assignedRequestId),
                    totalRequests: Math.max(0, state.pendingAssignments.totalRequests - 1) // تحديث العدد الإجمالي
                    // ملاحظة: تحديث totalPages و currentPage قد يكون أكثر تعقيدًا إذا كنت تريد الحفاظ على ترقيم الصفحات دقيقًا بعد الحذف
                },
                successAssign: true,
                errorAssign: null
            };
        case ADMIN_ASSIGN_MEDIATOR_FAIL:
            return {
                ...state,
                assigningMediator: { ...state.assigningMediator, [payload.requestId]: false },
                errorAssign: payload.error,
                successAssign: false
            };
        case ADMIN_ASSIGN_MEDIATOR_RESET:
            return { ...state, successAssign: false, errorAssign: null };

        // مسح الأخطاء
        case ADMIN_CLEAR_MEDIATION_ERRORS:
            return { ...state, errorPending: null, errorAssign: null };

        default:
            return state;
    }
};

export default mediationReducer;