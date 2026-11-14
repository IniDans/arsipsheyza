'use strict';

// Error yang pesannya aman ditampilkan langsung ke pengguna.
class AppError extends Error {
  constructor(message, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

const fail = (message, code) => {
  throw new AppError(message, code);
};

module.exports = { AppError, fail };
