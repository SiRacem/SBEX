// src/redux/reducers/withdrawalRequestReducer.js
import {
    CREATE_WITHDRAWAL_REQUEST, CREATE_WITHDRAWAL_SUCCESS,
    CREATE_WITHDRAWAL_FAIL, CREATE_WITHDRAWAL_RESET,
    ADMIN_GET_WITHDRAWALS_REQUEST, ADMIN_GET_WITHDRAWALS_SUCCESS, ADMIN_GET_WITHDRAWALS_FAIL,
    ADMIN_GET_WITHDRAWAL_DETAILS_REQUEST, ADMIN_GET_WITHDRAWAL_DETAILS_SUCCESS, ADMIN_GET_WITHDRAWAL_DETAILS_FAIL,
    ADMIN_CLEAR_WITHDRAWAL_DETAILS,
    ADMIN_COMPLETE_WITHDRAWAL_REQUEST, ADMIN_COMPLETE_WITHDRAWAL_SUCCESS, ADMIN_COMPLETE_WITHDRAWAL_FAIL,
    ADMIN_REJECT_WITHDRAWAL_REQUEST, ADMIN_REJECT_WITHDRAWAL_SUCCESS, ADMIN_REJECT_WITHDRAWAL_FAIL,
    ADMIN_CLEAR_WITHDRAWAL_ERROR,
    GET_USER_WITHDRAWALS_REQUEST, GET_USER_WITHDRAWALS_SUCCESS, GET_USER_WITHDRAWALS_FAIL
} from '../actionTypes/withdrawalRequestActionType'; // <-- تأكد من المسار الصحيح لملف الأكشن تايبس

const initialState = {
    // حالة إنشاء طلب من المستخدم
    loadingCreate: false,
    errorCreate: null,
    successCreate: false, // للإشارة للنجاح (مثل إغلاق المودال)

    // طلبات السحب الخاصة بالمستخدم الحالي
    userRequests: [],
    loadingUserRequests: false,
    errorUserRequests: null,

    // حالة عرض وإدارة الطلبات من قبل الأدمن
    adminRequestsData: { // لتجميع بيانات قائمة الأدمن
        requests: [],
        totalPages: 0,
        currentPage: 1,
        totalRequests: 0,
    },
    loadingAdminRequests: false,
    errorAdminRequests: null,

    // تفاصيل طلب محدد للأدمن
    adminRequestDetails: null,
    loadingAdminDetails: false,
    errorAdminDetails: null,

    // حالة تحميل وأخطاء عمليات الأدمن (إكمال/رفض)
    loadingAdminAction: false, // حالة تحميل عامة لعمليات الأدمن
    errorAdminAction: null,    // خطأ عام لعمليات الأدمن

};

const withdrawalRequestReducer = (state = initialState, action) => {
    const { type, payload } = action;

    switch (type) {
        // --- إنشاء طلب سحب (المستخدم) ---
        case CREATE_WITHDRAWAL_REQUEST:
            return { ...state, loadingCreate: true, errorCreate: null, successCreate: false };
        case CREATE_WITHDRAWAL_SUCCESS:
            return { ...state, loadingCreate: false, successCreate: true }; // يمكن إضافة الطلب لـ userRequests إذا أردت
        case CREATE_WITHDRAWAL_FAIL:
            return { ...state, loadingCreate: false, errorCreate: payload, successCreate: false };
        case CREATE_WITHDRAWAL_RESET:
            return { ...state, loadingCreate: false, errorCreate: null, successCreate: false };

        // --- جلب طلبات المستخدم ---
        case GET_USER_WITHDRAWALS_REQUEST:
            return { ...state, loadingUserRequests: true, errorUserRequests: null };
        case GET_USER_WITHDRAWALS_SUCCESS:
            // افترض أن payload هو { requests, totalPages, currentPage, totalRequests }
            return {
                ...state,
                loadingUserRequests: false,
                userRequests: payload.requests || [],
                // userTotalPages: payload.totalPages,
                // userCurrentPage: payload.currentPage,
                // userTotalRequests: payload.totalRequests
            };
        case GET_USER_WITHDRAWALS_FAIL:
            return { ...state, loadingUserRequests: false, errorUserRequests: payload };

        // --- جلب طلبات الأدمن ---
        case ADMIN_GET_WITHDRAWALS_REQUEST:
            return { ...state, loadingAdminRequests: true, errorAdminRequests: null };
        case ADMIN_GET_WITHDRAWALS_SUCCESS:
            // افترض أن payload هو { requests, totalPages, currentPage, totalRequests }
            return {
                ...state,
                loadingAdminRequests: false,
                adminRequestsData: payload || { requests: [], totalPages: 0, currentPage: 1, totalRequests: 0 }
            };
        case ADMIN_GET_WITHDRAWALS_FAIL:
            return { ...state, loadingAdminRequests: false, errorAdminRequests: payload };

        // --- جلب تفاصيل طلب للأدمن ---
        case ADMIN_GET_WITHDRAWAL_DETAILS_REQUEST:
            return { ...state, loadingAdminDetails: true, errorAdminDetails: null, adminRequestDetails: null };
        case ADMIN_GET_WITHDRAWAL_DETAILS_SUCCESS:
            return { ...state, loadingAdminDetails: false, adminRequestDetails: payload };
        case ADMIN_GET_WITHDRAWAL_DETAILS_FAIL:
            return { ...state, loadingAdminDetails: false, errorAdminDetails: payload };
        case ADMIN_CLEAR_WITHDRAWAL_DETAILS:
            return { ...state, adminRequestDetails: null, errorAdminDetails: null };

        // --- إكمال/رفض طلب (الأدمن) ---
        case ADMIN_COMPLETE_WITHDRAWAL_REQUEST:
        case ADMIN_REJECT_WITHDRAWAL_REQUEST:
            return { ...state, loadingAdminAction: true, errorAdminAction: null };

        case ADMIN_COMPLETE_WITHDRAWAL_SUCCESS:
        case ADMIN_REJECT_WITHDRAWAL_SUCCESS:
            const updatedRequest = payload; // payload هو الطلب المحدث
            return {
                ...state,
                loadingAdminAction: false,
                // تحديث الطلب في قائمة الأدمن
                adminRequestsData: {
                    ...state.adminRequestsData,
                    requests: state.adminRequestsData.requests.map(req =>
                        req._id === updatedRequest._id ? updatedRequest : req
                    ),
                },
                // تحديث الطلب في قائمة المستخدم (إذا كان مفتوحًا)
                userRequests: state.userRequests.map(req =>
                    req._id === updatedRequest._id ? { ...req, status: updatedRequest.status, rejectionReason: updatedRequest.rejectionReason } : req // تحديث الحقول الرئيسية فقط
                ),
                // تحديث التفاصيل إذا كانت مفتوحة
                adminRequestDetails: state.adminRequestDetails?._id === updatedRequest._id ? updatedRequest : state.adminRequestDetails,
            };

        case ADMIN_COMPLETE_WITHDRAWAL_FAIL:
        case ADMIN_REJECT_WITHDRAWAL_FAIL:
            // payload هنا هو { requestId, error }
            return { ...state, loadingAdminAction: false, errorAdminAction: payload.error };

        case ADMIN_CLEAR_WITHDRAWAL_ERROR:
            return { ...state, errorAdminAction: null, errorCreate: null /* يمكنك مسح أخطاء أخرى إذا أردت */ };

        default:
            return state;
    }
};

export default withdrawalRequestReducer;