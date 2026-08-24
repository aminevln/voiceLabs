const textarea = document.getElementById('text');
const counter = document.getElementById('counter');
const generateBtn = document.getElementById('generateBtn');
const player = document.getElementById('player');
const status = document.getElementById('status');

let currentAudioUrl = null;


// ========================================
// CONTATORE CARATTERI
// ========================================

textarea.addEventListener('input', () => {
  counter.textContent = `${textarea.value.length} / 5000`;
});


// ========================================
// GENERA AUDIO
// ========================================

generateBtn.addEventListener('click', async () => {

  const text = textarea.value.trim();

  if (!text) {
    status.textContent = 'Scrivi prima una frase.';
    return;
  }

  generateBtn.disabled = true;
  generateBtn.innerHTML = 'GENERAZIONE IN CORSO...';

  status.textContent = 'Sto generando la tua voce...';

  player.style.display = 'none';

  try {

    const response = await fetch('/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text
      })
    });

    if (!response.ok) {

      let errorMessage = 'Errore durante la generazione.';

      try {
        const errorData = await response.json();

        if (errorData.error) {
          errorMessage = errorData.error;
        }

      } catch {
        // Risposta non JSON
      }

      throw new Error(errorMessage);
    }


    // Riceviamo l'MP3
    const audioBlob = await response.blob();


    // Elimina vecchio URL
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
    }


    // Crea nuovo URL
    currentAudioUrl = URL.createObjectURL(audioBlob);


    // Imposta audio
    player.src = currentAudioUrl;
    player.style.display = 'block';


    status.textContent = '✓ Audio generato con successo.';


    // Prova ad avviare automaticamente
    try {
      await player.play();
    } catch {
      // Il browser potrebbe bloccare l'autoplay
    }


  } catch (error) {

    console.error(error);

    status.textContent = 'Errore: ' + error.message;

  } finally {

    generateBtn.disabled = false;

    generateBtn.innerHTML =
      '<span class="wave-icon">◫</span> GENERA AUDIO';

  }

});

// ========================================
// ACCOUNT
// ========================================

async function loadAccount() {

  const accountArea =
    document.getElementById('accountArea');

  // La pagina potrebbe non avere l'account area
  if (!accountArea) {
    return;
  }

  try {

    const response =
      await fetch('/api/me');

    if (!response.ok) {

      accountArea.innerHTML = `
        <a
          href="/auth/google"
          class="login-link"
        >
          Accedi con Google
        </a>
      `;

      return;
    }

    const data =
      await response.json();

    const user =
      data.user;


    accountArea.innerHTML = `

      <div class="account-wrapper">

        <button
          class="account-button"
          id="accountButton"
        >

          ${
            user.picture
              ? `<img
                  src="${escapeHtml(user.picture)}"
                  alt=""
                  class="account-avatar"
                >`
              : `<div class="account-avatar-placeholder">
                  ${escapeHtml(
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>`
          }

          <span class="account-name">
            ${escapeHtml(user.name)}
          </span>

          <span class="account-arrow">
            ▾
          </span>

        </button>


        <div
          class="account-menu"
          id="accountMenu"
        >

          <div class="account-menu-user">

            ${
              user.picture
                ? `<img
                    src="${escapeHtml(user.picture)}"
                    alt=""
                    class="account-menu-avatar"
                  >`
                : ''
            }

            <div>

              <strong>
                ${escapeHtml(user.name)}
              </strong>

              <span>
                ${escapeHtml(user.email)}
              </span>

            </div>

          </div>


          <div class="account-menu-divider"></div>


          <a
            href="/generazioni.html"
            class="account-menu-item"
          >
            Le mie frasi
          </a>


          <a
            href="#"
            class="account-menu-item"
          >
            Impostazioni
          </a>


          <div class="account-menu-divider"></div>


          <a
            href="/auth/logout"
            class="account-menu-item logout-item"
          >
            Esci
          </a>

        </div>

      </div>

    `;


    const accountButton =
      document.getElementById('accountButton');

    const accountMenu =
      document.getElementById('accountMenu');


    accountButton.addEventListener(
      'click',
      (event) => {

        event.stopPropagation();

        accountMenu.classList.toggle('open');

      }
    );


    document.addEventListener(
      'click',
      () => {

        accountMenu.classList.remove('open');

      }
    );


  } catch (error) {

    console.error(
      'Errore caricamento account:',
      error
    );

  }

}


// ========================================
// ESCAPE HTML
// ========================================

function escapeHtml(text) {

  const div =
    document.createElement('div');

  div.textContent = text;

  return div.innerHTML;

}


loadAccount();
