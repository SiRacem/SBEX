import axios from 'axios';
import {
    GET_ALL_USERS_REQUEST, GET_ALL_USERS_SUCCESS, GET_ALL_USERS_FAIL,
    UPDATE_USER_STATUS_REQUEST, UPDATE_USER_STATUS_SUCCESS, UPDATE_USER_STATUS_FAIL,
    ADMIN_UPDATE_USER_DATA_REQUEST, ADMIN_UPDATE_USER_DATA_SUCCESS, ADMIN_UPDATE_USER_DATA_FAIL
} from '../actionTypes/adminUserActionType';
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

const getTokenConfig = (contentType = 'application/json') => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { headers: { 'Content-Type': contentType, 'Authorization': `Bearer ${token}` } };
};

export const adminGetAllUsers = () => async (dispatch) => {
    dispatch({ type: GET_ALL_USERS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: GET_ALL_USERS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    }
    try {
        const { data } = await axios.get('/user/get_users', config);
        dispatch({ type: GET_ALL_USERS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.users.loadFail');
        dispatch({ type: GET_ALL_USERS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const adminUpdateUserStatus = (userId, newBlockedStatus) => async (dispatch) => {
    dispatch({ type: UPDATE_USER_STATUS_REQUEST, payload: { userId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: UPDATE_USER_STATUS_FAIL, payload: { userId, errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    }
    try {
        const { data } = await axios.put(`/user/update_users/${userId}`, { blocked: newBlockedStatus }, config);
        dispatch({ type: UPDATE_USER_STATUS_SUCCESS, payload: { ...data, successMessage: 'admin.users.updateStatusSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.users.updateStatusFail');
        dispatch({ type: UPDATE_USER_STATUS_FAIL, payload: { userId, errorMessage: { key, fallback, params } } });
    }
};

export const adminUpdateUserData = (userId, updatedData) => async (dispatch, getState) => {
    dispatch({ type: ADMIN_UPDATE_USER_DATA_REQUEST, payload: { userId } });
    const config = getTokenConfig();
    if (!config) {
        const errorMessage = { key: 'apiErrors.notAuthorizedAdmin' };
        dispatch({ type: ADMIN_UPDATE_USER_DATA_FAIL, payload: { userId, errorMessage } });
        throw new Error('Authorization required.');
    }
    try {
        const { data } = await axios.put(`/user/update_users/${userId}`, updatedData, config);
        dispatch({ type: ADMIN_UPDATE_USER_DATA_SUCCESS, payload: { ...data, successMessage: 'admin.users.updateDataSuccess' } });
        const { user: currentUser } = getState().userReducer;
        if (currentUser?._id === userId) {
            dispatch(getProfile());
        }
        return data;
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.users.updateDataFail');
        dispatch({ type: ADMIN_UPDATE_USER_DATA_FAIL, payload: { userId, errorMessage: { key, fallback, params } } });
        throw error;
    }
};