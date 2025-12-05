import {
    GET_MESSAGES_REQUEST,
    GET_MESSAGES_SUCCESS,
    ADD_MESSAGE_REALTIME,
    MESSAGE_DELETED_REALTIME,
    MESSAGE_PINNED_REALTIME,
    CHAT_CLEARED_REALTIME
} from '../actionTypes/chatActionTypes';

const initialState = {
    messages: [],
    pinnedMessage: null,
    loading: false,
    error: null
};

const chatReducer = (state = initialState, action) => {
    const { type, payload } = action;

    switch (type) {
        case GET_MESSAGES_REQUEST:
            return { ...state, loading: true };
        
        case GET_MESSAGES_SUCCESS:
            return { 
                ...state, 
                loading: false, 
                messages: payload.messages, 
                pinnedMessage: payload.pinnedMessage 
            };

        case ADD_MESSAGE_REALTIME:
            if (state.messages.some(msg => msg._id === payload._id)) return state;
            return { 
                ...state, 
                messages: [...state.messages, payload] 
            };

        case MESSAGE_DELETED_REALTIME:
            return {
                ...state,
                messages: state.messages.filter(msg => msg._id !== payload)
            };

        case CHAT_CLEARED_REALTIME:
            return { ...state, messages: [] };

        case MESSAGE_PINNED_REALTIME:
            return { ...state, pinnedMessage: payload };

        default:
            return state;
    }
};

export default chatReducer;