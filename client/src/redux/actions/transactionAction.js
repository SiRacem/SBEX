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

// Helper function to get token config
const getTokenConfig = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}` } };
};

// Action to get transactions
export const getTransactions = () => async (dispatch) => {
    dispatch({ type: GET_TRANSACTIONS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: GET_TRANSACTIONS_FAIL, payload: "Not authorized." });
    }

    try {
        // --- [!] استدعاء المسار الجديد في الواجهة الخلفية ---
        const { data } = await axios.get('/wallet/transactions', config);
        // ---------------------------------------------------
        dispatch({ type: GET_TRANSACTIONS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch transactions';
        dispatch({ type: GET_TRANSACTIONS_FAIL, payload: message });
    }
};

// Action to clear transactions on logout
export const clearTransactions = () => ({
    type: CLEAR_TRANSACTIONS
});

// --- [جديد] Action لجلب معاملات محددة للداشبورد ---
export const getTransactionsForDashboard = () => async (dispatch) => {
    dispatch({ type: GET_DASHBOARD_TRANSACTIONS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: GET_DASHBOARD_TRANSACTIONS_FAIL, payload: "Not authorized." });

    try {
        // Endpoint جديد في الـ Backend أو نفس الـ Endpoint مع query parameters
        // مثال: /wallet/transactions?context=dashboard أو /wallet/dashboard-transactions
        // الـ Backend سيرجع فقط الأنواع المطلوبة: PRODUCT_SALE_FUNDS_PENDING, PRODUCT_SALE_FUNDS_RELEASED,
        // PRODUCT_PURCHASE_COMPLETED, MEDIATION_FEE_RECEIVED, LEVEL_UP_REWARD_RECEIVED
        const { data } = await axios.get('/wallet/transactions/dashboard', config); // <<< Endpoint مقترح جديد
        dispatch({ type: GET_DASHBOARD_TRANSACTIONS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch dashboard transactions';
        dispatch({ type: GET_DASHBOARD_TRANSACTIONS_FAIL, payload: message });
    }
};
// ------------------------------------------------------