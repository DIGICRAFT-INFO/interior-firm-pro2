const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const enquirySchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 },
    client_name: { type: String, required: true, maxLength: 200 },
    mobile_number: { type: String, required: true, maxLength: 20 },
    address: { type: String, required: true },
    enquiry_date: { type: Date, required: true },
    enquiry_time: { type: String, required: true, maxLength: 10 },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['new', 'contacted', 'converted', 'lost'],
      default: 'new',
    },
    created_by: { type: String, ref: 'User', required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'enquiries',
  }
);

enquirySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model('Enquiry', enquirySchema);