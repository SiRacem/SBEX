// src/redux/actions/paymentMethodAction.js
import axios from 'axios';
import { toast } from 'react-toastify';
import {
    GET_ACTIVE_METHODS_REQUEST, GET_ACTIVE_METHODS_SUCCESS, GET_ACTIVE_METHODS_FAIL,
    ADMIN_GET_ALL_METHODS_REQUEST, ADMIN_GET_ALL_METHODS_SUCCESS, ADMIN_GET_ALL_METHODS_FAIL,
    ADMIN_ADD_METHOD_REQUEST, ADMIN_ADD_METHOD_SUCCESS, ADMIN_ADD_METHOD_FAIL,
    ADMIN_UPDATE_METHOD_REQUEST, ADMIN_UPDATE_METHOD_SUCCESS, ADMIN_UPDATE_METHOD_FAIL,
    ADMIN_DELETE_METHOD_REQUEST, ADMIN_DELETE_METHOD_SUCCESS, ADMIN_DELETE_METHOD_FAIL,
    CLEAR_PAYMENT_METHOD_ERROR
} from '../actionTypes/paymentMethodActionTypes';

// Helper للحصول على التوكن (يمكن استيراده من ملف مشترك)
const getTokenConfig = () => {
    const token = localStorage.getItem('token');
    if (!token || token === 'null' || token === 'undefined') return null;
    return { headers: { 'Authorization': `Bearer ${token}` } };
};

// --- Action للمستخدمين ---

// جلب الطرق النشطة
export const getActivePaymentMethods = (type = '') => async (dispatch) => { // type يمكن أن يكون 'deposit' أو 'withdrawal'
    dispatch({ type: GET_ACTIVE_METHODS_REQUEST });
    try {
        const params = type ? { type } : {}; // إضافة بارامتر النوع إذا تم تمريره
        const { data } = await axios.get('/payment-methods', { params }); // تأكد من المسار الصحيح (مع /api إذا لزم الأمر)
        dispatch({ type: GET_ACTIVE_METHODS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch payment methods.';
        dispatch({ type: GET_ACTIVE_METHODS_FAIL, payload: message });
    }
};

// --- Actions للأدمن ---

// جلب كل الطرق
export const adminGetAllPaymentMethods = () => async (dispatch) => {
    dispatch({ type: ADMIN_GET_ALL_METHODS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_GET_ALL_METHODS_FAIL, payload: 'Not authorized.' });
    try {
        const { data } = await axios.get('/payment-methods/admin/all', config); // تأكد من المسار
        dispatch({ type: ADMIN_GET_ALL_METHODS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch all payment methods.';
        dispatch({ type: ADMIN_GET_ALL_METHODS_FAIL, payload: message });
    }
};

// إضافة طريقة جديدة
export const adminAddPaymentMethod = (methodData) => async (dispatch) => {
    dispatch({ type: ADMIN_ADD_METHOD_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_ADD_METHOD_FAIL, payload: 'Not authorized.' });
    try {
        const { data } = await axios.post('/payment-methods/admin', methodData, config); // تأكد من المسار
        dispatch({ type: ADMIN_ADD_METHOD_SUCCESS, payload: data });
        toast.success(`Payment method '${data.name}' added successfully!`);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to add payment method.';
        dispatch({ type: ADMIN_ADD_METHOD_FAIL, payload: message });
        toast.error(`Error adding method: ${message}`);
    }
};

// تعديل طريقة موجودة
export const adminUpdatePaymentMethod = (methodId, updateData) => async (dispatch) => {
    dispatch({ type: ADMIN_UPDATE_METHOD_REQUEST, payload: { methodId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_UPDATE_METHOD_FAIL, payload: { methodId, error: 'Not authorized.' } });
    try {
        const { data } = await axios.put(`/payment-methods/admin/${methodId}`, updateData, config); // تأكد من المسار
        dispatch({ type: ADMIN_UPDATE_METHOD_SUCCESS, payload: data });
        toast.success(`Payment method '${data.name}' updated successfully!`);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to update payment method.';
        dispatch({ type: ADMIN_UPDATE_METHOD_FAIL, payload: { methodId, error: message } });
        toast.error(`Error updating method: ${message}`);
    }
};

// حذف طريقة دفع
export const adminDeletePaymentMethod = (methodId) => async (dispatch) => {
    dispatch({ type: ADMIN_DELETE_METHOD_REQUEST, payload: { methodId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADMIN_DELETE_METHOD_FAIL, payload: { methodId, error: 'Not authorized.' } });

    if (!window.confirm("Are you sure you want to delete this payment method?")) {
        dispatch({ type: ADMIN_DELETE_METHOD_FAIL, payload: { methodId, error: "Deletion cancelled." } });
        return;
    }

    try {
        await axios.delete(`/payment-methods/admin/${methodId}`, config); // تأكد من المسار
        dispatch({ type: ADMIN_DELETE_METHOD_SUCCESS, payload: { methodId } });
        toast.success(`Payment method deleted successfully!`);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to delete payment method.';
        dispatch({ type: ADMIN_DELETE_METHOD_FAIL, payload: { methodId, error: message } });
        toast.error(`Error deleting method: ${message}`);
    }
};

// مسح الأخطاء
export const clearPaymentMethodError = () => ({ type: CLEAR_PAYMENT_METHOD_ERROR });