const { v4: uuidv4 } = require('uuid');

function normalizeNISN(nisn) {
  if (!nisn) return '';
  const nisnStr = String(nisn).trim();
  if (nisnStr.charAt(0) === "'") nisnStr = nisnStr.substring(1);
  return nisnStr;
}

function generateToken() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateUUID() {
  return uuidv4();
}

module.exports = {
  normalizeNISN,
  generateToken,
  generateUUID
};
