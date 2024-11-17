const socket = io('ws://localhost:8080');

// Función para actualizar el rol y gestionar la visibilidad de elementos según el rol
function updateUserInterface(isPistador) {
    const userTypeElement = document.querySelector('#user-type');
    const wordChoosedElement = document.querySelector('#word-choosed');
    const wordButtonsContainer = document.querySelector('.botones');

    userTypeElement.innerHTML = `Rol: ${isPistador ? 'Pistador' : 'Adivinador'}`;

    if (isPistador) {
        wordChoosedElement.innerHTML = "Palabra: Selecciona una palabra";
        wordButtonsContainer.style.display = 'flex'; // Muestra los botones
    } else {
        wordChoosedElement.innerHTML = "Palabra: Oculta";
        wordButtonsContainer.style.display = 'none'; // Oculta los botones
    }
}

// Función para seleccionar una palabra y mostrarla
function selectWord(word) {
    const wordChoosedElement = document.querySelector('#word-choosed');
    wordChoosedElement.innerHTML = `Palabra: ${word}`;
    console.log(`Palabra elegida: ${word}`); // Mensaje en consola para verificar
    socket.emit('chosenWord', word); // Envía la palabra elegida al servidor
}

// Llamada inicial para establecer el rol cuando la página carga
socket.on('userType', data => {
    updateUserInterface(data.isPistador);
    console.log(`You are ${data.userName}`);
});

// Llamar a selectWord cuando el pistador selecciona una palabra
document.querySelectorAll('.botones button').forEach((button, index) => {
    button.onclick = () => {
        const word = `Palabra ${index + 1}`; // Cambia al nombre real de la palabra
        selectWord(word);
        document.querySelector('.botones').style.display = 'none'; // Oculta los botones
    };
});

// Escuchar la actualización de la palabra desde el servidor
socket.on('wordUpdate', (word) => {
    const wordChoosedElement = document.querySelector('#word-choosed');
    wordChoosedElement.innerHTML = `Palabra: ${word}`;
});

// Evento para manejar el cierre de la ventana
window.addEventListener('beforeunload', () => {
    socket.emit('userDisconnected');
});

// Evento para el botón de enviar mensajes
document.querySelector('#send-button').onclick = () => {
    const text = document.querySelector('#message-input').value;
    socket.emit('message', text);
};

// Recibir mensaje y añadirlo a la lista
socket.on('message', text => {
    const el = document.createElement('li');
    el.innerHTML = text;
    document.querySelector('#messages').appendChild(el);
    
    // Hacer scroll hacia el final
    const messageList = document.querySelector('.message-list');
    messageList.scrollTop = messageList.scrollHeight;
});

// Emitir evento al servidor para obtener el tipo de usuario al cargar la página
socket.emit('getUserType');
