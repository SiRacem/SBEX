// client/src/redux/reducers/achievementReducer.js

import * as types from '../actionTypes/achievementActionTypes';

const initialState = {
    achievements: [], // For admin management list
    availableAchievements: [], // For user display page
    loading: false,
    loadingAvailable: false,
    loadingCUD: false, // Loading for Create/Update/Delete operations
    error: null,
    pagination: {},
    success: false, // To track success of CUD operations
};

const achievementReducer = (state = initialState, action) => {
    const { type, payload } = action;

    switch (type) {
        // --- Admin Get All ---
        case types.ADMIN_GET_ACHIEVEMENTS_REQUEST:
            return { ...state, loading: true, error: null };
        case types.ADMIN_GET_ACHIEVEMENTS_SUCCESS:
            return {
                ...state,
                loading: false,
                achievements: payload.achievements,
                pagination: {
                    page: payload.page,
                    totalPages: payload.totalPages,
                    totalAchievements: payload.totalAchievements,
                },
            };
        case types.ADMIN_GET_ACHIEVEMENTS_FAIL:
            return { ...state, loading: false, error: payload };

        // --- User Get Available ---
        case types.GET_AVAILABLE_ACHIEVEMENTS_REQUEST:
            return { ...state, loadingAvailable: true, error: null };
        case types.GET_AVAILABLE_ACHIEVEMENTS_SUCCESS:
            return { ...state, loadingAvailable: false, availableAchievements: payload };
        case types.GET_AVAILABLE_ACHIEVEMENTS_FAIL:
            return { ...state, loadingAvailable: false, error: payload };

        // --- Admin Create ---
        case types.ADMIN_CREATE_ACHIEVEMENT_REQUEST:
            return { ...state, loadingCUD: true, success: false, error: null };
        case types.ADMIN_CREATE_ACHIEVEMENT_SUCCESS:
            return {
                ...state,
                loadingCUD: false,
                success: true,
                achievements: [payload, ...state.achievements],
            };
        case types.ADMIN_CREATE_ACHIEVEMENT_FAIL:
            return { ...state, loadingCUD: false, error: payload, success: false };
        case types.ADMIN_CREATE_ACHIEVEMENT_RESET:
            return { ...state, success: false, error: null };


        // --- Admin Update ---
        case types.ADMIN_UPDATE_ACHIEVEMENT_REQUEST:
            return { ...state, loadingCUD: true, success: false, error: null };
        case types.ADMIN_UPDATE_ACHIEVEMENT_SUCCESS:
            return {
                ...state,
                loadingCUD: false,
                success: true,
            };
        case types.ADMIN_UPDATE_ACHIEVEMENT_FAIL:
            return { ...state, loadingCUD: false, error: payload, success: false };
        case types.ADMIN_UPDATE_ACHIEVEMENT_RESET:
            return { ...state, success: false, error: null };

        // --- Admin Delete ---
        case types.ADMIN_DELETE_ACHIEVEMENT_REQUEST:
            return { ...state, loadingCUD: true, error: null };
        case types.ADMIN_DELETE_ACHIEVEMENT_SUCCESS:
            return {
                ...state,
                loadingCUD: false,
                achievements: state.achievements.filter(ach => ach._id !== payload.achievementId),
            };
        case types.ADMIN_DELETE_ACHIEVEMENT_FAIL:
            return { ...state, loadingCUD: false, error: payload };

        case types.CLEAR_ACHIEVEMENT_ERRORS:
            return { ...state, error: null };

        default:
            return state;
    }
};

export default achievementReducer;