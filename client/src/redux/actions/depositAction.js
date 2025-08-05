import axios from 'axios';
import {
    CREATE_DEPOSIT_REQUEST, CREATE_DEPOSIT_SUCCESS, CREATE_DEPOSIT_FAIL, CREATE_DEPOSIT_RESET,
    GET_USER_DEPOSITS_REQUEST, GET_USER_DEPOSITS_SUCCESS, GET_USER_DEPOSITS_FAIL,
    ADMIN_GET_DEPOSITS_REQUEST, ADMIN_GET_DEPOSITS_SUCCESS, ADMIN_GET_DEPOSITS_FAIL,
    ADMIN_APPROVE_DEPOSIT_REQUEST, ADMIN_APPROVE_DEPOSIT_SUCCESS, ADMIN_APPROVE_DEPOSIT_FAIL,
    ADMIN_REJECT_DEPOSIT_REQUEST, ADMIN_REJECT_DEPOSIT_SUCCESS, ADMIN_REJECT_DEPOSIT_FAIL,
    CLEAR_DEPOSIT_ERRORS
} from '../actionTypes/depositActionType';
import { getProfile } from './userAction';
import { getTransactions } from './transactionAction';

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
    return { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
};

export const createDepositRequest = (depositData) => async (dispatch) => {
    dispatch({ type: CREATE_DEPOSIT_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: CREATE_DEPOSIT_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.post('/deposits', depositData, config);
        dispatch({ type: CREATE_DEPOSIT_SUCCESS, payload: { ...data.request, successMessage: 'walletPage.deposit.success' } });
        dispatch(getUserDepositRequests());
        dispatch(getTransactions());
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'walletPage.deposit.fail');
        dispatch({ type: CREATE_DEPOSIT_FAIL, payload: { errorMessage: { key, fallback, params: { error: fallback } } } });
        throw new Error(fallback || "Failed to submit deposit request.");
    }
};

export const resetCreateDeposit = () => ({ type: CREATE_DEPOSIT_RESET });

export const getUserDepositRequests = (params = {}) => async (dispatch) => {
    dispatch({ type: GET_USER_DEPOSITS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: GET_USER_DEPOSITS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    try {
        const { data } = await axios.get('/deposits/my-requests', { ...config, params });
        dispatch({ type: GET_USER_DEPOSITS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'walletPage.deposit.historyFail');
        dispatch({ type: GET_USER_DEPOSITS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminGetDeposits = (filters = {}) => async (dispatch) => {
    dispatch({ type: ADMIN_GET_DEPOSITS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_GET_DEPOSITS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { page = 1, limit = 15, status = '' } = filters;
        let queryString = `?page=${page}&limit=${limit}`;
        if (status) queryString += `&status=${status}`;
        const { data } = await axios.get(`/deposits/admin${queryString}`, config);
        dispatch({ type: ADMIN_GET_DEPOSITS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.deposits.loadFail');
        dispatch({ type: ADMIN_GET_DEPOSITS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminApproveDeposit = (requestId) => async (dispatch) => {
    dispatch({ type: ADMIN_APPROVE_DEPOSIT_REQUEST, payload: { requestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_APPROVE_DEPOSIT_FAIL, payload: { requestId, errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`/deposits/admin/${requestId}/approve`, {}, config);
        dispatch({ type: ADMIN_APPROVE_DEPOSIT_SUCCESS, payload: { ...data.request, successMessage: 'admin.deposits.approveSuccess' } });
        dispatch(getProfile(data.request.user));
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.deposits.approveFail');
        dispatch({ type: ADMIN_APPROVE_DEPOSIT_FAIL, payload: { requestId, errorMessage: { key, fallback, params } } });
    }
};

export const adminRejectDeposit = (requestId, reason) => async (dispatch) => {
    dispatch({ type: ADMIN_REJECT_DEPOSIT_REQUEST, payload: { requestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_REJECT_DEPOSIT_FAIL, payload: { requestId, errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`/deposits/admin/${requestId}/reject`, { reason }, config);
        dispatch({ type: ADMIN_REJECT_DEPOSIT_SUCCESS, payload: { ...data.request, successMessage: 'admin.deposits.rejectSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.deposits.rejectFail');
        dispatch({ type: ADMIN_REJECT_DEPOSIT_FAIL, payload: { requestId, errorMessage: { key, fallback, params } } });
    }
};

export const clearDepositErrors = () => ({ type: CLEAR_DEPOSIT_ERRORS });