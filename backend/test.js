const { createServer } = require("node:http");
const { Server } = require("socket.io");
const ioc = require("socket.io-client");
import natural from 'natural';

function waitFor(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

function checkWord(word, forbiddenWords, threshold = 2) {
  for (const fw of forbiddenWords) {
    const distance = natural.LevenshteinDistance(word.toLowerCase(), fw.toLowerCase());
    if (distance <= threshold) {
      return { isForbidden: true, match: fw };
    }
  }
  return { isForbidden: false };
}

describe("my awesome project", () => {
  let io, serverSocket, clientSocket;

  beforeAll((done) => {
    const httpServer = createServer();
    io = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = ioc(`http://localhost:${port}`);
      let pistadorSocket;
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
        socket.emit('userType', { isPistador: socket === pistadorSocket, userName, points: 0 });


        let forbiddenWordsDict = { 'fuerte': ['robusto', 'resistente', 'vigoroso'], 'débil': ['frágil', 'vulnerable', 'endeble'], 'brillante': ['resplandeciente', 'radiante', 'luminoso'], 'oscuro': ['sombrío', 'tenebroso', 'opaco'], 'rápido': ['veloz', 'ligero', 'expedito'], 'amable': ['cortés', 'afable', 'cordial'], 'valiente': ['intrépido', 'audaz', 'osado'], 'sabio': ['erudito', 'sensato', 'prudente'], 'feliz': ['contento', 'alegre', 'dichoso'], 'triste': ['melancólico', 'deprimido', 'afligido'], 'grande': ['enorme', 'gigante', 'colosal'], 'pequeño': ['diminuto', 'minúsculo', 'chiquito'], 'inteligente': ['listo', 'brillante', 'sabio'], 'lento': ['despacio', 'pausado', 'tranquilo'], 'rápido': ['veloz', 'ágil', 'expedito'] };
        socket.emit('forbWords', forbiddenWordsDict);

        // Consultar la tabla de palabras
        let resPalabras = ['fuerte', 'débil', 'brillante', 'oscuro'];
        socket.emit('words', resPalabras.rows);


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
      clientSocket.on("connect", done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.disconnect();
  });

  test("should work", (done) => {
    clientSocket.on("hello", (arg) => {
      expect(arg).toBe("world");
      done();
    });
    serverSocket.emit("hello", "world");
  });

  test("should work with an acknowledgement", (done) => {
    serverSocket.on("hi", (cb) => {
      cb("hola");
    });
    clientSocket.emit("hi", (arg) => {
      expect(arg).toBe("hola");
      done();
    });
  });

  test("should work with emitWithAck()", async () => {
    serverSocket.on("foo", (cb) => {
      cb("bar");
    });
    const result = await clientSocket.emitWithAck("foo");
    expect(result).toBe("bar");
  });

  test("should work with waitFor()", () => {
    clientSocket.emit("baz");

    return waitFor(serverSocket, "baz");
  });
});