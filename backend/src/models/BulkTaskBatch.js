const mongoose = require('mongoose');

const bulkTaskBatchSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true },
  status: { type: String, enum: ['processing', 'completed'], default: 'processing' },
  response: { type: mongoose.Schema.Types.Mixed },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 86400000) },
}, { timestamps: true });

bulkTaskBatchSchema.index({ user: 1, key: 1 }, { unique: true });
bulkTaskBatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('BulkTaskBatch', bulkTaskBatchSchema);
