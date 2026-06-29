const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/settings_controller');
const { is_authenticated, is_owner } = require('../middleware/permissions');

// Apply auth for all routes
router.use(is_authenticated);

// -------------------------------------------------------------
// Singleton Routes (Restricted to Owner)
// -------------------------------------------------------------
router.route('/tax/')
  .get(ctrl.get_tax_settings)
  .put(is_owner, ctrl.update_tax_settings);

router.route('/bank/')
  .get(ctrl.get_bank_details)
  .put(is_owner, ctrl.update_bank_details);

router.route('/brand/')
  .get(ctrl.get_brand_theme)
  .put(is_owner, ctrl.update_brand_theme);

router.route('/numbering/')
  .get(ctrl.get_document_numbering)
  .put(is_owner, ctrl.update_document_numbering);

// Logo upload
router.post('/brand/logo/', is_owner, ctrl.logo_upload_middleware, ctrl.upload_logo);

// -------------------------------------------------------------
// Milestones Routes
// -------------------------------------------------------------
router.route('/milestones/')
  .get(ctrl.get_milestones)
  .post(is_owner, ctrl.create_milestone);

router.route('/milestones/:pk/')
  .get(ctrl.get_milestone_detail)
  .put(is_owner, ctrl.update_milestone)
  .patch(is_owner, ctrl.update_milestone)
  .delete(is_owner, ctrl.delete_milestone);

module.exports = router;