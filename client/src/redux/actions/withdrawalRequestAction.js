import axios from 'axios';
import * as types from '../actionTypes/withdrawalRequestActionType';
import { getProfile } from './userAction';

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
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
};

export const createWithdrawalRequest = (withdrawalData) => async (dispatch) => {
    dispatch({ type: types.CREATE_WITHDRAWAL_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: types.CREATE_WITHDRAWAL_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
        return false;
    }
    try {
        const { data } = await axios.post('/withdrawals', withdrawalData, config);
        dispatch({ type: types.CREATE_WITHDRAWAL_SUCCESS, payload: { ...data, successMessage: 'walletPage.withdrawal.success' } });
        dispatch(getUserWithdrawalRequests());
        dispatch(getProfile());
        return true;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'walletPage.withdrawal.fail');
        dispatch({ type: types.CREATE_WITHDRAWAL_FAIL, payload: { errorMessage: { key, fallback, params } } });
        return false;
    }
};

export const resetCreateWithdrawal = () => ({ type: types.CREATE_WITHDRAWAL_RESET });

export const getUserWithdrawalRequests = (params = {}) => async (dispatch) => {
    dispatch({ type: types.GET_USER_WITHDRAWALS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: types.GET_USER_WITHDRAWALS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
        return;
    }
    try {
        const { data } = await axios.get('/withdrawals/my-requests', { ...config, params });
        dispatch({ type: types.GET_USER_WITHDRAWALS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'walletPage.withdrawal.historyFail');
        dispatch({ type: types.GET_USER_WITHDRAWALS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminGetWithdrawalRequests = (params = {}) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_WITHDRAWALS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_GET_WITHDRAWALS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.get('/withdrawals/admin', { ...config, params });
        dispatch({ type: types.ADMIN_GET_WITHDRAWALS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.withdrawals.loadFail');
        dispatch({ type: types.ADMIN_GET_WITHDRAWALS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminGetWithdrawalDetails = (requestId) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_WITHDRAWAL_DETAILS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_GET_WITHDRAWAL_DETAILS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.get(`/withdrawals/admin/${requestId}`, config);
        dispatch({ type: types.ADMIN_GET_WITHDRAWAL_DETAILS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.withdrawals.loadDetailsFail');
        dispatch({ type: types.ADMIN_GET_WITHDRAWAL_DETAILS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminClearWithdrawalDetails = () => ({ type: types.ADMIN_CLEAR_WITHDRAWAL_DETAILS });

export const adminCompleteWithdrawal = (requestId, details = {}) => async (dispatch) => {
    dispatch({ type: types.ADMIN_COMPLETE_WITHDRAWAL_REQUEST, payload: { requestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_COMPLETE_WITHDRAWAL_FAIL, payload: { requestId, errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`/withdrawals/admin/${requestId}/complete`, details, config);
        dispatch({ type: types.ADMIN_COMPLETE_WITHDRAWAL_SUCCESS, payload: { requestId, updatedRequest: data.updatedRequest, successMessage: 'admin.withdrawals.completeSuccess' } });
        dispatch(adminGetWithdrawalRequests({ status: 'pending' }));
        return true;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.withdrawals.completeFail');
        dispatch({ type: types.ADMIN_COMPLETE_WITHDRAWAL_FAIL, payload: { requestId, errorMessage: { key, fallback, params } } });
        return false;
    }
};

export const adminRejectWithdrawal = (requestId, rejectionReason) => async (dispatch) => {
    dispatch({ type: types.ADMIN_REJECT_WITHDRAWAL_REQUEST, payload: { requestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_REJECT_WITHDRAWAL_FAIL, payload: { requestId, errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`/withdrawals/admin/${requestId}/reject`, { rejectionReason }, config);
        dispatch({ type: types.ADMIN_REJECT_WITHDRAWAL_SUCCESS, payload: { requestId, updatedRequest: data.updatedRequest, successMessage: 'admin.withdrawals.rejectSuccess' } });
        dispatch(getProfile());
        dispatch(adminGetWithdrawalRequests({ status: 'pending' }));
        return true;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.withdrawals.rejectFail');
        dispatch({ type: types.ADMIN_REJECT_WITHDRAWAL_FAIL, payload: { requestId, errorMessage: { key, fallback, params } } });
        return false;
    }
};

export const adminClearWithdrawalError = () => ({ type: types.ADMIN_CLEAR_WITHDRAWAL_ERROR });