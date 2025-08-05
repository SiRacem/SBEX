import axios from 'axios';
import * as types from '../actionTypes/faqActionTypes';

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

const getTokenConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export const getActiveFAQs = () => async (dispatch) => {
    dispatch({ type: types.GET_FAQS_REQUEST });
    try {
        const { data } = await axios.get('/faq');
        dispatch({ type: types.GET_FAQS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'faq.loadPublicFail');
        dispatch({ type: types.GET_FAQS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminGetAllFAQs = () => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_ALL_FAQS_REQUEST });
    try {
        const { data } = await axios.get('/faq/admin/all', getTokenConfig());
        dispatch({ type: types.ADMIN_GET_ALL_FAQS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.faq.loadFail');
        dispatch({ type: types.ADMIN_GET_ALL_FAQS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminCreateFAQ = (faqData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_CREATE_FAQ_REQUEST });
    try {
        const { data } = await axios.post('/faq/admin', faqData, getTokenConfig());
        dispatch({ type: types.ADMIN_CREATE_FAQ_SUCCESS, payload: { ...data.faq, successMessage: 'admin.faq.createSuccess' } });
        dispatch(getActiveFAQs());
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.faq.createFail');
        dispatch({ type: types.ADMIN_CREATE_FAQ_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminUpdateFAQ = (id, faqData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_UPDATE_FAQ_REQUEST });
    try {
        const { data } = await axios.put(`/faq/admin/${id}`, faqData, getTokenConfig());
        dispatch({ type: types.ADMIN_UPDATE_FAQ_SUCCESS, payload: { ...data.faq, successMessage: 'admin.faq.updateSuccess' } });
        dispatch(getActiveFAQs());
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.faq.updateFail');
        dispatch({ type: types.ADMIN_UPDATE_FAQ_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminDeleteFAQ = (id) => async (dispatch) => {
    dispatch({ type: types.ADMIN_DELETE_FAQ_REQUEST, payload: id });
    try {
        const { data } = await axios.delete(`/faq/admin/${id}`, getTokenConfig());
        dispatch({ type: types.ADMIN_DELETE_FAQ_SUCCESS, payload: { id, successMessage: 'admin.faq.deleteSuccess' } });
        dispatch(getActiveFAQs());
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.faq.deleteFail');
        dispatch({ type: types.ADMIN_DELETE_FAQ_FAIL, payload: { id, errorMessage: { key, fallback, params } } });
    }
};

export const clearFaqErrors = () => ({ type: types.CLEAR_FAQ_ERRORS });
export const resetCreateFaqStatus = () => ({ type: types.ADMIN_CREATE_FAQ_RESET });
export const resetUpdateFaqStatus = () => ({ type: types.ADMIN_UPDATE_FAQ_RESET });