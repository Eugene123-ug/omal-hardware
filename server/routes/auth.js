const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authenticateToken, requireRole, verifyAdminPin, logAudit } = require('../middleware/auth');

// LOGIN
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ error: 'This user account is inactive. Please contact the Owner/Admin.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const ip = req.ip || req.connection.remoteAddress;
  logAudit(user.id, user.name, user.role, 'LOGIN', `User logged in from ${ip}`, ip);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    }
  });
});

// GET CURRENT USER INFO
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// VERIFY ADMIN PIN (e.g., for POS discount > 2%, stock count adjustment, price override)
router.post('/verify-pin', authenticateToken, (req, res) => {
  const { pin } = req.body;
  const result = verifyAdminPin(pin);

  if (!result.valid) {
    return res.status(400).json({ valid: false, error: result.message });
  }

  const ip = req.ip || req.connection.remoteAddress;
  logAudit(
    result.user.id,
    result.user.name,
    result.user.role,
    'PIN_VERIFICATION',
    `PIN verified by supervisor: ${result.user.name} (${result.user.role}) for action requested by ${req.user.name}`,
    ip
  );

  res.json({
    valid: true,
    approver: {
      id: result.user.id,
      name: result.user.name,
      role: result.user.role
    }
  });
});

// LIST ALL USERS (Admin & Super Admin)
router.get('/users', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, phone, status, created_at FROM users ORDER BY id ASC').all();
  res.json(users);
});

// CREATE NEW USER (Admin & Super Admin)
router.post('/users', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const { name, email, password, role, admin_pin, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required' });
  }

  // IT Manager (admin) cannot create super_admin
  if (req.user.role === 'admin' && role === 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can create another Super Admin account' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(400).json({ error: 'User with this email already exists' });
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  const info = db.prepare(`
    INSERT INTO users (name, email, password, role, admin_pin, phone, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(name, email, hash, role, admin_pin || null, phone || null);

  logAudit(req.user.id, req.user.name, req.user.role, 'USER_CREATED', `Created user ${name} (${role})`);

  res.json({ success: true, id: info.lastInsertRowid, message: 'User created successfully' });
});

// UPDATE USER
router.put('/users/:id', authenticateToken, requireRole('super_admin', 'admin'), (req, res) => {
  const targetId = req.params.id;
  const { name, role, admin_pin, phone, status, password } = req.body;

  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  // Only super admin can modify super admin accounts
  if (targetUser.role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can modify Super Admin accounts' });
  }

  let updateFields = [];
  let params = [];

  if (name) { updateFields.push('name = ?'); params.push(name); }
  if (role) { updateFields.push('role = ?'); params.push(role); }
  if (admin_pin !== undefined) { updateFields.push('admin_pin = ?'); params.push(admin_pin); }
  if (phone !== undefined) { updateFields.push('phone = ?'); params.push(phone); }
  if (status) { updateFields.push('status = ?'); params.push(status); }

  if (password && password.trim()) {
    const hash = bcrypt.hashSync(password, 10);
    updateFields.push('password = ?');
    params.push(hash);
  }

  if (updateFields.length > 0) {
    params.push(targetId);
    db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`).run(...params);
  }

  logAudit(req.user.id, req.user.name, req.user.role, 'USER_UPDATED', `Updated user ID: ${targetId} (${targetUser.name})`);

  res.json({ success: true, message: 'User updated successfully' });
});

// DELETE USER (SUPER ADMIN ONLY!)
router.delete('/users/:id', authenticateToken, requireRole('super_admin'), (req, res) => {
  const targetId = req.params.id;
  if (parseInt(targetId) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own Super Admin account' });
  }

  const targetUser = db.prepare('SELECT name, role FROM users WHERE id = ?').get(targetId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  logAudit(req.user.id, req.user.name, req.user.role, 'USER_DELETED', `Deleted user ${targetUser.name} (${targetUser.role})`);

  res.json({ success: true, message: 'User deleted permanently' });
});

module.exports = router;
