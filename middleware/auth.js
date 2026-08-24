const fs = require('fs');
const path = require('path');

const dataDir = path.join(
  __dirname,
  '..',
  'data'
);

const usersFile = path.join(
  dataDir,
  'users.json'
);


// ========================================
// INIZIALIZZA STORAGE
// ========================================

if (!fs.existsSync(dataDir)) {

  fs.mkdirSync(dataDir, {
    recursive: true
  });

}

if (!fs.existsSync(usersFile)) {

  fs.writeFileSync(
    usersFile,
    '[]',
    'utf8'
  );

}


// ========================================
// LEGGI UTENTI
// ========================================

function getUsers() {

  const content =
    fs.readFileSync(
      usersFile,
      'utf8'
    );

  return JSON.parse(content);

}


// ========================================
// UTENTE CORRENTE
// ========================================

function getCurrentUser(req) {

  const userId =
    req.cookies.userId;

  if (!userId) {
    return null;
  }

  const users =
    getUsers();

  return users.find(
    user => user.id === userId
  ) || null;

}


// ========================================
// AUTENTICAZIONE
// ========================================

function requireAuth(
  req,
  res,
  next
) {

  const user =
    getCurrentUser(req);

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
