// client/src/redux/reducers/newsReducer.js

import {
    GET_NEWS_REQUEST, GET_NEWS_SUCCESS, GET_NEWS_FAIL, LIKE_NEWS_REQUEST, DISLIKE_NEWS_REQUEST,
    LIKE_NEWS_SUCCESS, DISLIKE_NEWS_SUCCESS, LIKE_NEWS_FAIL, DISLIKE_NEWS_FAIL, MARK_NEWS_READ_SUCCESS,
    ADMIN_CREATE_NEWS_SUCCESS, ADMIN_UPDATE_NEWS_SUCCESS, ADMIN_DELETE_NEWS_SUCCESS, CLEAR_NEWS_ERRORS
} from '../actionTypes/newsActionTypes';

const initialState = {
    posts: [],
    loading: false,
    error: null,
    pagination: {},
    unreadCount: 0, // لتتبع عدد الأخبار غير المقروءة
    actionLoading: {}, // لتتبع تحميل الإعجاب/عدم الإعجاب لكل خبر على حدة
};

const newsReducer = (state = initialState, action) => {
    const { type, payload } = action;

    switch (type) {
        case GET_NEWS_REQUEST:
            return {
                ...state,
                loading: true,
                error: null,
            };
        case GET_NEWS_SUCCESS:
            const currentUser = payload.currentUser;
            let unread = 0;
            // حساب عدد الأخبار غير المقروءة
            if (currentUser && payload.posts) {
                payload.posts.forEach(post => {
                    if (!post.readBy.includes(currentUser._id)) {
                        unread++;
                    }
                });
            }
            return {
                ...state,
                loading: false,
                posts: payload.posts,
                pagination: {
                    page: payload.page,
                    pages: payload.pages,
                },
                unreadCount: unread,
            };
        case GET_NEWS_FAIL:
            return {
                ...state,
                loading: false,
                error: payload,
            };

        case LIKE_NEWS_REQUEST:
        case DISLIKE_NEWS_REQUEST:
            return {
                ...state,
                actionLoading: { ...state.actionLoading, [payload.postId]: true },
            };

        case LIKE_NEWS_SUCCESS:
        case DISLIKE_NEWS_SUCCESS:
            return {
                ...state,
                posts: state.posts.map(post =>
                    post._id === payload._id ? payload : post // الآن payload يحتوي على البيانات المدمجة
                ),
                actionLoading: { ...state.actionLoading, [payload._id]: false },
            };

        case LIKE_NEWS_FAIL:
        case DISLIKE_NEWS_FAIL:
            return {
                ...state,
                actionLoading: { ...state.actionLoading, [payload.postId]: false },
                error: payload.error,
            };

        case MARK_NEWS_READ_SUCCESS:
            // تحديث الأخبار كـ "مقروءة" في الحالة المحلية
            const updatedPosts = state.posts.map(post => {
                if (payload.postIds.includes(post._id) && !post.readBy.includes(payload.userId)) {
                    return { ...post, readBy: [...post.readBy, payload.userId] };
                }
                return post;
            });
            // إعادة حساب العدد غير المقروء
            const newUnreadCount = updatedPosts.filter(post => !post.readBy.includes(payload.userId)).length;
            return {
                ...state,
                posts: updatedPosts,
                unreadCount: newUnreadCount,
            };

        // حالات الأدمن (يمكن تحسينها لاحقًا إذا لزم الأمر)
        case ADMIN_CREATE_NEWS_SUCCESS:
            return {
                ...state,
                posts: [payload, ...state.posts], // إضافة الخبر الجديد في بداية القائمة
            };

        case ADMIN_UPDATE_NEWS_SUCCESS:
            return {
                ...state,
                posts: state.posts.map(post =>
                    post._id === payload._id ? payload : post
                ),
            };

        case ADMIN_DELETE_NEWS_SUCCESS:
            return {
                ...state,
                posts: state.posts.filter(post => post._id !== payload.postId),
            };

        case CLEAR_NEWS_ERRORS:
            return {
                ...state,
                error: null,
            };

        default:
            return state;
    }
};

export default newsReducer;