// server/controllers/report.controller.js
console.log("--- report.controller.js: Module loaded ---");
const Report = require('../models/Report');
const User = require('../models/User');
const MediationRequest = require('../models/MediationRequest');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

exports.submitUserReport = async (req, res) => {
    console.log("--- report.controller.js: submitUserReport CALLED ---");
    const reporterUserId = req.user._id;
    const { reportedUserId } = req.params;
    const { reasonCategory, details, mediationContext } = req.body;
    const uploadedFiles = req.files;

    // دالة مساعدة لحذف الملفات المرفوعة في حالة حدوث خطأ
    const cleanupFilesOnError = (files) => {
        if (files && files.length > 0) {
            files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlink(file.path, err => {
                        if (err) console.error("Error deleting orphaned report image on validation fail:", err);
                    });
                }
            });
        }
    };

    // --- Input Validations ---
    if (!reportedUserId || !reasonCategory || !details) {
        cleanupFilesOnError(uploadedFiles);
        return res.status(400).json({ errorMessage: { key: 'apiErrors.reportFieldsRequired', fallback: "Reported user, reason, and details are required." } });
    }
    if (!mongoose.Types.ObjectId.isValid(reportedUserId)) {
        cleanupFilesOnError(uploadedFiles);
        return res.status(400).json({ errorMessage: { key: 'apiErrors.invalidReportedUserId', fallback: "Invalid reported user ID format." } });
    }
    if (mediationContext && !mongoose.Types.ObjectId.isValid(mediationContext)) {
        cleanupFilesOnError(uploadedFiles);
        return res.status(400).json({ msg: "Invalid mediation context ID format." });
    }
    if (reporterUserId.equals(reportedUserId)) {
        cleanupFilesOnError(uploadedFiles);
        return res.status(400).json({ errorMessage: { key: 'apiErrors.cannotReportSelf', fallback: "You cannot report yourself." } });
    }
    const validCategories = ['INAPPROPRIATE_BEHAVIOR', 'HARASSMENT_OR_BULLYING', 'SPAM_OR_SCAM', 'IMPERSONATION', 'HATE_SPEECH', 'INAPPROPRIATE_CONTENT', 'TRANSACTION_ISSUE', 'POLICY_VIOLATION', 'OTHER'];
    if (!validCategories.includes(reasonCategory)) {
        cleanupFilesOnError(uploadedFiles);
        return res.status(400).json({ msg: "Invalid reason category." });
    }

    try {
        const reportedUserExists = await User.findById(reportedUserId).select('_id fullName');
        if (!reportedUserExists) {
            cleanupFilesOnError(uploadedFiles);
            return res.status(404).json({ errorMessage: { key: 'apiErrors.reportedUserNotFound', fallback: "The user you are trying to report does not exist." } });
        }

        const recentReport = await Report.findOne({
            reporterUser: reporterUserId,
            reportedUser: reportedUserId,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        if (recentReport) {
            cleanupFilesOnError(uploadedFiles);
            return res.status(429).json({ errorMessage: { key: 'apiErrors.recentReportExists', fallback: "You have recently submitted a similar report against this user." } });
        }

        const imageUrls = (uploadedFiles || []).map(file => `uploads/report_images/${file.filename.replace(/\\/g, '/')}`);

        const newReport = new Report({
            reporterUser: reporterUserId,
            reportedUser: reportedUserId,
            reasonCategory,
            details,
            mediationContext: mediationContext || null,
            imageUrls
        });
        await newReport.save();

        const admins = await User.find({ userRole: 'Admin' }).select('_id');
        if (admins.length > 0) {
            const reporter = await User.findById(reporterUserId).select('fullName').lean();
            const notifications = admins.map(admin => ({
                user: admin._id,
                type: 'NEW_USER_REPORT',
                title: 'notification_titles.NEW_USER_REPORT',
                message: 'notification_messages.NEW_USER_REPORT',
                messageParams: {
                    reporterName: reporter?.fullName || 'a user',
                    reportedUserName: reportedUserExists.fullName || 'a user',
                    reason: reasonCategory
                },
                relatedEntity: { id: newReport._id, modelName: 'Report' }
            }));
            const createdNotifications = await Notification.insertMany(notifications);

            // إرسال الإشعارات عبر Socket.IO
            if (req.io && req.onlineUsers) {
                createdNotifications.forEach(notification => {
                    const adminSocketId = req.onlineUsers[notification.user.toString()];
                    if (adminSocketId) {
                        req.io.to(adminSocketId).emit('new_notification', notification.toObject());
                    }
                });
            }
        }

        res.status(201).json({
            successMessage: { key: 'reportUserModal.submitSuccess' },
            reportId: newReport._id
        });

    } catch (error) {
        console.error("[Report API] Error submitting report:", error);
        cleanupFilesOnError(uploadedFiles); // تأكد من حذف الملفات حتى في حالة حدوث خطأ عام
        if (error.name === 'ValidationError') {
            return res.status(400).json({ errorMessage: { key: 'apiErrors.validationError', fallback: "Validation Error: " + error.message } });
        }
        res.status(500).json({
            errorMessage: {
                key: 'reportUserModal.submitError',
                fallback: "Server error while submitting the report. Please try again later."
            }
        });
    }
};
// [!!!] END: الكود الكامل والنهائي للدالة [!!!]

/**
 * [Admin] Get a list of reports with pagination and filtering.
 */
exports.adminGetReports = async (req, res) => {
    console.log("--- report.controller.js: adminGetReports CALLED ---");
    console.log("--- [Admin Report Controller] --- adminGetReports ---");
    const {
        page = 1,
        limit = 10,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        reporterId,
        reportedId,
        search // للبحث في التفاصيل أو أسماء المستخدمين
    } = req.query;

    try {
        const query = {};
        if (status) query.status = status;
        if (reporterId && mongoose.Types.ObjectId.isValid(reporterId)) query.reporterUser = reporterId;
        if (reportedId && mongoose.Types.ObjectId.isValid(reportedId)) query.reportedUser = reportedId;

        // منطق البحث (مثال بسيط)
        if (search) {
            const searchRegex = new RegExp(search, 'i'); // بحث غير حساس لحالة الأحرف
            // ستحتاج إلى تعديل هذا إذا أردت البحث في أسماء المستخدمين (يتطلب $lookup أو populate ثم $match)
            // حاليًا يبحث فقط في تفاصيل البلاغ
            query.details = searchRegex;
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const options = {
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 10,
            sort: sortOptions,
            populate: [
                { path: 'reporterUser', select: 'fullName email avatarUrl' },
                { path: 'reportedUser', select: 'fullName email avatarUrl' }
            ],
            lean: true
        };

        const result = await Report.paginate(query, options);

        res.status(200).json({
            reports: result.docs,
            totalPages: result.totalPages,
            currentPage: result.page,
            totalReports: result.totalDocs,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
        });

    } catch (error) {
        console.error("[Admin Report API] Error fetching reports:", error);
        res.status(500).json({ msg: "Server error fetching reports." });
    }
};

/**
 * [Admin] Get details of a specific report.
 */
exports.adminGetReportDetails = async (req, res) => {
    console.log("--- report.controller.js: adminGetReportDetails CALLED ---");
    const { reportId } = req.params;
    console.log(`--- [Admin Report Controller] --- adminGetReportDetails for ID: ${reportId} ---`);

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
        return res.status(400).json({ msg: "Invalid report ID format." });
    }

    try {
        const report = await Report.findById(reportId)
            .populate('reporterUser', 'fullName email avatarUrl userRole level reputationPoints')
            .populate('reportedUser', 'fullName email avatarUrl userRole level reputationPoints blocked')
            .populate({ // Populate product title from mediationContext
                path: 'mediationContext',
                select: 'product status',
                populate: {
                    path: 'product',
                    select: 'title'
                }
            })
            .lean();

        if (!report) {
            return res.status(404).json({ msg: "Report not found." });
        }

        res.status(200).json(report);
    } catch (error) {
        console.error(`[Admin Report API] Error fetching report details for ${reportId}:`, error);
        res.status(500).json({ msg: "Server error fetching report details." });
    }
};

/**
 * [Admin] Update the status of a report and add admin notes.
 */
exports.adminUpdateReportStatus = async (req, res) => {
    console.log("--- report.controller.js: adminUpdateReportStatus CALLED ---");
    const { reportId } = req.params;
    const { status, adminNotes, resolutionDetails } = req.body;
    const adminUserId = req.user._id;
    const adminFullName = req.user.fullName; // افترض أن verifyAuth تضيف fullName لـ req.user

    console.log(`--- [Admin Report Controller] --- adminUpdateReportStatus for ID: ${reportId} by Admin: ${adminUserId} ---`);
    console.log("Update data received:", req.body);

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
        return res.status(400).json({ msg: "Invalid report ID format." });
    }

    const validStatuses = ['PENDING_REVIEW', 'UNDER_INVESTIGATION', 'ACTION_TAKEN', 'DISMISSED', 'NEEDS_MORE_INFO'];
    if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ msg: "Invalid status value provided." });
    }

    try {
        const report = await Report.findById(reportId).populate('reporterUser', 'fullName'); // لجلب اسم المُبلِّغ للإشعار
        if (!report) {
            return res.status(404).json({ msg: "Report not found to update." });
        }

        const oldStatus = report.status;
        let updatedFields = {}; // لتتبع الحقول التي تم تحديثها فعليًا

        if (status && report.status !== status) {
            updatedFields.status = status;
            console.log(`Report ${reportId} status changed from ${oldStatus} to ${status}`);
        }
        if (adminNotes !== undefined && report.adminNotes !== adminNotes.trim()) {
            updatedFields.adminNotes = adminNotes.trim();
            console.log(`Report ${reportId} adminNotes updated.`);
        }
        if (resolutionDetails !== undefined && report.resolutionDetails !== resolutionDetails.trim()) {
            updatedFields.resolutionDetails = resolutionDetails.trim();
            console.log(`Report ${reportId} resolutionDetails updated.`);
        }

        if (Object.keys(updatedFields).length === 0) {
            return res.status(200).json({ msg: "No changes detected to update.", report });
        }

        // (اختياري) يمكنك إضافة سجل تغيير هنا إذا كان لديك حقل history في ReportSchema
        // updatedFields.history = { $push: { adminUser: adminUserId, action: 'UPDATE', changes: updatedFields, timestamp: new Date() } };

        const updatedReport = await Report.findByIdAndUpdate(reportId, { $set: updatedFields }, { new: true })
            .populate('reporterUser', 'fullName email avatarUrl')
            .populate('reportedUser', 'fullName email avatarUrl');

        // إرسال إشعار للمستخدم المُبلِّغ إذا تغيرت الحالة إلى حالة نهائية
        if (updatedFields.status && ['ACTION_TAKEN', 'DISMISSED', 'NEEDS_MORE_INFO'].includes(updatedFields.status)) {
            let titleKey = 'notification_titles.REPORT_STATUS_UPDATE';
            let messageKey = `notification_messages.REPORT_STATUS_${updatedFields.status}`;

            const notification = await Notification.create({
                user: report.reporterUser._id,
                type: 'REPORT_STATUS_UPDATE',
                title: titleKey,
                message: messageKey,
                messageParams: {
                    adminName: adminFullName || 'Admin',
                    reportedUserName: report.reportedUser.fullName || 'a user',
                    details: updatedReport.resolutionDetails || 'No details provided.'
                },
                relatedEntity: { id: report._id, modelName: 'Report' }
            });

            // بث الإشعار عبر Socket.IO
            if (req.io && req.onlineUsers[report.reporterUser._id.toString()]) {
                const socketId = req.onlineUsers[report.reporterUser._id.toString()];
                req.io.to(socketId).emit('new_notification', notification.toObject());
            }
        }

        console.log(`Report ${updatedReport._id} updated successfully by admin ${adminUserId}.`);
        res.status(200).json({
            // إرسال مفتاح ترجمة للـ toast
            successMessage: { key: 'admin.reports.updateSuccess' },
            report: updatedReport
        });
        
    } catch (error) {
        console.error(`[Admin Report API] Error updating report ${reportId}:`, error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ msg: "Validation Error: " + error.message, errors: error.errors });
        }
        res.status(500).json({ msg: "Server error updating report." });
    }
};