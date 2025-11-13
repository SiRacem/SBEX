// client/src/redux/actions/newsAction.js

import axios from 'axios';
import * as types from '../actionTypes/newsActionTypes';

// دالة مساعدة للحصول على إعدادات الطلب مع التوكن
const getTokenConfig = (isFormData = false) => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const headers = { 'Authorization': `Bearer ${token}` };
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    return { headers };
};

// دالة لجلب جميع الأخبار (للمستخدمين)
export const getNews = (pageNumber = 1) => async (dispatch, getState) => {
    try {
        dispatch({ type: types.GET_NEWS_REQUEST });

        // لا نحتاج توكن لهذا الطلب لأنه عام
        const { data } = await axios.get(`/news?pageNumber=${pageNumber}`);

        // نحتاج لمعلومات المستخدم الحالي لحساب الأخبار غير المقروءة
        const { userReducer: { user } } = getState();

        dispatch({
            type: types.GET_NEWS_SUCCESS,
            payload: {
                posts: data.posts,
                page: data.page,
                pages: data.pages,
                currentUser: user // نمرر المستخدم الحالي إلى الـ reducer
            }
        });
    } catch (error) {
        dispatch({
            type: types.GET_NEWS_FAIL,
            payload: error.response && error.response.data.message
                ? error.response.data.message
                : error.message,
        });
    }
};

// دالة للإعجاب بخبر
export const likeNews = (postId) => async (dispatch, getState) => {
    try {
        dispatch({ type: types.LIKE_NEWS_REQUEST, payload: { postId } });
        const config = getTokenConfig();
        if (!config) throw new Error("Not authorized");

        const { data: updatedPost } = await axios.put(`/news/${postId}/like`, {}, config);

        // نقوم بدمج التغييرات مع الحالة الحالية بدلاً من الاستبدال الكامل
        const { newsReducer: { posts } } = getState();
        const originalPost = posts.find(p => p._id === postId);

        const finalPost = {
            ...originalPost, // احتفظ بالحالة المحلية (مثل readBy)
            likes: updatedPost.likes,
            dislikes: updatedPost.dislikes,
        };

        dispatch({ type: types.LIKE_NEWS_SUCCESS, payload: finalPost });
    } catch (error) {
        dispatch({
            type: types.LIKE_NEWS_FAIL,
            payload: {
                postId,
                error: error.response?.data?.message || error.message
            }
        });
    }
};

// دالة لعدم الإعجاب بخبر
export const dislikeNews = (postId) => async (dispatch, getState) => {
    try {
        dispatch({ type: types.DISLIKE_NEWS_REQUEST, payload: { postId } });
        const config = getTokenConfig();
        if (!config) throw new Error("Not authorized");

        const { data: updatedPost } = await axios.put(`/news/${postId}/dislike`, {}, config);

        const { newsReducer: { posts } } = getState();
        const originalPost = posts.find(p => p._id === postId);

        const finalPost = {
            ...originalPost,
            likes: updatedPost.likes,
            dislikes: updatedPost.dislikes,
        };

        dispatch({ type: types.DISLIKE_NEWS_SUCCESS, payload: finalPost });
    } catch (error) {
        dispatch({
            type: types.DISLIKE_NEWS_FAIL,
            payload: {
                postId,
                error: error.response?.data?.message || error.message
            }
        });
    }
};

// دالة لتعليم الأخبار كمقروءة
export const markNewsAsRead = (postIds) => async (dispatch, getState) => {
    const config = getTokenConfig();
    if (!config) return;

    const { userReducer: { user } } = getState();
    if (!user) return;

    // 1. تحديث الواجهة فورًا (متفائل)
    dispatch({ type: types.MARK_NEWS_READ_SUCCESS, payload: { postIds, userId: user._id } });

    // 2. إرسال الطلبات إلى الخادم في الخلفية
    try {
        // إنشاء مصفوفة من الـ promises لكل طلب
        const requests = postIds.map(postId =>
            axios.put(`/news/${postId}/read`, {}, config) // استخدم المسار الصحيح
        );
        // انتظر حتى تكتمل جميع الطلبات
        await Promise.all(requests);
        console.log("Successfully synced read status with server for posts:", postIds);
    } catch (error) {
        console.error("Failed to sync read status with server:", error);
        // في حالة الفشل، يمكنك إضافة منطق لإعادة الحالة إلى ما كانت عليه
        // (لكن للتبسيط، سنتركها كما هي الآن)
        dispatch({
            type: types.MARK_NEWS_READ_FAIL,
            payload: error.response?.data?.message || error.message
        });
    }
};

// --- دوال الأدمن ---

export const adminCreateNews = (formData) => async (dispatch) => {
    try {
        dispatch({ type: types.ADMIN_CREATE_NEWS_REQUEST });
        const config = getTokenConfig(true); // [!] مرر true هنا
        if (!config) throw new Error("Not authorized, no token");

        const { data } = await axios.post('/news', formData, config);

        dispatch({ type: types.ADMIN_CREATE_NEWS_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: types.ADMIN_CREATE_NEWS_FAIL,
            payload: error.response?.data?.message || error.message
        });
        throw error; // أعد رمي الخطأ ليتم التعامل معه في المكون
    }
};

export const adminUpdateNews = (postId, formData) => async (dispatch) => {
    try {
        dispatch({ type: types.ADMIN_UPDATE_NEWS_REQUEST });
        const config = getTokenConfig(true); // [!] مرر true هنا
        if (!config) throw new Error("Not authorized, no token");

        const { data } = await axios.put(`/news/${postId}`, formData, config);

        dispatch({ type: types.ADMIN_UPDATE_NEWS_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: types.ADMIN_UPDATE_NEWS_FAIL,
            payload: error.response?.data?.message || error.message
        });
        throw error; // أعد رمي الخطأ
    }
};

export const adminDeleteNews = (postId) => async (dispatch) => {
    try {
        dispatch({ type: types.ADMIN_DELETE_NEWS_REQUEST });
        const config = getTokenConfig();
        if (!config) throw new Error("Not authorized, no token");

        await axios.delete(`/news/${postId}`, config);

        dispatch({ type: types.ADMIN_DELETE_NEWS_SUCCESS, payload: { postId } });
    } catch (error) {
        dispatch({
            type: types.ADMIN_DELETE_NEWS_FAIL,
            payload: error.response?.data?.message || error.message
        });
    }
};