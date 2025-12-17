const socket = io();

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const emotionCounts = {
  happy: 0,
  neutral: 0,
  sad: 0,
  angry: 0,
  surprised: 0,
  fearful: 0,
  disgusted: 0
};

let localStream;
let peerConnection;

const roomId = "moodsync-room";

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// =======================
// Load face-api models
// =======================
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models")
]).then(startVideo);

// =======================
// Camera + Mic
// =======================
function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;
      socket.emit("join-room", roomId);
      startEmotionDetection();
    });
}

// =======================
// Emotion Detection
// =======================
function startEmotionDetection() {
  setInterval(async () => {
    const detection = await faceapi
      .detectSingleFace(
        localVideo,
        new faceapi.TinyFaceDetectorOptions()
      )
      .withFaceExpressions();

    if (detection && detection.expressions) {
      const expressions = detection.expressions;
      const emotion = Object.keys(expressions).reduce((a, b) =>
        expressions[a] > expressions[b] ? a : b
      );

      socket.emit("emotion", { roomId, emotion });
    }
  }, 3000);
}

// =======================
// Receive emotion updates
// =======================
socket.on("emotion-update", (emotion) => {
  if (emotionCounts[emotion] !== undefined) {
    emotionCounts[emotion]++;
    document.getElementById(emotion).innerText = emotionCounts[emotion];
    updateOverallMood();
  }
});

function updateOverallMood() {
  const overall = Object.keys(emotionCounts).reduce((a, b) =>
    emotionCounts[a] > emotionCounts[b] ? a : b
  );

  document.getElementById("overallMood").innerText = overall;
}

// =======================
// WebRTC
// =======================
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track =>
    peerConnection.addTrack(track, localStream)
  );

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        roomId,
        candidate: event.candidate
      });
    }
  };
}

socket.on("ready", async () => {
  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("offer", { roomId, offer });
});

socket.on("offer", async (offer) => {
  createPeerConnection();

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("answer", { roomId, answer });
});

socket.on("answer", async (answer) => {
  await peerConnection.setRemoteDescription(answer);
});

socket.on("ice-candidate", async (candidate) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(candidate);
  }
});



