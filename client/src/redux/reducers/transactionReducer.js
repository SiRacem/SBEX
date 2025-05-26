// src/redux/reducers/transactionReducer.js
import {
    GET_TRANSACTIONS_REQUEST,
    GET_TRANSACTIONS_SUCCESS,
    GET_TRANSACTIONS_FAIL,
    CLEAR_TRANSACTIONS,
    GET_DASHBOARD_TRANSACTIONS_REQUEST, GET_DASHBOARD_TRANSACTIONS_SUCCESS, GET_DASHBOARD_TRANSACTIONS_FAIL,
} from '../actionTypes/transactionActionTypes';

const initialState = {
    transactions: [],
    loading: false,
    error: null,
    dashboardSection: {     // <<< قسم جديد لمعاملات الداشبورد
        dashboardTransactions: [],
        loading: false,
        error: null,
    }
};

const transactionReducer = (state = initialState, { type, payload }) => {
    switch (type) {
        case GET_TRANSACTIONS_REQUEST:
            return { ...state, loading: true, error: null };
        case GET_TRANSACTIONS_SUCCESS:
            return { ...state, loading: false, transactions: payload, error: null };
        case GET_TRANSACTIONS_FAIL:
            return { ...state, loading: false, error: payload, transactions: [] }; // مسح المعاملات عند الفشل
        case CLEAR_TRANSACTIONS:
            return { ...initialState }; // إعادة للحالة الأولية
        
        case GET_DASHBOARD_TRANSACTIONS_REQUEST:
            return { 
                ...state, 
                dashboardSection: { ...state.dashboardSection, loading: true, error: null } 
            };
        case GET_DASHBOARD_TRANSACTIONS_SUCCESS:
            return { 
                ...state, 
                dashboardSection: { ...state.dashboardSection, loading: false, dashboardTransactions: payload, error: null } 
            };
        case GET_DASHBOARD_TRANSACTIONS_FAIL:
            return { 
                ...state, 
                dashboardSection: { ...state.dashboardSection, loading: false, error: payload, dashboardTransactions: [] } 
            };

        default:
            return state;
    }
};

export default transactionReducer;