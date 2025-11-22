import axios from 'axios';
import {
    GET_PRODUCTS_REQUEST, GET_PRODUCTS_SUCCESS, GET_PRODUCTS_FAIL,
    ADD_PRODUCT_REQUEST, ADD_PRODUCT_SUCCESS, ADD_PRODUCT_FAIL,
    UPDATE_PRODUCT_REQUEST, UPDATE_PRODUCT_SUCCESS, UPDATE_PRODUCT_FAIL,
    DELETE_PRODUCT_REQUEST, DELETE_PRODUCT_SUCCESS, DELETE_PRODUCT_FAIL,
    GET_PENDING_PRODUCTS_REQUEST, GET_PENDING_PRODUCTS_FAIL, GET_PENDING_PRODUCTS_SUCCESS,
    APPROVE_PRODUCT_REQUEST, APPROVE_PRODUCT_SUCCESS, APPROVE_PRODUCT_FAIL,
    REJECT_PRODUCT_REQUEST, REJECT_PRODUCT_SUCCESS, REJECT_PRODUCT_FAIL,
    TOGGLE_LIKE_PRODUCT_REQUEST, TOGGLE_LIKE_PRODUCT_SUCCESS, TOGGLE_LIKE_PRODUCT_FAIL,
    PLACE_BID_REQUEST, PLACE_BID_SUCCESS, PLACE_BID_FAIL,
    CLEAR_PRODUCT_ERROR, ACCEPT_BID_REQUEST, ACCEPT_BID_SUCCESS, ACCEPT_BID_FAIL,
    REJECT_BID_REQUEST, REJECT_BID_SUCCESS, REJECT_BID_FAIL,
} from '../actionTypes/productActionType';

