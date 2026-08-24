require('dotenv').config();

const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const cookieParser = require('cookie-parser');
const { getCurrentUser, requireAuth } = require('./middleware/auth');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

app.get('/test', (req, res) => {
  res.json({
    ok: true,
    message: 'Server funzionante!',
    voiceId: process.env.VOICE_ID ? 'VOICE_ID presente' : 'VOICE_ID mancante',
    apiKey: process.env.ELEVENLABS_API_KEY
      ? 'API key presente'
      : 'API key mancante'
  });
});

app.get('/voices', async (req, res) => {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: errorText
      });
    }

    const data = await response.json();

    const voices = data.voices.map(voice => ({
      name: voice.name,
      voice_id: voice.voice_id,
      category: voice.category
    }));

    res.json({
      count: voices.length,
      voices
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

app.post('/generate', requireAuth, async (req, res) => {

  try {

    const { text } = req.body;

    // ========================================
    // VALIDAZIONE
    // ========================================

    if (!text || !text.trim()) {

      return res.status(400).json({
        error: 'Il testo è obbligatorio.'
      });

    }

    if (text.length > 5000) {

      return res.status(400).json({
        error: 'Il testo non può superare 5000 caratteri.'
      });

    }


    // ========================================
    // UTENTE
    // ========================================

    const user = req.user;

    const voiceId = user.voiceId;


    console.log('========================================');
    console.log('Generazione audio');
    console.log('Utente:', user.email);
    console.log('Voice ID:', voiceId);
    console.log('Testo:', text);
    console.log('========================================');


    // ========================================
    // ELEVENLABS
    // ========================================

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',

        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({

          text: text,

          model_id: 'eleven_multilingual_v2',

          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }

        })
      }
    );


    // ========================================
    // ERRORE ELEVENLABS
    // ========================================

    if (!response.ok) {

      const errorText = await response.text();

      console.error(
        'ElevenLabs error:',
        errorText
      );

      return res.status(response.status).json({
        error: errorText
      });

    }


    // ========================================
    // AUDIO
    // ========================================

    const audioBuffer = Buffer.from(
      await response.arrayBuffer()
    );


    // ========================================
    // CREA ID GENERAZIONE
    // ========================================

    const generationId =
      `gen_${crypto.randomUUID()}`;


    const audioFileName =
      `${generationId}.mp3`;


    // ========================================
    // CARTELLA AUDIO
    // ========================================

    const fs = require('fs');
    const path = require('path');

    const audioDirectory =
      path.join(__dirname, 'audio');

    if (!fs.existsSync(audioDirectory)) {

      fs.mkdirSync(audioDirectory, {
        recursive: true
      });

    }


    // ========================================
    // SALVA MP3
    // ========================================

    const audioPath =
      path.join(
        audioDirectory,
        audioFileName
      );

    fs.writeFileSync(
      audioPath,
      audioBuffer
    );

    const generationsFile =
      path.join(
        __dirname,
        'data',
        'generations.json'
      );


    let generations = [];

    try {

      const fileContent =
        fs.readFileSync(
          generationsFile,
          'utf8'
        );

      generations =
        JSON.parse(fileContent);

    } catch (error) {

      console.error(
        'Errore lettura generations.json:',
        error
      );

      return res.status(500).json({
        error: 'Errore nella lettura delle generazioni.'
      });

    }


    // ========================================
    // CREA RECORD
    // ========================================

    const generation = {

      id: generationId,

      userId: user.id,

      text: text,

      audioFile: audioFileName,

      voiceId: voiceId,

      createdAt:
        new Date().toISOString()

    };


    generations.push(generation);


    // ========================================
    // SALVA JSON
    // ========================================

    fs.writeFileSync(

      generationsFile,

      JSON.stringify(
        generations,
        null,
        2
      ),

      'utf8'

    );


    console.log(
      'Generazione salvata:',
      generationId
    );


    // ========================================
    // RESTITUISCI AUDIO
    // ========================================

    res.setHeader(
      'Content-Type',
      'audio/mpeg'
    );

    res.setHeader(
      'Content-Length',
      audioBuffer.length
    );

    res.send(audioBuffer);


  } catch (error) {

    console.error(
      'Errore generazione:',
      error
    );

    res.status(500).json({
      error: error.message
    });

  }

});

app.get('/auth/google/test', (req, res) => {
  res.json({
    ok: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID
      ? 'Google Client ID presente'
      : 'Google Client ID mancante',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET
      ? 'Google Client Secret presente'
      : 'Google Client Secret mancante',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'Redirect URI mancante'
  });
});

