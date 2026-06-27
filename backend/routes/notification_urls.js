const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notification_controller');
const { is_authenticated, is_manager_or_above, is_finance_or_above } = require('../middleware/permissions');

// -------------------------------------------------------------
// WhatsApp Webhook (Meta calls this)
// -------------------------------------------------------------
router.route('/whatsapp/webhook/')
  .get(ctrl.whatsapp_webhook_verify) // allow_any
  .post(ctrl.whatsapp_webhook_receive);
// Add these two lines:
router.post('/email/proposal/:pk/send/', is_authenticated, is_manager_or_above, ctrl.send_proposal_email);
router.post('/email/invoice/:pk/send/', is_authenticated, is_finance_or_above, ctrl.send_invoice_email);
router.post('/email/quotation/:pk/send/', is_authenticated, is_manager_or_above, ctrl.send_quotation_email);
// Add these after the existing WhatsApp routes:
router.post('/email/invoice/:pk/send/',    is_authenticated, is_finance_or_above,  ctrl.send_invoice_email);
router.post('/email/quotation/:pk/send/',  is_authenticated, is_manager_or_above,  ctrl.send_quotation_email);
router.post('/email/proposal/:pk/send/',   is_authenticated, is_manager_or_above,  ctrl.send_proposal_email);
// Also fix the WhatsApp routes to match the /whatsapp/proposal/ pattern the frontend already uses:
// (these already exist with the right paths — no change needed there)
// -------------------------------------------------------------
// Send via WhatsApp
// -------------------------------------------------------------
router.post('/whatsapp/invoice/:pk/send/', is_authenticated, is_finance_or_above, ctrl.send_invoice_whatsapp); //
router.post('/whatsapp/quotation/:pk/send/', is_authenticated, is_manager_or_above, ctrl.send_quotation_whatsapp); //
router.post('/whatsapp/proposal/:pk/send/', is_authenticated, is_manager_or_above, ctrl.send_proposal_whatsapp); //

// -------------------------------------------------------------
// Send Both (WhatsApp + Email) at once
// -------------------------------------------------------------
router.post('/reminder/:pk/send-all/', is_authenticated, is_finance_or_above, ctrl.send_both_reminders); //

// -------------------------------------------------------------
// Logs
// -------------------------------------------------------------
router.get('/logs/', is_authenticated, is_finance_or_above, ctrl.get_notification_logs); //

module.exports = router;