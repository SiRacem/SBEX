// src/redux/reducers/userReducer.js (مثال افتراضي)
import {
  REGISTER_REQUEST, REGISTER_SUCCESS, REGISTER_FAIL, CLEAR_REGISTRATION_STATUS,
  LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAIL,
  GET_PROFILE_REQUEST, GET_PROFILE_SUCCESS, GET_PROFILE_FAIL,
  LOGOUT, CLEAR_USER_ERRORS,
  APPLY_MEDIATOR_REQUEST, APPLY_MEDIATOR_SUCCESS, APPLY_MEDIATOR_FAIL, APPLY_MEDIATOR_RESET,
  ADMIN_GET_MEDIATOR_APPS_REQUEST, ADMIN_GET_MEDIATOR_APPS_SUCCESS, ADMIN_GET_MEDIATOR_APPS_FAIL,
  ADMIN_PROCESS_MEDIATOR_APP_REQUEST, ADMIN_PROCESS_MEDIATOR_APP_SUCCESS, ADMIN_PROCESS_MEDIATOR_APP_FAIL,
  ADMIN_PROCESS_MEDIATOR_APP_RESET, ADMIN_GET_MEDIATORS_REQUEST, ADMIN_GET_MEDIATORS_SUCCESS, ADMIN_GET_MEDIATORS_FAIL
} from "../actionTypes/userActionType";

const initialState = {
  loading: false,
  user: null,
  token: localStorage.getItem("token") || null, // تحميل التوكن الأولي
  isAuth: !!localStorage.getItem("token"), // تحديد المصادقة الأولية
  errors: null,
  registrationStatus: null, // success or fail
  authChecked: false,
  availableMediators: [], // <-- إضافة حالة لتخزين الوسطاء
  loadingMediators: false,
  errorMediators: null,
  // --- [!!!] حالات جديدة لطلب الانضمام [!!!] ---
  loadingApplyMediator: false,
  errorApplyMediator: null,
  successApplyMediator: false,
  // --- [!!!] حالات جديدة لطلبات الأدمن المعلقة [!!!] ---
  pendingMediatorApps: { applications: [], totalPages: 0, currentPage: 1, totalApplications: 0 },
  loadingPendingApps: false,
  errorPendingApps: null,
  // --- [!!!] حالات جديدة لمعالجة طلب الأدمن [!!!] ---
  processingApp: {}, // { userId: true }
  errorProcessApp: null,
  successProcessApp: false,
  // -----------------------------------------------
};

