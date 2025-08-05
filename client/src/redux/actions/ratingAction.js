import axios from 'axios';
import {
    SUBMIT_RATING_REQUEST, SUBMIT_RATING_SUCCESS, SUBMIT_RATING_FAIL, SUBMIT_RATING_RESET,
    GET_RATINGS_FOR_MEDIATION_REQUEST, GET_RATINGS_FOR_MEDIATION_SUCCESS, GET_RATINGS_FOR_MEDIATION_FAIL
} from '../actionTypes/ratingActionTypes';
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export const submitRatingAction = (ratingData) => async (dispatch) => {
    dispatch({ type: SUBMIT_RATING_REQUEST, payload: { mediationRequestId: ratingData.mediationRequestId, ratedUserId: ratingData.ratedUserId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: SUBMIT_RATING_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.post(`${BACKEND_URL}/ratings/submit`, ratingData, config);
        dispatch({
            type: SUBMIT_RATING_SUCCESS,
            payload: {
                rating: data.rating,
                mediationRequestId: ratingData.mediationRequestId,
                ratedUserId: ratingData.ratedUserId,
                successMessage: 'ratings.submitSuccess'
            }
        });
        dispatch(getProfile());
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'ratings.submitFail');
        dispatch({ type: SUBMIT_RATING_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const resetSubmitRatingStatus = () => ({ type: SUBMIT_RATING_RESET });

export const getRatingsForMediationAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: GET_RATINGS_FOR_MEDIATION_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: GET_RATINGS_FOR_MEDIATION_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    try {
        const { data } = await axios.get(`${BACKEND_URL}/ratings/mediation/${mediationRequestId}`, config);
        dispatch({ type: GET_RATINGS_FOR_MEDIATION_SUCCESS, payload: { mediationRequestId, ratings: data } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'ratings.loadFail');
        dispatch({ type: GET_RATINGS_FOR_MEDIATION_FAIL, payload: { mediationRequestId, errorMessage: { key, fallback, params } } });
    }
};