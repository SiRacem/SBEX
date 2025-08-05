// src/redux/actions/transactionAction.js
import axios from 'axios';
import {
    GET_TRANSACTIONS_REQUEST,
    GET_TRANSACTIONS_SUCCESS,
    GET_TRANSACTIONS_FAIL,
    CLEAR_TRANSACTIONS,
    GET_DASHBOARD_TRANSACTIONS_REQUEST,
    GET_DASHBOARD_TRANSACTIONS_SUCCESS,
    GET_DASHBOARD_TRANSACTIONS_FAIL,
} from '../actionTypes/transactionActionTypes';

const handleError = (error, defaultKey = 'apiErrors.unknownError') => {
    if (error.response) {
        if (error.response.data.translationKey) return { key: error.response.data.translationKey };
        if (error.response.data.msg) {
            const fallback = error.response.data.msg;
            const key = `apiErrors.${fallback.replace(/\s+/g, '_').replace(/[!'.]/g, '')}`;
            return { key, fallback };
        }
        return { key: 'apiErrors.requestFailedWithCode', params: { code: error.response.status } };
    } else if (error.request) {
        return { key: 'apiErrors.networkError' };
    }
    return { key: defaultKey, params: { message: error.message } };
};

const getTokenConfig = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}` } };
};

export const getTransactions = () => async (dispatch) => {
    dispatch({ type: GET_TRANSACTIONS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: GET_TRANSACTIONS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.get('/wallet/transactions', config);
        dispatch({ type: GET_TRANSACTIONS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'transactions.loadFail');
        dispatch({ type: GET_TRANSACTIONS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const clearTransactions = () => ({
    type: CLEAR_TRANSACTIONS
});

export const getTransactionsForDashboard = () => async (dispatch) => {
    dispatch({ type: GET_DASHBOARD_TRANSACTIONS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: GET_DASHBOARD_TRANSACTIONS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.get('/wallet/transactions/dashboard', config);
        dispatch({ type: GET_DASHBOARD_TRANSACTIONS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'dashboard.activities.loadFail');
        dispatch({ type: GET_DASHBOARD_TRANSACTIONS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};