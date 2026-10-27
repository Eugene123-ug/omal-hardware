const { ApiResponse } = require('../common/response');

/**
 * Validates request body against a Zod schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message
      }));
      return ApiResponse.error(res, 'Validation failed for request payload', 400, 'VALIDATION_ERROR', issues);
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validates request query parameters against a Zod schema
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const issues = result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message
      }));
      return ApiResponse.error(res, 'Validation failed for query parameters', 400, 'QUERY_VALIDATION_ERROR', issues);
    }
    req.query = result.data;
    next();
  };
}

module.exports = {
  validateBody,
  validateQuery
};
