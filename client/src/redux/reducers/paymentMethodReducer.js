// src/redux/reducers/paymentMethodReducer.js
import {
    GET_ACTIVE_METHODS_REQUEST, GET_ACTIVE_METHODS_SUCCESS, GET_ACTIVE_METHODS_FAIL,
    ADMIN_GET_ALL_METHODS_REQUEST, ADMIN_GET_ALL_METHODS_SUCCESS, ADMIN_GET_ALL_METHODS_FAIL,
    ADMIN_ADD_METHOD_REQUEST, ADMIN_ADD_METHOD_SUCCESS, ADMIN_ADD_METHOD_FAIL,
    ADMIN_UPDATE_METHOD_REQUEST, ADMIN_UPDATE_METHOD_SUCCESS, ADMIN_UPDATE_METHOD_FAIL,
    ADMIN_DELETE_METHOD_REQUEST, ADMIN_DELETE_METHOD_SUCCESS, ADMIN_DELETE_METHOD_FAIL,
    CLEAR_PAYMENT_METHOD_ERROR
} from '../actionTypes/paymentMethodActionTypes';

const initialState = {
    activeMethods: [], // الطرق النشطة للمستخدم
    allMethods: [],    // جميع الطرق (للأدمن)
    loadingActive: false,
    loadingAdmin: false,
    error: null,
    loadingAdd: false,
    loadingUpdate: {}, // لتتبع تحديث طريقة معينة
    loadingDelete: {}, // لتتبع حذف طريقة معينة
};

const paymentMethodReducer = (state = initialState, { type, payload }) => {
    switch (type) {
        // جلب الطرق النشطة
        case GET_ACTIVE_METHODS_REQUEST:
            return { ...state, loadingActive: true, error: null };
        case GET_ACTIVE_METHODS_SUCCESS:
            return { ...state, loadingActive: false, activeMethods: Array.isArray(payload) ? payload : [] };
        case GET_ACTIVE_METHODS_FAIL:
            return { ...state, loadingActive: false, error: payload, activeMethods: [] };

        // جلب كل الطرق (للأدمن)
        case ADMIN_GET_ALL_METHODS_REQUEST:
            return { ...state, loadingAdmin: true, error: null };
        case ADMIN_GET_ALL_METHODS_SUCCESS:
            return { ...state, loadingAdmin: false, allMethods: Array.isArray(payload) ? payload : [] };
        case ADMIN_GET_ALL_METHODS_FAIL:
            return { ...state, loadingAdmin: false, error: payload, allMethods: [] };

        // إضافة طريقة (للأدمن)
        case ADMIN_ADD_METHOD_REQUEST:
            return { ...state, loadingAdd: true, error: null };
        case ADMIN_ADD_METHOD_SUCCESS:
            return { ...state, loadingAdd: false, allMethods: [...state.allMethods, payload] }; // إضافة الجديدة للقائمة
        case ADMIN_ADD_METHOD_FAIL:
            return { ...state, loadingAdd: false, error: payload };

        // تعديل طريقة (للأدمن)
        case ADMIN_UPDATE_METHOD_REQUEST:
            return { ...state, loadingUpdate: { ...state.loadingUpdate, [payload.methodId]: true }, error: null };
        case ADMIN_UPDATE_METHOD_SUCCESS:
            const updatedMethodId = payload._id;
            return {
                ...state,
                loadingUpdate: { ...state.loadingUpdate, [updatedMethodId]: false },
                allMethods: state.allMethods.map(method => method._id === updatedMethodId ? payload : method),
                // تحديث activeMethods أيضاً إذا كانت الطريقة المُعدلة موجودة ونشطة
                activeMethods: state.activeMethods.map(method => method._id === updatedMethodId ? payload : method).filter(m => m.isActive)
            };
        case ADMIN_UPDATE_METHOD_FAIL:
            return { ...state, loadingUpdate: { ...state.loadingUpdate, [payload.methodId]: false }, error: payload.error }; // أو تسجيل خطأ محدد

        // حذف طريقة (للأدمن)
        case ADMIN_DELETE_METHOD_REQUEST:
            return { ...state, loadingDelete: { ...state.loadingDelete, [payload.methodId]: true }, error: null };
        case ADMIN_DELETE_METHOD_SUCCESS:
            const deletedMethodId = payload.methodId;
            return {
                ...state,
                loadingDelete: { ...state.loadingDelete, [deletedMethodId]: false },
                allMethods: state.allMethods.filter(method => method._id !== deletedMethodId),
                activeMethods: state.activeMethods.filter(method => method._id !== deletedMethodId) // إزالتها من النشطة أيضاً
            };
        case ADMIN_DELETE_METHOD_FAIL:
            return { ...state, loadingDelete: { ...state.loadingDelete, [payload.methodId]: false }, error: payload.error };

        // مسح الأخطاء
        case CLEAR_PAYMENT_METHOD_ERROR:
            return { ...state, error: null };

        default:
            return state;
    }
};

export default paymentMethodReducer;