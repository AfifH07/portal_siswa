const { verifyToken } = require('../utils/auth');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token tidak ditemukan'
    });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid atau kadaluarsa'
    });
  }

  req.user = decoded;
  next();
}

module.exports = { authMiddleware };
