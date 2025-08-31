// src/redux/reducers/depositReducer.js // <-- تأكد من اسم الملف الصحيح
import {
    CREATE_DEPOSIT_REQUEST, CREATE_DEPOSIT_SUCCESS, CREATE_DEPOSIT_FAIL, CREATE_DEPOSIT_RESET,
    // --- إضافة الأنواع الجديدة ---
    GET_USER_DEPOSITS_REQUEST, GET_USER_DEPOSITS_SUCCESS, GET_USER_DEPOSITS_FAIL,
    // ---------------------------
    ADMIN_GET_DEPOSITS_REQUEST, ADMIN_GET_DEPOSITS_SUCCESS, ADMIN_GET_DEPOSITS_FAIL,
    ADMIN_APPROVE_DEPOSIT_REQUEST, ADMIN_APPROVE_DEPOSIT_SUCCESS, ADMIN_APPROVE_DEPOSIT_FAIL,
    ADMIN_REJECT_DEPOSIT_REQUEST, ADMIN_REJECT_DEPOSIT_SUCCESS, ADMIN_REJECT_DEPOSIT_FAIL,
    CLEAR_DEPOSIT_ERRORS,
    // --- إزالة أو إبقاء الأنواع القديمة معلقة ---
    // GET_DEPOSIT_HISTORY_REQUEST, GET_DEPOSIT_HISTORY_SUCCESS, GET_DEPOSIT_HISTORY_FAIL,
} from '../actionTypes/depositActionType'; // <-- تأكد من اسم الملف الصحيح

const initialState = {
    // --- [جديد] حالة طلبات المستخدم ---
    userRequests: [],
    loadingUserRequests: false,
    errorUserRequests: null,
    // --------------------------------
    // --- حالة طلبات الأدمن (بأسماء الحقول الصحيحة) ---
    adminRequestsData: {
        requests: [],
        totalPages: 0,
        currentPage: 1,
        totalRequests: 0,
    },
    // -------------------------------------------
    // depositHistory: [], // إزالة أو إعادة تسمية هذا
    loadingCreate: false,
    // loadingHistory: false, // إزالة أو إعادة تسمية
    loadingAdminList: false, // تغيير الاسم ليكون أوضح
    loadingAdminAction: {},
    errorCreate: null,
    // errorHistory: null, // إزالة أو إعادة تسمية
    errorAdminList: null, // تغيير الاسم ليكون أوضح
    errorAdminAction: null,
    successCreate: false,
    createdRequest: null,
};

const depositRequestReducer = (state = initialState, { type, payload }) => {
    switch (type) {
        // ... (حالات CREATE_DEPOSIT) ...
        case CREATE_DEPOSIT_REQUEST: return { ...state, loadingCreate: true, errorCreate: null, successCreate: false, createdRequest: null };
        case CREATE_DEPOSIT_SUCCESS: return { ...state, loadingCreate: false, successCreate: true, createdRequest: payload, errorCreate: null };
        case CREATE_DEPOSIT_FAIL: return { ...state, loadingCreate: false, errorCreate: payload, successCreate: false };
        case CREATE_DEPOSIT_RESET: return { ...state, loadingCreate: false, successCreate: false, errorCreate: null, createdRequest: null };

        // --- [جديد] حالات جلب طلبات المستخدم ---
        case GET_USER_DEPOSITS_REQUEST:
            return { ...state, loadingUserRequests: true, errorUserRequests: null };
        case GET_USER_DEPOSITS_SUCCESS:
            // افترض أن payload هو { requests, totalPages, currentPage, totalRequests }
            // أو قد يكون فقط مصفوفة الطلبات payload.requests
            return {
                ...state,
                loadingUserRequests: false,
                userRequests: payload.requests || (Array.isArray(payload) ? payload : []), // تعامل مع كلتا الحالتين
                errorUserRequests: null,
            };
        case GET_USER_DEPOSITS_FAIL:
            return { ...state, loadingUserRequests: false, errorUserRequests: payload, userRequests: [] };
        // ------------------------------------

        // ... (حالات ADMIN_GET_DEPOSITS - تأكد من استخدام adminRequestsData) ...
        case ADMIN_GET_DEPOSITS_REQUEST: return { ...state, loadingAdminList: true, errorAdminList: null };
        case ADMIN_GET_DEPOSITS_SUCCESS:
            if (typeof payload === 'object' && payload !== null && Array.isArray(payload.requests)) {
                return {
                    ...state,
                    loadingAdminList: false,
                    adminRequestsData: payload, // <-- هنا يتم تحديث البيانات
                    errorAdminList: null,
                };
            } else {
                console.error("ADMIN_GET_DEPOSITS_SUCCESS received unexpected payload structure:", payload);
                return { ...state, loadingAdminList: false, errorAdminList: "Invalid data format received from server." };
            }
        case ADMIN_GET_DEPOSITS_FAIL: return { ...state, loadingAdminList: false, errorAdminList: payload, adminRequestsData: { requests: [], totalPages: 0, currentPage: 1, totalRequests: 0 } };


        // ... (حالات الموافقة والرفض - يجب أن تحدث قائمة adminRequestsData.requests) ...
        case ADMIN_APPROVE_DEPOSIT_REQUEST:
        case ADMIN_REJECT_DEPOSIT_REQUEST:
            return { ...state, loadingAdminAction: { ...state.loadingAdminAction, [payload.requestId]: true }, errorAdminAction: null };

        case ADMIN_APPROVE_DEPOSIT_SUCCESS:
        case ADMIN_REJECT_DEPOSIT_SUCCESS:
            const updatedRequest = payload;
            return {
                ...state,
                loadingAdminAction: { ...state.loadingAdminAction, [updatedRequest._id]: false },
                adminRequestsData: {
                    ...state.adminRequestsData,
                    requests: state.adminRequestsData.map(req =>
                        req._id === updatedRequest._id ? updatedRequest : req
                    ),
                },
                // --- [إضافة] تحديث قائمة المستخدم أيضاً ---
                userRequests: state.userRequests.map(req =>
                    req._id === updatedRequest._id ? { ...req, status: updatedRequest.status, rejectionReason: updatedRequest.rejectionReason } : req
                ),
                // ------------------------------------
                errorAdminAction: null,
            };

        case ADMIN_APPROVE_DEPOSIT_FAIL:
        case ADMIN_REJECT_DEPOSIT_FAIL:
            return { ...state, loadingAdminAction: { ...state.loadingAdminAction, [payload.requestId]: false }, errorAdminAction: payload.error };


        case CLEAR_DEPOSIT_ERRORS:
            return { ...state, errorCreate: null, errorUserRequests: null, errorAdminList: null, errorAdminAction: null, }; // <-- تحديث ليشمل خطأ المستخدم

        case 'ADMIN_ADD_DEPOSIT_REQUEST_SOCKET':
            return {
                ...state,
                adminRequestsData: {
                    ...state.adminRequestsData,
                    requests: [payload, ...state.adminRequestsData.requests],
                    totalRequests: state.adminRequestsData.totalRequests + 1,
                },
            };

        default:
            return state;
    }
};

export default depositRequestReducer; // <-- تأكد من تصدير الاسم الصحيح