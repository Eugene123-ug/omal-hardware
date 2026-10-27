const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { ApiResponse } = require('../../common/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { getUserPermissions } = require('../../utils/security');
const { ROLE_PERMISSIONS_MAP } = require('../../database/seeds/02_permissions_seed');

// GET /api/v1/permissions (List all system permissions)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const permissions = await db('permissions').select('*').orderBy('module', 'asc').orderBy('name', 'asc');
    return ApiResponse.success(res, permissions, 'Permissions retrieved');
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/permissions/matrix (Get role permissions matrix)
router.get('/matrix', authenticateToken, async (req, res, next) => {
  try {
    const userPermissions = await getUserPermissions(req.user.id, req.user.role);

    return ApiResponse.success(res, {
      user_id: req.user.id,
      role: req.user.role,
      permissions: userPermissions,
      role_matrix: req.user.role === 'super_admin' ? ROLE_PERMISSIONS_MAP : undefined
    }, 'Role permissions matrix retrieved');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