app.get('/auth/google', (req, res) => {

  const authUrl = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'email',
      'profile'
    ],
    prompt: 'select_account'
  });

  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {

  try {

    const { code } = req.query;

    if (!code) {
      return res.status(400).send('Codice OAuth mancante.');
    }

    // Scambia il codice ricevuto da Google
    // con i token
    const { tokens } = await googleClient.getToken(code);

    // Imposta i token sul client
    googleClient.setCredentials(tokens);

    // Verifica l'identità dell'utente
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    const fs = require('fs');
    const path = require('path');

    const usersFile = path.join(__dirname, 'data', 'users.json');

    let users = [];

    try {
      const fileContent = fs.readFileSync(usersFile, 'utf8');
      users = JSON.parse(fileContent);
    } catch (error) {
      console.error('Errore lettura users.json:', error);
      return res.status(500).send('Errore nella lettura degli utenti.');
    }

    let user = users.find(
      u => u.googleId === payload.sub
    );

    if (!user) {
      user = {
        id: `user_${payload.sub}`,
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture || null,
        voiceId: process.env.VOICE_ID,
        createdAt: new Date().toISOString()
      };

      users.push(user);

      fs.writeFileSync(
        usersFile,
        JSON.stringify(users, null, 2),
        'utf8'
      );

      console.log('Nuovo utente creato:', user.email);

    } else {
      console.log('Utente esistente:', user.email);
    }

    console.log('Utente Google autenticato:');
    console.log({
      id: payload.sub,
      name: payload.name,
      email: payload.email
    });

    res.cookie('userId', user.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 30
    });

    res.redirect('/');

  } catch (error) {

    console.error('Google OAuth error:', error);

    res.status(500).send(
      'Errore durante il login Google.'
    );
  }

});

app.get('/api/me', requireAuth, (req, res) => {

  res.json({
    ok: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      picture: req.user.picture,
      voiceId: req.user.voiceId
    }
  });

});

app.get('/api/generations', requireAuth, (req, res) => {

  try {

    const fs = require('fs');
    const path = require('path');

    const generationsFile = path.join(
      __dirname,
      'data',
      'generations.json'
    );

    const fileContent = fs.readFileSync(
      generationsFile,
      'utf8'
    );

    const generations = JSON.parse(fileContent);


    // Solo le generazioni dell'utente loggato
    const userGenerations = generations.filter(
      generation =>
        generation.userId === req.user.id
    );


    // Più recenti prima
    userGenerations.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );


    res.json({
      ok: true,
      count: userGenerations.length,
      generations: userGenerations
    });


  } catch (error) {

    console.error(
      'Errore caricamento generazioni:',
      error
    );

    res.status(500).json({
      error: 'Errore nel caricamento delle generazioni.'
    });

  }

});

app.delete('/api/generations/:id', requireAuth, (req, res) => {

  try {

    const fs = require('fs');
    const path = require('path');

    const generationsFile = path.join(
      __dirname,
      'data',
      'generations.json'
    );

    const audioDirectory = path.join(
      __dirname,
      'audio'
    );

    const fileContent = fs.readFileSync(
      generationsFile,
      'utf8'
    );

    const generations = JSON.parse(fileContent);

    const generationIndex = generations.findIndex(
      generation =>
        generation.id === req.params.id &&
        generation.userId === req.user.id
    );

    // Non trovata oppure appartiene a un altro utente
    if (generationIndex === -1) {

      return res.status(404).json({
        error: 'Generazione non trovata.'
      });

    }

    const generation = generations[generationIndex];


    // ========================================
    // ELIMINA MP3
    // ========================================

    const audioPath = path.join(
      audioDirectory,
      generation.audioFile
    );

    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }


    // ========================================
    // ELIMINA RECORD JSON
    // ========================================

    generations.splice(generationIndex, 1);

    fs.writeFileSync(
      generationsFile,
      JSON.stringify(generations, null, 2),
      'utf8'
    );


    console.log(
      'Generazione eliminata:',
      generation.id
    );


    res.json({
      ok: true,
      message: 'Generazione eliminata.'
    });


  } catch (error) {

    console.error(
      'Errore eliminazione:',
      error
    );

    res.status(500).json({
      error: 'Errore durante l\'eliminazione.'
    });

  }

});

app.get('/auth/logout', (req, res) => {

  res.clearCookie('userId', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  });

  res.redirect('/');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server avviato sulla porta ${PORT}`);
});
