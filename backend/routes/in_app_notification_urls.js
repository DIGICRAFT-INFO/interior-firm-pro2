const express = require('express');
const router = express.Router();
const { is_authenticated } = require('../middleware/permissions');
const controller = require('../controllers/in_app_notification_controller');

router.get('/', is_authenticated, controller.getNotifications);
router.get('/unread-count', is_authenticated, controller.getUnreadCount);
router.patch('/:pk/read', is_authenticated, controller.markAsRead);
router.patch('/mark-all-read', is_authenticated, controller.markAllAsRead);

module.exports = router;
