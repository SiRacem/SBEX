// server/controllers/report.controller.js
console.log("--- report.controller.js: Module loaded ---");
const Report = require('../models/Report');
const User = require('../models/User');
const MediationRequest = require('../models/MediationRequest');
const Notification = require('../models/Notification'); // لاستخدامه في إشعارات الأدمن/المستخدمين
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// --- دالة إرسال البلاغ من المستخدم (تبقى كما هي من الرد السابق) ---
exports.submitUserReport = async (req, res) => {
    console.log("--- report.controller.js: submitUserReport CALLED ---");
    console.log("--- [Report Controller] --- submitUserReport ---");
    console.log("req.body received:", JSON.stringify(req.body, null, 2));
    console.log("req.files received:", req.files ? req.files.map(f => f.originalname) : 'No files');

    const reporterUserId = req.user._id;
    const { reportedUserId, reasonCategory, details, mediationContext } = req.body;
    const uploadedFiles = req.files;

    // --- Input Validations ---
    if (!reportedUserId || !reasonCategory || !details) {
        if (uploadedFiles && uploadedFiles.length > 0) { uploadedFiles.forEach(file => fs.unlink(file.path, err => { if (err) console.error("Error deleting orphaned report image on validation fail:", err); })); }
        return res.status(400).json({ msg: "Reported user ID, reason category, and details are required." });
    }
    if (!mongoose.Types.ObjectId.isValid(reportedUserId)) {
        if (uploadedFiles && uploadedFiles.length > 0) { uploadedFiles.forEach(file => fs.unlink(file.path, err => { if (err) console.error("Error deleting orphaned report image on validation fail:", err); })); }
        return res.status(400).json({ msg: "Invalid reported user ID format." });
    }
    if (mediationContext && !mongoose.Types.ObjectId.isValid(mediationContext)) {
        if (uploadedFiles && uploadedFiles.length > 0) { uploadedFiles.forEach(file => fs.unlink(file.path, err => { if (err) console.error("Error deleting orphaned report image on validation fail:", err); })); }
        return res.status(400).json({ msg: "Invalid mediation context ID format." });
    }
    if (reporterUserId.equals(reportedUserId)) {
        if (uploadedFiles && uploadedFiles.length > 0) { uploadedFiles.forEach(file => fs.unlink(file.path, err => { if (err) console.error("Error deleting orphaned report image on validation fail:", err); })); }
        return res.status(400).json({ msg: "You cannot rate yourself." });
    }
    const validCategories = ['INAPPROPRIATE_BEHAVIOR', 'HARASSMENT_OR_BULLYING', 'SPAM_OR_SCAM', 'IMPERSONATION', 'HATE_SPEECH', 'INAPPROPRIATE_CONTENT', 'TRANSACTION_ISSUE', 'POLICY_VIOLATION', 'OTHER'];
    if (!validCategories.includes(reasonCategory)) {
        if (uploadedFiles && uploadedFiles.length > 0) { uploadedFiles.forEach(file => fs.unlink(file.path, err => { if (err) console.error("Error deleting orphaned report image on validation fail:", err); })); }
        return res.status(400).json({ msg: "Invalid reason category." });
    }

    try {
        const reportedUserExists = await User.findById(reportedUserId).select('_id');
        if (!reportedUserExists) {
            if (uploadedFiles && uploadedFiles.length > 0) { uploadedFiles.forEach(file => fs.unlink(file.path, err => { if (err) console.error("Error deleting orphaned report image on validation fail:", err); })); }
            return res.status(404).json({ msg: "The user you are trying to report does not exist." });
        }
        if (mediationContext) {
            const mediationExists = await MediationRequest.findById(mediationContext).select('_id');
            if (!mediationExists) {
                if (uploadedFiles && uploadedFiles.length > 0) { uploadedFiles.forEach(file => fs.unlink(file.path, err => { if (err) console.error("Error deleting orphaned report image on validation fail:", err); })); }
                return res.status(404).json({ msg: "The referenced mediation context does not exist." });
            }
        }
        const recentReport = await Report.findOne({
            reporterUser: reporterUserId,
            reportedUser: reportedUserId,
            reasonCategory: reasonCategory,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        if (recentReport) {
            if (uploadedFiles && uploadedFiles.length > 0) { uploadedFiles.forEach(file => fs.unlink(file.path, err => { if (err) console.error("Error deleting orphaned report image on validation fail:", err); })); }
            return res.status(429).json({ msg: "You have recently submitted a similar report against this user. Please wait for our team to review it." });
        }

        const imageUrls = [];
        if (uploadedFiles && uploadedFiles.length > 0) {
            uploadedFiles.forEach(file => {
                const relativePath = file.path.replace(/\\/g, '/').split('uploads/')[1];
                imageUrls.push(`uploads/${relativePath}`);
            });
        }

        const newReport = new Report({
            reporterUser: reporterUserId,
            reportedUser: reportedUserId,
            reasonCategory,
            details,
            mediationContext: mediationContext || null,
            imageUrls
        });
        await newReport.save();

        // إشعار للأدمن (مثال بسيط، يمكنك تطويره)
        const admins = await User.find({ userRole: 'Admin' }).select('_id');
        if (admins.length > 0 && req.io) { // تأكد من وجود req.io
            const reporter = await User.findById(reporterUserId).select('fullName').lean();
            const notificationPromises = admins.map(admin => {
                return Notification.create({
                    user: admin._id,
                    type: 'NEW_USER_REPORT',
                    title: 'notification_titles.NEW_USER_REPORT', // <-- استخدام مفتاح الترجمة
                    message: 'notification_messages.NEW_USER_REPORT', // <-- استخدام مفتاح الترجمة
                    // إضافة متغيرات الرسالة
                    messageParams: {
                        reporterName: reporter?.fullName || 'a user',
                        reportedUserName: reportedUserExists.fullName || 'a user', // ستحتاج لجلب اسم المستخدم المبلغ عنه
                        reason: reasonCategory
                    },
                    relatedEntity: { id: newReport._id, modelName: 'Report' }
                });
            });
            await Promise.all(notificationPromises);
            // يمكنك أيضًا إرسال حدث socket لغرفة الأدمن
            // req.io.to('admin_room').emit('new_report_notification', { reportId: newReport._id, reason: reasonCategory });
            console.log(`Admin notifications sent for new report ${newReport._id}`);
        }


        console.log(`[Report API] Report ${newReport._id} submitted successfully. Images: ${imageUrls.join(', ')}`);
        res.status(201).json({ msg: "Report submitted successfully. Our team will review it shortly.", reportId: newReport._id });

    } catch (error) {
        console.error("[Report API] Error submitting report:", error);
        if (uploadedFiles && uploadedFiles.length > 0) {
            uploadedFiles.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlink(file.path, err => { if (err) console.error("Error deleting orphaned report image on error:", err); });
                }
            });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ msg: "Validation Error: " + error.message, errors: error.errors });
        }
        res.status(500).json({ msg: "Server error while submitting the report. Please try again later." });
    }
};

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
        if (updatedFields.status && (updatedFields.status === 'ACTION_TAKEN' || updatedFields.status === 'DISMISSED' || updatedFields.status === 'NEEDS_MORE_INFO')) {
            let notificationTitle = '';
            let notificationMessage = '';

            switch (updatedFields.status) {
                case 'ACTION_TAKEN':
                    notificationTitle = 'Report Reviewed: Action Taken';
                    notificationMessage = `Admin ${adminFullName || 'team'} has reviewed your report regarding user ${report.reportedUser.fullName || 'a user'} and appropriate action has been taken.`;
                    if (updatedReport.resolutionDetails) notificationMessage += ` Details: ${updatedReport.resolutionDetails}`;
                    break;
                case 'DISMISSED':
                    notificationTitle = 'Report Reviewed: Dismissed';
                    notificationMessage = `Admin ${adminFullName || 'team'} has reviewed your report regarding user ${report.reportedUser.fullName || 'a user'}. After investigation, it was determined that no action is required at this time.`;
                    if (updatedReport.resolutionDetails) notificationMessage += ` Reason: ${updatedReport.resolutionDetails}`;
                    break;
                case 'NEEDS_MORE_INFO':
                    notificationTitle = 'Report Update: More Information Needed';
                    notificationMessage = `Admin ${adminFullName || 'team'} is reviewing your report regarding user ${report.reportedUser.fullName || 'a user'} and requires more information. Please check your support tickets or messages for details.`;
                    // يمكنك هنا توجيه المستخدم لمكان ما لتقديم معلومات إضافية
                    break;
            }

            if (notificationTitle) {
                await Notification.create({
                    user: report.reporterUser._id, // ID المُبلِّغ
                    type: 'REPORT_STATUS_UPDATE',
                    title: notificationTitle,
                    message: notificationMessage,
                    relatedEntity: { id: report._id, modelName: 'Report' }
                });
                console.log(`Notification sent to reporter ${report.reporterUser.fullName} about report ${report._id} status change to ${updatedFields.status}.`);
            }
        }

        console.log(`Report ${updatedReport._id} updated successfully by admin ${adminUserId}.`);
        res.status(200).json({ msg: "Report updated successfully.", report: updatedReport });

    } catch (error) {
        console.error(`[Admin Report API] Error updating report ${reportId}:`, error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ msg: "Validation Error: " + error.message, errors: error.errors });
        }
        res.status(500).json({ msg: "Server error updating report." });
    }
};