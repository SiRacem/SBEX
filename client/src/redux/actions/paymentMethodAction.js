import axios from 'axios';
import * as types from '../actionTypes/paymentMethodActionTypes';

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
    return { headers: { 'Authorization': `Bearer ${token}` } };
};

export const getActivePaymentMethods = (type = '') => async (dispatch) => {
    dispatch({ type: types.GET_ACTIVE_METHODS_REQUEST });
    try {
        const params = type ? { type } : {};
        const { data } = await axios.get('/payment-methods', { params });
        dispatch({ type: types.GET_ACTIVE_METHODS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'paymentMethods.loadFail');
        dispatch({ type: types.GET_ACTIVE_METHODS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminGetAllPaymentMethods = () => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_ALL_METHODS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_GET_ALL_METHODS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.get('/payment-methods/admin/all', config);
        dispatch({ type: types.ADMIN_GET_ALL_METHODS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.paymentMethods.loadFail');
        dispatch({ type: types.ADMIN_GET_ALL_METHODS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminAddPaymentMethod = (methodData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_ADD_METHOD_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_ADD_METHOD_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.post('/payment-methods/admin', methodData, config);
        dispatch({ type: types.ADMIN_ADD_METHOD_SUCCESS, payload: { ...data, successMessage: 'admin.paymentMethods.addSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.paymentMethods.addFail');
        dispatch({ type: types.ADMIN_ADD_METHOD_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminUpdatePaymentMethod = (methodId, updateData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_UPDATE_METHOD_REQUEST, payload: { methodId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_UPDATE_METHOD_FAIL, payload: { methodId, errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        const { data } = await axios.put(`/payment-methods/admin/${methodId}`, updateData, config);
        dispatch({ type: types.ADMIN_UPDATE_METHOD_SUCCESS, payload: { ...data, successMessage: 'admin.paymentMethods.updateSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.paymentMethods.updateFail');
        dispatch({ type: types.ADMIN_UPDATE_METHOD_FAIL, payload: { methodId, errorMessage: { key, fallback, params } } });
    }
};

export const adminDeletePaymentMethod = (methodId) => async (dispatch) => {
    dispatch({ type: types.ADMIN_DELETE_METHOD_REQUEST, payload: { methodId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: types.ADMIN_DELETE_METHOD_FAIL, payload: { methodId, errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    try {
        await axios.delete(`/payment-methods/admin/${methodId}`, config);
        dispatch({ type: types.ADMIN_DELETE_METHOD_SUCCESS, payload: { methodId, successMessage: 'admin.paymentMethods.deleteSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.paymentMethods.deleteFail');
        dispatch({ type: types.ADMIN_DELETE_METHOD_FAIL, payload: { methodId, errorMessage: { key, fallback, params } } });
    }
};

export const clearPaymentMethodError = () => ({ type: types.CLEAR_PAYMENT_METHOD_ERROR });