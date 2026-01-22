const { User, Student, ResetToken } = require('../models');
const { comparePassword, generateToken, hashPassword } = require('../utils/auth');
const { normalizeNISN, generateToken: generateResetToken } = require('../utils/helpers');
const { formatDatabaseDate, getTodayDatabaseDateString } = require('../utils/date');
const config = require('../config/config');

async function login(req, res) {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi!'
      });
    }

    const user = await User.findOne({
      where: { username: username.trim() }
    });

    if (!user || !comparePassword(password, user.password)) {
      return res.status(401).json({
        success: false,
        message: 'Username atau Password salah!'
      });
    }

    const normalizedNISN = normalizeNISN(user.nisn);
    let kelas = '-';
    let program = '-';

    if (user.role === config.ROLES.USER && normalizedNISN) {
      const student = await Student.findOne({
        where: { nisn: normalizedNISN }
      });

      if (student) {
        kelas = student.kelas || '-';
        program = student.program || '-';
      }
    }

    const token = generateToken({
      username: user.username,
      role: user.role,
      name: user.name
    });

    res.json({
      success: true,
      token,
      username: user.username,
      name: user.name,
      role: user.role,
      nisn: normalizedNISN,
      email: user.email,
      kelas,
      program
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem'
    });
  }
}

async function changePassword(req, res) {
  try {
    const { username, oldPassword, newPassword } = req.body;

    if (!username || !oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak lengkap!'
      });
    }

    const user = await User.findOne({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Username tidak ditemukan!'
      });
    }

    if (!comparePassword(oldPassword, user.password)) {
      return res.status(400).json({
        success: false,
        message: 'Password lama salah!'
      });
    }

    await user.update({ password: hashPassword(newPassword) });

    res.json({
      success: true,
      message: 'Password berhasil diubah!'
    });
  } catch (error) {
    console.error('Error in changePassword:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan: ' + error.message
    });
  }
}

async function requestPasswordReset(req, res) {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username wajib diisi!'
      });
    }

    const user = await User.findOne({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Username tidak ditemukan!'
      });
    }

    const token = generateResetToken();

    await ResetToken.create({
      username,
      token,
      status: 'Active'
    });

    res.json({
      success: true,
      message: 'Token reset password telah dibuat!',
      token,
      name: user.name
    });
  } catch (error) {
    console.error('Error in requestPasswordReset:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan: ' + error.message
    });
  }
}

async function resetPassword(req, res) {
  try {
    const { username, token, newPassword } = req.body;

    if (!username || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Data tidak lengkap!'
      });
    }

    const resetToken = await ResetToken.findOne({
      where: {
        username,
        token,
        status: 'Active'
      }
    });

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Token tidak valid atau sudah digunakan!'
      });
    }

    const createdAt = new Date(resetToken.created_at);
    const now = new Date();
    const diffMinutes = (now - createdAt) / 1000 / 60;

    if (diffMinutes > config.TOKEN_EXPIRY_MINUTES) {
      return res.status(400).json({
        success: false,
        message: 'Token sudah kadaluarsa!'
      });
    }

    const user = await User.findOne({
      where: { username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Username tidak ditemukan!'
      });
    }

    await user.update({ password: hashPassword(newPassword) });
    await resetToken.update({ status: 'Used' });

    res.json({
      success: true,
      message: 'Password berhasil direset!'
    });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan: ' + error.message
    });
  }
}

module.exports = {
  login,
  changePassword,
  requestPasswordReset,
  resetPassword
};
