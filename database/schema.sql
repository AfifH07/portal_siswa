-- Database: portal_siswa
-- Schema untuk Portal Siswa (Migrasi dari Google Sheets)

CREATE DATABASE IF NOT EXISTS portal_siswa;
USE portal_siswa;

-- Table: users (Sheet: Users)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('superadmin', 'admin', 'user') NOT NULL DEFAULT 'user',
  name VARCHAR(100) NOT NULL,
  nisn VARCHAR(20),
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_nisn (nisn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: students (Sheet: Siswa)
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nisn VARCHAR(20) NOT NULL UNIQUE,
  nama VARCHAR(100) NOT NULL,
  kelas VARCHAR(20),
  program VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nisn (nisn),
  INDEX idx_kelas (kelas)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: attendance (Sheet: Absensi)
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nisn VARCHAR(20) NOT NULL,
  tanggal DATE NOT NULL,
  waktu VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL,
  keterangan TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nisn (nisn),
  INDEX idx_tanggal (tanggal),
  INDEX idx_nisn_tanggal (nisn, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: grades (Sheet: Nilai)
CREATE TABLE IF NOT EXISTS grades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nisn VARCHAR(20) NOT NULL,
  mata_pelajaran VARCHAR(100) NOT NULL,
  nilai DECIMAL(5,2) NOT NULL,
  semester VARCHAR(20),
  tahun_ajaran VARCHAR(20),
  jenis_ujian VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nisn (nisn),
  INDEX idx_mata_pelajaran (mata_pelajaran)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: evaluations (Sheet: Evaluasi)
CREATE TABLE IF NOT EXISTS evaluations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nisn VARCHAR(20) NOT NULL,
  tanggal DATE NOT NULL,
  jenis VARCHAR(50) NOT NULL,
  evaluator VARCHAR(50) NOT NULL,
  nama_evaluator VARCHAR(100),
  nama_siswa VARCHAR(100),
  summary TEXT,
  foto_url TEXT,
  tindak_lanjut TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nisn (nisn),
  INDEX idx_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: reset_tokens (Sheet: ResetPassword)
CREATE TABLE IF NOT EXISTS reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  token VARCHAR(10) NOT NULL,
  status ENUM('Active', 'Used') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_token (token),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: schedules (Sheet: Jadwal)
CREATE TABLE IF NOT EXISTS schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  kelas VARCHAR(20) NOT NULL,
  hari VARCHAR(20) NOT NULL,
  jam VARCHAR(20) NOT NULL,
  mata_pelajaran VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_kelas (kelas)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: attendance_draft (Sheet: AttendanceDraft)
CREATE TABLE IF NOT EXISTS attendance_draft (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  kelas VARCHAR(20) NOT NULL,
  tanggal DATE NOT NULL,
  mata_pelajaran VARCHAR(100) NOT NULL,
  data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username_kelas (username, kelas)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default superadmin user
-- Password: admin123 (hashed)
INSERT INTO users (username, password, role, name, email) 
VALUES ('admin', '$2a$10$YourHashedPasswordHere', 'superadmin', 'Super Admin', 'admin@sekolah.id')
ON DUPLICATE KEY UPDATE username=username;

-- Insert sample data for testing (optional)
-- INSERT INTO students (nisn, nama, kelas, program) VALUES ('1234567890', 'Contoh Siswa', 'X-A', 'IPA');
