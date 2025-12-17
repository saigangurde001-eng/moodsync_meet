const socket = io();

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const joinSection = document.getElementById("joinSection");
const videoSection = document.getElementById("videoSection");
const dashboard = document.getElementById("dashboard");
const selfControls = document.getElementById("selfControls");

let localStream;
let peerConnection;
let roomId;
let isHost = false;
let micMuted = false;

const emotionCounts = {
  happy: 0, neutral: 0, sad: 0,
  angry: 0, surprised: 0, fearful: 0, disgusted: 0
};

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// Models
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models")
]);

/* PARTICIPANT FLOW */
function showJoinInput() {
  document.getElementById("joinInputArea").style.display = "block";
}

function joinMeeting() {
  roomId = document.getElementById("roomInput").value.trim().toUpperCase();
  if (!roomId) return alert("Enter meeting code");
  isHost = false;
  startCall();
}

/* HOST FLOW */
function startAsHost() {
  isHost = true;
  roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  document.getElementById("hostCode").value = roomId;
  document.getElementById("hostCodeArea").style.display = "block";
  startCall();
}

function copyCode() {
  navigator.clipboard.writeText(roomId);
  alert("Meeting code copied!");
}

/* COMMON */
function startCall() {
  joinSection.style.display = "none";
  videoSection.style.display = "flex";

  if (isHost) dashboard.style.display = "block";
  else selfControls.style.display = "block";

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;
      socket.emit("join-room", roomId);
      startEmotionDetection();
      initChart();
    });
}

/* ================= AUDIO CONTROLS ================= */

// Participant self mute/unmute
function toggleSelfMute() {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  micMuted = !audioTrack.enabled;
}

// Host: mute all
function muteAll() {
  socket.emit("mute-all", roomId);
}

// Host: unmute all
function unmuteAll() {
  socket.emit("unmute-all", roomId);
}

// Participants listen
socket.on("mute-all", () => {
  if (isHost) return;
  localStream.getAudioTracks()[0].enabled = false;
});

socket.on("unmute-all", () => {
  if (isHost) return;
  localStream.getAudioTracks()[0].enabled = true;
});

/* ================= EMOTIONS ================= */

function startEmotionDetection() {
  setInterval(async () => {
    const det = await faceapi
      .detectSingleFace(localVideo, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (det && det.expressions) {
      const emotion = Object.keys(det.expressions)
        .reduce((a, b) => det.expressions[a] > det.expressions[b] ? a : b);

      socket.emit("emotion", { roomId, emotion });
    }
  }, 3000);
}

socket.on("emotion-update", (emotion) => {
  if (!isHost) return;
  emotionCounts[emotion]++;
  updateStats();
});

function updateStats() {
  let top = "neutral", max = 0;
  for (let e in emotionCounts) {
    if (emotionCounts[e] > max) {
      max = emotionCounts[e];
      top = e;
    }
    document.getElementById(e).innerText = emotionCounts[e];
  }
  document.getElementById("overallMood").innerText = top;
  emotionChart.data.datasets[0].data = Object.values(emotionCounts);
  emotionChart.update();
}

/* ================= CHART ================= */

let emotionChart;
function initChart() {
  if (!isHost) return;
  emotionChart = new Chart(
    document.getElementById("emotionChart"),
    {
      type: "pie",
      data: {
        labels: Object.keys(emotionCounts),
        datasets: [{ data: Object.values(emotionCounts) }]
      }
    }
  );
}

/* ================= WEBRTC ================= */

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
  peerConnection.ontrack = e => remoteVideo.srcObject = e.streams[0];
  peerConnection.onicecandidate = e =>
    e.candidate && socket.emit("ice-candidate", { roomId, candidate: e.candidate });
}

socket.on("ready", async () => {
  createPeerConnection();
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", { roomId, offer });
});

socket.on("offer", async offer => {
  createPeerConnection();
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", { roomId, answer });
});

socket.on("answer", ans => peerConnection.setRemoteDescription(ans));
socket.on("ice-candidate", c => peerConnection?.addIceCandidate(c));










