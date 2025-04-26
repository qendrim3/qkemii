let localVideo = document.getElementById('localVideo');
let remoteVideo = document.getElementById('remoteVideo');
let ws;
let peerConnection;
let partnerId = null;

const servers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};

async function startChat() {
    ws = new WebSocket(`ws://${location.host}`);

    ws.onopen = () => {
        console.log('Connected to signaling server');
        findPartner();
    };

    ws.onmessage = async (message) => {
        const data = JSON.parse(message.data);

        if (data.type === 'match') {
            partnerId = data.partnerId;
            await startPeer();
            createOffer();
        }

        if (data.type === 'offer') {
            partnerId = data.partnerId;
            await startPeer();
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', partnerId, answer }));
        }

        if (data.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }

        if (data.type === 'candidate') {
            try {
                await peerConnection.addIceCandidate(data.candidate);
            } catch (e) {
                console.error('Error adding received ice candidate', e);
            }
        }

        if (data.type === 'partner-left') {
            alert('Partner left. Searching new...');
            stop();
            findPartner();
        }
    };
}

function findPartner() {
    ws.send(JSON.stringify({ type: 'find' }));
}

function stop() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (partnerId) {
        ws.send(JSON.stringify({ type: 'stop' }));
        partnerId = null;
    }
}

function next() {
    stop();
    findPartner();
}

function sendMessage() {
    const message = document.getElementById('messageInput').value;
    alert(`(Fake) Sent message: ${message}`);
    document.getElementById('messageInput').value = '';
}

async function startPeer() {
    peerConnection = new RTCPeerConnection(servers);

    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            ws.send(JSON.stringify({ type: 'candidate', partnerId, candidate }));
        }
    };

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
}

async function createOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', partnerId, offer }));
}
