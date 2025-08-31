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
                // تأكد من أنك تضع البيانات في `userRequests`
                userRequests: action.payload,
                errorUserRequests: null,
            };
        // داخل withdrawalRequestReducer.js
        case GET_USER_WITHDRAWALS_FAIL:
            return {
                ...state,
                loadingUserRequests: false,
                errorUserRequests: action.payload, // حفظ كائن الخطأ
                userRequests: [], // مسح البيانات القديمة عند حدوث خطأ
            };
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
            const { requestId } = payload; // We only need the ID here
            return {
                ...state,
                loadingAdminAction: false,
                // --- [!!!] START: MODIFICATION [!!!] ---
                // Remove the processed request from the list of pending requests
                adminRequestsData: {
                    ...state.adminRequestsData,
                    requests: state.adminRequestsData.filter(req =>
                        req._id !== requestId
                    ),
                    totalRequests: Math.max(0, state.adminRequestsData.totalRequests - 1),
                },
                // --- [!!!] END: MODIFICATION [!!!] ---
                // You can still update userRequests and adminRequestDetails if needed
            };

        case ADMIN_COMPLETE_WITHDRAWAL_FAIL:
        case ADMIN_REJECT_WITHDRAWAL_FAIL:
            // payload هنا هو { requestId, error }
            return { ...state, loadingAdminAction: false, errorAdminAction: payload.error };

        case ADMIN_CLEAR_WITHDRAWAL_ERROR:
            return { ...state, errorAdminAction: null, errorCreate: null /* يمكنك مسح أخطاء أخرى إذا أردت */ };

        case 'ADMIN_ADD_WITHDRAWAL_REQUEST_SOCKET':
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

export default withdrawalRequestReducer;