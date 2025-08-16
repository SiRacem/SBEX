// server/controllers/ticket.controller.js
const mongoose = require('mongoose');
const path = require('path'); // تأكد من استيراد 'path'
const Ticket = require('../models/Ticket');
const TicketReply = require('../models/TicketReply');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Helper function to handle file uploads for tickets (النسخة النهائية المعدلة)
function handleFileUploadsForTicket(reqFiles) {
    const attachments = [];
    // تحقق مزدوج للتأكد من أن reqFiles.attachments هو المصفوفة التي نريدها
    const filesArray = reqFiles && reqFiles.attachments ? reqFiles.attachments : [];

    if (filesArray.length > 0) {
        filesArray.forEach(file => {
            // بناء المسار النسبي الذي يمكن للـ frontend استخدامه
            const relativePath = `uploads/ticket_attachments/${file.filename}`;

            attachments.push({
                fileName: file.originalname,
                filePath: relativePath, // <--- سيتم الآن حفظ المسار الصحيح دائماً
                fileType: file.mimetype,
                fileSize: file.size,
            });
        });
    }
    return attachments;
}

// --- User Facing Controllers ---
exports.createTicket = async (req, res) => {
    const { title, description, category, priority } = req.body;
    const userId = req.user._id;
    if (!title || !description || !category) return res.status(400).json({ msg: "Title, description, and category are required." });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const attachments = handleFileUploadsForTicket(req.files); // تمرير req.files مباشرة
        let newTicket = new Ticket({ user: userId, title, description, category, priority: priority || 'Medium', attachments });
        await newTicket.save({ session });

        // جلب بيانات المستخدم للتذكرة الجديدة قبل إرسالها عبر السوكيت
        newTicket = await newTicket.populate('user', 'fullName email avatarUrl');

        const admins = await User.find({ userRole: { $in: ['Admin', 'Support'] } }).select('_id').lean().session(session);
        if (admins.length > 0) {
            const notifications = admins.map(admin => ({
                user: admin._id,
                type: 'NEW_TICKET_CREATED',
                title: 'notification_titles.NEW_TICKET_CREATED', // <-- استخدام مفتاح الترجمة
                message: 'notification_messages.NEW_TICKET_CREATED', // <-- استخدام مفتاح الترجمة
                // إضافة متغيرات الرسالة
                messageParams: {
                    ticketId: newTicket.ticketId,
                    title: newTicket.title.substring(0, 30),
                    userName: req.user.fullName || 'a user'
                },
                relatedEntity: { id: newTicket._id, modelName: 'Ticket' }
            }));
            await Notification.create(notifications, { session });
        }

        await session.commitTransaction(); // انهاء الـ transaction قبل إرسال السوكيت

        // إرسال حدث عبر Socket.IO إلى الأدمن/الدعم المتصلين
        if (req.io && req.onlineUsers) {
            const adminIds = admins.map(admin => admin._id.toString());
            adminIds.forEach(adminId => {
                const adminSocketId = req.onlineUsers[adminId];
                if (adminSocketId) {
                    req.io.to(adminSocketId).emit('new_ticket_created_for_admin', newTicket.toObject());
                    console.log(`SOCKET: Emitted 'new_ticket_created_for_admin' to admin ${adminId} on socket ${adminSocketId}`);
                }
            });
        }

        res.status(201).json({ msg: "Support ticket created successfully.", ticket: newTicket });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error creating ticket:", error);
        res.status(500).json({ msg: "Failed to create ticket.", errorDetails: error.message });
    } finally {
        if (session) await session.endSession();
    }
};

exports.getUserTickets = async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 10, status, category, sortBy = 'lastReplyAt', order = 'desc' } = req.query;
    const query = { user: userId };
    if (status) query.status = status; if (category) query.category = category;
    const options = {
        page: parseInt(page, 10), limit: parseInt(limit, 10),
        sort: { [sortBy]: order === 'asc' ? 1 : -1 },
        populate: [{ path: 'assignedTo', select: 'fullName avatarUrl' }, { path: 'lastRepliedBy', select: 'fullName avatarUrl' }],
        lean: true
    };
    try {
        const tickets = await Ticket.paginate(query, options);
        res.status(200).json(tickets);
    } catch (error) {
        console.error("Error fetching user tickets:", error);
        res.status(500).json({ msg: "Failed to fetch tickets.", errorDetails: error.message });
    }
};

