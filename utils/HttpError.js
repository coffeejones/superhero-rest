class HttpError extends Error {
  constructor(status, message, cause) {
    super(message, { cause });
    this.status = status;
  }
}

module.exports = HttpError;
