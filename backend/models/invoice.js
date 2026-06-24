const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const invoiceSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 }, //
    project: { type: String, ref: 'Project', required: true }, //
    quotation: { type: String, ref: 'Quotation', default: null }, //
    invoice_number: { type: String, required: true, unique: true }, //
    invoice_type: { 
      type: String, 
      enum: ['full', 'advance', 'milestone', 'final'], 
      default: 'full' 
    }, //
    invoice_date: { type: Date, required: true }, //
    due_date: { type: Date, required: true }, //
    status: { 
      type: String, 
      enum: ['draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled'], 
      default: 'draft' 
    }, //
    
    // Milestone billing
    milestone_label: { type: String, default: '' },
    milestone_percentage: { type: Number, default: 0 },

    // Financials
    subtotal: { type: Number, default: 0 },
    taxable_amount: { type: Number, default: 0 },
    cgst_amount: { type: Number, default: 0 },
    sgst_amount: { type: Number, default: 0 },
    igst_amount: { type: Number, default: 0 },
    total_tax: { type: Number, default: 0 },
    grand_total: { type: Number, default: 0 },
    amount_paid: { type: Number, default: 0 },
    balance_due: { type: Number, default: 0 },
    
    notes: { type: String, default: '' }, //
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'invoices' //
  }
);

// Virtual for items
invoiceSchema.virtual('items', {
  ref: 'InvoiceItem',
  localField: '_id',
  foreignField: 'invoice'
});

// Equivalent to Django's update_balance method
invoiceSchema.methods.update_balance = async function () {
  const PaymentRecord = mongoose.model('PaymentRecord');
  
  const result = await PaymentRecord.aggregate([
    { $match: { invoice: this._id } },
    { $group: { _id: null, t: { $sum: '$amount_paid' } } }
  ]);
  
  const paid = result.length > 0 ? result[0].t : 0;
  
  this.amount_paid = paid;
  this.balance_due = this.grand_total - paid;
  
  if (this.balance_due <= 0) {
    this.status = 'paid';
  } else if (paid > 0) {
    this.status = 'partial';
  }
  
  await this.save();
};

invoiceSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  }
});

module.exports = mongoose.model('Invoice', invoiceSchema);