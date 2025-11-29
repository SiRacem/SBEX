import axios from "axios";
import { toast } from "react-toastify";
import { SET_WHEEL_CONFIG, SET_CHECK_IN_CONFIG, GET_QUESTS_REQUEST, GET_QUESTS_SUCCESS, GET_QUESTS_FAIL, CHECK_IN_REQUEST, CHECK_IN_SUCCESS, CHECK_IN_FAIL, CLAIM_REWARD_REQUEST, CLAIM_REWARD_SUCCESS, CLAIM_REWARD_FAIL, SPIN_WHEEL_SUCCESS } from "../actionTypes/questActionTypes";
import i18n from '../../i18n';

const getTokenConfig = () => {
    const token = localStorage.getItem("token");
    return { headers: { Authorization: `Bearer ${token}` } };
};

export const getUserQuests = () => async (dispatch) => {
    dispatch({ type: GET_QUESTS_REQUEST });
    try {
        const { data } = await axios.get("/quests/my-quests", getTokenConfig());
        dispatch({ type: GET_QUESTS_SUCCESS, payload: data });
    } catch (error) {
        dispatch({ type: GET_QUESTS_FAIL, payload: error.response?.data?.msg || "Error" });
    }
};

// Check-in (نترك التوست هنا لأنه يستخدم في زر بسيط، أو يمكنك نقله للمكون إذا أردت توحيد الأسلوب)
// لكن بما أن شكواك كانت في لوحة الإدارة، سنركز على دوال الإدارة.
export const performCheckIn = () => async (dispatch) => {
    dispatch({ type: CHECK_IN_REQUEST });
    try {
        const { data } = await axios.post("/quests/check-in", {}, getTokenConfig());
        dispatch({ type: CHECK_IN_SUCCESS, payload: data });
        
        // [!!!] استخدام الترجمة هنا [!!!]
        // نمرر المتغيرات (streak, reward) للمترجم
        const message = i18n.t('quests.checkIn.toastSuccess', { 
            streak: data.streak, 
            reward: data.reward 
        });
        
        toast.success(message);

    } catch (error) {
        // [!!!] محاولة ترجمة الخطأ أيضاً [!!!]
        const errorKey = error.response?.data?.translationKey || "quests.checkIn.error";
        const msg = i18n.t(errorKey, { defaultValue: "Check-in failed" });
        
        dispatch({ type: CHECK_IN_FAIL, payload: msg });
        toast.error(msg);
    }
};

export const claimReward = (questId) => async (dispatch) => {
    dispatch({ type: CLAIM_REWARD_REQUEST });
    try {
        const { data } = await axios.post("/quests/claim", { questId }, getTokenConfig());
        dispatch({ type: CLAIM_REWARD_SUCCESS, payload: { ...data, questId } });
        // يمكن إزالة التوست من هنا أيضاً لتوحيد النمط، لكنه ليس المشكلة الحالية
    } catch (error) {
        dispatch({ type: CLAIM_REWARD_FAIL, payload: error.response?.data?.msg });
    }
};

// --- دوال الإدارة (Admin Actions) - تم تنظيفها ---

export const adminGetAllQuests = () => async (dispatch) => {
    try {
        const { data } = await axios.get("/quests/admin/all", getTokenConfig());
        dispatch({ type: "ADMIN_GET_QUESTS_SUCCESS", payload: data });
    } catch (error) {
        console.error(error);
    }
};

export const createQuest = (questData) => async (dispatch) => {
    try {
        const { data } = await axios.post("/quests/admin/create", questData, getTokenConfig());
        dispatch({ type: "ADMIN_CREATE_QUEST_SUCCESS", payload: data });
        return Promise.resolve(data); // إرجاع وعد ناجح للمكون
    } catch (error) {
        return Promise.reject(error.response?.data?.msg || "Failed to create"); // إرجاع خطأ للمكون
    }
};

export const updateQuest = (id, questData) => async (dispatch) => {
    try {
        const { data } = await axios.put(`/quests/admin/update/${id}`, questData, getTokenConfig());
        dispatch({ type: "ADMIN_UPDATE_QUEST_SUCCESS", payload: data });
        return Promise.resolve(data); // إرجاع وعد ناجح
    } catch (error) {
        return Promise.reject(error.response?.data?.msg || "Failed to update");
    }
};

export const deleteQuest = (id) => async (dispatch) => {
    // إزالة window.confirm من هنا لأننا وضعناه في المكون مع الترجمة
    try {
        await axios.delete(`/quests/admin/delete/${id}`, getTokenConfig());
        dispatch({ type: "ADMIN_DELETE_QUEST_SUCCESS", payload: id });
        return Promise.resolve(id); // إرجاع وعد ناجح
    } catch (error) {
        return Promise.reject(error.response?.data?.msg || "Failed to delete");
    }
};

// دالة لجلب الإعدادات (تستدعى عند فتح التطبيق أو المودال)
export const getCheckInConfig = () => async (dispatch) => {
    try {
        const token = localStorage.getItem("token");
        // لا نحتاج لتوكن إذا كان المسار عاماً، لكن سنرسله للاحتياط
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : null;
        
        const { data } = await axios.get("/quests/config/check-in", config);
        dispatch({ type: SET_CHECK_IN_CONFIG, payload: data });
    } catch (error) {
        console.error("Error fetching check-in config", error);
    }
};

export const getWheelConfig = () => async (dispatch) => {
    try {
        const token = localStorage.getItem("token");
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : null;
        
        const { data } = await axios.get("/quests/config/wheel", config);
        dispatch({ type: SET_WHEEL_CONFIG, payload: data });
    } catch (error) {
        console.error("Error fetching wheel config", error);
    }
};