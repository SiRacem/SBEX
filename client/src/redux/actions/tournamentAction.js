// src/redux/actions/tournamentAction.js
import axios from 'axios';
import {
    GET_TOURNAMENTS_REQUEST, GET_TOURNAMENTS_SUCCESS, GET_TOURNAMENTS_FAIL,
    GET_TOURNAMENT_DETAILS_REQUEST, GET_TOURNAMENT_DETAILS_SUCCESS, GET_TOURNAMENT_DETAILS_FAIL,
    CREATE_TOURNAMENT_REQUEST, CREATE_TOURNAMENT_SUCCESS, CREATE_TOURNAMENT_FAIL,
    JOIN_TOURNAMENT_REQUEST, JOIN_TOURNAMENT_SUCCESS, JOIN_TOURNAMENT_FAIL,
    CHECKIN_TOURNAMENT_REQUEST, CHECKIN_TOURNAMENT_SUCCESS, CHECKIN_TOURNAMENT_FAIL,
    START_TOURNAMENT_REQUEST, START_TOURNAMENT_SUCCESS, START_TOURNAMENT_FAIL,
    GET_MATCHES_REQUEST, GET_MATCHES_SUCCESS, GET_MATCHES_FAIL,
    SUBMIT_MATCH_RESULT_REQUEST, SUBMIT_MATCH_RESULT_SUCCESS, SUBMIT_MATCH_RESULT_FAIL,
    CONFIRM_MATCH_RESULT_REQUEST, CONFIRM_MATCH_RESULT_SUCCESS, CONFIRM_MATCH_RESULT_FAIL,
    CHANGE_TEAM_REQUEST, CHANGE_TEAM_SUCCESS, CHANGE_TEAM_FAIL, CLEAR_TOURNAMENT_ERRORS
} from '../actionTypes/tournamentActionTypes';

// Helper to get token (if not using an interceptor)
const getConfig = () => {
    const token = localStorage.getItem('token');
    
    return {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        }
    };
};

const API_URL = "http://localhost:8000";

// 1. Get All Tournaments
export const getAllTournaments = () => async (dispatch) => {
    dispatch({ type: GET_TOURNAMENTS_REQUEST });
    try {
        const { data } = await axios.get(`${API_URL}/tournaments`, getConfig());
        dispatch({ type: GET_TOURNAMENTS_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: GET_TOURNAMENTS_FAIL,
            payload: error.response?.data?.message || 'Error fetching tournaments'
        });
    }
};

// 2. Get Single Tournament Details
export const getTournamentDetails = (id) => async (dispatch) => {
    dispatch({ type: GET_TOURNAMENT_DETAILS_REQUEST });
    try {
        const { data } = await axios.get(`${API_URL}/tournaments/${id}`, getConfig());
        dispatch({ type: GET_TOURNAMENT_DETAILS_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: GET_TOURNAMENT_DETAILS_FAIL,
            payload: error.response?.data?.message || 'Error fetching details'
        });
    }
};

// 3. Create Tournament (Admin)
export const createTournament = (formData) => async (dispatch) => {
    dispatch({ type: CREATE_TOURNAMENT_REQUEST });
    try {
        const { data } = await axios.post(
            `${API_URL}/tournaments/create`, 
            formData, 
            getConfig()
        );
        
        dispatch({ type: CREATE_TOURNAMENT_SUCCESS, payload: data.tournament });
        return { success: true, message: data.message };
    } catch (error) {
        const msg = error.response?.data?.message || 'CreationFailed';
        dispatch({ type: CREATE_TOURNAMENT_FAIL, payload: msg });
        return { success: false, message: msg };
    }
};

