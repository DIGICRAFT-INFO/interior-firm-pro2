const nodemailer = require('nodemailer');
const NotificationLog = require('../models/notification_log');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_HOST_USER, //
    pass: process.env.EMAIL_HOST_PASSWORD // App Password
  }
});

const log_notification = async (channel, doc_type, doc_id, recipient, status, error = "") => {
  await NotificationLog.create({ channel, doc_type, doc_id, recipient, status, error });
};

const firm_name = () => "Interior Design Firm"; //

// 1. Send Invoice Email
exports.send_invoice_email = async (invoice) => {
  const client = invoice.project.client;
  if (!client.email) return { success: false, error: "Client email not set" };

  try {
    // Generate PDF logic mock (Replace with your actual PDFKit buffer stream)
    const pdf_bytes = Buffer.from('Mock PDF Content'); 
    
    await transporter.sendMail({
      from: process.env.DEFAULT_FROM_EMAIL || `Elegance Interiors <${process.env.EMAIL_HOST_USER}>`,
      to: client.email,
      subject: `Invoice ${invoice.invoice_number} — ${firm_name()}`,
      html: `<p>Please find attached Invoice ${invoice.invoice_number}. Download: ${process.env.BACKEND_URL}/api/v1/invoices/${invoice._id}/pdf/</p>`,
      attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: pdf_bytes }] //
    });

    await log_notification("email", "invoice", invoice._id, client.email, "sent");
    return { success: true };
  } catch (error) {
    await log_notification("email", "invoice", invoice._id, client.email, "failed", error.message);
    return { success: false, error: error.message };
  }
};

// ... Similar functions for send_quotation_email, send_payment_reminder_email, and send_proposal_email map exactly like above using transporter.sendMail() ...

// 2. Send Portfolio Email (with PDF attachment + inline image links)
exports.send_portfolio_email = async (portfolio, recipient_email, pdf_buffer) => {
  if (!recipient_email) return { success: false, error: "Recipient email not set" };

  try {
    const base = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const image_links = (portfolio.images || [])
      .map((img) => `<img src="${img.file_url.startsWith('http') ? img.file_url : base + img.file_url}" width="260" style="margin:6px;border-radius:6px;" />`)
      .join('');

    await transporter.sendMail({
      from: process.env.DEFAULT_FROM_EMAIL || `${firm_name()} <${process.env.EMAIL_HOST_USER}>`,
      to: recipient_email,
      subject: `${portfolio.title} — Portfolio from ${firm_name()}`,
      html: `<p>Hi,</p><p>Here's a look at the work — <strong>${portfolio.title}</strong>.</p>
             ${portfolio.description ? `<p>${portfolio.description}</p>` : ''}
             <div>${image_links}</div>
             <p>A PDF copy is attached for your records.</p>`,
      attachments: pdf_buffer
        ? [{ filename: `${portfolio.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, content: pdf_buffer }]
        : [],
    });

    await log_notification("email", "portfolio", portfolio._id, recipient_email, "sent");
    return { success: true };
  } catch (error) {
    await log_notification("email", "portfolio", portfolio._id, recipient_email, "failed", error.message);
    return { success: false, error: error.message };
  }
};