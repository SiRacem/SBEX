import axios from 'axios';
import * as types from '../actionTypes/referralActionTypes';
import { getProfile } from './userAction'; // لتحديث رصيد المستخدم الرئيسي بعد التحويل

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const getTokenConfig = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}` } };
};

export const getReferralStats = () => async (dispatch) => {
    try {
        dispatch({ type: types.GET_REFERRAL_STATS_REQUEST });
        const { data } = await axios.get(`${BACKEND_URL}/referral/my-stats`, getTokenConfig());
        dispatch({ type: types.GET_REFERRAL_STATS_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: types.GET_REFERRAL_STATS_FAIL,
            payload: error.response?.data?.msg || error.message
        });
    }
};

export const bindReferral = (referralCode) => async (dispatch) => {
    try {
        dispatch({ type: types.BIND_REFERRAL_REQUEST });
        const { data } = await axios.post(`${BACKEND_URL}/referral/bind`, { referralCode }, getTokenConfig());
        dispatch({ type: types.BIND_REFERRAL_SUCCESS, payload: data });
        dispatch(getProfile()); // تحديث حالة المستخدم (لإخفاء خانة الإدخال)
        return data;
    } catch (error) {
        dispatch({
            type: types.BIND_REFERRAL_FAIL,
            payload: error.response?.data?.msg || error.message
        });
        throw error;
    }
};

export const transferReferralBalance = (amount) => async (dispatch) => {
    try {
        dispatch({ type: types.TRANSFER_REFERRAL_BALANCE_REQUEST });
        const { data } = await axios.post(`${BACKEND_URL}/referral/transfer`, { amount }, getTokenConfig());
        dispatch({ type: types.TRANSFER_REFERRAL_BALANCE_SUCCESS, payload: data });
        dispatch(getProfile()); // تحديث الرصيد الرئيسي
        return data;
    } catch (error) {
        dispatch({
            type: types.TRANSFER_REFERRAL_BALANCE_FAIL,
            payload: error.response?.data?.msg || error.message
        });
        throw error;
    }
};

export const addNewReferralFromSocket = (newReferral) => (dispatch) => {
    dispatch({
        type: 'ADD_NEW_REFERRAL_SOCKET', // سنضيفه في Reducer
        payload: newReferral
    });
};