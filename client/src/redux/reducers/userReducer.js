// src/redux/reducers/userReducer.js
import {
  REGISTER_REQUEST, REGISTER_SUCCESS, REGISTER_FAIL, CLEAR_REGISTRATION_STATUS,
  LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAIL,
  GET_PROFILE_REQUEST, GET_PROFILE_SUCCESS, GET_PROFILE_FAIL,
  LOGOUT, CLEAR_USER_ERRORS,
  APPLY_MEDIATOR_REQUEST, APPLY_MEDIATOR_SUCCESS, APPLY_MEDIATOR_FAIL, APPLY_MEDIATOR_RESET,
  ADMIN_GET_MEDIATOR_APPS_REQUEST, ADMIN_GET_MEDIATOR_APPS_SUCCESS, ADMIN_GET_MEDIATOR_APPS_FAIL,
  ADMIN_PROCESS_MEDIATOR_APP_REQUEST, ADMIN_PROCESS_MEDIATOR_APP_SUCCESS, ADMIN_PROCESS_MEDIATOR_APP_FAIL,
  ADMIN_PROCESS_MEDIATOR_APP_RESET, ADMIN_GET_MEDIATORS_REQUEST, ADMIN_GET_MEDIATORS_SUCCESS, ADMIN_GET_MEDIATORS_FAIL,
  UPDATE_MEDIATOR_STATUS_REQUEST,
  UPDATE_MEDIATOR_STATUS_SUCCESS,
  UPDATE_MEDIATOR_STATUS_FAIL,
  UPDATE_USER_BALANCE,
  UPDATE_AVATAR_REQUEST,
  UPDATE_AVATAR_SUCCESS,
  UPDATE_AVATAR_FAIL,
  UPDATE_AVATAR_RESET,
  SET_ONLINE_USERS,
  SET_USER_BALANCES,
  // تأكد من وجود هذه الأنواع إذا كنت تستخدمها في actions أخرى
  // CLEAR_LOGIN_SUCCESS_MESSAGE, 
} from "../actionTypes/userActionType";

const initialState = {
  loading: false, // يشير إلى تحميل عام لعمليات المستخدم (login, register, getProfile)
  user: null,
  token: localStorage.getItem("token") || null,
  isAuth: !!localStorage.getItem("token"), // قيمة أولية بناءً على التوكن
  authChecked: false, // هل تم فحص المصادقة الأولية أم لا
  errors: null, // خطأ عام لعمليات المستخدم
  registrationStatus: null,
  availableMediators: [],
  loadingMediators: false,
  errorMediators: null,
  loadingApplyMediator: false,
  errorApplyMediator: null,
  successApplyMediator: false,
  pendingMediatorApps: { applications: [], totalPages: 0, currentPage: 1, totalApplications: 0 },
  loadingPendingApps: false,
  errorPendingApps: null,
  processingApp: {},
  errorProcessApp: null,
  successProcessApp: false,
  loadingUpdateMediatorStatus: false,
  errorUpdateMediatorStatus: null,
  loadingUpdateAvatar: false,
  errorUpdateAvatar: null,
  successUpdateAvatar: false,
  onlineUserIds: [],
};

