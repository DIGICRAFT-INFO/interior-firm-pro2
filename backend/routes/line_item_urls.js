const express = require('express');
const router = express.Router();
const { 
  get_line_items, 
  create_line_item, 
  get_line_item_detail, 
  update_line_item, 
  delete_line_item 
} = require('../controllers/line_item_controller');

const { is_authenticated, is_owner } = require('../middleware/permissions'); // Note: Adjust path to your auth middleware

// -------------------------------------------------------------
// Django path: '' (LineItemLibraryListCreateView)
// GET: IsAuthenticated | POST: IsOwner
// -------------------------------------------------------------
router.route('/')
  .get(is_authenticated, get_line_items)
  .post(is_authenticated, is_owner, create_line_item);

// -------------------------------------------------------------
// Django path: '<uuid:pk>/' (LineItemLibraryDetailView)
// All Methods (GET, PUT, PATCH, DELETE): IsOwner
// -------------------------------------------------------------
router.route('/:pk/')
  .get(is_authenticated, is_owner, get_line_item_detail)
  .put(is_authenticated, is_owner, update_line_item)
  .patch(is_authenticated, is_owner, update_line_item)
  .delete(is_authenticated, is_owner, delete_line_item);

module.exports = router;