exports.getTicketByIdForUser = async (req, res) => {
    const userId = req.user._id;
    const { ticketId: ticketIdFromParam } = req.params;
    console.log(`[getTicketByIdForUser] Req for ticket: ${ticketIdFromParam}, by user: ${userId}`);
    try {
        let ticketQuery = mongoose.Types.ObjectId.isValid(ticketIdFromParam) ? { _id: ticketIdFromParam } : { ticketId: ticketIdFromParam };
        ticketQuery.user = userId;

        const ticket = await Ticket.findOne(ticketQuery).populate('user', 'fullName avatarUrl email').populate('assignedTo', 'fullName avatarUrl');
        if (!ticket) return res.status(404).json({ msg: "Ticket not found or not authorized." });
        const replies = await TicketReply.find({ ticket: ticket._id }).populate('user', 'fullName avatarUrl userRole').sort({ createdAt: 'asc' });
        res.status(200).json({ ticket, replies });
    } catch (error) {
        console.error(`Error fetching ticket ${ticketIdFromParam} for user:`, error);
        res.status(500).json({ msg: "Failed to fetch ticket details.", errorDetails: error.message });
    }
};

exports.addReplyToTicket = async (req, res) => {
    const { ticketId: ticketIdFromParam } = req.params;
    const { message } = req.body;
    const userId = req.user._id;
    const userRole = req.user.userRole;

    if (!message || message.trim() === "") return res.status(400).json({ msg: "Reply message cannot be empty." });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        let ticketQuery = mongoose.Types.ObjectId.isValid(ticketIdFromParam) ? { _id: ticketIdFromParam } : { ticketId: ticketIdFromParam };
        const ticket = await Ticket.findOne(ticketQuery).session(session);

        if (!ticket) { await session.abortTransaction(); await session.endSession(); return res.status(404).json({ msg: "Ticket not found." }); }

        const isOwner = ticket.user.equals(userId);
        const isAdminOrSupport = ['Admin', 'Support'].includes(userRole);

        if (!isOwner && !isAdminOrSupport) { await session.abortTransaction(); await session.endSession(); return res.status(403).json({ msg: "Not authorized to reply." }); }

        if (['Closed'].includes(ticket.status) && !isAdminOrSupport && isOwner) { await session.abortTransaction(); await session.endSession(); return res.status(400).json({ msg: "Cannot reply to a closed ticket." }); }
        if (['Closed', 'Resolved'].includes(ticket.status) && isOwner && !isAdminOrSupport && ticket.status === 'Closed') { await session.abortTransaction(); await session.endSession(); return res.status(400).json({ msg: "Cannot reply to a closed ticket." }); }


        const attachments = handleFileUploadsForTicket(req.files);
        const newReply = new TicketReply({ ticket: ticket._id, user: userId, message, attachments, isSupportReply: isAdminOrSupport });
        await newReply.save({ session });

        ticket.lastReplyAt = newReply.createdAt;
        ticket.lastRepliedBy = newReply.user;
        const oldStatus = ticket.status;

        if (isAdminOrSupport) {
            if (ticket.status !== 'Resolved' && ticket.status !== 'Closed') ticket.status = 'PendingUserInput';
            else if (ticket.status === 'Closed') { ticket.status = 'PendingUserInput'; ticket.closedAt = null; }
        } else {
            if (['PendingUserInput', 'Open', 'Resolved'].includes(ticket.status)) {
                if (ticket.status === 'Resolved') ticket.resolvedAt = null;
                ticket.status = 'PendingSupportReply';
            }
        }
        if (oldStatus !== ticket.status) console.log(`Ticket ${ticket.ticketId} status changed: ${oldStatus} -> ${ticket.status}`);
        await ticket.save({ session });

        const senderName = req.user.fullName || (isAdminOrSupport ? 'Support Team' : 'User');
        const ticketTitleShort = ticket.title.substring(0, 30) + (ticket.title.length > 30 ? "..." : "");
        let recipientId = null;
        if (isAdminOrSupport) recipientId = ticket.user;
        else recipientId = ticket.assignedTo;

        if (recipientId && !recipientId.equals(userId)) {
            await Notification.create([{ user: recipientId, type: 'TICKET_REPLY', title: `Reply on: #${ticket.ticketId}`, message: `${senderName} replied to "${ticketTitleShort}".`, relatedEntity: { id: ticket._id, modelName: 'Ticket' } }], { session });
        } else if (!isAdminOrSupport && !ticket.assignedTo) {
            const adminsToNotify = await User.find({ _id: { $ne: userId }, userRole: { $in: ['Admin', 'Support'] } }).select('_id').lean().session(session);
            if (adminsToNotify.length > 0) {
                // ----- التعديل هنا -----
                const adminNotifications = adminsToNotify.map(admin => ({
                    user: admin._id,
                    type: 'TICKET_REPLY_UNASSIGNED',
                    title: 'notification_titles.TICKET_REPLY_UNASSIGNED', // <-- استخدام مفتاح الترجمة
                    message: 'notification_messages.TICKET_REPLY_UNASSIGNED', // <-- استخدام مفتاح الترجمة
                    // إضافة متغيرات الرسالة
                    messageParams: {
                        ticketId: ticket.ticketId,
                        senderName: senderName,
                        ticketTitleShort: ticketTitleShort
                    },
                    relatedEntity: { id: ticket._id, modelName: 'Ticket' }
                }));
                // ----- نهاية التعديل -----
                await Notification.create(adminNotifications, { session });
            }
        }

        await session.commitTransaction();
        const populatedReply = await TicketReply.findById(newReply._id).populate('user', 'fullName avatarUrl userRole').lean();

        if (req.io) {
            const roomName = ticket._id.toString();
            req.io.to(roomName).emit('new_ticket_reply', { ticketId: ticket._id, reply: populatedReply, updatedTicketStatus: ticket.status });
            console.log(`SOCKET: Emitted 'new_ticket_reply' to room ${roomName}`);
        }
        res.status(201).json({ msg: "Reply added.", reply: populatedReply, updatedTicketStatus: ticket.status });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error adding reply:", error);
        let errorMsg = "Failed to add reply.";
        if (error.code === 112 || error.message.includes('WriteConflict')) errorMsg = "A temporary conflict occurred. Please try submitting your reply again.";
        else if (error.message) errorMsg = error.message;
        res.status(500).json({ msg: errorMsg, errorDetails: error.toString() });
    } finally {
        if (session) await session.endSession();
    }
};

