import { GET_QUESTS_REQUEST, GET_QUESTS_SUCCESS,
    CHECK_IN_REQUEST, CHECK_IN_SUCCESS, CLAIM_REWARD_REQUEST, CLAIM_REWARD_SUCCESS,
    SET_CHECK_IN_CONFIG, SPIN_WHEEL_SUCCESS, GET_QUESTS_FAIL,
    CHECK_IN_FAIL, CLAIM_REWARD_FAIL, SET_WHEEL_CONFIG } from "../actionTypes/questActionTypes";

const initialState = {
    loading: false,
    quests: [],
    credits: 0,
    checkIn: { streak: 0, claimedToday: false, lastCheckInDate: null },
    rewardsConfig: [10, 20, 30, 40, 50, 60, 100],
    wheelConfig: [],
    error: null
};

const questReducer = (state = initialState, action) => {
    const { type, payload } = action;

    switch (type) {
        case GET_QUESTS_REQUEST:
        case CHECK_IN_REQUEST:
        case CLAIM_REWARD_REQUEST:
            return { ...state, loading: true, error: null };

        case GET_QUESTS_SUCCESS:
            return {
                ...state,
                loading: false,
                quests: payload.quests,
                credits: payload.credits,
                checkIn: payload.checkIn
            };

        case "ADMIN_GET_QUESTS_SUCCESS":
            return { ...state, quests: payload, loading: false };

        case "ADMIN_CREATE_QUEST_SUCCESS":
            return { ...state, quests: [payload, ...state.quests] };

        case "ADMIN_UPDATE_QUEST_SUCCESS":
            return {
                ...state,
                quests: state.quests.map(quest =>
                    quest._id === payload._id ? payload : quest
                )
            };

        case "ADMIN_DELETE_QUEST_SUCCESS":
            return {
                ...state,
                quests: state.quests.filter(quest => quest._id !== payload)
            };

        case GET_QUESTS_FAIL:
        case CHECK_IN_FAIL:
        case CLAIM_REWARD_FAIL:
            return { ...state, loading: false, error: payload };

        case SET_CHECK_IN_CONFIG:
            return {
                ...state,
                rewardsConfig: payload
            };

        case CHECK_IN_SUCCESS:
            return {
                ...state,
                user: {
                    ...state.user,
                    credits: payload.totalCredits
                }
            };

        case CLAIM_REWARD_SUCCESS:
            return {
                ...state,
                loading: false,
                credits: payload.newCredits,
                quests: state.quests.map(quest => {
                    if (quest._id === payload.questId || quest.userQuestId === payload.questId) {
                        return {
                            ...quest,
                            isClaimed: true
                        };
                    }
                    return quest;
                })
            };

        case SPIN_WHEEL_SUCCESS:
            return {
                ...state,
                user: {
                    ...state.user,
                    credits: payload.remainingCredits,
                    balance: payload.newBalance || state.user.balance
                }
            };

        case SET_WHEEL_CONFIG:
            return {
                ...state,
                wheelConfig: payload
            };

        default:
            return state;
    }
};

export default questReducer;