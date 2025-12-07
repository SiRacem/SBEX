// server/models/League.js
const mongoose = require('mongoose');

const LeagueSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, // اسم الدوري (La Liga)
  logo: { type: String, required: true }, // رابط شعار الدوري
  type: { 
    type: String, 
    enum: ['Club', 'National'], // هل هو دوري أندية أم منتخبات؟
    required: true 
  },
  region: { type: String }, // المنطقة (أوروبا، أفريقيا...) - اختياري
  isActive: { type: Boolean, default: true }, // تفعيل/إلغاء تفعيل
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('League', LeagueSchema);