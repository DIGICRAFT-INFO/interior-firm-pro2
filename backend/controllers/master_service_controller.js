const MasterService = require('../models/master_service');
const ServiceMedia = require('../models/master_service');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createNotification, deleteNotificationsByReference } = require('../services/in_app_notification_service');

// ─── File upload config ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/services/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only images and videos are allowed.'));
  }
});

exports.uploadMiddleware = upload.array('files', 10);

// ── GET /  ────────────────────────────────────────────────────────────────────
exports.get_services = async (req, res) => {
  try {
    let query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) query.name = { $regex: req.query.search, $options: 'i' };

    const services = await MasterService.find(query)
      .populate('media')
      .sort('-created_at');

    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── GET /:id  ─────────────────────────────────────────────────────────────────
exports.get_service_detail = async (req, res) => {
  try {
    const service = await MasterService.findById(req.params.id).populate('media');
    if (!service) return res.status(404).json({ detail: 'Not found.' });
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── POST /  ───────────────────────────────────────────────────────────────────
exports.create_service = async (req, res) => {
  try {
    const service = await MasterService.create({
      name: req.body.name,
      description: req.body.description,
      status: req.body.status || 'active',
      created_by: req.user ? req.user._id : null
    });

    await createNotification({
      event_type: 'service_created',
      title: 'New Service Added',
      message: `Master service "${service.name}" has been created`,
      reference_id: service._id,
      reference_type: 'service'
    });

    const withMedia = await MasterService.findById(service._id).populate('media');
    res.status(201).json(withMedia);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ── PUT /:id  — BUG FIX: Frontend was sending PATCH but route only had PUT
// Fixed: route file now supports both PUT and PATCH ─────────────────────────
exports.update_service = async (req, res) => {
  try {
    const service = await MasterService.findById(req.params.id);
    if (!service) return res.status(404).json({ detail: 'Not found.' });

    const allowed = ['name', 'description', 'status'];
    allowed.forEach(f => {
      if (req.body[f] !== undefined) service[f] = req.body[f];
    });
    await service.save();

    const withMedia = await MasterService.findById(service._id).populate('media');
    res.json(withMedia);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ── DELETE /:id  ──────────────────────────────────────────────────────────────
exports.delete_service = async (req, res) => {
  try {
    const service = await MasterService.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ detail: 'Not found.' });

    // Also delete associated media records
    await ServiceMedia.deleteMany({ service: req.params.id });
    await deleteNotificationsByReference(req.params.id, 'service');

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── POST /:id/media/  — Upload media files ───────────────────────────────────
exports.upload_media = async (req, res) => {
  try {
    const service = await MasterService.findById(req.params.id);
    if (!service) return res.status(404).json({ detail: 'Not found.' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const mediaRecords = req.files.map(file => ({
      service: service._id,
      file_url: `/uploads/services/${file.filename}`,
      file_type: file.mimetype.startsWith('video') ? 'video' : 'image',
      file_size: file.size,
      original_filename: file.originalname
    }));

    const created = await ServiceMedia.insertMany(mediaRecords);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── DELETE /:id/media/:mediaId/  — Remove a single media file ────────────────
exports.delete_media = async (req, res) => {
  try {
    const media = await ServiceMedia.findOneAndDelete({
      _id: req.params.mediaId,
      service: req.params.id
    });
    if (!media) return res.status(404).json({ detail: 'Media not found.' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
