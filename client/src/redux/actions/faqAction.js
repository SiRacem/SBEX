// src/redux/actions/faqAction.js
import axios from 'axios';
import { toast } from 'react-toastify';
import * as types from '../actionTypes/faqActionTypes';

const getTokenConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

// --- Public Action ---
export const getActiveFAQs = () => async (dispatch) => {
    dispatch({ type: types.GET_FAQS_REQUEST });
    try {
        const { data } = await axios.get('/faq'); // المسار الصحيح الآن
        dispatch({ type: types.GET_FAQS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || 'Failed to load FAQs.';
        dispatch({ type: types.GET_FAQS_FAIL, payload: message });
    }
};

// --- Admin Actions ---
export const adminGetAllFAQs = () => async (dispatch) => {
    dispatch({ type: types.ADMIN_GET_ALL_FAQS_REQUEST });
    try {
        const { data } = await axios.get('/faq/admin/all', getTokenConfig());
        dispatch({ type: types.ADMIN_GET_ALL_FAQS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || 'Failed to load FAQs for admin.';
        dispatch({ type: types.ADMIN_GET_ALL_FAQS_FAIL, payload: message });
        toast.error(message);
    }
};

export const adminCreateFAQ = (faqData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_CREATE_FAQ_REQUEST });
    try {
        const { data } = await axios.post('/faq/admin', faqData, getTokenConfig());
        dispatch({ type: types.ADMIN_CREATE_FAQ_SUCCESS, payload: data.faq });
        dispatch(getActiveFAQs());
        toast.success(data.msg || "FAQ created successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || 'Failed to create FAQ.';
        dispatch({ type: types.ADMIN_CREATE_FAQ_FAIL, payload: message });
        toast.error(message);
    }
};

export const adminUpdateFAQ = (id, faqData) => async (dispatch) => {
    dispatch({ type: types.ADMIN_UPDATE_FAQ_REQUEST });
    try {
        const { data } = await axios.put(`/faq/admin/${id}`, faqData, getTokenConfig());
        dispatch({ type: types.ADMIN_UPDATE_FAQ_SUCCESS, payload: data.faq });
        dispatch(getActiveFAQs());
        toast.success(data.msg || "FAQ updated successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || 'Failed to update FAQ.';
        dispatch({ type: types.ADMIN_UPDATE_FAQ_FAIL, payload: message });
        toast.error(message);
    }
};

export const adminDeleteFAQ = (id) => async (dispatch) => {
    dispatch({ type: types.ADMIN_DELETE_FAQ_REQUEST, payload: id });
    try {
        const { data } = await axios.delete(`/faq/admin/${id}`, getTokenConfig());
        dispatch({ type: types.ADMIN_DELETE_FAQ_SUCCESS, payload: id });
        dispatch(getActiveFAQs());
        toast.success(data.msg || "FAQ deleted successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || 'Failed to delete FAQ.';
        dispatch({ type: types.ADMIN_DELETE_FAQ_FAIL, payload: { id, error: message } });
        toast.error(message);
    }
};

export const clearFaqErrors = () => ({ type: types.CLEAR_FAQ_ERRORS });
export const resetCreateFaqStatus = () => ({ type: types.ADMIN_CREATE_FAQ_RESET });
export const resetUpdateFaqStatus = () => ({ type: types.ADMIN_UPDATE_FAQ_RESET });