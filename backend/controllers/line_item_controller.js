const LineItemLibrary = require('../models/line_item_library');

// LineItemLibraryListCreateView -> GET
exports.get_line_items = async (req, res) => {
  try {
    // get_queryset() logic: Only active items by default
    let query = { is_active: true };

    // category query param filter (icontains logic via regex)
    if (req.query.category) {
      query.category = { $regex: req.query.category, $options: 'i' };
    }

    // search_fields logic ['name', 'category', 'description']
    if (req.query.search) {
      const searchRegex = { $regex: req.query.search, $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { category: searchRegex },
        { description: searchRegex }
      ];
    }

    // Default ordering from Meta class: ['category', 'name']
    let sortObj = { category: 1, name: 1 };
    
    // ordering_fields override ['category', 'name', 'default_rate']
    if (req.query.ordering) {
      sortObj = {};
      const fields = req.query.ordering.split(',');
      fields.forEach(field => {
        if (field.startsWith('-')) {
          sortObj[field.substring(1)] = -1;
        } else {
          sortObj[field] = 1;
        }
      });
    }

    const items = await LineItemLibrary.find(query).sort(sortObj);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LineItemLibraryListCreateView -> POST
exports.create_line_item = async (req, res) => {
  try {
    const item = await LineItemLibrary.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// LineItemLibraryDetailView -> GET
// Fetches even inactive ones as no custom get_queryset restriction is applied to detail view
exports.get_line_item_detail = async (req, res) => {
  try {
    const item = await LineItemLibrary.findById(req.params.pk);
    if (!item) return res.status(404).json({ detail: 'Not found.' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LineItemLibraryDetailView -> PUT/PATCH
exports.update_line_item = async (req, res) => {
  try {
    const item = await LineItemLibrary.findByIdAndUpdate(req.params.pk, req.body, { 
      new: true, 
      runValidators: true 
    });
    if (!item) return res.status(404).json({ detail: 'Not found.' });
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// LineItemLibraryDetailView -> DELETE
exports.delete_line_item = async (req, res) => {
  try {
    const item = await LineItemLibrary.findByIdAndDelete(req.params.pk);
    if (!item) return res.status(404).json({ detail: 'Not found.' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};