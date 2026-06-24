const Enquiry = require('../models/enquiry_model.js');

// GET /api/v1/enquiries/
exports.list_enquiries = async (req, res) => {
  try {
    const filter = {};

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
    console.error('❌ list_enquiries error:', error);
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
    console.error('❌ get_enquiry error:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/v1/enquiries/
exports.create_enquiry = async (req, res) => {
  try {
    console.log('📥 create_enquiry body:', req.body);
    console.log('👤 req.user:', req.user ? { id: req.user._id, role: req.user.role } : 'undefined');

    const { client_name, mobile_number, address, enquiry_date, enquiry_time, notes, status } = req.body;

    if (!client_name || !mobile_number || !address || !enquiry_date || !enquiry_time) {
      return res.status(400).json({
        error: 'client_name, mobile_number, address, enquiry_date, and enquiry_time are required.',
      });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'User not authenticated.' });
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

    await enquiry.populate('created_by', 'full_name email');
    res.status(201).json(enquiry);
  } catch (error) {
    console.error('❌ create_enquiry error:', error);
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
    await enquiry.populate('created_by', 'full_name email');
    res.json(enquiry);
  } catch (error) {
    console.error('❌ update_enquiry error:', error);
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
    console.error('❌ delete_enquiry error:', error);
    res.status(500).json({ error: error.message });
  }
};