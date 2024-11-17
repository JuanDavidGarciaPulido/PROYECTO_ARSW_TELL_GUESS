const http = require('http').createServer();
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});
const natural = require('natural');

// Lista de palabras prohibidas
const forbiddenWords = ['secreto', 'prohibido', 'inaceptable'];

const selectedWord = 'secreto';

// Función para analizar palabras
function checkWord(word, forbiddenWords, threshold = 2) {
    for (const fw of forbiddenWords) {
        const distance = natural.LevenshteinDistance(word.toLowerCase(), fw.toLowerCase());
        if (distance <= threshold) {
            return { isForbidden: true, match: fw };
        }
    }
    return { isForbidden: false };
}

let userCount = 0;
let pistadorSocket = null;
//Arreglo que tiene guardados los usuarios de la siguiente forma llave(socket.id): valor([nombreUsuario, puntos])
let users = new Map();

io.on('connection', (socket) => {
    userCount++;
    let userName = `User ${userCount}`;
    
    // Asigna el primer usuario como el Pistador
    if (pistadorSocket === null) {
        pistadorSocket = socket;
        userName = 'Pistador';
    }
    users.set(socket.id, [userName,0])
    console.log(`${userName} connected with ID: ${socket.id}`);

    // Enviar el tipo de usuario al cliente
    socket.emit('userType', { isPistador: socket === pistadorSocket, userName });

    // Manejar mensajes
    socket.on('message', (message) => {
        console.log(`${users.get(socket.id)[0]}: ${message}`);
        
        // Si el usuario es el Pistador, analizar el mensaje
        if (socket === pistadorSocket) {
            // Análisis semántico del mensaje
            const analysis = checkWord(message, forbiddenWords);

            if (analysis.isForbidden) {
                // Si el mensaje contiene una palabra prohibida, envía una alerta solo al Pistador
                socket.emit('message', `⚠️ La palabra "${message}" es similar a "${analysis.match}" y está prohibida.`);
                console.log(`Mensaje bloqueado para Pistador: "${message}"`);
                return; // No emitir el mensaje al resto
            }
        }
        else {
            if(message === selectedWord) {
                userData = users.get(socket.id)
                userData[1] += 1
                users.set(socket.id,userData)
                userData = users.get(socket.id)
                console.log('estado',`${userData[0]} tiene ${userData[1]} puntos`);
                io.emit('estado',`${userData[0]} tiene ${userData[1]} puntos`)
                return;
            }
        }
        // Emitir el mensaje a todos los usuarios (excepto si es el Pistador con palabra prohibida)
        io.emit('message', `${users.get(socket.id)[0]} said: ${message}`);
    });

    // Manejar desconexiones
    socket.on('disconnect', () => {
        console.log(`${users.get(socket.id)[0]} disconnected`);
        
        if (socket === pistadorSocket) {
            pistadorSocket = null;
            console.log('Pistador position is now open');
            
            const connectedSockets = Array.from(io.sockets.sockets.values()).filter(s => s.connected);
            if (connectedSockets.length > 0) {
                pistadorSocket = connectedSockets[0];
                users.set(pistadorSocket.id, ['Pistador',0]);
                pistadorSocket.emit('message', 'You are now the Pistador');
                pistadorSocket.emit('userType', { isPistador: true, userName: 'Pistador' });
                console.log('New Pistador assigned');
            }
        }
        users.delete(socket.id);
    });

    // Manejar la solicitud del tipo de usuario
    socket.on('getUserType', () => {
        socket.emit('userType', { isPistador: socket === pistadorSocket, userName: users.get(socket.id)[0] });
    });
});

// Iniciar el servidor de sockets en el puerto 8080
http.listen(8080, () => console.log('listening on http://localhost:8080'));
