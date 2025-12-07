// src/redux/reducers/leagueReducer.js
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

const initialState = {
    leagues: [],
    teams: [], // الفرق الخاصة بالدوري المحدد حالياً
    loadingLeagues: false,
    loadingTeams: false,
    loadingAction: false, // للإنشاء/التعديل/الحذف
    errors: null,
};

const leagueReducer = (state = initialState, { type, payload }) => {
    switch (type) {
        // --- Get Leagues ---
        case GET_LEAGUES_REQUEST:
            return { ...state, loadingLeagues: true, errors: null };
        case GET_LEAGUES_SUCCESS:
            return { ...state, loadingLeagues: false, leagues: payload, errors: null };
        case GET_LEAGUES_FAIL:
            return { ...state, loadingLeagues: false, errors: payload };

        // --- Create League ---
        case CREATE_LEAGUE_REQUEST:
            return { ...state, loadingAction: true, errors: null };
        case CREATE_LEAGUE_SUCCESS:
            return { 
                ...state, 
                loadingAction: false, 
                leagues: [payload, ...state.leagues], 
                errors: null 
            };
        case CREATE_LEAGUE_FAIL:
            return { ...state, loadingAction: false, errors: payload };

        // --- Update League ---
        case UPDATE_LEAGUE_REQUEST:
            return { ...state, loadingAction: true };
        case UPDATE_LEAGUE_SUCCESS:
            return {
                ...state,
                loadingAction: false,
                leagues: state.leagues.map(l => l._id === payload._id ? payload : l)
            };
        case UPDATE_LEAGUE_FAIL:
            return { ...state, loadingAction: false, errors: payload };

        // --- Delete League ---
        case DELETE_LEAGUE_REQUEST:
            return { ...state, loadingAction: true };
        case DELETE_LEAGUE_SUCCESS:
            return {
                ...state,
                loadingAction: false,
                leagues: state.leagues.filter(l => l._id !== payload)
            };
        case DELETE_LEAGUE_FAIL:
            return { ...state, loadingAction: false, errors: payload };

        // --- TEAMS ---
        case GET_TEAMS_REQUEST:
            return { ...state, loadingTeams: true, teams: [], errors: null };
        case GET_TEAMS_SUCCESS:
            return { ...state, loadingTeams: false, teams: payload.teams };
        case GET_TEAMS_FAIL:
            return { ...state, loadingTeams: false, errors: payload };

        // --- Add Team ---
        case ADD_TEAM_REQUEST:
            return { ...state, loadingAction: true };
        case ADD_TEAM_SUCCESS:
            return { 
                ...state, 
                loadingAction: false, 
                teams: [...state.teams, payload] 
            };
        case ADD_TEAM_FAIL:
            return { ...state, loadingAction: false, errors: payload };

        // --- Update/Delete Team ---
        case UPDATE_TEAM_REQUEST:
        case DELETE_TEAM_REQUEST:
            return { ...state, loadingAction: true };
        
        case UPDATE_TEAM_SUCCESS:
            return {
                ...state,
                loadingAction: false,
                teams: state.teams.map(t => t._id === payload._id ? payload : t)
            };
        
        case DELETE_TEAM_SUCCESS:
            return {
                ...state,
                loadingAction: false,
                teams: state.teams.filter(t => t._id !== payload)
            };

        case UPDATE_TEAM_FAIL:
        case DELETE_TEAM_FAIL:
            return { ...state, loadingAction: false, errors: payload };

        case CLEAR_LEAGUE_ERRORS:
            return { ...state, errors: null };

        default:
            return state;
    }
};

export default leagueReducer;