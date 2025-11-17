// src/redux/reducers/userReducer.js
import {
  REGISTER_REQUEST, REGISTER_SUCCESS, REGISTER_FAIL, CLEAR_REGISTRATION_STATUS,
  LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAIL,
  GET_PROFILE_REQUEST, GET_PROFILE_SUCCESS, GET_PROFILE_FAIL,
  LOGOUT, CLEAR_USER_ERRORS, CLEAR_USER_MESSAGES,
  APPLY_MEDIATOR_REQUEST, APPLY_MEDIATOR_SUCCESS, APPLY_MEDIATOR_FAIL, APPLY_MEDIATOR_RESET,
  ADMIN_GET_MEDIATOR_APPS_REQUEST, ADMIN_GET_MEDIATOR_APPS_SUCCESS, ADMIN_GET_MEDIATOR_APPS_FAIL,
  ADMIN_PROCESS_MEDIATOR_APP_REQUEST, ADMIN_PROCESS_MEDIATOR_APP_SUCCESS, ADMIN_PROCESS_MEDIATOR_APP_FAIL, ADMIN_PROCESS_MEDIATOR_APP_RESET,
  ADMIN_GET_MEDIATORS_REQUEST, ADMIN_GET_MEDIATORS_SUCCESS, ADMIN_GET_MEDIATORS_FAIL,
  UPDATE_MEDIATOR_STATUS_REQUEST, UPDATE_MEDIATOR_STATUS_SUCCESS, UPDATE_MEDIATOR_STATUS_FAIL,
  UPDATE_USER_BALANCE, UPDATE_AVATAR_REQUEST, UPDATE_AVATAR_SUCCESS, UPDATE_AVATAR_FAIL,
  UPDATE_AVATAR_RESET, SET_ONLINE_USERS, UPDATE_USER_BALANCES_SOCKET, ADMIN_ADD_PENDING_MEDIATOR_APPLICATION,
  UPDATE_USER_PROFILE_SOCKET, UPDATE_USER_STATS, AUTH_CHECK_COMPLETE, LOGOUT_NO_TOKEN_ON_LOAD
} from "../actionTypes/userActionType";

const initialState = {
  loading: false,
  user: null,
  token: localStorage.getItem("token") || null,
  isAuth: !!localStorage.getItem("token"),
  authChecked: false,
  errors: null,
  registrationStatus: null,
  availableMediators: [],
  loadingMediators: false,
  errorMediators: null,
  loadingApplyMediator: false,
  errorApplyMediator: null,
  successApplyMediator: false,
  pendingMediatorApplications: { applications: [], totalPages: 0, currentPage: 1, totalApplications: 0 },
  loadingPendingMediatorApps: false,
  errorPendingMediatorApps: null,
  processingApp: {},
  errorProcessApp: null,
  successProcessApp: false,
  loadingUpdateMediatorStatus: false,
  errorUpdateMediatorStatus: null,
  loadingUpdateAvatar: false,
  errorUpdateAvatar: null,
  successUpdateAvatar: false,
  onlineUsers: [],
  successMessage: null,
  successMessageParams: null,
  errorMessage: null,
};

