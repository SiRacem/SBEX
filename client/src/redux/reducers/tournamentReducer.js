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
    UPDATE_TOURNAMENT_SOCKET, UPDATE_MATCH_SOCKET, CLEAR_TOURNAMENT_ERRORS, GET_TAKEN_TEAMS_SUCCESS,
    UPDATE_TOURNAMENT_PARTICIPANTS_SOCKET, ADD_TOURNAMENT_SOCKET
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
    takenTeams: [],
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

        case UPDATE_MATCH_SOCKET:
            // payload is the updated match object
            return {
                ...state,
                matches: state.matches.map(m => m._id === payload._id ? payload : m)
            };

        case CLEAR_TOURNAMENT_ERRORS:
            return { ...state, errors: null };

        case GET_TAKEN_TEAMS_SUCCESS:
            return { ...state, takenTeams: payload };

        // 1. إضافة بطولة جديدة (Socket)
        case ADD_TOURNAMENT_SOCKET:
            // منع التكرار
            if (state.tournaments.some(t => t._id === payload._id)) return state;
            return {
                ...state,
                tournaments: [payload, ...state.tournaments]
            };

        // 2. تحديث حالة بطولة موجودة (Socket - للإلغاء أو البدء)
        case UPDATE_TOURNAMENT_SOCKET:
            // 1. تحديث القائمة الرئيسية
            const updatedList = state.tournaments.map(t =>
                t._id === payload._id ? { ...t, ...payload } : t
            );

            // 2. تحديث البطولة الحالية (إذا كانت مفتوحة)
            let updatedCurrent = state.currentTournament;
            if (state.currentTournament && state.currentTournament._id === payload._id) {
                updatedCurrent = { 
                    ...state.currentTournament, 
                    ...payload,
                    participants: payload.participants || state.currentTournament.participants 
                };
            }

            return {
                ...state,
                tournaments: updatedList,
                currentTournament: updatedCurrent
            };

        case UPDATE_TOURNAMENT_PARTICIPANTS_SOCKET:
            if (state.currentTournament && state.currentTournament._id === payload.tournamentId) {
                // تحديث المشاركين
                const updatedParticipants = [...state.currentTournament.participants, payload.participant];
                // تحديث الفرق المحجوزة
                const updatedTakenTeams = [...state.takenTeams, payload.takenTeam];

                return {
                    ...state,
                    currentTournament: {
                        ...state.currentTournament,
                        participants: updatedParticipants
                    },
                    takenTeams: updatedTakenTeams
                };
            }
            return state;

        default:
            return state;
    }
};

export default tournamentReducer;