const userReducer = (state = initialState, { type, payload }) => {
  switch (type) {
    case LOGIN_REQUEST:
      return { ...state, loading: true, errors: null, authChecked: false }; // authChecked false أثناء محاولة تسجيل الدخول
    case LOGIN_SUCCESS:
      console.log('[Reducer] LOGIN_SUCCESS', payload);
      return {
        ...state,
        loading: false,
        isAuth: true,
        user: payload.user,
        token: payload.token,
        errors: null,
        authChecked: true, // المصادقة تمت بنجاح
      };
    case LOGIN_FAIL:
      return {
        ...state,
        loading: false,
        errors: payload,
        isAuth: false,
        user: null,
        token: null,
        authChecked: true, // تم محاولة المصادقة وفشلت
      };

    case REGISTER_REQUEST:
      return { ...state, loading: true, errors: null, registrationStatus: null };
    case REGISTER_SUCCESS:
      return { ...state, loading: false, registrationStatus: 'success', errors: null };
    case REGISTER_FAIL:
      return { ...state, loading: false, registrationStatus: 'fail', errors: payload };
    case CLEAR_REGISTRATION_STATUS:
      return { ...state, registrationStatus: null };

    case GET_PROFILE_REQUEST:
      return { ...state, loading: true, errors: null }; // لا تعدل authChecked هنا
    case GET_PROFILE_SUCCESS:
      console.log('[Reducer] GET_PROFILE_SUCCESS', payload);
      return {
        ...state,
        user: payload.user,
        loading: false,
        isAuth: true, // تأكيد المصادقة
        errors: null, // مسح أي أخطاء سابقة
        authChecked: true,
      };
    case GET_PROFILE_FAIL:
      // لا تزيل التوكن هنا، دع action creator logoutUser يفعل ذلك
      // localStorage.removeItem('token'); 
      console.warn('[Reducer] GET_PROFILE_FAIL', payload);
      return {
        ...state,
        user: null,
        isAuth: false, // المصادقة فشلت
        loading: false,
        errors: payload,
        authChecked: true, // تم محاولة فحص المصادقة
        // token: null // يمكن ترك التوكن إذا كان الخطأ مؤقتًا، أو حذفه إذا كان الخطأ 401/403
      };

    case 'AUTH_CHECK_COMPLETE': // يستخدم إذا لم يكن هناك توكن أصلاً
      return {
        ...state,
        authChecked: true,
        // isAuth و user يجب أن يكونا بالفعل false/null إذا لم يكن هناك توكن
      };

    case 'LOGOUT_NO_TOKEN_ON_LOAD': // عند تحميل التطبيق ولا يوجد توكن
      return {
        ...initialState, // يعيد كل شيء إلى الحالة الأولية
        token: null,
        isAuth: false,
        user: null,
        authChecked: true, // تم الفحص، لا يوجد توكن
      };

    case LOGOUT:
      // localStorage.removeItem("token") و ("userId") يتم في action creator
      console.log('[Reducer] LOGOUT');
      return {
        ...initialState, // يعيد كل شيء إلى الحالة الأولية
        token: null,
        isAuth: false,
        user: null,
        authChecked: true, // تم تسجيل الخروج، لذا المصادقة "تم فحصها" (لا يوجد مستخدم)
      };

    case CLEAR_USER_ERRORS:
      return { ...state, errors: null };

    // ... (بقية الحالات تبقى كما هي) ...
    case ADMIN_GET_MEDIATORS_REQUEST:
      return { ...state, loadingMediators: true, errorMediators: null };
    case ADMIN_GET_MEDIATORS_SUCCESS:
      return { ...state, loadingMediators: false, availableMediators: payload || [] };
    case ADMIN_GET_MEDIATORS_FAIL:
      return { ...state, loadingMediators: false, errorMediators: payload };

    case APPLY_MEDIATOR_REQUEST:
      return { ...state, loadingApplyMediator: true, errorApplyMediator: null, successApplyMediator: false };
    case APPLY_MEDIATOR_SUCCESS:
      return { ...state, loadingApplyMediator: false, successApplyMediator: true, errorApplyMediator: null, user: state.user ? { ...state.user, mediatorApplicationStatus: payload.newStatus } : null };
    case APPLY_MEDIATOR_FAIL:
      return { ...state, loadingApplyMediator: false, errorApplyMediator: payload, successApplyMediator: false };
    case APPLY_MEDIATOR_RESET:
      return { ...state, loadingApplyMediator: false, errorApplyMediator: null, successApplyMediator: false };

    case ADMIN_GET_MEDIATOR_APPS_REQUEST:
      return { ...state, loadingPendingApps: true, errorPendingApps: null };
    case ADMIN_GET_MEDIATOR_APPS_SUCCESS:
      return { ...state, loadingPendingApps: false, pendingMediatorApps: payload || { applications: [], totalPages: 0, currentPage: 1, totalApplications: 0 } };
    case ADMIN_GET_MEDIATOR_APPS_FAIL:
      return { ...state, loadingPendingApps: false, errorPendingApps: payload };

    case ADMIN_PROCESS_MEDIATOR_APP_REQUEST:
      return { ...state, processingApp: { ...state.processingApp, [payload.userId]: true }, errorProcessApp: null, successProcessApp: false };
    case ADMIN_PROCESS_MEDIATOR_APP_SUCCESS:
      return {
        ...state,
        processingApp: { ...state.processingApp, [payload.userId]: false },
        successProcessApp: true,
        errorProcessApp: null,
        pendingMediatorApps: {
          ...state.pendingMediatorApps,
          applications: state.pendingMediatorApps.applications.filter(app => app._id !== payload.userId),
          totalApplications: Math.max(0, state.pendingMediatorApps.totalApplications - 1)
        },
        user: state.user?._id === payload.userId ? payload.updatedUser : state.user
      };
    case ADMIN_PROCESS_MEDIATOR_APP_FAIL:
      return { ...state, processingApp: { ...state.processingApp, [payload.userId]: false }, errorProcessApp: payload.error, successProcessApp: false };
    case ADMIN_PROCESS_MEDIATOR_APP_RESET:
      return { ...state, successProcessApp: false, errorProcessApp: null };

    case UPDATE_MEDIATOR_STATUS_REQUEST:
      return { ...state, loadingUpdateMediatorStatus: true, errorUpdateMediatorStatus: null };
    case UPDATE_MEDIATOR_STATUS_SUCCESS:
      return {
        ...state,
        loadingUpdateMediatorStatus: false,
        user: state.user ? { ...state.user, mediatorStatus: payload.newStatus } : null
      };
    case UPDATE_MEDIATOR_STATUS_FAIL:
      return { ...state, loadingUpdateMediatorStatus: false, errorUpdateMediatorStatus: payload };

    case UPDATE_USER_BALANCE: // هذا كان موجودًا، يستخدم لتحديث رصيد معين
      if (state.user && payload && typeof payload.balance === 'number') {
        return {
          ...state,
          user: {
            ...state.user,
            balance: payload.balance
            // إذا كنت تريد تحديث الأرصدة الأخرى هنا أيضًا، أضفها
          }
        };
      }
      return state;

    case UPDATE_AVATAR_REQUEST:
      return {
        ...state,
        loadingUpdateAvatar: true,
        errorUpdateAvatar: null,
        successUpdateAvatar: false
      };
    case UPDATE_AVATAR_SUCCESS:
      // يفترض أن payload هو كائن المستخدم المحدث بالكامل أو { avatarUrl: '...' }
      let updatedUserForAvatar = state.user;
      if (state.user) {
        if (payload.user && payload.user.avatarUrl !== undefined) { // إذا كان الـ backend يرجع { user: { ... } }
          updatedUserForAvatar = { ...state.user, avatarUrl: payload.user.avatarUrl };
        } else if (payload.avatarUrl !== undefined) { // إذا كان الـ backend يرجع { avatarUrl: '...' }
          updatedUserForAvatar = { ...state.user, avatarUrl: payload.avatarUrl };
        }
      }
      return {
        ...state,
        loadingUpdateAvatar: false,
        user: updatedUserForAvatar,
        successUpdateAvatar: true,
        errorUpdateAvatar: null,
      };
    case UPDATE_AVATAR_FAIL:
      return {
        ...state,
        loadingUpdateAvatar: false,
        errorUpdateAvatar: payload,
        successUpdateAvatar: false
      };
    case UPDATE_AVATAR_RESET:
      return {
        ...state,
        loadingUpdateAvatar: false,
        errorUpdateAvatar: null,
        successUpdateAvatar: false,
      };

    case SET_ONLINE_USERS:
      console.log("[Reducer USER] SET_ONLINE_USERS, payload:", payload);
      return {
        ...state,
        onlineUserIds: Array.isArray(payload) ? payload : [], // تأكد أنه دائمًا مصفوفة
      };

    case SET_USER_BALANCES: // هذا لتحديث جميع الأرصدة من socket
      console.log("[Reducer USER] Handling SET_USER_BALANCES. Payload:", payload, "Current user state:", state.user);
      if (state.user) {
        return {
          ...state,
          user: {
            ...state.user,
            balance: payload.balance !== undefined ? payload.balance : state.user.balance,
            sellerAvailableBalance: payload.sellerAvailableBalance !== undefined ? payload.sellerAvailableBalance : state.user.sellerAvailableBalance,
            sellerPendingBalance: payload.sellerPendingBalance !== undefined ? payload.sellerPendingBalance : state.user.sellerPendingBalance,
          }
        };
      }
      return state;

    default:
      return state;
  }
};

export default userReducer;