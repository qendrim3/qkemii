const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidV4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = {};
const queue = [];

app.use(express.static('public'));

wss.on('connection', ws => {
    const clientId = uuidV4();
    clients[clientId] = ws;
    ws.clientId = clientId;
    ws.partnerId = null;

    console.log(`New client connected: ${clientId}`);

    ws.on('message', message => {
        const data = JSON.parse(message);

        if (data.type === 'find') {
            if (queue.length > 0) {
                const partnerId = queue.shift();
                const partnerWs = clients[partnerId];
                if (partnerWs) {
                    ws.partnerId = partnerId;
                    partnerWs.partnerId = clientId;

                    ws.send(JSON.stringify({ type: 'match', partnerId }));
                    partnerWs.send(JSON.stringify({ type: 'match', partnerId: clientId }));
                }
            } else {
                queue.push(clientId);
            }
        }

        if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
            const partnerWs = clients[data.partnerId];
            if (partnerWs) {
                partnerWs.send(JSON.stringify(data));
            }
        }

        if (data.type === 'stop') {
            if (ws.partnerId && clients[ws.partnerId]) {
                clients[ws.partnerId].send(JSON.stringify({ type: 'partner-left' }));
                clients[ws.partnerId].partnerId = null;
            }
            ws.partnerId = null;
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        delete clients[clientId];
        const index = queue.indexOf(clientId);
        if (index !== -1) {
            queue.splice(index, 1);
        }
        if (ws.partnerId && clients[ws.partnerId]) {
            clients[ws.partnerId].send(JSON.stringify({ type: 'partner-left' }));
            clients[ws.partnerId].partnerId = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
