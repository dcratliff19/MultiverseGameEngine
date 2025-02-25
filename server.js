const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = new Map();

io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    // Add new player
    players.set(socket.id, { id: socket.id, color: null });
    
    // Send existing players to new client
    const existingPlayers = Array.from(players.values()).filter(p => p.id !== socket.id);
    socket.emit('existingPlayers', existingPlayers);

    socket.broadcast.emit('playerJoined', { id: socket.id });

    socket.on('setColor', (data) => {
        const player = players.get(socket.id);
        if (player) {
            player.color = data.color;
            // Broadcast color to all other clients
            socket.broadcast.emit('playerColor', { id: socket.id, color: data.color });
            // Send colors of existing players to this client
            existingPlayers.forEach(p => {
                if (p.color) {
                    socket.emit('playerColor', { id: p.id, color: p.color });
                }
            });
        }
    });

    socket.on('message', (data) => {
        console.log('Message from', socket.id, ':', data);
        socket.broadcast.emit('message', data);
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        players.delete(socket.id);
        socket.broadcast.emit('playerLeft', { id: socket.id });
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});