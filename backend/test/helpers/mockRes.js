function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

function mockMongooseSession(mongoose) {
  const origStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    startTransaction() {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: async () => {},
  });
  return () => {
    mongoose.startSession = origStartSession;
  };
}

module.exports = { mockRes, mockMongooseSession };
