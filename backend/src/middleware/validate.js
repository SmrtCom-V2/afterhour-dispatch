/**
 * Request validation middleware backed by zod schemas.
 */

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const fieldErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));

      return res.status(400).json({
        error: 'Invalid request data',
        fields: fieldErrors,
      });
    }

    req[source] = result.data;
    next();
  };
}

export default { validate };
