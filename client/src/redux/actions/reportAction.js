// src/redux/actions/reportAction.js
import axios from 'axios';
import * as types from '../actionTypes/reportActionTypes';

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

const getTokenConfig = (isFormData = false) => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const headers = { 'Authorization': `Bearer ${token}` };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    return { headers };
};

export const submitReport = (reportData) => async (dispatch) => {
    dispatch({ type: types.SUBMIT_REPORT_REQUEST });
    const config = getTokenConfig(true); // formData is used
    if (!config) {
        return dispatch({ type: types.SUBMIT_REPORT_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.post('/reports/submit', reportData, config);
        dispatch({ type: types.SUBMIT_REPORT_SUCCESS, payload: { ...data, successMessage: 'reports.submitSuccess' } });
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'reports.submitFail');
        dispatch({ type: types.SUBMIT_REPORT_FAIL, payload: { errorMessage: { key, fallback, params } } });
        throw error;
    }
};

export const adminGetReports = (params = {}) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_REPORTS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: types.ADMIN_GET_REPORTS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    }
    try {
        const { data } = await axios.get('/reports/admin', { ...config, params });
        dispatch({ type: types.ADMIN_GET_REPORTS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.reports.loadFail');
        dispatch({ type: types.ADMIN_GET_REPORTS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminGetReportDetails = (reportId) => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_REPORT_DETAILS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: types.ADMIN_GET_REPORT_DETAILS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    }
    try {
        const { data } = await axios.get(`/reports/admin/${reportId}`, config);
        dispatch({ type: types.ADMIN_GET_REPORT_DETAILS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.reports.loadDetailsFail');
        dispatch({ type: types.ADMIN_GET_REPORT_DETAILS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminUpdateReportStatus = (reportId, updateData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_UPDATE_REPORT_STATUS_REQUEST, payload: { reportId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: types.ADMIN_UPDATE_REPORT_STATUS_FAIL, payload: { reportId, errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    }
    try {
        const { data } = await axios.put(`/reports/admin/${reportId}/status`, updateData, config);
        dispatch({ type: types.ADMIN_UPDATE_REPORT_STATUS_SUCCESS, payload: { ...data, successMessage: 'admin.reports.updateSuccess' } });
        return data.report;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.reports.updateFail');
        dispatch({ type: types.ADMIN_UPDATE_REPORT_STATUS_FAIL, payload: { reportId, errorMessage: { key, fallback, params } } });
        throw error;
    }
};