const { User } = require('../models');
const config = require('../config/config');

async function checkPermission(username, requiredRole) {
  try {
    const user = await User.findOne({
      where: { username }
    });

    if (!user) return false;

    const userRole = user.role.toLowerCase();

    if (requiredRole === config.ROLES.SUPERADMIN) {
      return userRole === config.ROLES.SUPERADMIN;
    } else if (requiredRole === config.ROLES.ADMIN) {
      return userRole === config.ROLES.SUPERADMIN || userRole === config.ROLES.ADMIN;
    } else if (requiredRole === config.ROLES.USER) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

module.exports = { checkPermission };
