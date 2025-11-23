import axios from 'axios';
import * as types from '../actionTypes/leaderboardActionTypes';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const getTokenConfig = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}` } };
};

export const getLeaderboards = (limit = 20) => async (dispatch) => {
    try {
        dispatch({ type: types.GET_LEADERBOARD_REQUEST });
        
        // نحاول جلب التوكن، إذا وجد نرسله لجلب "ترتيبي أنا"، وإذا لم يوجد نرسل طلب عادي
        const config = getTokenConfig() || {};
        
        const { data } = await axios.get(`${BACKEND_URL}/leaderboards?limit=${limit}`, config);

        dispatch({ 
            type: types.GET_LEADERBOARD_SUCCESS, 
            payload: data 
        });
    } catch (error) {
        dispatch({
            type: types.GET_LEADERBOARD_FAIL,
            payload: error.response?.data?.msg || error.message,
        });
    }
};