const handleError = (error, defaultKey = 'apiErrors.unknownError') => {
    if (error.response?.data?.translationKey) {
        return {
            key: error.response.data.translationKey,
            params: error.response.data.translationParams || {}
        };
    }
    if (error.response) {
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
    return { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };
};

export const getProducts = () => async (dispatch) => {
    dispatch({ type: GET_PRODUCTS_REQUEST });
    try {
        const { data } = await axios.get('/product/get_products');
        dispatch({ type: GET_PRODUCTS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'products.loadFailError');
        dispatch({ type: GET_PRODUCTS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const getMyProducts = () => async (dispatch) => {
    try {
        dispatch({ type: GET_PRODUCTS_REQUEST });

        // إعداد التوكن لأن هذا مسار محمي
        const token = localStorage.getItem("token");
        const config = {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        };

        // استدعاء المسار الجديد الذي أنشأناه
        const { data } = await axios.get("/product/my-products", config);

        dispatch({ type: GET_PRODUCTS_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: GET_PRODUCTS_FAIL,
            payload: error.response?.data?.errors || "Failed to fetch products",
        });
    }
};

export const addProduct = (newProductData) => async (dispatch) => {
    dispatch({ type: ADD_PRODUCT_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: ADD_PRODUCT_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.post('/product/add_product', newProductData, config);
        dispatch({ type: ADD_PRODUCT_SUCCESS, payload: { ...data, successMessage: 'products.addSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'products.addFail');
        dispatch({ type: ADD_PRODUCT_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const updateProduct = (productId, updatedData) => async (dispatch) => {
    dispatch({ type: UPDATE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: UPDATE_PRODUCT_FAIL, payload: { productId, errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        const { data } = await axios.put(`/product/update_products/${productId}`, updatedData, config);
        dispatch({ type: UPDATE_PRODUCT_SUCCESS, payload: { ...data, successMessage: 'products.updateSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'products.updateFail');
        dispatch({ type: UPDATE_PRODUCT_FAIL, payload: { productId, errorMessage: { key, fallback, params } } });
    }
};

export const deleteProduct = (productId) => async (dispatch) => {
    dispatch({ type: DELETE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: DELETE_PRODUCT_FAIL, payload: { productId, errorMessage: { key: 'apiErrors.notAuthorized' } } });
    }
    try {
        await axios.delete(`/product/delete_products/${productId}`, config);
        dispatch({ type: DELETE_PRODUCT_SUCCESS, payload: { productId, successMessage: 'products.deleteSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'products.deleteFail');
        dispatch({ type: DELETE_PRODUCT_FAIL, payload: { productId, errorMessage: { key, fallback, params } } });
    }
};

export const getPendingProducts = () => async (dispatch) => {
    dispatch({ type: GET_PENDING_PRODUCTS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: GET_PENDING_PRODUCTS_FAIL, payload: { errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    }
    try {
        const { data } = await axios.get('/product/pending', config);
        dispatch({ type: GET_PENDING_PRODUCTS_SUCCESS, payload: data });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.products.loadPendingFail');
        dispatch({ type: GET_PENDING_PRODUCTS_FAIL, payload: { errorMessage: { key, fallback, params } } });
    }
};

export const approveProduct = (productId) => async (dispatch) => {
    dispatch({ type: APPROVE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: APPROVE_PRODUCT_FAIL, payload: { productId, errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    }
    try {
        await axios.put(`/product/approve/${productId}`, {}, config);
        dispatch({ type: APPROVE_PRODUCT_SUCCESS, payload: { productId, successMessage: 'admin.products.approveSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.products.approveFail');
        dispatch({ type: APPROVE_PRODUCT_FAIL, payload: { productId, errorMessage: { key, fallback, params } } });
    }
};

export const rejectProduct = (productId, reason) => async (dispatch) => {
    dispatch({ type: REJECT_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        return dispatch({ type: REJECT_PRODUCT_FAIL, payload: { productId, errorMessage: { key: 'apiErrors.notAuthorizedAdmin' } } });
    }
    try {
        await axios.put(`/product/reject/${productId}`, { reason }, config);
        dispatch({ type: REJECT_PRODUCT_SUCCESS, payload: { productId, successMessage: 'admin.products.rejectSuccess' } });
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'admin.products.rejectFail');
        dispatch({ type: REJECT_PRODUCT_FAIL, payload: { productId, errorMessage: { key, fallback, params } } });
    }
};

export const toggleLikeProduct = (productId) => async (dispatch, getState) => {
    const userId = getState().userReducer?.user?._id;
    if (!userId) {
        const errorMessage = { key: "home.pleaseLoginToLike" };
        dispatch({ type: TOGGLE_LIKE_PRODUCT_FAIL, payload: { productId, errorMessage } });
        return Promise.reject({ error: errorMessage });
    }

    dispatch({ type: TOGGLE_LIKE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        const errorMessage = { key: 'apiErrors.notAuthorized' };
        dispatch({ type: TOGGLE_LIKE_PRODUCT_FAIL, payload: { productId, errorMessage } });
        return Promise.reject({ error: errorMessage });
    }

    try {
        const { data } = await axios.put(`/product/${productId}/like`, {}, config);
        dispatch({ type: TOGGLE_LIKE_PRODUCT_SUCCESS, payload: { productId, likesCount: data.likesCount, userLiked: data.userLiked, userId } });
        return Promise.resolve(data);
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'home.likeUpdateFailed');
        dispatch({ type: TOGGLE_LIKE_PRODUCT_FAIL, payload: { productId, errorMessage: { key, fallback, params } } });
        return Promise.reject({ error: { key, fallback, params } });
    }
};

export const placeBid = (productId, amount, isUpdate = false) => async (dispatch) => {
    dispatch({ type: PLACE_BID_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        const errorMessage = { key: 'home.pleaseLoginToBid' };
        dispatch({ type: PLACE_BID_FAIL, payload: { productId, errorMessage } });
        return Promise.reject({ error: errorMessage });
    }

    try {
        const { data } = await axios.post(`/product/${productId}/bids`, { amount }, config);
        const successMessage = isUpdate ? 'home.bidUpdatedSuccess' : 'home.bidPlacedSuccess';

        dispatch({ 
            type: PLACE_BID_SUCCESS, 
            payload: { 
                productId, 
                bids: data.bids,
                updatedProduct: data.updatedProduct, // تأكد من أن الخادم يرجع المنتج المحدث
                successMessage 
            } 
        });
        return Promise.resolve(data);
    } catch (error) {
        // handleError سيتعامل مع المفاتيح الجديدة تلقائياً
        const { key, params } = handleError(error);
        dispatch({ type: PLACE_BID_FAIL, payload: { productId, errorMessage: { key, params } } });
        return Promise.reject({ error: { key, params } });
    }
};

export const acceptBid = (productId, bidUserId, bidAmount) => async (dispatch) => {
    dispatch({ type: ACCEPT_BID_REQUEST, payload: { productId, bidUserId } });
    const config = getTokenConfig();
    if (!config) {
        const errorMessage = { key: 'apiErrors.notAuthorized' };
        dispatch({ type: ACCEPT_BID_FAIL, payload: { productId, bidUserId, errorMessage } });
        return Promise.reject({ error: errorMessage });
    }

    try {
        const { data } = await axios.put(`/product/${productId}/accept-bid`, { bidUserId, bidAmount }, config);
        if (data && data.updatedProduct) {
            dispatch({ type: ACCEPT_BID_SUCCESS, payload: { updatedProduct: data.updatedProduct, successMessage: 'myProductsPage.acceptBidSuccess' } });
            return Promise.resolve(data.updatedProduct);
        } else {
            throw new Error("API response for acceptBid missing updatedProduct.");
        }
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'myProductsPage.acceptBidFail');
        dispatch({ type: ACCEPT_BID_FAIL, payload: { productId, bidUserId, errorMessage: { key, fallback, params } } });
        return Promise.reject({ error: { key, fallback, params } });
    }
};

export const rejectBid = (productId, bidUserId, reason) => async (dispatch) => {
    dispatch({ type: REJECT_BID_REQUEST, payload: { productId, bidUserId } });
    const config = getTokenConfig();
    if (!config) {
        const errorMessage = { key: 'apiErrors.notAuthorized' };
        dispatch({ type: REJECT_BID_FAIL, payload: { productId, bidUserId, errorMessage } });
        return Promise.reject({ error: errorMessage });
    }

    try {
        const { data } = await axios.put(`/product/${productId}/reject-bid`, { bidUserId, reason }, config);
        if (data && data.updatedProduct) {
            dispatch({ type: REJECT_BID_SUCCESS, payload: { updatedProduct: data.updatedProduct, rejectedBidUserId: bidUserId, successMessage: 'myProductsPage.rejectBidSuccess' } });
            return Promise.resolve(data.updatedProduct);
        } else {
            dispatch({ type: REJECT_BID_SUCCESS, payload: { productId, rejectedBidUserId: bidUserId, msg: data.msg || "Bid rejected.", successMessage: 'myProductsPage.rejectBidSuccess' } });
            return Promise.resolve();
        }
    } catch (error) {
        const { key, fallback, params } = handleError(error, 'myProductsPage.rejectBidFail');
        dispatch({ type: REJECT_BID_FAIL, payload: { productId, bidUserId, errorMessage: { key, fallback, params } } });
        return Promise.reject({ error: { key, fallback, params } });
    }
};

export const clearProductError = (productId) => ({
    type: CLEAR_PRODUCT_ERROR,
    payload: { productId }
});

// [!!!] دالة جديدة لتحديث المنتج محلياً فقط في الواجهة [!!!]
export const updateProductLocally = (productId, updates) => (dispatch) => {
    dispatch({
        type: 'UPDATE_SINGLE_PRODUCT_LOCALLY', // سنضيف هذا النوع في الـ Reducer
        payload: {
            _id: productId,
            ...updates
        }
    });
};