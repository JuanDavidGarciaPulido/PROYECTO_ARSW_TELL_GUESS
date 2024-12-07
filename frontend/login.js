document.getElementById('login-button').onclick = async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    console.log('Intentando iniciar sesión con usuario:', username);

    try {
        const response = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        console.log('Respuesta del servidor recibida:', response);

        if (!response.ok) {
            console.error('Error en la respuesta del servidor:', response.statusText);
            document.getElementById('login-error').style.display = 'block';
            return;
        }

        const data = await response.json();
        console.log('Datos recibidos del servidor:', data);

        localStorage.setItem('jwtToken', data.token);
        console.log('Token JWT almacenado en localStorage');

        window.location.href = 'game.html'; // Redirigir al juego
        console.log('Redirigiendo a game.html');
    } catch (error) {
        console.error('Error durante el login:', error);
    }
};
