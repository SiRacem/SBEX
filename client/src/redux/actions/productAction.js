// src/redux/actions/productAction.js
// import { getProfile } from './userAction'; // <--- تم التعليق عليه مؤقتًا
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
import { toast } from 'react-toastify';

const getTokenConfig = () => {
    const token = localStorage.getItem('token');
    if (!token || token === 'null' || token === 'undefined') {
        console.error("Auth token is missing or invalid for product action.");
        return null;
    }
    return {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
};

export const getProducts = () => async (dispatch) => {
    dispatch({ type: GET_PRODUCTS_REQUEST });
    try {
        const { data } = await axios.get('/product/get_products');
        dispatch({ type: GET_PRODUCTS_SUCCESS, payload: data });
    } catch (error) {
        // [!!!] هذا هو التعديل الحاسم هنا [!!!]
        let errorPayload;
        if (error.response) {
            // خطأ من الخادم (مثل 404, 500)
            errorPayload = {
                key: 'apiErrors.requestFailedWithCode',
                params: { code: error.response.status }
            };
        } else if (error.request) {
            // الطلب تم إرساله ولكن لم يتم تلقي أي رد (مشكلة شبكة)
            errorPayload = { key: 'apiErrors.networkError' };
        } else {
            // خطأ آخر حدث أثناء إعداد الطلب
            errorPayload = { key: 'apiErrors.unknownError', params: { message: error.message } };
        }
        dispatch({ type: GET_PRODUCTS_FAIL, payload: errorPayload });
    }
};

export const addProduct = (newProductData) => async (dispatch) => {
    dispatch({ type: ADD_PRODUCT_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: ADD_PRODUCT_FAIL, payload: "Not authorized." });
        toast.error("Authorization required to add product.");
        return;
    }
    try {
        const { data } = await axios.post('/product/add_product', newProductData, config);
        dispatch({ type: ADD_PRODUCT_SUCCESS, payload: data });
        toast.success("Product submitted for approval!");
    } catch (error) {
        const message = error.response?.data?.errors?.[0]?.msg || error.response?.data?.msg || error.message || 'Failed to add product';
        dispatch({ type: ADD_PRODUCT_FAIL, payload: message });
        toast.error(`Failed to add product: ${message}`);
    }
};

export const updateProduct = (productId, updatedData) => async (dispatch) => {
    dispatch({ type: UPDATE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: UPDATE_PRODUCT_FAIL, payload: { productId, error: "Not authorized." } });
        toast.error("Authorization required to update product.");
        return;
    }
    try {
        const { data } = await axios.put(`/product/update_products/${productId}`, updatedData, config);
        dispatch({ type: UPDATE_PRODUCT_SUCCESS, payload: data });
        toast.success("Product updated successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || error.response?.data?.errors || error.message || 'Failed to update product.';
        dispatch({ type: UPDATE_PRODUCT_FAIL, payload: { productId, error: message } });
        toast.error(`Update failed: ${typeof message === 'string' ? message : JSON.stringify(message)}`);
    }
};

export const deleteProduct = (productId) => async (dispatch) => {
    dispatch({ type: DELETE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: DELETE_PRODUCT_FAIL, payload: { productId, error: "Not authorized." } });
        toast.error("Authorization required to delete product.");
        return;
    }

    if (!window.confirm("Are you sure you want to delete this product permanently?")) {
        dispatch({ type: DELETE_PRODUCT_FAIL, payload: { productId, error: "Deletion cancelled by user." } });
        return; // لا ترسل شيئًا إذا ألغى المستخدم
    }

    try {
        await axios.delete(`/product/delete_products/${productId}`, config);
        dispatch({ type: DELETE_PRODUCT_SUCCESS, payload: { productId } });
        toast.success("Product deleted successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to delete product.';
        dispatch({ type: DELETE_PRODUCT_FAIL, payload: { productId, error: message } });
        toast.error(`Deletion failed: ${message}`);
    }
};

export const getPendingProducts = () => async (dispatch) => {
    dispatch({ type: GET_PENDING_PRODUCTS_REQUEST });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: GET_PENDING_PRODUCTS_FAIL, payload: 'Token required for pending products.' });
        // لا تحتاج لـ toast هنا بالضرورة، لأن الخطأ سيعرض في الواجهة
        return;
    }
    try {
        const { data } = await axios.get('/product/pending', config);
        dispatch({ type: GET_PENDING_PRODUCTS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch pending products';
        dispatch({ type: GET_PENDING_PRODUCTS_FAIL, payload: message });
    }
};

export const approveProduct = (productId) => async (dispatch) => {
    dispatch({ type: APPROVE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: APPROVE_PRODUCT_FAIL, payload: { productId, error: "Not authorized." } });
        toast.error("Authorization required to approve product.");
        return;
    }
    try {
        await axios.put(`/product/approve/${productId}`, {}, config); // لا يوجد body مطلوب للموافقة عادةً
        dispatch({ type: APPROVE_PRODUCT_SUCCESS, payload: { productId } });
        toast.success("Product approved successfully!");
        // تم التعليق على استدعاء getProfile مؤقتًا لتشخيص مشكلة تسجيل الخروج
        // dispatch(getProfile()); 
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to approve product.';
        dispatch({ type: APPROVE_PRODUCT_FAIL, payload: { productId, error: message } });
        toast.error(`Approval failed: ${message}`);
    }
};

