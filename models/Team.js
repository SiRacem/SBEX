// server/models/Team.js
const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, // اسم الفريق (Real Madrid)
  logo: { type: String, required: true }, // رابط شعار الفريق
  league: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true }, // مرجع للدوري
  isActive: { type: Boolean, default: true }, // تفعيل/إلغاء تفعيل
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', TeamSchema);