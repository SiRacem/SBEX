const Quest = require('../models/Quest');
const UserQuest = require('../models/UserQuest');
const Notification = require('../models/Notification');
const User = require('../models/User');

const triggerQuestEvent = async (userId, eventTrigger, io, onlineUsers, incrementBy = 1) => {
    try {
        const activeQuests = await Quest.find({ eventTrigger, isActive: true });
        if (!activeQuests.length) return;

        for (const quest of activeQuests) {
            let userQuest = await UserQuest.findOne({ user: userId, quest: quest._id });

            const now = new Date();
            if (quest.type === 'Daily') {
                const todayStart = new Date(now.setHours(0, 0, 0, 0));
                if (!userQuest || userQuest.lastUpdated < todayStart) {
                    if (userQuest) {
                        userQuest.progress = 0;
                        userQuest.isCompleted = false;
                        userQuest.isClaimed = false;
                        userQuest.resetDate = new Date(now.setHours(23, 59, 59, 999));
                    }
                }
            }

            if (!userQuest) {
                userQuest = new UserQuest({
                    user: userId,
                    quest: quest._id,
                    progress: 0,
                    resetDate: quest.type === 'Daily' ? new Date(new Date().setHours(23, 59, 59, 999)) : null
                });
            }

            if (userQuest.isCompleted) continue;

            userQuest.progress += incrementBy;
            userQuest.lastUpdated = new Date();

            let justCompleted = false;
            if (userQuest.progress >= quest.targetCount) {
                userQuest.progress = quest.targetCount;
                userQuest.isCompleted = true;
                justCompleted = true;
            }

            await userQuest.save();

            if (justCompleted) {
                const questTitleString = quest.title.en || quest.title.ar || "Quest";

                await Notification.create({
                    user: userId,
                    type: 'QUEST_COMPLETED',
                    title: 'notification_titles.QUEST_COMPLETED',
                    message: 'notification_messages.QUEST_COMPLETED',
                    messageParams: { questTitle: questTitleString },
                    relatedEntity: { id: userQuest._id, modelName: 'UserQuest' }
                });

                if (io && onlineUsers && onlineUsers[userId.toString()]) {
                    const socketId = onlineUsers[userId.toString()];

                    io.to(socketId).emit('quest_completed_toast', {
                        questTitle: quest.title,
                        reward: quest.reward
                    });

                    io.to(socketId).emit('refresh_quests_list');
                }
            }
        }
    } catch (error) {
        console.error(`[QuestService] Error triggering event ${eventTrigger} for user ${userId}:`, error);
    }
};

module.exports = { triggerQuestEvent };