export const rejectProduct = (productId, reason) => async (dispatch) => {
    dispatch({ type: REJECT_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        dispatch({ type: REJECT_PRODUCT_FAIL, payload: { productId, error: "Not authorized." } });
        toast.error("Authorization required to reject product.");
        return;
    }
    try {
        await axios.put(`/product/reject/${productId}`, { reason }, config);
        dispatch({ type: REJECT_PRODUCT_SUCCESS, payload: { productId } });
        toast.success("Product rejected successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to reject product.';
        dispatch({ type: REJECT_PRODUCT_FAIL, payload: { productId, error: message } });
        toast.error(`Rejection failed: ${message}`);
    }
};

export const toggleLikeProduct = (productId) => async (dispatch, getState) => {
    const userId = getState().userReducer?.user?._id;
    if (!userId) {
        const errorMsg = "Toggle Like Error: User ID not found in state.";
        console.error(errorMsg);
        dispatch({ type: TOGGLE_LIKE_PRODUCT_FAIL, payload: { productId, error: errorMsg } });
        return Promise.reject(new Error(errorMsg));
    }

    dispatch({ type: TOGGLE_LIKE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        const errorPayload = { productId, error: "Not authorized to like product." };
        dispatch({ type: TOGGLE_LIKE_PRODUCT_FAIL, payload: errorPayload });
        toast.error(errorPayload.error);
        return Promise.reject(new Error(errorPayload.error));
    }

    try {
        const { data } = await axios.put(`/product/${productId}/like`, {}, config);
        dispatch({
            type: TOGGLE_LIKE_PRODUCT_SUCCESS,
            payload: {
                productId: productId,
                likesCount: data.likesCount,
                userLiked: data.userLiked,
                userId: userId
            }
        });
        return Promise.resolve(data); // أرجع البيانات للاستخدام في المكون إذا لزم الأمر
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to update like status.';
        dispatch({ type: TOGGLE_LIKE_PRODUCT_FAIL, payload: { productId, error: message } });
        toast.error(`Like/Unlike failed: ${message}`);
        return Promise.reject(error);
    }
};

export const placeBid = (productId, amount) => async (dispatch) => {
    dispatch({ type: PLACE_BID_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        const errorPayload = { productId, error: "Not authorized to place bid." };
        dispatch({ type: PLACE_BID_FAIL, payload: errorPayload });
        toast.error(errorPayload.error);
        return Promise.reject(new Error(errorPayload.error));
    }

    try {
        const { data } = await axios.post(`/product/${productId}/bids`, { amount }, config);
        dispatch({
            type: PLACE_BID_SUCCESS,
            payload: {
                productId: productId,
                bids: data.bids
            }
        });
        return Promise.resolve(data);
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to place bid.';
        dispatch({ type: PLACE_BID_FAIL, payload: { productId, error: message } });
        toast.error(`Bid failed: ${message}`);
        return Promise.reject(new Error(message));
    }
};

export const acceptBid = (productId, bidUserId, bidAmount) => async (dispatch) => {
    dispatch({ type: ACCEPT_BID_REQUEST, payload: { productId, bidUserId } });
    const config = getTokenConfig();
    if (!config) {
        const errorPayload = { productId, bidUserId, error: "Not authorized to accept bid." };
        dispatch({ type: ACCEPT_BID_FAIL, payload: errorPayload });
        toast.error(errorPayload.error);
        return Promise.reject(new Error(errorPayload.error));
    }

    try {
        const { data } = await axios.put(`/product/${productId}/accept-bid`, { bidUserId, bidAmount }, config);
        if (data && data.updatedProduct) {
            dispatch({
                type: ACCEPT_BID_SUCCESS,
                payload: { updatedProduct: data.updatedProduct }
            });
            toast.success(data.msg || "Bid accepted! Mediation process initiated.");
            return Promise.resolve(data.updatedProduct);
        } else {
            const errMsg = "API response for acceptBid missing updatedProduct.";
            console.error(errMsg, data);
            throw new Error(errMsg);
        }
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to accept bid.';
        const errorPayload = { productId, bidUserId, error: message };
        dispatch({ type: ACCEPT_BID_FAIL, payload: errorPayload });
        toast.error(`Accept bid failed: ${message}`);
        return Promise.reject(new Error(message));
    }
};

export const rejectBid = (productId, bidUserId, reason) => async (dispatch) => {
    dispatch({ type: REJECT_BID_REQUEST, payload: { productId, bidUserId } });
    const config = getTokenConfig();
    if (!config) {
        const errorPayload = { productId, bidUserId, error: "Not authorized to reject bid." };
        dispatch({ type: REJECT_BID_FAIL, payload: errorPayload });
        toast.error(errorPayload.error);
        return Promise.reject(new Error(errorPayload.error));
    }

    try {
        const { data } = await axios.put(`/product/${productId}/reject-bid`, { bidUserId, reason }, config);
        if (data && data.updatedProduct) {
            dispatch({
                type: REJECT_BID_SUCCESS,
                payload: { updatedProduct: data.updatedProduct, rejectedBidUserId: bidUserId }
            });
            toast.info(data.msg || "Bid rejected successfully.");
            return Promise.resolve(data.updatedProduct);
        } else {
             // إذا لم يرجع الخادم المنتج المحدث، يمكنك إرسال البيانات الأساسية للتحديث المحلي
            dispatch({
                type: REJECT_BID_SUCCESS,
                payload: { productId, rejectedBidUserId: bidUserId, msg: data.msg || "Bid rejected (local update)." }
            });
            toast.info(data.msg || "Bid rejected successfully (local update).");
            return Promise.resolve(); // أو resolve(data) إذا كان data.msg مفيدًا
        }
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to reject bid.';
        const errorPayload = { productId, bidUserId, error: message };
        dispatch({ type: REJECT_BID_FAIL, payload: errorPayload });
        toast.error(`Reject bid failed: ${message}`);
        return Promise.reject(new Error(message));
    }
};

export const clearProductError = (productId) => ({
    type: CLEAR_PRODUCT_ERROR,
    payload: { productId }
});