const { validate: validateUUID } = require('uuid');

function validateUUIDFormat(id) {
  if (typeof id !== 'string' || !validateUUID(id)) {
    throw createError(400, `Invalid UUID format: ${id}`);
  }
}

module.exports = validateUUIDFormat;