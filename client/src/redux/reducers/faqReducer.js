// src/redux/reducers/faqReducer.js
import * as types from '../actionTypes/faqActionTypes';

const initialState = {
    // For public view
    groupedFAQs: {},
    loading: false,
    error: null,
    // For admin panel
    adminFaqList: [],
    loadingAdmin: false,
    errorAdmin: null,
    // For create/update/delete operations
    loadingCUD: false,
    errorCUD: null,
    successCreate: false,
    successUpdate: false,
};

export const faqReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.GET_FAQS_REQUEST:
            return { ...state, loading: true, error: null };
        case types.GET_FAQS_SUCCESS:
            return { ...state, loading: false, groupedFAQs: action.payload };
        case types.GET_FAQS_FAIL:
            return { ...state, loading: false, error: action.payload };

        case types.ADMIN_GET_ALL_FAQS_REQUEST:
            return { ...state, loadingAdmin: true };
        case types.ADMIN_GET_ALL_FAQS_SUCCESS:
            return { ...state, loadingAdmin: false, adminFaqList: action.payload };
        case types.ADMIN_GET_ALL_FAQS_FAIL:
            return { ...state, loadingAdmin: false, errorAdmin: action.payload };

        case types.ADMIN_CREATE_FAQ_REQUEST:
        case types.ADMIN_UPDATE_FAQ_REQUEST:
        case types.ADMIN_DELETE_FAQ_REQUEST:
            return { ...state, loadingCUD: true, successCreate: false, successUpdate: false, errorCUD: null };

        case types.ADMIN_CREATE_FAQ_SUCCESS:
            return {
                ...state,
                loadingCUD: false,
                successCreate: true,
                adminFaqList: [...state.adminFaqList, action.payload],
            };
        case types.ADMIN_UPDATE_FAQ_SUCCESS:
            return {
                ...state,
                loadingCUD: false,
                successUpdate: true,
                adminFaqList: state.adminFaqList.map(faq =>
                    faq._id === action.payload._id ? action.payload : faq
                ),
            };
        case types.ADMIN_DELETE_FAQ_SUCCESS:
            return {
                ...state,
                loadingCUD: false,
                adminFaqList: state.adminFaqList.filter(faq => faq._id !== action.payload),
            };

        case types.ADMIN_CREATE_FAQ_FAIL:
        case types.ADMIN_UPDATE_FAQ_FAIL:
        case types.ADMIN_DELETE_FAQ_FAIL:
            return { ...state, loadingCUD: false, errorCUD: action.payload };

        case types.ADMIN_CREATE_FAQ_RESET:
            return { ...state, successCreate: false };
        case types.ADMIN_UPDATE_FAQ_RESET:
            return { ...state, successUpdate: false };

        case types.CLEAR_FAQ_ERRORS:
            return { ...state, error: null, errorAdmin: null, errorCUD: null };

        default:
            return state;
    }
};