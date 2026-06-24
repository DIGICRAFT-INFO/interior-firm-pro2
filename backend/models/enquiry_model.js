const Enquiry = require('../models/enquiry_model');

// GET /api/v1/enquiries/
exports.list_enquiries = async (req, res) => {
  try {
    const filter = {};

    // Optional filters via query params
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { client_name: regex },
        { mobile_number: regex },
        { address: regex },
      ];
    }

    const enquiries = await Enquiry.find(filter)
      .populate('created_by', 'full_name email')
      .sort({ created_at: -1 });

    res.json(enquiries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/v1/enquiries/:id/
exports.get_enquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id).populate('created_by', 'full_name email');
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found.' });
    res.json(enquiry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/v1/enquiries/
exports.create_enquiry = async (req, res) => {
  try {
    const { client_name, mobile_number, address, enquiry_date, enquiry_time, notes, status } = req.body;

    if (!client_name || !mobile_number || !address || !enquiry_date || !enquiry_time) {
      return res.status(400).json({
        error: 'client_name, mobile_number, address, enquiry_date, and enquiry_time are required.',
      });
    }

    const enquiry = await Enquiry.create({
      client_name,
      mobile_number,
      address,
      enquiry_date: new Date(enquiry_date),
      enquiry_time,
      notes: notes || '',
      status: status || 'new',
      created_by: req.user._id,
    });

    const populated = await enquiry.populate('created_by', 'full_name email');
    res.status(201).json(populated);
  } catch (error) {
    let errorMsg = error.message;
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors || {}).map((e) => e.message);
      errorMsg = messages.join(', ') || error.message;
    }
    res.status(400).json({ error: errorMsg });
  }
};

// PATCH /api/v1/enquiries/:id/
exports.update_enquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found.' });

    const { client_name, mobile_number, address, enquiry_date, enquiry_time, notes, status } = req.body;

    if (client_name !== undefined) enquiry.client_name = client_name;
    if (mobile_number !== undefined) enquiry.mobile_number = mobile_number;
    if (address !== undefined) enquiry.address = address;
    if (enquiry_date !== undefined) enquiry.enquiry_date = new Date(enquiry_date);
    if (enquiry_time !== undefined) enquiry.enquiry_time = enquiry_time;
    if (notes !== undefined) enquiry.notes = notes;
    if (status !== undefined) enquiry.status = status;

    await enquiry.save();
    const populated = await enquiry.populate('created_by', 'full_name email');
    res.json(populated);
  } catch (error) {
    let errorMsg = error.message;
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors || {}).map((e) => e.message);
      errorMsg = messages.join(', ') || error.message;
    }
    res.status(400).json({ error: errorMsg });
  }
};

// DELETE /api/v1/enquiries/:id/
exports.delete_enquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found.' });

    await Enquiry.deleteOne({ _id: enquiry._id });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};