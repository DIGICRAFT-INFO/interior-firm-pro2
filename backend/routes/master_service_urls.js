const express = require('express');
const router = express.Router();
const controller = require('../controllers/master_service_controller');
const { is_authenticated, is_manager_or_above, is_owner } = require('../middleware/permissions');

// -------------------------------------------------------------
// GET /  — List all services (any authenticated user)
// POST / — Create a new service (manager or above)
// -------------------------------------------------------------
router.route('/')
  .get(is_authenticated, controller.list_services)
  .post(is_authenticated, is_manager_or_above, controller.create_service);

// -------------------------------------------------------------
// Client services route (placed before :id to avoid conflicts)
// GET /client/:clientId — Get services assigned to a client
// -------------------------------------------------------------
router.get('/client/:clientId', is_authenticated, controller.get_client_services);

// -------------------------------------------------------------
// Media routes
// POST /:id/media — Upload media files (max 10)
// DELETE /:id/media/:mediaId — Remove a media entry
// -------------------------------------------------------------
router.post('/:id/media', is_authenticated, is_manager_or_above, controller.upload.array('files', 10), controller.upload_media);
router.delete('/:id/media/:mediaId', is_authenticated, is_manager_or_above, controller.delete_media);

// -------------------------------------------------------------
// Assignment routes
// POST /:id/assign — Assign service to a client
// DELETE /:id/assign/:clientId — Unassign service from a client
// GET /:id/assignments — List assignments for a service
// -------------------------------------------------------------
router.post('/:id/assign', is_authenticated, is_manager_or_above, controller.assign_service);
router.delete('/:id/assign/:clientId', is_authenticated, is_manager_or_above, controller.unassign_service);
router.get('/:id/assignments', is_authenticated, controller.get_service_assignments);

// -------------------------------------------------------------
// GET /:id  — Get single service (any authenticated user)
// PUT /:id  — Update a service (manager or above)
// DELETE /:id — Soft-delete a service (owner only)
// -------------------------------------------------------------
router.route('/:id')
  .get(is_authenticated, controller.get_service)
  .put(is_authenticated, is_manager_or_above, controller.update_service)
  .delete(is_authenticated, is_manager_or_above, controller.delete_service);

module.exports = router;