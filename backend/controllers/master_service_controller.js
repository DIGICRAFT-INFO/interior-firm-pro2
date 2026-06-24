const path = require('path');
const fs = require('fs');
const multer = require('multer');
const MasterService = require('../models/master_service');
const ServiceAssignment = require('../models/service_assignment');

// --- Multer Configuration ---
const uploadsDir = path.join(__dirname, '..', 'uploads', 'services');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const datePrefix = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${datePrefix}-${sanitized}`);
  },
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: jpeg, png, webp, mp4, mov, pdf.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
});

// Export multer middleware for use in routes
exports.upload = upload;

// --- Controller Functions ---

// GET /api/v1/services
// List all services. Returns only active services by default; admins can see all.
exports.list_services = async (req, res) => {
  try {
    const filter = {};
    // If user is owner or manager, allow filtering by status query param
    if (req.user && req.user.is_manager_or_above && req.query.status) {
      filter.status = req.query.status;
    } else if (!(req.user && req.user.is_manager_or_above)) {
      // Non-admin users only see active services
      filter.status = 'active';
    } else {
      // Admin with no status filter sees all
    }

    const services = await MasterService.find(filter)
      .populate('created_by', 'full_name email')
      .sort({ created_at: -1 });

    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/v1/services/:id
// Get a single service by ID, populate created_by
exports.get_service = async (req, res) => {
  try {
    const service = await MasterService.findById(req.params.id)
      .populate('created_by', 'full_name email');

    if (!service) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/v1/services
// Create a new service. Requires name and description.
exports.create_service = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required.' });
    }

    const service = await MasterService.create({
      name,
      description,
      created_by: req.user._id,
    });

    res.status(201).json(service);
  } catch (error) {
    let errorMsg = error.message;
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors || {}).map((e) => e.message);
      errorMsg = messages.join(', ') || error.message;
    }
    res.status(400).json({ error: errorMsg });
  }
};

// PUT /api/v1/services/:id
// Update service name, description, and/or status
exports.update_service = async (req, res) => {
  try {
    const service = await MasterService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    const { name, description, status } = req.body;
    if (name !== undefined) service.name = name;
    if (description !== undefined) service.description = description;
    if (status !== undefined) service.status = status;

    await service.save();
    res.json(service);
  } catch (error) {
    let errorMsg = error.message;
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors || {}).map((e) => e.message);
      errorMsg = messages.join(', ') || error.message;
    }
    res.status(400).json({ error: errorMsg });
  }
};

// DELETE /api/v1/services/:id
// Soft-delete: set status to 'inactive'
exports.delete_service = async (req, res) => {
  try {
    const service = await MasterService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    service.status = 'inactive';
    await service.save();
    res.json({ message: 'Service deleted (deactivated) successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/v1/services/:id/media
// Upload media files to a service (max 10 files, 50MB each)
exports.upload_media = async (req, res) => {
  try {
    const service = await MasterService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const mediaEntries = req.files.map((file) => {
      let file_type = 'image';
      if (file.mimetype === 'video/mp4' || file.mimetype === 'video/quicktime') {
        file_type = 'video';
      } else if (file.mimetype === 'application/pdf') {
        file_type = 'pdf';
      }

      return {
        file_url: `/uploads/services/${file.filename}`,
        file_type,
        file_size: file.size,
        original_filename: file.originalname,
      };
    });

    service.media.push(...mediaEntries);
    await service.save();

    res.status(201).json(service);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// DELETE /api/v1/services/:id/media/:mediaId
// Remove a single media entry from the service's media array
exports.delete_media = async (req, res) => {
  try {
    const service = await MasterService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    const mediaItem = service.media.id(req.params.mediaId);
    if (!mediaItem) {
      return res.status(404).json({ error: 'Media not found.' });
    }

    // Attempt to delete the physical file
    const filePath = path.join(__dirname, '..', mediaItem.file_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    service.media.pull({ _id: req.params.mediaId });
    await service.save();

    res.json({ message: 'Media deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/v1/services/:id/assign
// Assign a service to a client
exports.assign_service = async (req, res) => {
  try {
    const { client_id } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required.' });
    }

    const service = await MasterService.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    const assignment = await ServiceAssignment.create({
      service: req.params.id,
      client: client_id,
      assigned_by: req.user._id,
    });

    res.status(201).json(assignment);
  } catch (error) {
    // Handle duplicate assignment (compound unique index violation)
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Service is already assigned to this client.' });
    }
    res.status(400).json({ error: error.message });
  }
};

// DELETE /api/v1/services/:id/assign/:clientId
// Remove a service assignment for a specific client
exports.unassign_service = async (req, res) => {
  try {
    const assignment = await ServiceAssignment.findOneAndDelete({
      service: req.params.id,
      client: req.params.clientId,
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    res.json({ message: 'Service unassigned successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/v1/services/:id/assignments
// Get all assignments for a service, populate client
exports.get_service_assignments = async (req, res) => {
  try {
    const assignments = await ServiceAssignment.find({ service: req.params.id })
      .populate('client', 'full_name email phone')
      .populate('assigned_by', 'full_name email')
      .sort({ assigned_at: -1 });

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/v1/clients/:clientId/services
// Get all service assignments for a client, populate service
exports.get_client_services = async (req, res) => {
  try {
    const assignments = await ServiceAssignment.find({ client: req.params.clientId })
      .populate('service')
      .populate('assigned_by', 'full_name email')
      .sort({ assigned_at: -1 });

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
