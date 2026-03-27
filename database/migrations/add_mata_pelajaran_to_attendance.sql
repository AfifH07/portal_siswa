-- Migration: Add mata_pelajaran column to attendance table
-- Date: 2025-02-02
-- Description: Add mata_pelajaran column to attendance table to support subject-specific attendance

USE portal_siswa;

-- Add mata_pelajaran column to attendance table
ALTER TABLE attendance ADD COLUMN mata_pelajaran VARCHAR(100) NULL AFTER waktu;

-- Update the index to include mata_pelajaran
DROP INDEX idx_nisn_tanggal ON attendance;
CREATE INDEX idx_nisn_tanggal_subject ON attendance (nisn, tanggal, mata_pelajaran);

-- Add index for mata_pelajaran for better query performance
CREATE INDEX idx_mata_pelajaran ON attendance (mata_pelajaran);
