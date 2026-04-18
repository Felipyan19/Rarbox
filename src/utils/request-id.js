const { v4: uuidv4 } = require('uuid');

const addRequestId = async (request) => {
  request.id = uuidv4();
};

module.exports = addRequestId;
