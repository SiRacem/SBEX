import * as types from '../actionTypes/referralActionTypes';

const initialState = {
    stats: null, // { referralCode, referralBalance, totalEarnings, referralsCount, referralsList, config }
    loading: false,
    error: null,
    bindLoading: false,
    bindSuccess: false,
    transferLoading: false,
    transferSuccess: false
};

const referralReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.GET_REFERRAL_STATS_REQUEST:
            return { ...state, loading: true, error: null };
        case types.GET_REFERRAL_STATS_SUCCESS:
            return { ...state, loading: false, stats: action.payload };
        case types.GET_REFERRAL_STATS_FAIL:
            return { ...state, loading: false, error: action.payload };

        case types.BIND_REFERRAL_REQUEST:
            return { ...state, bindLoading: true, bindSuccess: false };
        case types.BIND_REFERRAL_SUCCESS:
            return { ...state, bindLoading: false, bindSuccess: true };
        case types.BIND_REFERRAL_FAIL:
            return { ...state, bindLoading: false, error: action.payload };

        case types.TRANSFER_REFERRAL_BALANCE_REQUEST:
            return { ...state, transferLoading: true, transferSuccess: false };
        case types.TRANSFER_REFERRAL_BALANCE_SUCCESS:
            // تحديث الرصيد محلياً
            return { 
                ...state, 
                transferLoading: false, 
                transferSuccess: true,
                stats: {
                    ...state.stats,
                    referralBalance: action.payload.newReferralBalance
                }
            };
        case types.TRANSFER_REFERRAL_BALANCE_FAIL:
            return { ...state, transferLoading: false, error: action.payload };

        case 'ADD_NEW_REFERRAL_SOCKET':
            const newReferral = action.payload;
            // إذا لم تكن stats محملة بعد، لا نفعل شيئًا (ستتحمل عند فتح الصفحة)
            if (!state.stats) return state;

            return {
                ...state,
                stats: {
                    ...state.stats,
                    referralsList: [newReferral, ...(state.stats.referralsList || [])], // إضافة للأعلى
                    referralsCount: (state.stats.referralsCount || 0) + 1
                }
            };
            
        default:
            return state;
    }
};

export default referralReducer;