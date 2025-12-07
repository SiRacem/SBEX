// src/redux/reducers/tournamentReducer.js
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
    UPDATE_TOURNAMENT_SOCKET, UPDATE_MATCH_SOCKET, CLEAR_TOURNAMENT_ERRORS
} from '../actionTypes/tournamentActionTypes';

const initialState = {
    tournaments: [],
    currentTournament: null,
    matches: [], // for the bracket
    loading: false,         // General loading (fetch lists)
    loadingDetails: false,  // Fetching single tournament
    loadingCreate: false,   // Creating new one
    loadingJoin: false,     // Joining action
    loadingCheckIn: false,  // Check-in action
    loadingStart: false,    // Admin start action
    loadingMatches: false,  // Fetching bracket
    loadingMatchAction: false, // Submitting/Confirming result
    errors: null,
};

const tournamentReducer = (state = initialState, { type, payload }) => {
    switch (type) {
        // --- Get All ---
        case GET_TOURNAMENTS_REQUEST:
            return { ...state, loading: true, errors: null };
        case GET_TOURNAMENTS_SUCCESS:
            return { ...state, loading: false, tournaments: payload, errors: null };
        case GET_TOURNAMENTS_FAIL:
            return { ...state, loading: false, errors: payload };

        // --- Get Details ---
        case GET_TOURNAMENT_DETAILS_REQUEST:
            return { ...state, loadingDetails: true, errors: null };
        case GET_TOURNAMENT_DETAILS_SUCCESS:
            return { ...state, loadingDetails: false, currentTournament: payload, errors: null };
        case GET_TOURNAMENT_DETAILS_FAIL:
            return { ...state, loadingDetails: false, errors: payload };

        // --- Create ---
        case CREATE_TOURNAMENT_REQUEST:
            return { ...state, loadingCreate: true, errors: null };
        case CREATE_TOURNAMENT_SUCCESS:
            return { 
                ...state, 
                loadingCreate: false, 
                tournaments: [payload, ...state.tournaments], // Add to list
                errors: null 
            };
        case CREATE_TOURNAMENT_FAIL:
            return { ...state, loadingCreate: false, errors: payload };

        // --- Join ---
        case JOIN_TOURNAMENT_REQUEST:
            return { ...state, loadingJoin: true, errors: null };
        case JOIN_TOURNAMENT_SUCCESS:
            // We usually re-fetch details, but we can also update locally if payload has info
            return { ...state, loadingJoin: false, errors: null };
        case JOIN_TOURNAMENT_FAIL:
            return { ...state, loadingJoin: false, errors: payload };

        // --- Check In ---
        case CHECKIN_TOURNAMENT_REQUEST:
            return { ...state, loadingCheckIn: true, errors: null };
        case CHECKIN_TOURNAMENT_SUCCESS:
            return { ...state, loadingCheckIn: false, errors: null };
        case CHECKIN_TOURNAMENT_FAIL:
            return { ...state, loadingCheckIn: false, errors: payload };

        // --- Start (Admin) ---
        case START_TOURNAMENT_REQUEST:
            return { ...state, loadingStart: true, errors: null };
        case START_TOURNAMENT_SUCCESS:
            return { 
                ...state, 
                loadingStart: false, 
                // Update local status if matches current
                currentTournament: state.currentTournament 
                    ? { ...state.currentTournament, status: 'active' } 
                    : null
            };
        case START_TOURNAMENT_FAIL:
            return { ...state, loadingStart: false, errors: payload };

        // --- Matches (Bracket) ---
        case GET_MATCHES_REQUEST:
            return { ...state, loadingMatches: true, errors: null };
        case GET_MATCHES_SUCCESS:
            return { ...state, loadingMatches: false, matches: payload, errors: null };
        case GET_MATCHES_FAIL:
            return { ...state, loadingMatches: false, errors: payload };

        // --- Match Actions (Submit/Confirm) ---
        case SUBMIT_MATCH_RESULT_REQUEST:
        case CONFIRM_MATCH_RESULT_REQUEST:
            return { ...state, loadingMatchAction: true, errors: null };
        case SUBMIT_MATCH_RESULT_SUCCESS:
        case CONFIRM_MATCH_RESULT_SUCCESS:
            return { ...state, loadingMatchAction: false, errors: null };
        case SUBMIT_MATCH_RESULT_FAIL:
        case CONFIRM_MATCH_RESULT_FAIL:
            return { ...state, loadingMatchAction: false, errors: payload };

        // --- Socket Updates ---
        case UPDATE_TOURNAMENT_SOCKET:
            // Update in list
            const updatedList = state.tournaments.map(t => 
                t._id === payload._id ? payload : t
            );
            // Update current if open
            const updatedCurrent = (state.currentTournament && state.currentTournament._id === payload._id)
                ? payload
                : state.currentTournament;
            
            return {
                ...state,
                tournaments: updatedList,
                currentTournament: updatedCurrent
            };

        case UPDATE_MATCH_SOCKET:
            // payload is the updated match object
            return {
                ...state,
                matches: state.matches.map(m => m._id === payload._id ? payload : m)
            };

        case CLEAR_TOURNAMENT_ERRORS:
            return { ...state, errors: null };

        default:
            return state;
    }
};

export default tournamentReducer;