exports.closeTicketByUser = async (req, res) => {
    const userId = req.user._id;
    const { ticketId } = req.params;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        let ticketQuery = mongoose.Types.ObjectId.isValid(ticketId) ? { _id: ticketId } : { ticketId: ticketId };
        ticketQuery.user = userId;
        const ticket = await Ticket.findOne(ticketQuery).session(session);

        if (!ticket) { await session.abortTransaction(); await session.endSession(); return res.status(404).json({ msg: "Ticket not found or not authorized." }); }
        if (ticket.status === 'Closed') { await session.abortTransaction(); await session.endSession(); return res.status(400).json({ msg: "Ticket is already closed." }); }

        ticket.status = 'Closed'; ticket.closedAt = new Date();
        await ticket.save({ session });

        if (ticket.assignedTo) await Notification.create([{ user: ticket.assignedTo, type: 'TICKET_CLOSED_BY_USER', title: `Ticket Closed: #${ticket.ticketId}`, message: `User ${req.user.fullName || 'User'} closed ticket "${ticket.title.substring(0, 30)}...".`, relatedEntity: { id: ticket._id, modelName: 'Ticket' } }], { session });

        await session.commitTransaction();
        res.status(200).json({ msg: "Ticket closed successfully.", ticket });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error closing ticket by user:", error);
        res.status(500).json({ msg: "Failed to close ticket.", errorDetails: error.message });
    } finally {
        if (session) await session.endSession();
    }
};

