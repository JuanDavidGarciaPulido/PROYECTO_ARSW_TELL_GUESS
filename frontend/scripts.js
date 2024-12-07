function initializeSocket() {
    const token = localStorage.getItem('jwtToken');

    // Redirigir al login si no hay token
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const socket = io('ws://localhost:8080', {
        auth: {
            token
        }
    });

    let chosenWords = [];
    let forbbidenWords = [];

    socket.on('forbWords', (forbWords) => {
        forbbidenWords = forbWords;
        console.log(forbbidenWords['amable'])
    });

    // Recupera el diccionario de palabras del servidor
    socket.on('words', (words) => {
        chosenWords = words;
        const wordsArray = Object.values(chosenWords);
        function getRandomWords(num) {
            const shuffled = [...wordsArray].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, num);
        }
        const randomWords = getRandomWords(3);
        chosenWords = randomWords;
        randomWords.forEach((word, index) => {
            const button = document.querySelector(`.botones button:nth-child(${index + 1})`);
            button.innerHTML = word.palabra;
            button.onclick = () => {
                selectWord(word.palabra);
                console.log(`Palabra elegida: ${word.palabra}`); // Verificar en la consola
                document.querySelector('.botones').style.display = 'none'; // Oculta los botones
            };
        });
    });



    // Función para actualizar el rol y gestionar la visibilidad de elementos según el rol
    function updateUserInterface(isPistador, points, users) {
        const userTypeElement = document.querySelector('#user-type');
        const wordChoosedElement = document.querySelector('#word-choosed');
        const wordButtonsContainer = document.querySelector('.botones');
        const PointsElement = document.querySelector('#points');
        const ForbiddenWordsHtml = document.querySelector('.forbidden-words');
        userTypeElement.innerHTML = `Rol: ${isPistador ? 'Pistador' : 'Adivinador'}`;
        PointsElement.innerHTML = `Puntos: ${points}`;

        if (isPistador) {
            chosenWords.forEach((word, index) => {
                const button = document.querySelector(`.botones button:nth-child(${index + 1})`);
                button.innerHTML = word.palabra;
                button.onclick = () => {
                    selectWord(word.palabra);
                    console.log(`Palabra elegida: ${word.palabra}`); // Verificar en la consola
                    document.querySelector('.botones').style.display = 'none'; // Oculta los botones
                };
            });
            wordChoosedElement.innerHTML = "Palabra: Selecciona una palabra";
            wordButtonsContainer.style.display = 'flex'; // Muestra los botones
        } else {
            ForbiddenWordsHtml.style.display = 'none';
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
        let forbWords = forbbidenWords[word];
        console.log(forbWords);
        document.querySelector('.forbidden-words').innerHTML = forbWords.join(", ");
    }

    // Llamada inicial para establecer el rol cuando la página carga
    socket.on('userType', data => {
        updateUserInterface(data.isPistador, data.points, data.users);
        console.log(`You are ${data.userName}`);
    });

    // Configurar el clic en los botones para seleccionar la palabra
    document.querySelectorAll('.botones button').forEach((button, index) => {
        button.onclick = () => {
            const word = `Palabra ${index + 1}`; // Cambia al nombre real de la palabra
            selectWord(word);
            document.querySelector('.botones').style.display = 'none'; // Oculta los botones
        };
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
}

// Llama a la función para inicializar el socket cuando se cargue la página del juego
document.addEventListener('DOMContentLoaded', initializeSocket);
