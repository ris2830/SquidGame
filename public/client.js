// public/client.js

const socket = io();

// Alle UI-Elemente holen
const loginBereich = document.getElementById('login-bereich');
const spielBereich = document.getElementById('spiel-bereich');
const spielrundeBereich = document.getElementById('spielrunde-bereich');

const spielernameInput = document.getElementById('spielername-input');
const beitretenButton = document.getElementById('beitreten-button');
const startButton = document.getElementById('start-button');
const spielerListe = document.getElementById('spieler-liste');

const infoRolle = document.getElementById('info-rolle');
const infoWort = document.getElementById('info-wort');

// Event Listener für Buttons
beitretenButton.addEventListener('click', () => {
    const spielername = spielernameInput.value;
    if (spielername) {
        socket.emit('spielBeitreten', { name: spielername });
        loginBereich.style.display = 'none';
        spielBereich.style.display = 'block';
    }
});

startButton.addEventListener('click', () => {
    socket.emit('spielStarten');
});

// Socket-Events vom Server empfangen
socket.on('spielerlisteUpdate', (spieler) => {
    spielerListe.innerHTML = '';
    spieler.forEach((s, index) => {
        const li = document.createElement('li');
        li.textContent = s.name;
        // Der erste Spieler in der Liste ist der Host und sieht den Start-Button
        if (socket.id === s.id && index === 0) {
            startButton.style.display = 'block';
        }
        spielerListe.appendChild(li);
    });
    // Verstecke den Startbutton für alle, die nicht der erste Spieler sind
    if (spieler.length > 0 && socket.id !== spieler[0].id) {
         startButton.style.display = 'none';
    }
});

// NEU: Was passiert, wenn das Spiel gestartet wird
socket.on('spielGestartet', () => {
    console.log("Das Spiel wurde auf dem Server gestartet!");
    spielBereich.style.display = 'none';
    spielrundeBereich.style.display = 'block';
});

// NEU: Was passiert, wenn du deine geheime Rolle bekommst
socket.on('deineRolle', (data) => {
    console.log("Rolleninfo erhalten:", data);
    infoRolle.textContent = `Deine Rolle: ${data.rolle}`;
    if (data.rolle === 'Agent') {
        infoWort.textContent = `Das geheime Wort: ${data.wort}`;
    } else {
        infoWort.textContent = 'Finde das geheime Wort heraus!';
    }
});