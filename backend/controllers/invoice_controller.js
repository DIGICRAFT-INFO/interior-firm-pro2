const Invoice = require('../models/invoice');
const InvoiceItem = require('../models/invoice_item');
const invoiceService = require('../services/invoice_service');
const pdfEngine = require('../services/pdf_engine_service');
const { createNotification, deleteNotificationsByReference } = require('../services/in_app_notification_service');

exports.get_invoice_pdf = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.pk)
      .populate({ path: 'project', populate: { path: 'client' } })
      .populate('items');
    if (!invoice) return res.status(404).json({ detail: 'Not found.' });
    
    // Yahan service call hogi
    const pdfBuffer = await pdfEngine.render_invoice_pdf(invoice);
    
    // DRF ki PDFRenderer class ka equivalent headers setup
    res.setHeader('Content-Type', 'application/pdf'); 
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// InvoiceListCreateView -> GET
exports.get_invoices = async (req, res) => {
  try {
    let query = {};
    if (req.query.status) query.status = req.query.status; // status_filter

    // select_related in mongoose
    const invoices = await Invoice.find(query)
      .populate({ path: 'project', populate: { path: 'client' } })
      .populate('quotation')
      .populate('items')
      .sort('-created_at'); // ordering_fields
      
    // Format to match serializers.py custom fields
    const formatted = invoices.map(inv => {
      const obj = inv.toJSON();
      obj.project_name = inv.project ? inv.project.name : null; //
      obj.client_name = inv.project && inv.project.client ? inv.project.client.full_name : null; //
      return obj;
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// InvoiceListCreateView -> POST
exports.create_invoice = async (req, res) => {
  try {
    const invoice = await Invoice.create(req.body);

    await createNotification({
      event_type: 'invoice_created',
      title: 'Invoice Generated',
      message: `Invoice ${invoice.invoice_number} created for ₹${invoice.grand_total}`,
      reference_id: invoice._id,
      reference_type: 'invoice'
    });

    res.status(201).json(invoice);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Invoice send (mark as issued)
exports.send_invoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.pk);
    if (!invoice) return res.status(404).json({ detail: 'Not found.' });
    if (invoice.status !== 'draft') {
      return res.status(400).json({ detail: `Cannot send invoice with status: ${invoice.status}` });
    }
    invoice.status = 'issued';
    await invoice.save();

    await createNotification({
      event_type: 'invoice_sent',
      title: 'Invoice Sent',
      message: `Invoice ${invoice.invoice_number} sent to client`,
      reference_id: invoice._id,
      reference_type: 'invoice'
    });

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Invoice mark as paid
exports.mark_invoice_paid = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.pk);
    if (!invoice) return res.status(404).json({ detail: 'Not found.' });
    invoice.status = 'paid';
    await invoice.save();

    await createNotification({
      event_type: 'invoice_paid',
      title: 'Payment Complete',
      message: `Invoice ${invoice.invoice_number} marked as paid`,
      reference_id: invoice._id,
      reference_type: 'invoice'
    });

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// InvoiceDetailView -> GET, PUT, DELETE
exports.get_invoice_detail = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.pk)
      .populate({ path: 'project', populate: { path: 'client' } })
      .populate('quotation')
      .populate('items'); // prefetch_related('items')
      
    if (!invoice) return res.status(404).json({ detail: 'Not found.' });
    
    const obj = invoice.toJSON();
    obj.project_name = invoice.project ? invoice.project.name : null; //
    obj.client_name = invoice.project && invoice.project.client ? invoice.project.client.full_name : null; //
    
    res.json(obj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update_invoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.pk, req.body, { new: true });
    if (!invoice) return res.status(404).json({ detail: 'Not found.' });
    res.json(invoice);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.delete_invoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.pk);
    if (!invoice) return res.status(404).json({ detail: 'Not found.' });
    await deleteNotificationsByReference(req.params.pk, 'invoice');
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GenerateInvoiceView -> POST
exports.generate_invoice = async (req, res) => {
  try {
    const invoice = await invoiceService.generate_invoice_from_quotation(req.body);
    res.status(201).json(invoice);
  } catch (error) {
    res.status(400).json({ detail: error.message }); //
  }
};