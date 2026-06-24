const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generate_tokens = (id) => {
  const access = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refresh = jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { access, refresh };
};

// TokenObtainPairView (Login)
exports.token_obtain_pair = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (user && (await user.check_password(password))) {
    // 🚀 SECURITY CHECK: Agar user active nahi hai toh token mat do
    if (!user.is_active) {
      return res.status(403).json({ detail: 'Your account is pending approval from the Manager.' });
    }

    const tokens = generate_tokens(user._id);
    res.json({
      ...tokens,
      user: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      }
    });
  } else {
    res.status(401).json({ detail: 'No active account found with the given credentials' });
  }
};

// RegisterView
exports.register = async (req, res) => {
  const { email, full_name, role, password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ password: ['Ensure this field has at least 8 characters.'] });
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ email: ['User with this email already exists.'] });
  }

  // default property model se is_active: false utha legi
  const user = await User.create({ email, full_name, role, password });
  res.status(201).json({
    id: user._id, 
    email: user.email, 
    full_name: user.full_name, 
    role: user.role,
    detail: 'Registration successful. Waiting for Manager approval.'
  });
};

// MeView
exports.me = async (req, res) => {
  res.json({
    id: req.user._id,
    email: req.user.email,
    full_name: req.user.full_name,
    role: req.user.role,
    is_active: req.user.is_active,
    created_at: req.user.created_at
  });
};

// ChangePasswordView
exports.change_password = async (req, res) => {
  const { old_password, new_password } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.check_password(old_password))) {
    return res.status(400).json({ old_password: ['Old password is incorrect.'] });
  }
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ new_password: ['Ensure this field has at least 8 characters.'] });
  }

  user.password = new_password;
  await user.save();
  res.json({ detail: 'Password changed successfully.' });
};

// TokenRefreshView
exports.token_refresh = async (req, res) => {
  const { refresh } = req.body;
  if (!refresh) {
    return res.status(400).json({ detail: 'Refresh token is required.' });
  }

  try {
    const decoded = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ detail: 'User inactive, pending approval or not found.' });
    }

    const access = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    res.json({ access });
  } catch (err) {
    res.status(401).json({ detail: 'Invalid or expired refresh token.' });
  }
};

// LogoutView
exports.logout = (req, res) => {
  res.json({ detail: 'Logged out successfully.' });
};

// UserListView (Sirf unhe dikhayega jo already approved hain)
exports.user_list = async (req, res) => {
  const users = await User.find({ is_active: true }).sort('full_name').select('-password');
  res.json(users);
};


// ==========================================
// 👑 NEW MANAGER APPROVAL SYSTEM CONTROLLERS
// ==========================================

// 1. Get Pending Users List (Sirf `is_active: false` waale users laayega)
exports.get_pending_users = async (req, res) => {
  try {
    const pendingUsers = await User.find({ is_active: false }).sort('-created_at');
    res.json(pendingUsers);
  } catch (err) {
    res.status(500).json({ detail: 'Internal server error.' });
  }
};

// 1.5. Get All Active/Approved Users (Sirf `is_active: true` waale users laayega)
exports.get_all_active_users = async (req, res) => {
  try {
    const activeUsers = await User.find({ is_active: true }).sort('full_name').select('-password');
    res.json(activeUsers);
  } catch (err) {
    res.status(500).json({ detail: 'Internal server error.' });
  }
};

// 2. Approve User (User ko active `true` kardega)
exports.approve_user = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ detail: 'User not found.' });
    }

    user.is_active = true;
    await user.save();

    res.json({ detail: `User ${user.full_name} has been approved successfully.` });
  } catch (err) {
    res.status(500).json({ detail: 'Server error during approval.' });
  }
};

// 3. Reject / Delete User (User ko database se permanent uda dega)
exports.reject_user = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ detail: 'User not found.' });
    }

    res.json({ detail: 'User request rejected and deleted successfully.' });
  } catch (err) {
    res.status(500).json({ detail: 'Server error during rejection.' });
  }
};

// 4. Deactivate / Revoke User Access (is_active ko false kardega - user login nahi kar sakta)
exports.deactivate_user = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ detail: 'User not found.' });
    }

    user.is_active = false;
    await user.save();

    res.json({ detail: `User ${user.full_name}'s access has been revoked. They can no longer login.` });
  } catch (err) {
    res.status(500).json({ detail: 'Server error during deactivation.' });
  }
};