const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { ApiResponse, parsePagination } = require('../../common/response');
const { authenticateToken, requirePermission, logAudit } = require('../../middleware/auth');

/**
 * GET /api/v1/approvals
 * Centralized queue for pending and historical authorization requests
 */
router.get('/', authenticateToken, requirePermission('approvals.view'), async (req, res, next) => {
  try {
    const { status, request_type, page, limit, offset } = parsePagination(req.query, 50);

    let query = db('approval_requests as ar')
      .join('users as req_u', 'ar.requester_id', 'req_u.id')
      .leftJoin('users as app_u', 'ar.approver_id', 'app_u.id')
      .select(
        'ar.*',
        'req_u.name as requester_name',
        'req_u.role as requester_role',
        'app_u.name as approver_name'
      );

    if (status && status !== 'All') {
      query = query.where('ar.status', status);
    }
    if (request_type && request_type !== 'All') {
      query = query.where('ar.request_type', request_type);
    }

    const [totalRes, requests] = await Promise.all([
      query.clone().count('ar.id as total').first(),
      query.clone().orderBy('ar.id', 'desc').limit(limit).offset(offset)
    ]);

    return ApiResponse.paginated(res, requests, parseInt(totalRes.total), page, limit, 'Approval requests retrieved');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/approvals
 * Enqueue a new authorization request
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { request_type, reference_id, reference_table, amount, reason, metadata } = req.body;

    if (!request_type || !reason) {
      return ApiResponse.error(res, 'request_type and reason are required', 400, 'BAD_REQUEST');
    }

    const [created] = await db('approval_requests').insert({
      request_type,
      reference_id: reference_id || null,
      reference_table: reference_table || null,
      amount: amount ? parseFloat(amount) : null,
      reason: reason.trim(),
      requester_id: req.user.id,
      status: 'pending',
      metadata: metadata ? JSON.stringify(metadata) : null
    }).returning('*');

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      'APPROVAL_REQUESTED',
      `Requested approval for ${request_type}: ${reason}`
    );

    return ApiResponse.success(res, created, 'Approval request submitted to queue', 201);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/approvals/:id/decide
 * Authorize or reject a queued request
 * STRICT ENFORCEMENT: Separation of duties prevents requester from approving their own request.
 */
router.post('/:id/decide', authenticateToken, requirePermission('approvals.decide'), async (req, res, next) => {
  try {
    const requestId = parseInt(req.params.id);
    const { action, decision_notes = '' } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return ApiResponse.error(res, 'Action must be either "approve" or "reject"', 400, 'BAD_REQUEST');
    }

    const request = await db('approval_requests').where({ id: requestId }).first();
    if (!request) {
      return ApiResponse.error(res, 'Approval request not found', 404, 'NOT_FOUND');
    }

    if (request.status !== 'pending') {
      return ApiResponse.error(res, `Request has already been decided (${request.status})`, 400, 'ALREADY_DECIDED');
    }

    // Separation of Duties: Requester cannot approve or reject their own request
    if (req.user.id === request.requester_id) {
      return ApiResponse.error(
        res,
        'Separation of duties violation: You cannot decide or approve a request that you submitted yourself.',
        403,
        'FORBIDDEN_SELF_APPROVAL'
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const [updated] = await db('approval_requests')
      .where({ id: requestId })
      .update({
        status: newStatus,
        approver_id: req.user.id,
        decision_notes: decision_notes.trim(),
        decided_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // Cascade decision to target table if applicable
    if (request.request_type === 'EXPENSE' && request.reference_id && request.reference_table === 'expenses') {
      await db('expenses')
        .where({ id: request.reference_id })
        .update({
          approval_status: newStatus,
          approved_by_id: req.user.id,
          approved_at: new Date(),
          rejection_reason: action === 'reject' ? decision_notes : null,
          updated_at: new Date()
        });
    }

    await logAudit(
      req.user.id,
      req.user.name,
      req.user.role,
      `APPROVAL_${newStatus.toUpperCase()}`,
      `${newStatus.toUpperCase()} ${request.request_type} request #${requestId}. Reason/Notes: "${decision_notes}"`
    );

    return ApiResponse.success(res, updated, `Request #${requestId} ${newStatus} successfully`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
