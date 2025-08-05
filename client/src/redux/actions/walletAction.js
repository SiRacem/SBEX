import axios from 'axios';
import { SEND_BALANCE_REQUEST, SEND_BALANCE_SUCCESS, SEND_BALANCE_FAIL } from '../actionTypes/walletActionType';
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
    return { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };
};

export const sendBalance = (sendData) => async (dispatch) => {
    dispatch({ type: SEND_BALANCE_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        const errorMessage = { key: 'apiErrors.notAuthorized' };
        dispatch({ type: SEND_BALANCE_FAIL, payload: { errorMessage } });
        return Promise.reject(new Error("Token required."));
    }
    try {
        const { data } = await axios.post('/wallet/send', sendData, config);
        dispatch({ type: SEND_BALANCE_SUCCESS, payload: { ...data, successMessage: 'walletPage.sendModal.sendSuccess' } });
        dispatch(getProfile());
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'walletPage.sendModal.sendGenericError');
        dispatch({ type: SEND_BALANCE_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};