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
  UPDATE_AVATAR_REQUEST,     // --- NEW ---
  UPDATE_AVATAR_SUCCESS,     // --- NEW ---
  UPDATE_AVATAR_FAIL,        // --- NEW ---
  UPDATE_AVATAR_RESET,       // --- NEW (Optional) ---
  SET_ONLINE_USERS,
  SET_USER_BALANCES,
} from "../actionTypes/userActionType";

const initialState = {
  loading: false,
  user: null,
  token: localStorage.getItem("token") || null, // تحميل التوكن الأولي
  isAuth: !!localStorage.getItem("token"), // تحقق من وجود توكن
  authChecked: false, 
  errors: null,
  registrationStatus: null, // success or fail
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
  loadingUpdateMediatorStatus: false,
  errorUpdateMediatorStatus: null,
  loadingUpdateAvatar: false, // --- NEW ---
  errorUpdateAvatar: null,    // --- NEW ---
  successUpdateAvatar: false, // --- NEW (Optional) ---
  onlineUserIds: [], // <-- إضافة حالة لتخزين المستخدمين المتصلين
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
      return { ...state, loading: true };

    case GET_PROFILE_SUCCESS:
      return {
        ...state,
        loading: false,
        isAuth: true,
        user: payload.user || payload, // افترض أن payload قد يكون { user: ... } أو المستخدم مباشرة
        errors: null,
        authChecked: true
      };

    case GET_PROFILE_FAIL:
      return {
        ...state,
        loading: false,
        errors: payload,
        authChecked: true
        // لا تمسح user أو isAuth هنا بالضرورة، فقط أوقف التحميل
      };

    case 'AUTH_CHECK_COMPLETE': // تأكد أن هذا النوع يُرسل من App.js عندما لا يوجد توكن
      console.log('[Reducer USER] AUTH_CHECK_COMPLETE'); // <-- أضف هذا
      return { ...state, authChecked: true, loading: false }; // أضف loading: false هنا أيضًا

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
    case ADMIN_GET_MEDIATORS_REQUEST:
      return { ...state, loadingMediators: true, errorMediators: null };
    case ADMIN_GET_MEDIATORS_SUCCESS:
      return { ...state, loadingMediators: false, availableMediators: payload || [] };
    case ADMIN_GET_MEDIATORS_FAIL:
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

    case UPDATE_MEDIATOR_STATUS_REQUEST:
      return { ...state, loadingUpdateMediatorStatus: true, errorUpdateMediatorStatus: null };

    case UPDATE_MEDIATOR_STATUS_SUCCESS:
      return {
        ...state,
        loadingUpdateMediatorStatus: false,
        // تحديث حالة الوسيط في كائن المستخدم
        user: state.user ? { ...state.user, mediatorStatus: payload.newStatus } : null
      };

    case UPDATE_MEDIATOR_STATUS_FAIL:
      return { ...state, loadingUpdateMediatorStatus: false, errorUpdateMediatorStatus: payload };

    // --- [!!!] حالة جديدة لتحديث رصيد المستخدم [!!!] ---
    case UPDATE_USER_BALANCE:
      if (state.user && payload && typeof payload.balance === 'number') { // تحقق من أن payload.balance هو رقم
        return {
          ...state,
          user: {
            ...state.user,
            balance: payload.balance // تحديث الرصيد
          }
        };
      }
      return state; // إذا لم يكن المستخدم موجودًا أو الـ payload غير صالح، لا تغير الحالة

    // --- NEW CASES for Avatar Update ---
    case UPDATE_AVATAR_REQUEST:
      return {
        ...state,
        loadingUpdateAvatar: true,
        errorUpdateAvatar: null,
        successUpdateAvatar: false
      };
    case UPDATE_AVATAR_SUCCESS:
      // payload should be the updated user object or at least { avatarUrl: 'new_url' }
      // If backend returns the full user object in payload:
      // return { ...state, loadingUpdateAvatar: false, user: payload, successUpdateAvatar: true, errorUpdateAvatar: null };
      // If backend returns just { avatarUrl: 'new_url' } or { user: { avatarUrl: '...' } }:
      return {
        ...state,
        loadingUpdateAvatar: false,
        user: state.user ? { ...state.user, avatarUrl: payload.avatarUrl || payload } : null, // Update avatarUrl in user object
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
    case UPDATE_AVATAR_RESET: // Optional
      return {
        ...state,
        loadingUpdateAvatar: false,
        errorUpdateAvatar: null,
        successUpdateAvatar: false,
      };

    // --- Set Online Users ---
    case SET_ONLINE_USERS: // هذا هو الـ actionType الذي تستخدمه
      console.log("[Reducer USER] SET_ONLINE_USERS, payload:", payload); // أضف console.log هنا
      return {
        ...state,
        onlineUserIds: payload, // تأكد أن هذا الاسم (onlineUserIds) هو نفسه الذي تستخدمه في useSelector
      };

    // --- Set User Balances ---
    case SET_USER_BALANCES:
      console.log("[Reducer USER] Handling SET_USER_BALANCES. Payload:", payload, "Current user state:", state.user);
      if (state.user) { // تأكد أن كائن المستخدم موجود قبل محاولة تحديثه
        return {
          ...state,
          user: { // تحديث كائن المستخدم الموجود
            ...state.user,
            balance: payload.balance !== undefined ? payload.balance : state.user.balance,
            sellerAvailableBalance: payload.sellerAvailableBalance !== undefined ? payload.sellerAvailableBalance : state.user.sellerAvailableBalance,
            sellerPendingBalance: payload.sellerPendingBalance !== undefined ? payload.sellerPendingBalance : state.user.sellerPendingBalance,
            // أضف أي حقول رصيد أخرى هنا
          }
        };
      }
      return state; // إذا لم يكن هناك مستخدم، لا تقم بتغيير الحالة (أو يمكنك التعامل مع هذا بشكل مختلف)

    default: return state;
  }
};

export default userReducer;
