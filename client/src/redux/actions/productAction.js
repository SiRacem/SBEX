// src/redux/actions/productAction.js

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
    CONFIRM_RECEIPT_REQUEST, CONFIRM_RECEIPT_SUCCESS, CONFIRM_RECEIPT_FAIL
} from '../actionTypes/productActionType'; // Ensure path is correct
import { toast } from 'react-toastify';

// Helper function to get token and config
const getTokenConfig = () => {
    const token = localStorage.getItem('token');
    if (!token || token === 'null' || token === 'undefined') {
        console.error("Auth token is missing or invalid.");
        return null;
    }
    return {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
};

// --- Fetch All Approved Products ---
export const getProducts = () => async (dispatch) => {
    console.log("ACTION: GET_PRODUCTS_REQUEST dispatched");
    dispatch({ type: GET_PRODUCTS_REQUEST });
    try {
        // --- [!] CORRECTED PATH --- (Matches router/product.js general route)
        const { data } = await axios.get('/product/get_products');
        // --------------------------
        console.log("ACTION: GET_PRODUCTS_SUCCESS - Payload length:", data?.length);
        dispatch({ type: GET_PRODUCTS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.errors?.[0]?.msg || error.response?.data?.msg || error.message || 'Failed to fetch products';
        console.error("ACTION: GET_PRODUCTS_FAIL - Error:", message, error.response);
        dispatch({ type: GET_PRODUCTS_FAIL, payload: message });
    }
};

// --- Add New Product ---
export const addProduct = (newProductData) => async (dispatch) => {
    dispatch({ type: ADD_PRODUCT_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: ADD_PRODUCT_FAIL, payload: "Not authorized." });
    try {
        // --- [!] CORRECTED PATH --- (Matches router/product.js auth route)
        const { data } = await axios.post('/product/add_product', newProductData, config);
        // --------------------------
        dispatch({ type: ADD_PRODUCT_SUCCESS, payload: data });
        toast.success("Product submitted for approval!");
    } catch (error) {
        const message = error.response?.data?.errors?.[0]?.msg || error.response?.data?.msg || error.message || 'Failed to add product';
        console.error("Add Product Action Error:", message, error.response?.data);
        dispatch({ type: ADD_PRODUCT_FAIL, payload: message });
        toast.error(`Failed to add product: ${message}`);
    }
};

// --- Update Product ---
export const updateProduct = (productId, updatedData) => async (dispatch) => {
    dispatch({ type: UPDATE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: UPDATE_PRODUCT_FAIL, payload: { productId, error: "Not authorized." } });

    try {
        // --- [!] CORRECTED PATH --- (Matches router/product.js auth route)
        const { data } = await axios.put(`/product/update_products/${productId}`, updatedData, config);
        // --------------------------
        dispatch({ type: UPDATE_PRODUCT_SUCCESS, payload: data });
        toast.success("Product updated successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || error.response?.data?.errors || error.message || 'Failed to update product.';
        dispatch({ type: UPDATE_PRODUCT_FAIL, payload: { productId, error: message } });
        toast.error(`Update failed: ${typeof message === 'string' ? message : JSON.stringify(message)}`);
    }
};

// --- Delete Product ---
export const deleteProduct = (productId) => async (dispatch) => {
    dispatch({ type: DELETE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: DELETE_PRODUCT_FAIL, payload: { productId, error: "Not authorized." } });

    if (!window.confirm("Are you sure you want to delete this product permanently?")) {
        return dispatch({ type: DELETE_PRODUCT_FAIL, payload: { productId, error: "Deletion cancelled by user." } });
    }

    try {
        // --- [!] CORRECTED PATH --- (Matches router/product.js auth route)
        await axios.delete(`/product/delete_products/${productId}`, config);
        // --------------------------
        dispatch({ type: DELETE_PRODUCT_SUCCESS, payload: { productId } });
        toast.success("Product deleted successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to delete product.';
        dispatch({ type: DELETE_PRODUCT_FAIL, payload: { productId, error: message } });
        toast.error(`Deletion failed: ${message}`);
    }
};

// --- Fetch Pending Products (Admin) ---
export const getPendingProducts = () => async (dispatch) => {
    dispatch({ type: GET_PENDING_PRODUCTS_REQUEST });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: GET_PENDING_PRODUCTS_FAIL, payload: 'Token required.' });
    try {
        // --- [!] CORRECTED PATH --- (Matches router/product.js admin route)
        const { data } = await axios.get('/product/pending', config);
        // --------------------------
        dispatch({ type: GET_PENDING_PRODUCTS_SUCCESS, payload: data });
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to fetch pending products';
        dispatch({ type: GET_PENDING_PRODUCTS_FAIL, payload: message });
    }
};

// --- Approve Product (Admin) ---
export const approveProduct = (productId) => async (dispatch) => {
    dispatch({ type: APPROVE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: APPROVE_PRODUCT_FAIL, payload: { productId, error: "Not authorized." } });

    try {
        // --- [!] CORRECTED PATH --- (Matches router/product.js admin route)
        await axios.put(`/product/approve/${productId}`, {}, config);
        // --------------------------
        dispatch({ type: APPROVE_PRODUCT_SUCCESS, payload: { productId } });
        toast.success("Product approved successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to approve product.';
        dispatch({ type: APPROVE_PRODUCT_FAIL, payload: { productId, error: message } });
        toast.error(`Approval failed: ${message}`);
    }
};

// --- Reject Product (Admin) ---
export const rejectProduct = (productId, reason) => async (dispatch) => {
    dispatch({ type: REJECT_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) return dispatch({ type: REJECT_PRODUCT_FAIL, payload: { productId, error: "Not authorized." } });

    try {
        // --- [!] CORRECTED PATH --- (Matches router/product.js admin route)
        await axios.put(`/product/reject/${productId}`, { reason }, config);
        // --------------------------
        dispatch({ type: REJECT_PRODUCT_SUCCESS, payload: { productId } });
        toast.success("Product rejected successfully!");
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to reject product.';
        dispatch({ type: REJECT_PRODUCT_FAIL, payload: { productId, error: message } });
        toast.error(`Rejection failed: ${message}`);
    }
};

// --- Toggle Like Product ---
export const toggleLikeProduct = (productId) => async (dispatch, getState) => { // <-- إضافة getState
    // --- *** الحصول على userId من الحالة *** ---
    const userId = getState().userReducer?.user?._id;
    if (!userId) {
        console.error("Toggle Like Error: Cannot get userId from state.");
        dispatch({ type: TOGGLE_LIKE_PRODUCT_FAIL, payload: { productId, error: "User ID not found." } });
        return Promise.reject(new Error("User ID not found."));
    }
    // --- *** نهاية الحصول على userId *** ---

    dispatch({ type: TOGGLE_LIKE_PRODUCT_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        const errorPayload = { productId, error: "Not authorized." };
        dispatch({ type: TOGGLE_LIKE_PRODUCT_FAIL, payload: errorPayload });
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
                userId: userId // <-- !! إضافة userId هنا !!
            }
        });
        return Promise.resolve();
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to update like status.';
        dispatch({ type: TOGGLE_LIKE_PRODUCT_FAIL, payload: { productId, error: message } });
        return Promise.reject(error);
    }
};

// --- Place Bid on Product ---
export const placeBid = (productId, amount) => async (dispatch, getState) => {
    dispatch({ type: PLACE_BID_REQUEST, payload: { productId } });
    const config = getTokenConfig();
    if (!config) {
        // Return a rejected promise
        const errorPayload = { productId, error: "Not authorized." };
        dispatch({ type: PLACE_BID_FAIL, payload: errorPayload });
        return Promise.reject(new Error(errorPayload.error));
    }

    try {
        // --- [!] CORRECTED PATH --- (Matches router/product.js auth route)
        const { data } = await axios.post(`/product/${productId}/bids`, { amount }, config);
        // --------------------------
        dispatch({
            type: PLACE_BID_SUCCESS,
            payload: {
                productId: productId,
                bids: data.bids // Assuming API returns updated bids
            }
        });
        return Promise.resolve(); // Resolve on success
    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to place bid.';
        dispatch({ type: PLACE_BID_FAIL, payload: { productId, error: message } });
        // Return a rejected promise so the component's catch block works
        return Promise.reject(new Error(message));
    }
};

// --- Accept Bid ---
export const acceptBid = (productId, bidUserId, bidAmount) => async (dispatch) => {
    dispatch({ type: ACCEPT_BID_REQUEST, payload: { productId, bidUserId } });
    const config = getTokenConfig();
    if (!config) {
        const errorPayload = { productId, bidUserId, error: "Not authorized." };
        dispatch({ type: ACCEPT_BID_FAIL, payload: errorPayload });
        toast.error("Authorization required.");
        return Promise.reject(errorPayload);
    }

    try {
        const { data } = await axios.put(`/product/${productId}/accept-bid`, { bidUserId, bidAmount }, config);

        // --- [!!!] تعديل الـ Payload ليشمل بيانات الوساطة [!!!] ---
        dispatch({
            type: ACCEPT_BID_SUCCESS,
            payload: {
                productId: data.productId, // استخدام ID المنتج من الرد
                newProductStatus: data.newProductStatus, // استخدام الحالة الجديدة من الرد
                acceptedBidUserId: bidUserId,
                mediationRequestId: data.mediationRequestId // <-- تمرير معرف الوساطة
                // product: data.product // يمكنك إزالة هذا إذا لم تعد تحتاجه مباشرة في reducer
            }
        });
        // ---------------------------------------------------------
        toast.success(data.msg || "Bid accepted successfully! Mediation initiated.");
        return Promise.resolve(data); // يمكنك إرجاع البيانات كاملة إذا احتجت

    } catch (error) {
        console.error("AXIOS Error in acceptBid Action:", error.response || error); // Log الخطأ الفعلي
        const message = error.response?.data?.msg || error.message || 'Failed to accept bid.';
        const errorPayload = { productId, bidUserId, error: message };
        dispatch({ type: ACCEPT_BID_FAIL, payload: errorPayload });
        toast.error(`Failed to accept bid: ${message}`); // عرض الرسالة الصحيحة
        return Promise.reject(errorPayload); // إرجاع رفض بالرسالة الصحيحة
    }
};

// --- Reject Bid ---
export const rejectBid = (productId, bidUserId, reason) => async (dispatch) => {
    dispatch({ type: REJECT_BID_REQUEST, payload: { productId, bidUserId } });
    const config = getTokenConfig();
    if (!config) {
        const errorPayload = { productId, bidUserId, error: "Not authorized." };
        dispatch({ type: REJECT_BID_FAIL, payload: errorPayload });
        toast.error("Authorization required.");
        return Promise.reject(errorPayload);
    }

    try {
        // --- [!] تفعيل وتأكيد استدعاء API ---
        // تأكد أن هذا المسار والـ controller موجودان ويعملان في الواجهة الخلفية
        await axios.put(`/product/${productId}/reject-bid`, { bidUserId, reason }, config);
        // -----------------------------------

        dispatch({
            type: REJECT_BID_SUCCESS,
            payload: { productId, rejectedBidUserId: bidUserId }
        });
        toast.info("Bid rejected. Bidder notified."); // تعديل الرسالة
        return Promise.resolve();

    } catch (error) {
        const message = error.response?.data?.msg || error.message || 'Failed to reject bid.';
        const errorPayload = { productId, bidUserId, error: message };
        dispatch({ type: REJECT_BID_FAIL, payload: errorPayload });
        toast.error(`Failed to reject bid: ${message}`);
        return Promise.reject(errorPayload);
    }
};


// --- Clear Product Specific Error ---
export const clearProductError = (productId) => ({
    type: CLEAR_PRODUCT_ERROR,
    payload: { productId }
});