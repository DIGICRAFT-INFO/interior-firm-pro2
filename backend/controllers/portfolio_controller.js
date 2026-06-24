const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Portfolio = require('../models/Portfolio');
const pdfEngine = require('../services/pdf_engine_service');
const emailService = require('../services/email_service');
const whatsappService = require('../services/whatsapp_service');

// --- Multer Configuration (mirrors services/master_service_controller pattern) ---
const uploadsDir = path.join(__dirname, '..', 'uploads', 'portfolio');
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

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files (jpeg, png, webp, avif) are allowed.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per image
    files: 20,
  },
});

exports.upload = upload;

// --- Multer Configuration for PDF documents ---
const docsDir = path.join(__dirname, '..', 'uploads', 'portfolio_docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, docsDir);
  },
  filename: (req, file, cb) => {
    const datePrefix = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${datePrefix}-${sanitized}`);
  },
});

const docFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only PDF files are allowed.'));
};

const uploadDocs = multer({
  storage: docStorage,
  fileFilter: docFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per PDF
    files: 10,
  },
});

exports.uploadDocs = uploadDocs;

// --- Controller Functions ---

// GET /api/v1/portfolio
exports.list_portfolios = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.project) filter.project = req.query.project;

    const portfolios = await Portfolio.find(filter)
      .populate({ path: 'project', populate: { path: 'client' } })
      .sort({ created_at: -1 });

    res.json(portfolios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/v1/portfolio/:id
exports.get_portfolio_detail = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id)
      .populate({ path: 'project', populate: { path: 'client' } });
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/v1/portfolio
// Create a new portfolio entry (optionally with project link). Images added separately via /:id/images
exports.create_portfolio = async (req, res) => {
  try {
    const { title, description, category, project, status } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required.' });

    const portfolio = await Portfolio.create({
      title,
      description: description || '',
      category: category || 'other',
      project: project || null,
      status: status || 'draft',
      created_by: req.user ? req.user._id : null,
    });

    res.status(201).json(portfolio);
  } catch (error) {
    let errorMsg = error.message;
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors || {}).map((e) => e.message);
      errorMsg = messages.join(', ') || error.message;
    }
    res.status(400).json({ error: errorMsg });
  }
};

// PUT /api/v1/portfolio/:id
exports.update_portfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });

    const { title, description, category, project, status } = req.body;
    if (title !== undefined) portfolio.title = title;
    if (description !== undefined) portfolio.description = description;
    if (category !== undefined) portfolio.category = category;
    if (project !== undefined) portfolio.project = project;
    if (status !== undefined) portfolio.status = status;

    await portfolio.save();
    res.json(portfolio);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// DELETE /api/v1/portfolio/:id
exports.delete_portfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });

    // Clean up image files on disk
    (portfolio.images || []).forEach((img) => {
      const filePath = path.join(__dirname, '..', img.file_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    // Clean up document files on disk
    (portfolio.documents || []).forEach((doc) => {
      const filePath = path.join(__dirname, '..', doc.file_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    await Portfolio.deleteOne({ _id: portfolio._id });
    res.json({ message: 'Portfolio deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/v1/portfolio/:id/images
// Upload work images (max 20 per request, 20MB each)
exports.upload_images = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded.' });
    }

    const captions = Array.isArray(req.body.captions) ? req.body.captions : [];
    const startOrder = portfolio.images.length;

    const newImages = req.files.map((file, idx) => ({
      file_url: `/uploads/portfolio/${file.filename}`,
      caption: captions[idx] || '',
      file_size: file.size,
      original_filename: file.originalname,
      sort_order: startOrder + idx,
    }));

    portfolio.images.push(...newImages);
    await portfolio.save();

    res.status(201).json(portfolio);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// DELETE /api/v1/portfolio/:id/images/:imageId
exports.delete_image = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });

    const image = portfolio.images.id(req.params.imageId);
    if (!image) return res.status(404).json({ error: 'Image not found.' });

    const filePath = path.join(__dirname, '..', image.file_url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    portfolio.images.pull({ _id: req.params.imageId });
    await portfolio.save();

    res.json({ message: 'Image deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/v1/portfolio/:id/documents
// Upload PDF documents (max 10 per request, 25MB each)
exports.upload_documents = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No PDF files uploaded.' });
    }

    const titles = Array.isArray(req.body.titles) ? req.body.titles : [];

    const newDocs = req.files.map((file, idx) => ({
      file_url: `/uploads/portfolio_docs/${file.filename}`,
      title: titles[idx] || file.originalname,
      file_size: file.size,
      original_filename: file.originalname,
    }));

    portfolio.documents.push(...newDocs);
    await portfolio.save();

    res.status(201).json(portfolio);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// DELETE /api/v1/portfolio/:id/documents/:docId
exports.delete_document = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });

    const doc = portfolio.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    const filePath = path.join(__dirname, '..', doc.file_url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    portfolio.documents.pull({ _id: req.params.docId });
    await portfolio.save();

    res.json({ message: 'Document deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/v1/portfolio/:id/pdf
exports.get_portfolio_pdf = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id)
      .populate({ path: 'project', populate: { path: 'client' } });
    if (!portfolio) return res.status(404).json({ detail: 'Not found.' });

    const pdfBuffer = await pdfEngine.render_portfolio_pdf(portfolio);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${portfolio.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/v1/portfolio/:id/send
// body: { channel: 'email' | 'whatsapp', recipient_email?, recipient_phone? }
// Falls back to the linked project's client contact info if recipient not provided.
exports.send_portfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id)
      .populate({ path: 'project', populate: { path: 'client' } });
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });

    const { channel, recipient_email, recipient_phone } = req.body;
    const client = portfolio.project && portfolio.project.client;

    if (channel === 'email') {
      const email = recipient_email || (client && client.email);
      if (!email) return res.status(400).json({ error: 'No recipient email available.' });

      const pdfBuffer = await pdfEngine.render_portfolio_pdf(portfolio);
      const result = await emailService.send_portfolio_email(portfolio, email, pdfBuffer);
      if (!result.success) return res.status(502).json({ error: result.error });
      return res.json({ message: `Portfolio emailed to ${email}` });
    }

    if (channel === 'whatsapp') {
      const phone = recipient_phone || (client && client.phone);
      if (!phone) return res.status(400).json({ error: 'No recipient phone available.' });

      const result = await whatsappService.send_portfolio_whatsapp(portfolio, phone);
      if (!result.success) return res.status(502).json({ error: result.error });
      return res.json({ message: `Portfolio sent via WhatsApp to ${phone}` });
    }

    return res.status(400).json({ error: "channel must be 'email' or 'whatsapp'." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};