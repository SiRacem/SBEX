import { GET_LEADERBOARD_FAIL, GET_LEADERBOARD_REQUEST, GET_LEADERBOARD_SUCCESS } from '../actionTypes/leaderboardActionTypes';

const initialState = {
    leaderboards: {
        topReputation: [],
        topSellers: [],
        topMediators: [],
        topBuyers: [],
        topBidders: []
    },
    myRanks: {}, // لتخزين ترتيب المستخدم الحالي
    loading: false,
    error: null
};

const leaderboardReducer = (state = initialState, action) => {
    const { type, payload } = action;

    switch (type) {
        case GET_LEADERBOARD_REQUEST:
            return { ...state, loading: true, error: null };
        case GET_LEADERBOARD_SUCCESS:
            return {
                ...state,
                loading: false,
                leaderboards: payload.leaderboards,
                myRanks: payload.myRanks || {},
                error: null
            };
        case GET_LEADERBOARD_FAIL:
            return { ...state, loading: false, error: payload };
        default:
            return state;
    }
};

export default leaderboardReducer;