const http = require('http').createServer();
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true
    }
});

const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const app = express(); 
const secretKey = 'your-secret-key';

let forbiddenWordsDict = {};
let userTable = [];
let selectedWord;
let gameWon = false; // Bandera para indicar si el juego ya ha sido ganado

const { Client } = require('pg');
const natural = require('natural');

// Conexion a la base de datos con credenciales embebidas
const client = new Client({
    user: 'tell_admin',
    host: 'tell-and-guess-db.postgres.database.azure.com',
    database: 'postgres',
    password: 'g2VYn4TewrBSDqb',
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

// Conexion del cliente
client.connect()
    .then(() => console.log('Conexión exitosa a la base de datos'))
    .catch(err => console.error('Error al conectar a la base de datos:', err.stack));

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
// Arreglo que tiene guardados los usuarios de la siguiente forma llave(socket.id): valor([nombreUsuario, puntos])
let users = new Map();

// Ruta para autenticar usuarios y generar un token JWT
app.use(cors());
app.use(express.json());

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await client.query('SELECT * FROM usuarios WHERE nombre_usuario = $1 AND password = $2', [username, password]);
        if (result.rows.length > 0) {
            const token = jwt.sign({ username }, secretKey, { expiresIn: '1h' });
            return res.json({ token });
        }
        res.status(401).send('Unauthorized');
    } catch (err) {
        console.error('Error al autenticar el usuario:', err.stack);
        res.status(500).send('Internal Server Error');
    }
});


io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return next(new Error('Authentication error'));
        }
        socket.username = decoded.username;
        next();
    });
});

// Función para manejar la conexión del socket
io.on('connection', (socket) => {
    userCount++;
    console.log("===============================================================================================")
    console.log("username: " + socket.username)
    let userName = socket.username;

    // Asigna el primer usuario como el Pistador
    if (pistadorSocket === null) {
        pistadorSocket = socket;
        role = 'Pistador';
    }
    users.set(socket.id, [userName, 0]);
    console.log(`${userName} connected with ID: ${socket.id}`);

    // Enviar el tipo de usuario al cliente
    socket.emit('userType', { isPistador: socket === pistadorSocket, userName, points:0 });

    // Consultar la base de datos y enviar las palabras al cliente
    async function fetchData() {
        try {
            // Consultar palabras prohibidas
            const resForbiddenWords = await client.query('SELECT palabra, sinonimos FROM palabras');
            resForbiddenWords.rows.forEach(row => {
                forbiddenWordsDict[row.palabra] = row.sinonimos;
            });
            socket.emit('forbWords', forbiddenWordsDict);
            console.log('Palabras prohibidas:', forbiddenWordsDict);

            // Consultar la tabla de palabras
            const resPalabras = await client.query('SELECT * FROM palabras');
            console.log('Tabla de Palabras:', resPalabras.rows);
            socket.emit('words', resPalabras.rows); // Enviar palabras al cliente
            console.log('enviadas')

            // Consultar la tabla de usuarios
            const resUsuarios = await client.query('SELECT * FROM usuarios');
            console.log('Tabla de Usuarios:', resUsuarios.rows);
            userTable = resUsuarios.row;

        } catch (err) {
            console.error('Error al consultar la base de datos:', err.stack);
        }
    }
    fetchData();

    //Recibir la palabra seleccionada por el pistador
    socket.on('chosenWord', (word) => {
        selectedWord = word;
        gameWon = false; // Reiniciar la bandera cuando se selecciona una nueva palabra
        console.log("Palabra seleccionada por el pistador: " + word);
    });

    // Función asíncrona para manejar los mensajes de los usuarios
    async function handleMessage(socket, message) {
        let forbiddenWords = [];
        console.log(`${users.get(socket.id)[0]}: ${message}`);
        console.log("selected word " + selectedWord);
        if (Object.keys(forbiddenWordsDict).includes(selectedWord)) {
            forbiddenWords = forbiddenWordsDict[selectedWord];
            forbiddenWords.push(selectedWord);
            console.log("Palabras prohibidas: " + forbiddenWords);
        }
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
        } else {
            if (message === selectedWord && !gameWon) {
                gameWon = true; // Marcar como ganado para que solo un usuario pueda ganar
                const userData = users.get(socket.id);
                userData[1] += 1;
                users.set(socket.id, userData);
                console.log('estado', `${userData[0]} tiene ${userData[1]} puntos`);
                io.emit('estado', `${userData[0]} tiene ${userData[1]} puntos`);
                socket.emit('userType', { isPistador: false, userName: socket.username, points: users.get(socket.id)[1] });
                newPistador()
                return;
            }
        }
        // Emitir el mensaje a todos los usuarios (excepto si es el Pistador con palabra prohibida)
        io.emit('message', `${users.get(socket.id)[0]} said: ${message}`);
    }

    // Manejar mensajes
    socket.on('message', (message) => {
        handleMessage(socket, message).catch(err => console.error('Error manejando el mensaje:', err));
    });

    // Funcion que nos permite tener un nuevo pistador
    function newPistador() {
        oldPistador = pistadorSocket;
        pistadorSocket = null;
        console.log('Pistador position is now open');
        const connectedSockets = Array.from(io.sockets.sockets.values()).filter(s => s.connected);
        let randomIndex = Math.floor(Math.random() * connectedSockets.length);
        while (oldPistador.id === connectedSockets[randomIndex].id) {
            randomIndex = Math.floor(Math.random() * connectedSockets.length);
        }
        points = users.get(connectedSockets[randomIndex].id)[1];
        pistadorSocket = connectedSockets[randomIndex];
        pistadorSocket.emit('message', 'You are now the Pistador');
        pistadorSocket.emit('userType', { isPistador: true, userName: pistadorSocket.username, points: users.get(pistadorSocket.id)[1] });
        oldPistador.emit('userType', { isPistador: false, userName: oldPistador.username, points: users.get(oldPistador.id)[1] });
        console.log('New Pistador assigned');
    };

    // Manejar desconexiones
    socket.on('disconnect', () => {
        console.log(`${users.get(socket.id)[0]} disconnected`);

        if (socket === pistadorSocket) {
            pistadorSocket = null;
            console.log('Pistador position is now open');

            const connectedSockets = Array.from(io.sockets.sockets.values()).filter(s => s.connected);
            if (connectedSockets.length > 0) {
                pistadorSocket = connectedSockets[0];
                pistadorSocket.emit('message', 'You are now the Pistador');
                pistadorSocket.emit('userType', { isPistador: true, userName: pistadorSocket.username, points: users.get(pistadorSocket.id)[1] });
                console.log('New Pistador assigned');
            }
        }
        users.delete(socket.id);
    });

    // Manejar la solicitud del tipo de usuario
    socket.on('getUserType', () => {
        socket.emit('userType', { isPistador: socket === pistadorSocket, userName: users.get(socket.id)[0], points: users.get(socket.id)[1] });
    });
});

// Iniciar el servidor de sockets en el puerto 8080
http.listen(8080, () => console.log('listening on http://localhost:8080'));
app.listen(3000, () => console.log('HTTP server listening on port 3000'));