const userReducer = (state = initialState, action) => {
  const { type, payload } = action;

  switch (type) {
    case REGISTER_REQUEST:
    case LOGIN_REQUEST:
    case GET_PROFILE_REQUEST:
    case APPLY_MEDIATOR_REQUEST:
    case ADMIN_GET_MEDIATORS_REQUEST:
      return {
        ...state,
        loading: true,
        errorMessage: null,
        successMessage: null
      };

    case UPDATE_MEDIATOR_STATUS_REQUEST:
      return {
        ...state,
        loadingUpdateMediatorStatus: true, // هنا فقط نستخدم الحالة الخاصة
        errorUpdateMediatorStatus: null,
      };

    case UPDATE_MEDIATOR_STATUS_SUCCESS:
      return {
        ...state,
        loadingUpdateMediatorStatus: false,
        user: state.user ? { ...state.user, mediatorStatus: payload.newStatus } : null,
        successMessage: payload.successMessage,
      };

    // [!!!] حالة التحميل الخاصة بالصورة يجب أن تكون منفصلة [!!!]
    case UPDATE_AVATAR_REQUEST:
      return {
        ...state,
        loadingUpdateAvatar: true,
        errorUpdateAvatar: null,
        successUpdateAvatar: false,
      };

    case ADMIN_GET_MEDIATOR_APPS_REQUEST:
      return {
        ...state,
        loadingPendingMediatorApps: true,
        errorPendingMediatorApps: null,
      };
    case ADMIN_GET_MEDIATOR_APPS_SUCCESS:
      return {
        ...state,
        loadingPendingMediatorApps: false,
        pendingMediatorApplications: payload || initialState.pendingMediatorApplications,
      };
    case ADMIN_GET_MEDIATOR_APPS_FAIL:
      return {
        ...state,
        loadingPendingMediatorApps: false,
        errorPendingMediatorApps: payload.errorMessage,
      };

    case ADMIN_PROCESS_MEDIATOR_APP_REQUEST:
      return {
        ...state,
        processingApp: { ...state.processingApp, [payload.userId]: true },
        errorProcessApp: null,
        successProcessApp: false
      };
    case ADMIN_PROCESS_MEDIATOR_APP_SUCCESS:
      return {
        ...state,
        processingApp: { ...state.processingApp, [payload.userId]: false },
        pendingMediatorApplications: {
          ...state.pendingMediatorApplications,
          applications: state.pendingMediatorApplications.applications.filter(app => app._id !== payload.userId),
          totalApplications: Math.max(0, state.pendingMediatorApplications.totalApplications - 1)
        },
        successProcessApp: true,
        successMessage: payload.successMessage,
      };
    case ADMIN_PROCESS_MEDIATOR_APP_FAIL:
      return {
        ...state,
        processingApp: { ...state.processingApp, [payload.userId]: false },
        errorProcessApp: payload.errorMessage,
      };
    case ADMIN_PROCESS_MEDIATOR_APP_RESET:
      return {
        ...state,
        errorProcessApp: null,
        successProcessApp: false,
      };

    case ADMIN_ADD_PENDING_MEDIATOR_APPLICATION:
      const newApp = payload;
      const appExists = state.pendingMediatorApplications.applications.some(app => app._id === newApp._id);
      if (appExists) {
        return state;
      }
      return {
        ...state,
        pendingMediatorApplications: {
          ...state.pendingMediatorApplications,
          applications: [newApp, ...state.pendingMediatorApplications.applications],
          totalApplications: state.pendingMediatorApplications.totalApplications + 1
        }
      };

    case LOGIN_SUCCESS:
      return {
        ...state,
        loading: false,
        isAuth: true,
        user: payload.user,
        token: payload.token,
        errors: null,
        authChecked: true,
        successMessage: payload.successMessage,
        successMessageParams: payload.successMessageParams,
        errorMessage: null,
      };

    case REGISTER_SUCCESS:
      return {
        ...state,
        loading: false,
        registrationStatus: 'success',
        errors: null,
        successMessage: payload.successMessage
      };

    case GET_PROFILE_SUCCESS:
      return {
        ...state,
        user: payload.user,
        loading: false,
        isAuth: true,
        errors: null,
        authChecked: true,
      };

    // =========================================================================
    // [!!!] START: الكود المعدل والمصحح هنا [!!!]
    // =========================================================================
    case UPDATE_AVATAR_SUCCESS:
      // الـ payload يحتوي على { user: { ... }, msg: "..." }
      // لذا، يجب أن ندمج payload.user
      return {
        ...state,
        loadingUpdateAvatar: false,
        successUpdateAvatar: true,
        // دمج بيانات المستخدم الجديدة (بما في ذلك avatarUrl) مع الحالة الحالية
        user: { ...state.user, ...payload.user },
        successMessage: payload.successMessage,
        errorUpdateAvatar: null,
      };
    // =========================================================================
    // [!!!] END: نهاية الكود المعدل [!!!]
    // =========================================================================

    case APPLY_MEDIATOR_SUCCESS:
      return {
        ...state,
        loading: false,
        successApplyMediator: true,
        errorApplyMediator: null,
        user: state.user ? { ...state.user, mediatorApplicationStatus: payload.newStatus } : null,
        successMessage: payload.successMessage
      };

    // حالة الفشل الخاصة بالصورة يجب أن تكون منفصلة
    case UPDATE_AVATAR_FAIL:
      return {
        ...state,
        loadingUpdateAvatar: false,
        errorUpdateAvatar: payload.errorMessage,
      };

    case LOGIN_FAIL:
      return {
        ...state,
        loading: false, // <-- أهم إصلاح: أوقف التحميل
        isAuth: false,
        token: null,
        user: null,
        errorMessage: payload.errorMessage, // <-- ضع رسالة الخطأ هنا
      };

    case REGISTER_FAIL:
    case GET_PROFILE_FAIL:
    case APPLY_MEDIATOR_FAIL:
    case ADMIN_GET_MEDIATORS_FAIL:
      return {
        ...state,
        loading: false, // <-- أوقف التحميل العام لهذه الحالات أيضًا
        errorMessage: payload.errorMessage,
      };

    case UPDATE_MEDIATOR_STATUS_FAIL:
      return {
        ...state,
        loadingUpdateMediatorStatus: false, // هذه تستخدم حالة تحميل خاصة بها
        errorMessage: payload.errorMessage,
      };

    case LOGOUT:
    case LOGOUT_NO_TOKEN_ON_LOAD:
      return {
        ...initialState,
        token: null,
        isAuth: false,
        authChecked: true,
        successMessage: payload?.successMessage || null
      };

    case AUTH_CHECK_COMPLETE:
      return { ...state, authChecked: true };

    case CLEAR_USER_MESSAGES:
      return {
        ...state,
        successMessage: null,
        successMessageParams: null,
        errorMessage: null,
      };

    case CLEAR_USER_ERRORS:
      return {
        ...state,
        errors: null,
        errorMessage: null
      };

    case CLEAR_REGISTRATION_STATUS:
      return { ...state, registrationStatus: null };

    case UPDATE_AVATAR_RESET:
      return { ...state, loadingUpdateAvatar: false, errorUpdateAvatar: null, successUpdateAvatar: false };

    case APPLY_MEDIATOR_RESET:
      return { ...state, loadingApplyMediator: false, errorApplyMediator: null, successApplyMediator: false };

    case UPDATE_USER_BALANCES_SOCKET:
      if (state.user && payload && state.user._id === payload._id) {
        return {
          ...state,
          user: {
            ...state.user,
            balance: payload.balance !== undefined ? payload.balance : state.user.balance,
            depositBalance: payload.depositBalance !== undefined ? payload.depositBalance : state.user.depositBalance,
            withdrawalBalance: payload.withdrawalBalance !== undefined ? payload.withdrawalBalance : state.user.withdrawalBalance,
            sellerAvailableBalance: payload.sellerAvailableBalance !== undefined ? payload.sellerAvailableBalance : state.user.sellerAvailableBalance,
            sellerPendingBalance: payload.sellerPendingBalance !== undefined ? payload.sellerPendingBalance : state.user.sellerPendingBalance,
          },
        };
      }
      return state;

    case SET_ONLINE_USERS:
      return { ...state, onlineUsers: Array.isArray(payload) ? payload : [] };

    default:
      return state;
  }
};
export default userReducer;