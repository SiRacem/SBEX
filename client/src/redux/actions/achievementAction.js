// client/src/redux/actions/achievementAction.js

import axios from 'axios';
import * as types from '../actionTypes/achievementActionTypes';

// Helper to get token config, copied from your newsAction.js for consistency
const getTokenConfig = (isFormData = false) => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const headers = { 'Authorization': `Bearer ${token}` };
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    return { headers };
};

// --- ADMIN ACTIONS ---

// Get all achievements for the management dashboard
export const adminGetAllAchievements = (page = 1, limit = 15) => async (dispatch) => {
    try {
        dispatch({ type: types.ADMIN_GET_ACHIEVEMENTS_REQUEST });
        const config = getTokenConfig();
        if (!config) throw new Error("Not authorized");

        const { data } = await axios.get(`/achievements?page=${page}&limit=${limit}`, config);

        dispatch({ type: types.ADMIN_GET_ACHIEVEMENTS_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: types.ADMIN_GET_ACHIEVEMENTS_FAIL,
            payload: error.response?.data?.message || error.message,
        });
    }
};

// Create a new achievement
export const adminCreateAchievement = (formData) => async (dispatch) => {
    try {
        dispatch({ type: types.ADMIN_CREATE_ACHIEVEMENT_REQUEST });
        const config = getTokenConfig(); // Not FormData for this one
        if (!config) throw new Error("Not authorized");

        // We will send data as JSON, not FormData
        const { data } = await axios.post('/achievements', formData, config);

        dispatch({ type: types.ADMIN_CREATE_ACHIEVEMENT_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: types.ADMIN_CREATE_ACHIEVEMENT_FAIL,
            payload: error.response?.data?.message || error.message,
        });
        throw error; // Re-throw to be caught in the component
    }
};

// Update an existing achievement
export const adminUpdateAchievement = (achievementId, formData) => async (dispatch) => {
    try {
        dispatch({ type: types.ADMIN_UPDATE_ACHIEVEMENT_REQUEST });
        const config = getTokenConfig();
        if (!config) throw new Error("Not authorized");

        const { data } = await axios.put(`/achievements/${achievementId}`, formData, config);

        // 1. قم بعمل dispatch للنجاح (لإيقاف التحميل)
        dispatch({ type: types.ADMIN_UPDATE_ACHIEVEMENT_SUCCESS, payload: data });

        // 2. قم بإعادة جلب القائمة المحدثة بالكامل من الخادم
        dispatch(adminGetAllAchievements());

    } catch (error) {
        dispatch({
            type: types.ADMIN_UPDATE_ACHIEVEMENT_FAIL,
            payload: error.response?.data?.message || error.message,
        });
        throw error;
    }
};

// Delete an achievement
export const adminDeleteAchievement = (achievementId) => async (dispatch) => {
    try {
        dispatch({ type: types.ADMIN_DELETE_ACHIEVEMENT_REQUEST });
        const config = getTokenConfig();
        if (!config) throw new Error("Not authorized");

        await axios.delete(`/achievements/${achievementId}`, config);

        dispatch({ type: types.ADMIN_DELETE_ACHIEVEMENT_SUCCESS, payload: { achievementId } });
    } catch (error) {
        dispatch({
            type: types.ADMIN_DELETE_ACHIEVEMENT_FAIL,
            payload: error.response?.data?.message || error.message,
        });
        throw error;
    }
};


// --- USER/PUBLIC ACTIONS ---

// Get all non-secret achievements for users to view
export const getAvailableAchievements = () => async (dispatch) => {
    try {
        dispatch({ type: types.GET_AVAILABLE_ACHIEVEMENTS_REQUEST });
        // This is a public route, no token needed
        const { data } = await axios.get('/achievements/available');
        dispatch({ type: types.GET_AVAILABLE_ACHIEVEMENTS_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: types.GET_AVAILABLE_ACHIEVEMENTS_FAIL,
            payload: error.response?.data?.message || error.message,
        });
    }
};