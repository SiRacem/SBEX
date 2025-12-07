// src/redux/actions/leagueAction.js
import axios from 'axios';
import {
    GET_LEAGUES_REQUEST, GET_LEAGUES_SUCCESS, GET_LEAGUES_FAIL,
    CREATE_LEAGUE_REQUEST, CREATE_LEAGUE_SUCCESS, CREATE_LEAGUE_FAIL,
    UPDATE_LEAGUE_REQUEST, UPDATE_LEAGUE_SUCCESS, UPDATE_LEAGUE_FAIL,
    DELETE_LEAGUE_REQUEST, DELETE_LEAGUE_SUCCESS, DELETE_LEAGUE_FAIL,
    GET_TEAMS_REQUEST, GET_TEAMS_SUCCESS, GET_TEAMS_FAIL,
    ADD_TEAM_REQUEST, ADD_TEAM_SUCCESS, ADD_TEAM_FAIL,
    UPDATE_TEAM_REQUEST, UPDATE_TEAM_SUCCESS, UPDATE_TEAM_FAIL,
    DELETE_TEAM_REQUEST, DELETE_TEAM_SUCCESS, DELETE_TEAM_FAIL,
    CLEAR_LEAGUE_ERRORS
} from '../actionTypes/leagueActionTypes';

// رابط الـ API الثابت (أو من .env)
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const getConfig = () => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token 
        }
    };
};

// 1. Get All Leagues (Admin)
export const getAllLeagues = () => async (dispatch) => {
    dispatch({ type: GET_LEAGUES_REQUEST });
    try {
        const { data } = await axios.get(`${API_URL}/leagues`, getConfig());
        dispatch({ type: GET_LEAGUES_SUCCESS, payload: data });
    } catch (error) {
        dispatch({ type: GET_LEAGUES_FAIL, payload: error.response?.data?.message || 'Error fetching leagues' });
    }
};

// 2. Create League
export const createLeague = (leagueData) => async (dispatch) => {
    dispatch({ type: CREATE_LEAGUE_REQUEST });
    try {
        const { data } = await axios.post(`${API_URL}/leagues/create`, leagueData, getConfig());
        dispatch({ type: CREATE_LEAGUE_SUCCESS, payload: data.league });
        return { success: true, message: data.message };
    } catch (error) {
        const msg = error.response?.data?.message || 'Creation failed';
        dispatch({ type: CREATE_LEAGUE_FAIL, payload: msg });
        return { success: false, message: msg };
    }
};

// 3. Update League (Toggle Active or Edit)
export const updateLeague = (id, updateData) => async (dispatch) => {
    dispatch({ type: UPDATE_LEAGUE_REQUEST });
    try {
        const { data } = await axios.put(`${API_URL}/leagues/${id}`, updateData, getConfig());
        dispatch({ type: UPDATE_LEAGUE_SUCCESS, payload: data.league });
        return { success: true };
    } catch (error) {
        dispatch({ type: UPDATE_LEAGUE_FAIL, payload: error.response?.data?.message });
        return { success: false };
    }
};

// 4. Delete League
export const deleteLeague = (id) => async (dispatch) => {
    dispatch({ type: DELETE_LEAGUE_REQUEST });
    try {
        await axios.delete(`${API_URL}/leagues/${id}`, getConfig());
        dispatch({ type: DELETE_LEAGUE_SUCCESS, payload: id });
        return { success: true };
    } catch (error) {
        dispatch({ type: DELETE_LEAGUE_FAIL, payload: error.response?.data?.message });
        return { success: false };
    }
};

// --- TEAMS ---

// 5. Get Teams by League
export const getTeamsByLeague = (leagueId) => async (dispatch) => {
    dispatch({ type: GET_TEAMS_REQUEST });
    try {
        const { data } = await axios.get(`${API_URL}/leagues/${leagueId}/teams`, getConfig());
        dispatch({ type: GET_TEAMS_SUCCESS, payload: { leagueId, teams: data } });
    } catch (error) {
        dispatch({ type: GET_TEAMS_FAIL, payload: error.response?.data?.message });
    }
};

// 6. Add Team
export const addTeam = (teamData) => async (dispatch) => {
    dispatch({ type: ADD_TEAM_REQUEST });
    try {
        const { data } = await axios.post(`${API_URL}/leagues/teams/add`, teamData, getConfig());
        dispatch({ type: ADD_TEAM_SUCCESS, payload: data.team });
        return { success: true, message: data.message };
    } catch (error) {
        const msg = error.response?.data?.message || 'Add team failed';
        dispatch({ type: ADD_TEAM_FAIL, payload: msg });
        return { success: false, message: msg };
    }
};

// 7. Update Team
export const updateTeam = (id, updateData) => async (dispatch) => {
    dispatch({ type: UPDATE_TEAM_REQUEST });
    try {
        const { data } = await axios.put(`${API_URL}/leagues/teams/${id}`, updateData, getConfig());
        dispatch({ type: UPDATE_TEAM_SUCCESS, payload: data.team });
        return { success: true };
    } catch (error) {
        dispatch({ type: UPDATE_TEAM_FAIL, payload: error.response?.data?.message });
        return { success: false };
    }
};

// 8. Delete Team
export const deleteTeam = (id) => async (dispatch) => {
    dispatch({ type: DELETE_TEAM_REQUEST });
    try {
        await axios.delete(`${API_URL}/leagues/teams/${id}`, getConfig());
        dispatch({ type: DELETE_TEAM_SUCCESS, payload: id });
        return { success: true };
    } catch (error) {
        dispatch({ type: DELETE_TEAM_FAIL, payload: error.response?.data?.message });
        return { success: false };
    }
};

export const clearLeagueErrors = () => ({ type: CLEAR_LEAGUE_ERRORS });