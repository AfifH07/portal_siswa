const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

const uploadDir = path.resolve(config.UPLOAD.PATH);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (config.UPLOAD.ALLOWED_EXTENSIONS.includes(ext.substring(1))) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak diizinkan. Hanya: ' + config.UPLOAD.ALLOWED_EXTENSIONS.join(', ')));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.UPLOAD.MAX_SIZE
  }
});

module.exports = upload;
