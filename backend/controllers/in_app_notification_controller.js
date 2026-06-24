const InAppNotification = require('../models/in_app_notification');

// GET / — List notifications (paginated, filterable)
exports.getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter: notifications where user is null (visible to all) OR user matches current user
    const filter = {
      $or: [
        { user: null },
        { user: req.user._id }
      ]
    };

    // Optional filters
    if (req.query.event_type) {
      filter.event_type = req.query.event_type;
    }
    if (req.query.is_read !== undefined) {
      filter.is_read = req.query.is_read === 'true';
    }

    const [notifications, total] = await Promise.all([
      InAppNotification.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      InAppNotification.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      notifications,
      total,
      page,
      totalPages
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /unread-count — Get unread count for current user
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await InAppNotification.countDocuments({
      $or: [
        { user: null },
        { user: req.user._id }
      ],
      is_read: false
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PATCH /:pk/read — Mark single notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await InAppNotification.findByIdAndUpdate(
      req.params.pk,
      { is_read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ detail: 'Not found.' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PATCH /mark-all-read — Mark all notifications as read for current user
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await InAppNotification.updateMany(
      {
        $or: [
          { user: null },
          { user: req.user._id }
        ],
        is_read: false
      },
      { is_read: true }
    );

    res.json({ modified_count: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