// 4. Join Tournament
export const joinTournament = (tournamentId, teamData) => async (dispatch) => {
    dispatch({ type: JOIN_TOURNAMENT_REQUEST });
    try {
        const { data } = await axios.post(
            `${API_URL}/tournaments/${tournamentId}/join`,
            teamData,
            getConfig()
        );
        dispatch({ type: JOIN_TOURNAMENT_SUCCESS, payload: data });
        dispatch(getTournamentDetails(tournamentId));
        return { success: true, message: data.message };
    } catch (error) {
        const msg = error.response?.data?.message || 'Join Failed';
        dispatch({ type: JOIN_TOURNAMENT_FAIL, payload: msg });
        return { success: false, message: msg };
    }
};

// 5. Check In
export const checkInTournament = (tournamentId) => async (dispatch) => {
    dispatch({ type: CHECKIN_TOURNAMENT_REQUEST });
    try {
        const { data } = await axios.post(
            `${API_URL}/tournaments/${tournamentId}/check-in`,
            {},
            getConfig()
        );
        dispatch({ type: CHECKIN_TOURNAMENT_SUCCESS, payload: data });
        dispatch(getTournamentDetails(tournamentId));
        return { success: true, message: data.message };
    } catch (error) {
        const msg = error.response?.data?.message || 'Check-in Failed';
        dispatch({ type: CHECKIN_TOURNAMENT_FAIL, payload: msg });
        return { success: false, message: msg };
    }
};

// 6. Start Tournament (Admin)
export const startTournament = (tournamentId) => async (dispatch) => {
    dispatch({ type: START_TOURNAMENT_REQUEST });
    try {
        const { data } = await axios.post(
            `${API_URL}/tournaments/${tournamentId}/start`,
            {},
            getConfig()
        );
        dispatch({ type: START_TOURNAMENT_SUCCESS, payload: data });
        dispatch(getTournamentDetails(tournamentId));
        return { success: true, message: data.message };
    } catch (error) {
        const msg = error.response?.data?.message || 'Start Failed';
        dispatch({ type: START_TOURNAMENT_FAIL, payload: msg });
        return { success: false, message: msg };
    }
};

// 7. Get Matches (Bracket)
export const getTournamentMatches = (tournamentId) => async (dispatch) => {
    dispatch({ type: GET_MATCHES_REQUEST });
    try {
        const { data } = await axios.get(`${API_URL}/tournaments/${tournamentId}/matches`, getConfig());
        dispatch({ type: GET_MATCHES_SUCCESS, payload: data });
    } catch (error) {
        dispatch({ type: GET_MATCHES_FAIL, payload: error.response?.data?.message });
    }
};

// 8. Submit Match Result
export const submitMatchResult = (matchId, resultData) => async (dispatch) => {
    dispatch({ type: SUBMIT_MATCH_RESULT_REQUEST });
    try {
        const { data } = await axios.post(
            `${API_URL}/matches/${matchId}/submit`,
            resultData,
            getConfig()
        );
        dispatch({ type: SUBMIT_MATCH_RESULT_SUCCESS, payload: data });
        return { success: true, message: data.message };
    } catch (error) {
        const msg = error.response?.data?.message || 'Submit Failed';
        dispatch({ type: SUBMIT_MATCH_RESULT_FAIL, payload: msg });
        return { success: false, message: msg };
    }
};

// 9. Confirm Match Result
export const confirmMatchResult = (matchId) => async (dispatch) => {
    dispatch({ type: CONFIRM_MATCH_RESULT_REQUEST });
    try {
        const { data } = await axios.post(
            `${API_URL}/matches/${matchId}/confirm`,
            {},
            getConfig()
        );
        dispatch({ type: CONFIRM_MATCH_RESULT_SUCCESS, payload: data });
        return { success: true, message: data.message };
    } catch (error) {
        const msg = error.response?.data?.message || 'Confirm Failed';
        dispatch({ type: CONFIRM_MATCH_RESULT_FAIL, payload: msg });
        return { success: false, message: msg };
    }
};

// 10. Clear Errors
export const clearTournamentErrors = () => {
    return { type: CLEAR_TOURNAMENT_ERRORS };
};