const userReducer = (state = initialState, { type, payload }) => {
  switch (type) {
    // --- Login Cases ---
    case LOGIN_REQUEST:
      return { ...state, loading: true, errors: null, loginSuccessMessage: null }; // مسح الرسالة عند بدء الطلب
    case LOGIN_SUCCESS:
      return {
        ...state,
        loading: false,
        isAuth: true,
        user: payload.user,
        token: payload.token,
        errors: null,
      };
    case LOGIN_FAIL:
      return { ...state, loading: false, errors: payload, isAuth: false, user: null, token: null };

    // --- Register Cases ---
    case REGISTER_REQUEST:
      return { ...state, loading: true, errors: null, registrationStatus: null };
    case REGISTER_SUCCESS:
      return { ...state, loading: false, registrationStatus: 'success', errors: null };
    case REGISTER_FAIL:
      return { ...state, loading: false, registrationStatus: 'fail', errors: payload };
    case CLEAR_REGISTRATION_STATUS:
      return { ...state, registrationStatus: null };

    // --- Get Profile Cases ---
    case GET_PROFILE_REQUEST:
      // لا تغير authChecked هنا، فقط loading
      return { ...state, loading: true };
    case GET_PROFILE_SUCCESS:
      // عند النجاح: اكتمل التحقق، تحديث المستخدم والمصادقة
      return {
        ...state,
        loading: false,
        isAuth: true,
        user: payload,
        errors: null,
        authChecked: true // <-- [!] مهم جداً: تعيينها true هنا
      };
    case GET_PROFILE_FAIL:
      // عند الفشل: اكتمل التحقق أيضاً، مسح المصادقة
      // (لا تمسح التوكن من هنا، دع logout يفعل ذلك إذا لزم الأمر)
      return {
        ...state,
        loading: false,
        // isAuth: false, // لا تغير isAuth هنا بالضرورة، قد يكون فشل مؤقت
        // user: null,
        errors: payload,
        authChecked: true // <-- [!] مهم جداً: تعيينها true هنا أيضاً
      };

    // --- Logout Case ---
    case LOGOUT:
      // عند تسجيل الخروج، إعادة تعيين كل شيء بما في ذلك authChecked
      return {
        ...initialState,
        token: null,
        isAuth: false,
        authChecked: true // <-- اكتمل التحقق (لا يوجد مستخدم)
      };

    // --- حالة خاصة للتحقق عند عدم وجود توكن ---
    case 'AUTH_CHECK_COMPLETE': // النوع الذي أضفته في App.js
      return { ...state, authChecked: true }; // فقط تعيين authChecked

    // --- Clear Errors Case ---
    case CLEAR_USER_ERRORS:
      return { ...state, errors: null };

    // --- [!!!] إضافة حالات جلب الوسطاء [!!!] ---
    case 'ADMIN_GET_MEDIATORS_REQUEST':
      return { ...state, loadingMediators: true, errorMediators: null };
    case 'ADMIN_GET_MEDIATORS_SUCCESS':
      return { ...state, loadingMediators: false, availableMediators: payload || [] };
    case 'ADMIN_GET_MEDIATORS_FAIL':
      return { ...state, loadingMediators: false, errorMediators: payload };
    // -------------------------------------------

    // --- جلب الوسطاء المتاحين ---
    case ADMIN_GET_MEDIATORS_REQUEST: return { ...state, loadingMediators: true, errorMediators: null };
    case ADMIN_GET_MEDIATORS_SUCCESS: return { ...state, loadingMediators: false, availableMediators: payload || [] };
    case ADMIN_GET_MEDIATORS_FAIL: return { ...state, loadingMediators: false, errorMediators: payload };
    // ---------------------------

    // --- طلب الانضمام (المستخدم) ---
    case APPLY_MEDIATOR_REQUEST: return { ...state, loadingApplyMediator: true, errorApplyMediator: null, successApplyMediator: false };
    case APPLY_MEDIATOR_SUCCESS: return { ...state, loadingApplyMediator: false, successApplyMediator: true, errorApplyMediator: null, user: state.user ? { ...state.user, mediatorApplicationStatus: payload.newStatus } : null };
    case APPLY_MEDIATOR_FAIL: return { ...state, loadingApplyMediator: false, errorApplyMediator: payload, successApplyMediator: false };
    case APPLY_MEDIATOR_RESET: return { ...state, loadingApplyMediator: false, errorApplyMediator: null, successApplyMediator: false };
    // ---------------------------

    // --- جلب طلبات الأدمن المعلقة ---
    case ADMIN_GET_MEDIATOR_APPS_REQUEST: return { ...state, loadingPendingApps: true, errorPendingApps: null };
    case ADMIN_GET_MEDIATOR_APPS_SUCCESS: return { ...state, loadingPendingApps: false, pendingMediatorApps: payload || { applications: [], totalPages: 0, currentPage: 1, totalApplications: 0 } };
    case ADMIN_GET_MEDIATOR_APPS_FAIL: return { ...state, loadingPendingApps: false, errorPendingApps: payload };
    // ------------------------------

    // --- معالجة طلب الأدمن ---
    case ADMIN_PROCESS_MEDIATOR_APP_REQUEST: return { ...state, processingApp: { ...state.processingApp, [payload.userId]: true }, errorProcessApp: null, successProcessApp: false };
    case ADMIN_PROCESS_MEDIATOR_APP_SUCCESS:
      return {
        ...state,
        processingApp: { ...state.processingApp, [payload.userId]: false },
        successProcessApp: true,
        errorProcessApp: null,
        // إزالة الطلب من قائمة المعلقين
        pendingMediatorApps: {
          ...state.pendingMediatorApps,
          applications: state.pendingMediatorApps.applications.filter(app => app._id !== payload.userId),
          totalApplications: Math.max(0, state.pendingMediatorApps.totalApplications - 1)
        },
        // تحديث المستخدم في قائمة المستخدمين العامة (إذا كانت محملة) - اختياري
        // users: state.users?.map(u => u._id === payload.userId ? payload.updatedUser : u),
        // تحديث بيانات المستخدم الحالي إذا كان الأدمن يعالج طلب المستخدم الحالي (نادر)
        user: state.user?._id === payload.userId ? payload.updatedUser : state.user
      };
    case ADMIN_PROCESS_MEDIATOR_APP_FAIL: return { ...state, processingApp: { ...state.processingApp, [payload.userId]: false }, errorProcessApp: payload.error, successProcessApp: false };
    case ADMIN_PROCESS_MEDIATOR_APP_RESET: return { ...state, successProcessApp: false, errorProcessApp: null };
    // ------------------------

    default: return state;
  }
};
export default userReducer;
