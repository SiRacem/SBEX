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
  UPDATE_USER_PROFILE_SOCKET, UPDATE_USER_STATS
} from "../actionTypes/userActionType";

const initialState = {
  loading: false,
  user: null,
  token: localStorage.getItem("token") || null,
  isAuth: !!localStorage.getItem("token"),
  authChecked: false,
  errors: null, // يبقى للتوافق مع أي كود قديم
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
  onlineUsers: [],
  successMessage: null,
  successMessageParams: null,
  errorMessage: null, // الحقل الجديد للتعامل مع أخطاء الترجمة
};

const userReducer = (state = initialState, action) => {
  const { type, payload } = action;

  switch (type) {
    case REGISTER_REQUEST:
    case LOGIN_REQUEST:
    case GET_PROFILE_REQUEST:
    case APPLY_MEDIATOR_REQUEST:
    case UPDATE_AVATAR_REQUEST:
    case ADMIN_GET_MEDIATOR_APPS_REQUEST:
    case ADMIN_GET_MEDIATORS_REQUEST:
    case UPDATE_MEDIATOR_STATUS_REQUEST:
      return {
        ...state,
        loading: true,
        errorMessage: null,
        successMessage: null
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
        errorMessage: payload.errorMessage || null,
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

    case UPDATE_AVATAR_SUCCESS:
      return {
        ...state,
        loading: false,
        successUpdateAvatar: true,
        user: payload.user,
        successMessage: payload.successMessage,
        errorUpdateAvatar: null,
      };

    case APPLY_MEDIATOR_SUCCESS:
      return {
        ...state,
        loading: false,
        successApplyMediator: true,
        errorApplyMediator: null,
        user: state.user ? { ...state.user, mediatorApplicationStatus: payload.newStatus } : null,
        successMessage: payload.successMessage
      };

    // --- حالات الفشل المجمعة ---
    case LOGIN_FAIL:
    case REGISTER_FAIL:
    case GET_PROFILE_FAIL:
    case APPLY_MEDIATOR_FAIL:
    case ADMIN_GET_MEDIATOR_APPS_FAIL:
    case ADMIN_GET_MEDIATORS_FAIL:
    case UPDATE_MEDIATOR_STATUS_FAIL:
    case UPDATE_AVATAR_FAIL:
      return {
        ...state,
        loading: false,
        errorMessage: payload.errorMessage,
        authChecked: true,
      };

    case LOGOUT:
      return {
        ...initialState,
        authChecked: true,
        successMessage: payload?.successMessage || null
      };

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