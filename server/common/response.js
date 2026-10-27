/**
 * Consistent API Response and Pagination Standards
 */

class ApiResponse {
  /**
   * Standard Success Response
   */
  static success(res, data = null, message = 'Operation successful', statusCode = 200, meta = undefined) {
    const payload = {
      success: true,
      statusCode,
      message,
      data
    };

    if (meta !== undefined) {
      payload.meta = meta;
    }

    return res.status(statusCode).json(payload);
  }

  /**
   * Standard Paginated Response
   */
  static paginated(res, items, total, page = 1, limit = 20, message = 'Records retrieved successfully') {
    const totalPages = Math.ceil(total / limit);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message,
      data: items,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  }

  /**
   * Standard Error Response
   */
  static error(res, message = 'An error occurred', statusCode = 500, errorType = 'INTERNAL_ERROR', details = null) {
    const payload = {
      success: false,
      statusCode,
      error: {
        type: errorType,
        message,
        ...(details ? { details } : {})
      }
    };

    return res.status(statusCode).json(payload);
  }
}

/**
 * Standard query parser for pagination
 */
function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || defaultLimit));
  const offset = (page - 1) * limit;
  const sortBy = query.sortBy || 'created_at';
  const sortOrder = (query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

  return { page, limit, offset, sortBy, sortOrder };
}

module.exports = {
  ApiResponse,
  parsePagination
};
