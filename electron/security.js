'use strict';
const crypto = require('node:crypto');

// Hash password dengan scrypt (bawaan Node, tidak butuh modul native).
// Format: scrypt$N$r$p$salt$hash (base64)
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEYLEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 6) {
    return 'Password minimal 6 karakter.';
  }
  if (password.length > 128) return 'Password maksimal 128 karakter.';
  return null;
}

module.exports = { hashPassword, verifyPassword, validatePasswordStrength };
