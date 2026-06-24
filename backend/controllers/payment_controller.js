const PaymentRecord = require('../models/payment_record');
const Invoice = require('../models/invoice');
const { createNotification, deleteNotificationsByReference } = require('../services/in_app_notification_service');

// PaymentListCreateView -> GET
exports.get_payments = async (req, res) => {
  try {
    let matchStage = {};

    // Filter by invoice_id if provided
    if (req.query.invoice) {
      matchStage.invoice = req.query.invoice;
    }

    // Search functionality
    if (req.query.search) {
      const searchRegex = { $regex: req.query.search, $options: 'i' };
      matchStage.$or = [
        { reference_number: searchRegex },
        { 'invoice_data.invoice_number': searchRegex },
        { 'client_data.full_name': searchRegex }
      ];
    }

    // Ordering logic
    let sortStage = { payment_date: -1 }; // Default ordering from Meta
    if (req.query.ordering) {
      sortStage = {};
      const fields = req.query.ordering.split(',');
      fields.forEach(field => {
        if (field.startsWith('-')) {
          sortStage[field.substring(1)] = -1;
        } else {
          sortStage[field] = 1;
        }
      });
    }

    // Aggregation pipeline to simulate select_related and nested search
    const payments = await PaymentRecord.aggregate([
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoice',
          foreignField: '_id',
          as: 'invoice_data'
        }
      },
      { $unwind: { path: '$invoice_data', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'projects',
          localField: 'invoice_data.project',
          foreignField: '_id',
          as: 'project_data'
        }
      },
      { $unwind: { path: '$project_data', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'clients',
          localField: 'project_data.client',
          foreignField: '_id',
          as: 'client_data'
        }
      },
      { $unwind: { path: '$client_data', preserveNullAndEmptyArrays: true } },
      { $match: matchStage },
      { $sort: sortStage },
      {
        $project: {
          id: '$_id',
          invoice: 1,
          amount_paid: 1,
          payment_date: 1,
          payment_mode: 1,
          reference_number: 1,
          notes: 1,
          created_at: 1,
          invoice_number: '$invoice_data.invoice_number', //
          client_name: '$client_data.full_name' //
        }
      }
    ]);

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PaymentListCreateView -> POST
exports.create_payment = async (req, res) => {
  try {
    // Model hooks will handle the invoice balance calculation
    const payment = await PaymentRecord.create(req.body);

    await createNotification({
      event_type: 'payment_received',
      title: 'Payment Received',
      message: `Payment of ₹${payment.amount_paid} recorded`,
      reference_id: payment._id,
      reference_type: 'payment'
    });

    res.status(201).json(payment);
  } catch (error) {
    // Handling Mongoose validation errors (like amount <= 0)
    res.status(400).json({ error: error.message });
  }
};

// PaymentDetailView -> GET
exports.get_payment_detail = async (req, res) => {
  try {
    const payment = await PaymentRecord.findById(req.params.pk)
      .populate({
        path: 'invoice',
        select: 'invoice_number project',
        populate: {
          path: 'project',
          select: 'client',
          populate: { path: 'client', select: 'full_name' }
        }
      }); // Equivalent to select_related('invoice__project__client')

    if (!payment) return res.status(404).json({ detail: 'Not found.' });

    // Formatting for serializers
    const obj = payment.toJSON();
    obj.invoice_number = payment.invoice ? payment.invoice.invoice_number : null;
    obj.client_name = payment.invoice && payment.invoice.project && payment.invoice.project.client 
      ? payment.invoice.project.client.full_name : null;
    
    // Cleanup nested populated objects to match flat serializer output
    obj.invoice = payment.invoice ? payment.invoice._id : null; 

    res.json(obj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PaymentDetailView -> PUT/PATCH
exports.update_payment = async (req, res) => {
  try {
    const payment = await PaymentRecord.findById(req.params.pk);
    if (!payment) return res.status(404).json({ detail: 'Not found.' });

    // Update fields manually then use save() to trigger the model hook
    Object.assign(payment, req.body);
    await payment.save();

    res.json(payment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// PaymentDetailView -> DELETE
exports.delete_payment = async (req, res) => {
  try {
    // findOneAndDelete hook will automatically recalculate balance
    const payment = await PaymentRecord.findOneAndDelete({ _id: req.params.pk });
    if (!payment) return res.status(404).json({ detail: 'Not found.' });
    await deleteNotificationsByReference(req.params.pk, 'payment');
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};