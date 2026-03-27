const sequelize = require('../../backend/config/database');

async function runMigration() {
  try {
    console.log('Starting migration: Add mata_pelajaran column to attendance table...');

    await sequelize.query(`
      ALTER TABLE attendance ADD COLUMN mata_pelajaran VARCHAR(100) NULL AFTER waktu
    `);

    console.log('Added mata_pelajaran column to attendance table');

    await sequelize.query(`
      DROP INDEX idx_nisn_tanggal ON attendance
    `);

    console.log('Dropped old index idx_nisn_tanggal');

    await sequelize.query(`
      CREATE INDEX idx_nisn_tanggal_subject ON attendance (nisn, tanggal, mata_pelajaran)
    `);

    console.log('Created new index idx_nisn_tanggal_subject');

    await sequelize.query(`
      CREATE INDEX idx_mata_pelajaran ON attendance (mata_pelajaran)
    `);

    console.log('Created index idx_mata_pelajaran');

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('Column mata_pelajaran already exists. Skipping migration.');
      process.exit(0);
    } else {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  }
}

runMigration();
