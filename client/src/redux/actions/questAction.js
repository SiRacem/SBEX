import axios from "axios";
import { toast } from "react-toastify";
import { 
    SET_WHEEL_CONFIG, 
    SET_CHECK_IN_CONFIG, 
    GET_QUESTS_REQUEST, 
    GET_QUESTS_SUCCESS, 
    GET_QUESTS_FAIL, 
    CHECK_IN_REQUEST, 
    CHECK_IN_SUCCESS, 
    CHECK_IN_FAIL, 
    CLAIM_REWARD_REQUEST, 
    CLAIM_REWARD_SUCCESS, 
    CLAIM_REWARD_FAIL 
} from "../actionTypes/questActionTypes";
import { getProfile } from "./userAction";
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

export const performCheckIn = () => async (dispatch) => {
    dispatch({ type: CHECK_IN_REQUEST });
    try {
        const { data } = await axios.post("/quests/check-in", {}, getTokenConfig());
        dispatch({ type: CHECK_IN_SUCCESS, payload: data });
        
        dispatch(getProfile());

        const message = i18n.t('quests.checkIn.toastSuccess', { 
            streak: data.streak, 
            reward: data.reward 
        });
        toast.success(message);

    } catch (error) {
        const errorKey = error.response?.data?.translationKey || "quests.checkIn.error";
        const msg = i18n.t(errorKey, { defaultValue: error.response?.data?.msg || "Check-in failed" });
        dispatch({ type: CHECK_IN_FAIL, payload: msg });
        toast.error(msg);
    }
};

export const claimReward = (questId) => async (dispatch) => {
    dispatch({ type: CLAIM_REWARD_REQUEST });
    try {
        const { data } = await axios.post("/quests/claim", { questId }, getTokenConfig());
        
        dispatch({ 
            type: CLAIM_REWARD_SUCCESS, 
            payload: { 
                questId: questId, 
                newCredits: data.credits,
                newReputation: data.reputation
            } 
        });

        dispatch(getProfile()); 

        toast.success(i18n.t('quests.claimSuccess', { defaultValue: "Reward Claimed!" }));

    } catch (error) {
        const msg = error.response?.data?.msg || "Claim failed";
        dispatch({ type: CLAIM_REWARD_FAIL, payload: msg });
        toast.error(i18n.t(`apiErrors.${msg}`, { defaultValue: msg }));
    }
};

export const adminGetAllQuests = () => async (dispatch) => {
    try {
        const { data } = await axios.get("/quests/admin/all", getTokenConfig());
        dispatch({ type: "ADMIN_GET_QUESTS_SUCCESS", payload: data });
    } catch (error) { console.error(error); }
};

export const createQuest = (questData) => async (dispatch) => {
    try {
        const { data } = await axios.post("/quests/admin/create", questData, getTokenConfig());
        dispatch({ type: "ADMIN_CREATE_QUEST_SUCCESS", payload: data });
        return Promise.resolve(data);
    } catch (error) { return Promise.reject(error.response?.data?.msg); }
};

export const updateQuest = (id, questData) => async (dispatch) => {
    try {
        const { data } = await axios.put(`/quests/admin/update/${id}`, questData, getTokenConfig());
        dispatch({ type: "ADMIN_UPDATE_QUEST_SUCCESS", payload: data });
        return Promise.resolve(data);
    } catch (error) { return Promise.reject(error.response?.data?.msg); }
};

export const deleteQuest = (id) => async (dispatch) => {
    try {
        await axios.delete(`/quests/admin/delete/${id}`, getTokenConfig());
        dispatch({ type: "ADMIN_DELETE_QUEST_SUCCESS", payload: id });
        return Promise.resolve(id);
    } catch (error) { return Promise.reject(error.response?.data?.msg); }
};

export const getCheckInConfig = () => async (dispatch) => {
    try {
        const { data } = await axios.get("/quests/config/check-in", getTokenConfig());
        dispatch({ type: SET_CHECK_IN_CONFIG, payload: data });
    } catch (error) { console.error(error); }
};

export const getWheelConfig = () => async (dispatch) => {
    try {
        const { data } = await axios.get("/quests/config/wheel", getTokenConfig());
        dispatch({ type: SET_WHEEL_CONFIG, payload: data });
    } catch (error) { console.error(error); }
};