// --- Admin/Support Panel Controllers ---
exports.getAllTicketsForAdmin = async (req, res) => {
    const { page = 1, limit = 10, status, category, priority, assignedTo, search, sortBy = 'lastReplyAt', order = 'desc' } = req.query;
    const query = {};
    if (status) query.status = status; if (category) query.category = category; if (priority) query.priority = priority;
    if (assignedTo) { if (assignedTo === 'unassigned') query.assignedTo = null; else if (mongoose.Types.ObjectId.isValid(assignedTo)) query.assignedTo = assignedTo; }
    if (search) query.$or = [{ title: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }, { ticketId: { $regex: search, $options: 'i' } }];
    const options = { page: parseInt(page, 10), limit: parseInt(limit, 10), sort: { [sortBy]: order === 'asc' ? 1 : -1 }, populate: [{ path: 'user', select: 'fullName email avatarUrl' }, { path: 'assignedTo', select: 'fullName avatarUrl' }, { path: 'lastRepliedBy', select: 'fullName avatarUrl userRole' }], lean: true };
    try {
        const tickets = await Ticket.paginate(query, options);
        res.status(200).json(tickets);
    } catch (error) {
        console.error("Error fetching all tickets for admin:", error);
        res.status(500).json({ msg: "Failed to fetch tickets for admin.", errorDetails: error.message });
    }
};

exports.getTicketByIdForAdmin = async (req, res) => {
    const { ticketId: ticketIdFromParam } = req.params;
    console.log(`[getTicketByIdForAdmin] Admin ${req.user._id} requesting ticket: ${ticketIdFromParam}`);
    try {
        let ticketQuery = mongoose.Types.ObjectId.isValid(ticketIdFromParam) ? { _id: ticketIdFromParam } : { ticketId: ticketIdFromParam };
        const ticket = await Ticket.findOne(ticketQuery).populate('user', 'fullName email avatarUrl userRole').populate('assignedTo', 'fullName avatarUrl userRole');
        if (!ticket) return res.status(404).json({ msg: "Ticket not found." });
        const replies = await TicketReply.find({ ticket: ticket._id }).populate('user', 'fullName avatarUrl userRole').sort({ createdAt: 'asc' });
        res.status(200).json({ ticket, replies });
    } catch (error) {
        console.error(`Error fetching ticket ${ticketIdFromParam} for admin:`, error);
        res.status(500).json({ msg: "Failed to fetch ticket details for admin.", errorDetails: error.message });
    }
};

exports.updateTicketStatusBySupport = async (req, res) => {
    const { ticketId } = req.params;
    const { status, resolutionNotes } = req.body;
    if (!status) return res.status(400).json({ msg: "New status is required." });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        let ticketQuery = mongoose.Types.ObjectId.isValid(ticketId) ? { _id: ticketId } : { ticketId: ticketId };
        // قم بعمل populate للمستخدم والمسؤول المعين للحصول على بياناتهم عند البث
        const ticket = await Ticket.findOne(ticketQuery).session(session).populate('user', 'fullName email avatarUrl').populate('assignedTo', 'fullName email avatarUrl');
        if (!ticket) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ msg: "Ticket not found." });
        }

        const oldStatus = ticket.status;
        ticket.status = status;
        if (status === 'Resolved') ticket.resolvedAt = new Date();
        else if (status === 'Closed' && oldStatus !== 'Closed') ticket.closedAt = new Date();
        else if (oldStatus === 'Resolved' && status !== 'Closed') ticket.resolvedAt = null;
        else if (oldStatus === 'Closed' && status !== 'Closed') ticket.closedAt = null;

        await ticket.save({ session });

        let notifTitle = `Ticket Status: #${ticket.ticketId}`;
        let notifMessage = `Status of ticket "${ticket.title.substring(0, 30)}..." updated to ${status}.`;
        if (status === 'Resolved') notifMessage = `Ticket "${ticket.title.substring(0, 30)}..." resolved. ${resolutionNotes ? 'Notes: ' + resolutionNotes.substring(0, 50) + '...' : ''}`;
        else if (status === 'Closed') notifMessage = `Ticket "${ticket.title.substring(0, 30)}..." closed.`;

        await Notification.create([{ user: ticket.user._id, type: 'TICKET_STATUS_UPDATED', title: notifTitle, message: notifMessage, relatedEntity: { id: ticket._id, modelName: 'Ticket' } }], { session });

        await session.commitTransaction();

        // بث الحدث إلى جميع المشتركين في غرفة التذكرة
        if (req.io) {
            const ticketRoomName = ticket._id.toString();
            req.io.to(ticketRoomName).emit('ticket_updated', { updatedTicket: ticket.toObject() });
            console.log(`SOCKET: Emitted 'ticket_updated' to room ${ticketRoomName} after status change.`);
        }

        res.status(200).json({ msg: `Ticket status updated to ${status}.`, ticket });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error updating ticket status by support:", error);
        res.status(500).json({ msg: "Failed to update ticket status.", errorDetails: error.message });
    } finally {
        if (session) await session.endSession();
    }
};

