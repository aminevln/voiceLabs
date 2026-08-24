const fs = require('fs');
const path = require('path');

const usersFile = path.join(
  __dirname,
  '..',
  'data',
  'users.json'
);

function getUsers() {
  const content = fs.readFileSync(usersFile, 'utf8');
  return JSON.parse(content);
}

function getCurrentUser(req) {

  const userId = req.cookies.userId;

  if (!userId) {
    return null;
  }

  const users = getUsers();

  return users.find(
    user => user.id === userId
  ) || null;
}

function requireAuth(req, res, next) {

  const user = getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      error: 'Non autenticato.'
    });
  }

  req.user = user;

  next();
}

module.exports = {
  getCurrentUser,
  requireAuth
};
