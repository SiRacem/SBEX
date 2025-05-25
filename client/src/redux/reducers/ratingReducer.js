import {
    SUBMIT_RATING_REQUEST, SUBMIT_RATING_SUCCESS, SUBMIT_RATING_FAIL, SUBMIT_RATING_RESET,
    GET_RATINGS_FOR_MEDIATION_REQUEST, GET_RATINGS_FOR_MEDIATION_SUCCESS, GET_RATINGS_FOR_MEDIATION_FAIL
} from '../actionTypes/ratingActionTypes';

const initialState = {
    loadingSubmit: {}, // لتتبع تحميل كل طلب تقييم على حدة { 'mediationId_ratedUserId': true }
    errorSubmit: null,
    successSubmit: {}, // لتتبع نجاح كل طلب { 'mediationId_ratedUserId': true }
    mediationRatings: {}, // لتخزين التقييمات لكل وساطة { mediationId: [ratings] }
    loadingMediationRatings: {}, // { mediationId: true }
    errorMediationRatings: null,
};

const ratingReducer = (state = initialState, { type, payload }) => {
    const key = payload ? `${payload.mediationRequestId}_${payload.ratedUserId}` : null;

    switch (type) {
        case SUBMIT_RATING_REQUEST:
            return {
                ...state,
                loadingSubmit: { ...state.loadingSubmit, [key]: true },
                errorSubmit: null,
                successSubmit: { ...state.successSubmit, [key]: false },
            };
        case SUBMIT_RATING_SUCCESS:
            return {
                ...state,
                loadingSubmit: { ...state.loadingSubmit, [key]: false },
                successSubmit: { ...state.successSubmit, [key]: true },
                // إضافة التقييم الجديد إلى قائمة التقييمات لهذه الوساطة
                mediationRatings: {
                    ...state.mediationRatings,
                    [payload.mediationRequestId]: [
                        ...(state.mediationRatings[payload.mediationRequestId] || []),
                        payload.rating
                    ]
                }
            };
        case SUBMIT_RATING_FAIL:
            return {
                ...state,
                loadingSubmit: { ...state.loadingSubmit, [key]: false },
                errorSubmit: payload, // يمكن تخصيص الخطأ لكل طلب إذا أردت
            };
        case SUBMIT_RATING_RESET:
            return {
                ...state,
                // إعادة تعيين الحالة لطلب معين أو بشكل عام
                // successSubmit: { ...state.successSubmit, [key]: false }, // إذا كان payload يحتوي على key
                successSubmit: {}, // أو إعادة تعيين الكل
                errorSubmit: null,
            };

        case GET_RATINGS_FOR_MEDIATION_REQUEST:
            return {
                ...state,
                loadingMediationRatings: { ...state.loadingMediationRatings, [payload.mediationRequestId]: true },
            };
        case GET_RATINGS_FOR_MEDIATION_SUCCESS:
            return {
                ...state,
                loadingMediationRatings: { ...state.loadingMediationRatings, [payload.mediationRequestId]: false },
                mediationRatings: { ...state.mediationRatings, [payload.mediationRequestId]: payload.ratings },
            };
        case GET_RATINGS_FOR_MEDIATION_FAIL:
            return {
                ...state,
                loadingMediationRatings: { ...state.loadingMediationRatings, [payload.mediationRequestId]: false },
                errorMediationRatings: payload.error, // يمكن تخصيص الخطأ
            };
        default:
            return state;
    }
};

export default ratingReducer;