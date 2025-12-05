import axios from 'axios';
import { 
    GET_MESSAGES_REQUEST, 
    GET_MESSAGES_SUCCESS 
} from '../actionTypes/chatActionTypes';

// إعداد التوكن (نفس الدالة المستخدمة في userAction)
const getTokenConfig = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { headers: { 'Authorization': `Bearer ${token}` } };
};

// 1. جلب الرسائل (HTTP)
export const getRecentMessages = () => async (dispatch) => {
    dispatch({ type: GET_MESSAGES_REQUEST });
    try {
        const config = getTokenConfig();
        const { data } = await axios.get('/chat/messages', config); // تأكد من المسار في server/routes
        dispatch({ 
            type: GET_MESSAGES_SUCCESS, 
            payload: { messages: data.messages, pinnedMessage: data.pinnedMessage } 
        });
    } catch (error) {
        console.error("Error fetching messages:", error);
    }
};

// 2. حذف رسالة (Admin)
export const deleteMessage = (id) => async (dispatch) => {
    try {
        const config = getTokenConfig();
        await axios.delete(`/chat/admin/delete/${id}`, config);
        // لا نحتاج لـ dispatch هنا لأن السوكيت سيقوم بالتحديث (MESSAGE_DELETED_REALTIME)
    } catch (error) {
        console.error("Error deleting message:", error);
    }
};

// 3. تثبيت رسالة (Admin)
export const pinMessage = (messageId) => async (dispatch) => {
    try {
        const config = getTokenConfig();
        await axios.put(`/chat/admin/pin`, { messageId }, config);
    } catch (error) {
        console.error("Error pinning message:", error);
    }
};

// 4. حظر مستخدم (Admin)
export const muteUser = (data) => async (dispatch) => {
    try {
        const config = getTokenConfig();
        await axios.post(`/chat/admin/mute`, data, config);
    } catch (error) {
        console.error("Error muting user:", error);
    }
};

// 5. مسح الدردشة (Admin)
export const clearChat = () => async (dispatch) => {
    try {
        const config = getTokenConfig();
        await axios.delete(`/chat/admin/clear`, config);
    } catch (error) {
        console.error("Error clearing chat:", error);
    }
};