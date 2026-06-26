const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/master_service_controller');
const { is_authenticated, is_manager_or_above, is_finance_or_above } = require('../middleware/permissions');

// GET /            → list all services (any authenticated user)
// POST /           → create service (manager+)
router.route('/')
  .get(is_authenticated, ctrl.get_services)
  .post(is_authenticated, is_manager_or_above, ctrl.create_service);

// POST /:id/media/       → upload media files
router.post('/:id/media/', is_authenticated, is_manager_or_above, ctrl.uploadMiddleware, ctrl.upload_media);

// DELETE /:id/media/:mediaId/ → delete a media file
router.delete('/:id/media/:mediaId/', is_authenticated, is_manager_or_above, ctrl.delete_media);

// GET /:id         → service detail
// PUT /:id         → full update (manager+)
// BUG FIX: Added PATCH support — frontend sends PATCH but old routes only had PUT
// PATCH /:id       → partial update (manager+)
// DELETE /:id      → delete (manager+)
router.route('/:id')
  .get(is_authenticated, ctrl.get_service_detail)
  .put(is_authenticated, is_manager_or_above, ctrl.update_service)
  .patch(is_authenticated, is_manager_or_above, ctrl.update_service)
  .delete(is_authenticated, is_manager_or_above, ctrl.delete_service);

// BUG FIX: Also support trailing slash variants (Next.js/Axios may append /)
router.route('/:id/')
  .get(is_authenticated, ctrl.get_service_detail)
  .put(is_authenticated, is_manager_or_above, ctrl.update_service)
  .patch(is_authenticated, is_manager_or_above, ctrl.update_service)
  .delete(is_authenticated, is_manager_or_above, ctrl.delete_service);

module.exports = router;