exports.updateTicketPriorityBySupport = async (req, res) => {
    const { ticketId } = req.params;
    const { priority } = req.body;
    if (!priority) return res.status(400).json({ msg: "New priority is required." });
    try {
        let ticketQuery = mongoose.Types.ObjectId.isValid(ticketId) ? { _id: ticketId } : { ticketId: ticketId };
        const ticket = await Ticket.findOneAndUpdate(ticketQuery, { priority }, { new: true })
            .populate('user', 'fullName email avatarUrl')
            .populate('assignedTo', 'fullName email avatarUrl');

        if (!ticket) return res.status(404).json({ msg: "Ticket not found." });

        // بث الحدث بعد التحديث
        if (req.io) {
            req.io.to(ticket._id.toString()).emit('ticket_updated', { updatedTicket: ticket.toObject() });
            console.log(`SOCKET: Emitted 'ticket_updated' to room ${ticket._id.toString()} after priority change.`);
        }

        res.status(200).json({ msg: `Ticket priority updated to ${priority}.`, ticket });
    } catch (error) {
        console.error("Error updating ticket priority:", error);
        res.status(500).json({ msg: "Failed to update priority.", errorDetails: error.message });
    }
};

exports.assignTicketToSupport = async (req, res) => {
    const { ticketId } = req.params;
    const { assignedToUserId } = req.body;
    if (assignedToUserId && !mongoose.Types.ObjectId.isValid(assignedToUserId)) return res.status(400).json({ msg: "Invalid support user ID." });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        let ticketQuery = mongoose.Types.ObjectId.isValid(ticketId) ? { _id: ticketId } : { ticketId: ticketId };
        const ticket = await Ticket.findOne(ticketQuery).session(session);
        if (!ticket) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ msg: "Ticket not found." }); }

        let assignedUser = null;
        if (assignedToUserId) {
            assignedUser = await User.findOne({ _id: assignedToUserId, userRole: { $in: ['Admin', 'Support'] } }).session(session);
            if (!assignedUser) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ msg: "Support user for assignment not found or not qualified." }); }
        }

        const oldAssignedTo = ticket.assignedTo;
        ticket.assignedTo = assignedUser ? assignedUser._id : null;
        if (ticket.status === 'Open' && ticket.assignedTo) ticket.status = 'InProgress';
        else if (ticket.status === 'InProgress' && !ticket.assignedTo) ticket.status = 'Open';
        await ticket.save({ session });

        if (assignedUser && (!oldAssignedTo || !oldAssignedTo.equals(assignedUser._id))) {
            await Notification.create([{ user: assignedUser._id, type: 'TICKET_ASSIGNED_TO_YOU', title: `Assigned Ticket: #${ticket.ticketId}`, message: `Ticket "${ticket.title.substring(0, 30)}..." assigned to you.`, relatedEntity: { id: ticket._id, modelName: 'Ticket' } }], { session });
        }
        await Notification.create([{ user: ticket.user, type: 'TICKET_ASSIGNMENT_UPDATED', title: `Ticket Update: #${ticket.ticketId}`, message: assignedUser ? `Ticket now handled by ${assignedUser.fullName}.` : `Ticket assignment updated.`, relatedEntity: { id: ticket._id, modelName: 'Ticket' } }], { session });

        await session.commitTransaction();

        // جلب النسخة النهائية من التذكرة مع البيانات المضمنة (populated)
        const populatedTicket = await Ticket.findById(ticket._id)
            .populate('user', 'fullName email avatarUrl')
            .populate('assignedTo', 'fullName email avatarUrl')
            .lean();

        // بث الحدث بعد التحديث
        if (req.io && populatedTicket) {
            req.io.to(populatedTicket._id.toString()).emit('ticket_updated', { updatedTicket: populatedTicket });
            console.log(`SOCKET: Emitted 'ticket_updated' to room ${populatedTicket._id.toString()} after assignment change.`);
        }

        res.status(200).json({ msg: assignedUser ? `Ticket assigned to ${assignedUser.fullName}.` : "Ticket assignment removed.", ticket: populatedTicket });
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error("Error assigning ticket:", error);
        res.status(500).json({ msg: "Failed to assign ticket.", errorDetails: error.message });
    } finally {
        if (session) await session.endSession();
    }
};