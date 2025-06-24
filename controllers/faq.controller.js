// server/controllers/faq.controller.js
const FAQ = require('../models/FAQ');
const mongoose = require('mongoose');

// @route   GET /faq
// @desc    Get all active FAQs for public view, grouped by category
// @access  Public
exports.getAllActiveFAQs = async (req, res) => {
    try {
        const faqs = await FAQ.find({ isActive: true }).sort({ category: 1, displayOrder: 1, createdAt: 1 });
        
        // Group FAQs by category
        const groupedFAQs = faqs.reduce((acc, faq) => {
            const category = faq.category;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(faq);
            return acc;
        }, {});

        res.status(200).json(groupedFAQs);
    } catch (error) {
        console.error("Error fetching active FAQs:", error);
        res.status(500).json({ msg: "Server error while fetching FAQs." });
    }
};

// --- Admin Controllers ---

// @route   GET /faq/admin/all
// @desc    Get all FAQs for admin management
// @access  Private (Admin)
exports.adminGetAllFAQs = async (req, res) => {
    try {
        const faqs = await FAQ.find().sort({ category: 1, displayOrder: 1 });
        res.status(200).json(faqs);
    } catch (error) {
        console.error("Error fetching all FAQs for admin:", error);
        res.status(500).json({ msg: "Server error." });
    }
};

// @route   POST /faq/admin
// @desc    Create a new FAQ entry
// @access  Private (Admin)
exports.adminCreateFAQ = async (req, res) => {
    const { question, answer, category, isActive, displayOrder } = req.body;

    try {
        if (!question || !answer || !category) {
            return res.status(400).json({ msg: "Please provide question, answer, and category." });
        }

        const newFAQ = new FAQ({
            question,
            answer,
            category,
            isActive,
            displayOrder
        });

        await newFAQ.save();

        // [!] Socket.IO: Broadcast update to all clients
        if (req.io) {
            req.io.emit('faqs_updated', { action: 'create', data: newFAQ });
            console.log("SOCKET: Emitted 'faqs_updated' for CREATE operation.");
        }
        
        res.status(201).json({ msg: "FAQ created successfully.", faq: newFAQ });

    } catch (error) {
        console.error("Error creating FAQ:", error);
        res.status(500).json({ msg: "Server error while creating FAQ." });
    }
};

// @route   PUT /faq/admin/:id
// @desc    Update an existing FAQ entry
// @access  Private (Admin)
exports.adminUpdateFAQ = async (req, res) => {
    const { id } = req.params;
    const { question, answer, category, isActive, displayOrder } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: "Invalid FAQ ID." });
    }

    try {
        const faq = await FAQ.findById(id);
        if (!faq) {
            return res.status(404).json({ msg: "FAQ not found." });
        }

        faq.question = question ?? faq.question;
        faq.answer = answer ?? faq.answer;
        faq.category = category ?? faq.category;
        
        if (typeof isActive !== 'undefined') {
            faq.isActive = isActive;
        }
        if (typeof displayOrder !== 'undefined') {
            faq.displayOrder = displayOrder;
        }

        const updatedFAQ = await faq.save();

        // [!] Socket.IO: Broadcast update to all clients
        if (req.io) {
            req.io.emit('faqs_updated', { action: 'update', data: updatedFAQ });
            console.log("SOCKET: Emitted 'faqs_updated' for UPDATE operation.");
        }

        res.status(200).json({ msg: "FAQ updated successfully.", faq: updatedFAQ });

    } catch (error) {
        console.error("Error updating FAQ:", error);
        res.status(500).json({ msg: "Server error while updating FAQ." });
    }
};

// @route   DELETE /faq/admin/:id
// @desc    Delete an FAQ entry
// @access  Private (Admin)
exports.adminDeleteFAQ = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ msg: "Invalid FAQ ID." });
    }

    try {
        const faq = await FAQ.findByIdAndDelete(id);
        if (!faq) {
            return res.status(404).json({ msg: "FAQ not found or already deleted." });
        }
        
        // [!] Socket.IO: Broadcast update to all clients
        if (req.io) {
            // For delete, we just need to send the ID of the deleted item
            req.io.emit('faqs_updated', { action: 'delete', data: { _id: id } });
            console.log("SOCKET: Emitted 'faqs_updated' for DELETE operation.");
        }

        res.status(200).json({ msg: "FAQ deleted successfully." });

    } catch (error) {
        console.error("Error deleting FAQ:", error);
        res.status(500).json({ msg: "Server error while deleting FAQ." });
    }
};