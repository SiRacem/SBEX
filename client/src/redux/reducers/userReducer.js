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
  UPDATE_USER_BALANCES_SOCKET,
  ADMIN_ADD_PENDING_MEDIATOR_APPLICATION,
  UPDATE_USER_PROFILE_SOCKET,
  UPDATE_USER_STATS,
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
    case ADMIN_GET_MEDIATOR_APPS_SUCCESS: // هذه الحالة تجلب القائمة الكاملة
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

    case UPDATE_USER_BALANCES_SOCKET:
      if (state.user && payload && state.user._id === payload._id) {
        console.log("[Reducer] Updating user balances via socket. Payload:", payload);
        // This ensures all balance fields from the payload are updated,
        // while keeping other user data intact.
        return {
          ...state,
          user: {
            ...state.user, // Keep existing user data
            balance: payload.balance !== undefined ? payload.balance : state.user.balance,
            depositBalance: payload.depositBalance !== undefined ? payload.depositBalance : state.user.depositBalance,
            withdrawalBalance: payload.withdrawalBalance !== undefined ? payload.withdrawalBalance : state.user.withdrawalBalance,
            sellerAvailableBalance: payload.sellerAvailableBalance !== undefined ? payload.sellerAvailableBalance : state.user.sellerAvailableBalance,
            sellerPendingBalance: payload.sellerPendingBalance !== undefined ? payload.sellerPendingBalance : state.user.sellerPendingBalance,
          },
        };
      }
      return state;

    // --- [!!! الحالة الجديدة هنا !!!] ---
    case ADMIN_ADD_PENDING_MEDIATOR_APPLICATION:
      if (!payload || !payload._id) {
        console.warn("REDUCER: ADMIN_ADD_PENDING_MEDIATOR_APPLICATION - Invalid payload. Payload:", payload);
        return state;
      }
      // payload هنا هو applicantDataForSocket من الخادم
      console.log("REDUCER: ADMIN_ADD_PENDING_MEDIATOR_APPLICATION - Adding application:", JSON.stringify(payload, null, 2));

      const applicationExists = state.pendingMediatorApps.applications.some(
        app => app._id === payload._id && app.mediatorApplicationStatus === 'Pending' // قد ترغب في التحقق من الحالة أيضًا
      );

      if (applicationExists) {
        console.warn("REDUCER: ADMIN_ADD_PENDING_MEDIATOR_APPLICATION - Application already exists or is not pending anymore:", payload._id);
        // إذا كان موجودًا بالفعل، يمكنك اختيار تحديثه بالبيانات الجديدة
        // أو تجاهله إذا كان الهدف هو فقط إضافة الطلبات الجديدة
        return {
          ...state,
          pendingMediatorApps: {
            ...state.pendingMediatorApps,
            applications: state.pendingMediatorApps.applications.map(app =>
              app._id === payload._id ? payload : app // تحديث الطلب الموجود
            ),
          },
        };
      }

      // تأكد أن الكائن 'payload' يحتوي على نفس بنية الكائنات الموجودة في 'applications'
      // خاصة إذا كان 'applications' يتوقع كائنات مستخدم كاملة
      // applicantDataForSocket كان يحتوي على حقول مختارة.
      // إذا كان ReviewMediatorApplications يتوقع بنية معينة، قم بضبط payload هنا.
      // المثال الحالي يفترض أن applicantDataForSocket كافٍ للعرض.
      const newApplicationEntry = {
        // افترض أن payload (applicantDataForSocket) يحتوي على كل ما يحتاجه الجدول
        // مثل _id, fullName, email, level, mediatorEscrowGuarantee, mediatorApplicationBasis, updatedAt/createdAt
        ...payload
      };

      return {
        ...state,
        pendingMediatorApps: {
          ...state.pendingMediatorApps,
          applications: [newApplicationEntry, ...state.pendingMediatorApps.applications],
          totalApplications: state.pendingMediatorApps.totalApplications + 1,
        },
      };
    // --- نهاية الحالة الجديدة ---

    case UPDATE_USER_PROFILE_SOCKET:
      if (state.user && state.user._id === payload._id) {
        // الدمج يضمن تحديث الحقول الجديدة مع الحفاظ على القديمة
        return {
          ...state,
          user: { ...state.user, ...payload },
        };
      }
      return state;

    // [!!!] أضف هذه الحالة الجديدة هنا [!!!]
    case UPDATE_USER_STATS:
      if (state.user) {
        // payload should contain { activeListingsCount_change: 1 or -1 }
        // or { productsSoldCount_change: 1 or -1 }
        const currentActiveCount = state.user.activeListingsCount || 0;
        const currentSoldCount = state.user.productsSoldCount || 0;

        return {
          ...state,
          user: {
            ...state.user,
            activeListingsCount: currentActiveCount + (payload.activeListingsCount_change || 0),
            productsSoldCount: currentSoldCount + (payload.productsSoldCount_change || 0),
          },
        };
      }
      return state;
      
    default:
      return state;
  }
};
export default userReducer;
