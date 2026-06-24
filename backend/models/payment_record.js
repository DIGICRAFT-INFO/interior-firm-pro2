const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const paymentRecordSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 }, //
    invoice: { type: String, ref: 'Invoice', required: true }, //
    
    amount_paid: { 
      type: Number, 
      required: true,
      // Amount validation exactly as in validate_amount_paid
      min: [0.01, 'Payment amount must be greater than zero.'] 
    },
    
    payment_date: { type: Date, required: true }, //
    
    payment_mode: { 
      type: String, 
      enum: ['bank_transfer', 'cheque', 'cash', 'upi', 'neft', 'other'], 
      default: 'bank_transfer' 
    }, //
    
    reference_number: { type: String, default: '' }, // help_text: "UTR / Cheque no. / Transaction ID"
    notes: { type: String, default: '' }, //
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, //
    collection: 'payment_records' // db_table
  }
);

// --- Django's override save() alternative ---
// Recalculate invoice balance after every payment save
paymentRecordSchema.post('save', async function (doc) {
  const Invoice = mongoose.model('Invoice');
  const invoice = await Invoice.findById(doc.invoice);
  if (invoice) {
    await invoice.update_balance(); // Yeh method humne Invoices conversion mein define kiya tha
  }
});

// Extra Hook: Taki delete karne par bhi invoice balance sahi update ho jaye
paymentRecordSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    const Invoice = mongoose.model('Invoice');
    const invoice = await Invoice.findById(doc.invoice);
    if (invoice) {
      await invoice.update_balance();
    }
  }
});

// JSON Output Formatting
paymentRecordSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  }
});

module.exports = mongoose.model('PaymentRecord', paymentRecordSchema);