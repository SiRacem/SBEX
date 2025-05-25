import axios from 'axios';
import { toast } from 'react-toastify';
import {
    SUBMIT_RATING_REQUEST, SUBMIT_RATING_SUCCESS, SUBMIT_RATING_FAIL, SUBMIT_RATING_RESET,
    GET_RATINGS_FOR_MEDIATION_REQUEST, GET_RATINGS_FOR_MEDIATION_SUCCESS, GET_RATINGS_FOR_MEDIATION_FAIL
} from '../actionTypes/ratingActionTypes';
import { getProfile } from './userAction'; // قد تحتاج لتحديث بروفايل المستخدم المقَيَّم

const getTokenConfig = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export const submitRatingAction = (ratingData) => async (dispatch, getState) => {
    // ratingData should be: { ratedUserId, ratingType, comment, mediationRequestId }
    dispatch({ type: SUBMIT_RATING_REQUEST, payload: { mediationRequestId: ratingData.mediationRequestId, ratedUserId: ratingData.ratedUserId } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: SUBMIT_RATING_FAIL, payload: 'Authorization required.' });
        toast.error("Authorization required to submit rating.");
        return;
    }

    try {
        const { data } = await axios.post(`${BACKEND_URL}/ratings/submit`, ratingData, config); // تأكد من أن المسار هو /submit
        dispatch({
            type: SUBMIT_RATING_SUCCESS,
            payload: {
                rating: data.rating, // التقييم الذي تم إنشاؤه
                mediationRequestId: ratingData.mediationRequestId,
                ratedUserId: ratingData.ratedUserId
            }
        });
        toast.success(data.msg || "Rating submitted successfully!");
        dispatch(getProfile());

        const currentUserId = getState().userReducer.user?._id;
        if (currentUserId) { // تأكد أن المستخدم الحالي موجود
            dispatch(getProfile());
        }
        // هذا سيحدث بروفايل المستخدم المسجل حاليًا
        // إذا أردت تحديث بروفايل ratedUserId تحديدًا، ستحتاج لـ action خاص بذلك أو آلية أخرى

    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to submit rating.';
        dispatch({ type: SUBMIT_RATING_FAIL, payload: message });
        toast.error(`Rating submission failed: ${message}`);
    }
};

export const resetSubmitRatingStatus = () => ({ type: SUBMIT_RATING_RESET });

// Action لجلب التقييمات الموجودة لوساطة معينة (لمعرفة ما إذا كان المستخدم قد قيّم بالفعل)
export const getRatingsForMediationAction = (mediationRequestId) => async (dispatch) => {
    dispatch({ type: GET_RATINGS_FOR_MEDIATION_REQUEST, payload: { mediationRequestId } });
    const config = getTokenConfig();
    // لا بأس إذا لم يكن هناك توكن لجلب التقييمات العامة، لكن للتقييمات الخاصة بالوساطة قد يكون مطلوبًا
    // if (!config) return dispatch({ type: GET_RATINGS_FOR_MEDIATION_FAIL, payload: 'Authorization may be required.' });

    try {
        // ستحتاج لإنشاء هذا الـ endpoint في الواجهة الخلفية
        // GET /ratings/mediation/:mediationRequestId
        const { data } = await axios.get(`${BACKEND_URL}/ratings/mediation/${mediationRequestId}`, config);
        dispatch({ type: GET_RATINGS_FOR_MEDIATION_SUCCESS, payload: { mediationRequestId, ratings: data } });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch ratings for this mediation.';
        dispatch({ type: GET_RATINGS_FOR_MEDIATION_FAIL, payload: { mediationRequestId, error: message } });
        // لا تعرض toast هنا بالضرورة، قد يتم استدعاؤه في الخلفية
    }
};