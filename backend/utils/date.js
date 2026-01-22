const moment = require('moment');

function formatDate(date) {
  if (!date) return '';
  return moment(date).format('DD/MM/YYYY');
}

function formatDatabaseDate(date) {
  if (!date) return '';
  return moment(date).format('YYYY-MM-DD');
}

function getTodayDateString() {
  return moment().format('DD/MM/YYYY');
}

function getTodayDatabaseDateString() {
  return moment().format('YYYY-MM-DD');
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Try dd/MM/yyyy format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const date = moment(`${parts[2]}-${parts[1]}-${parts[0]}`, 'YYYY-MM-DD');
      return date.isValid() ? date.toDate() : null;
    }
  }
  
  // Try ISO format
  const date = moment(dateStr);
  return date.isValid() ? date.toDate() : null;
}

function getStartOfMonth() {
  return moment().startOf('month').toDate();
}

function getEndOfMonth() {
  return moment().endOf('month').toDate();
}

module.exports = {
  formatDate,
  formatDatabaseDate,
  getTodayDateString,
  getTodayDatabaseDateString,
  parseDate,
  getStartOfMonth,
  getEndOfMonth
};
