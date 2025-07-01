const socket = io();

// UI-Elemente aus der HTML holen
const loginBereich = document.getElementById('login-bereich');
const spielBereich = document.getElementById('spiel-bereich');
const spielernameInput = document.getElementById('spielername-input');
const beitretenButton = document.getElementById('beitreten-button');
const spielerListe = document.getElementById('spieler-liste');

// Was passiert, wenn man auf den "Beitreten"-Button klickt
beitretenButton.addEventListener('click', () => {
  const spielername = spielernameInput.value;
  if (spielername) { // Nur wenn ein Name eingegeben wurde
    // Sende den Namen an den Server
    socket.emit('spielBeitreten', { name: spielername });
    // Verstecke den Login und zeige das Spiel an
    loginBereich.style.display = 'none';
    spielBereich.style.display = 'block';
  }
});

// Was passiert, wenn der Server uns eine neue Spielerliste schickt
socket.on('spielerlisteUpdate', (spieler) => {
  console.log('Spielerliste aktualisiert:', spieler);
  spielerListe.innerHTML = ''; // Alte Liste leeren
  spieler.forEach(s => {
    const li = document.createElement('li');
    li.textContent = s.name;
    spielerListe.appendChild(li);
  });
});