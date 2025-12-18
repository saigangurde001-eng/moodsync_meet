const socket = io();

let localStream, peer, roomId, chart;
let isHost = false;
let audioUnlocked = false;

const emotions = {
  happy: 0,
  neutral: 0,
  sad: 0,
  angry: 0
};

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const remoteAudio = document.getElementById("remoteAudio");

const hostBtn = document.getElementById("hostBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const muteBtn = document.getElementById("muteBtn");

const dashboard = document.getElementById("dashboard");
const chartCanvas = document.getElementById("emotionChart");

/* 🔑 AUDIO UNLOCK */
function unlockAudioContext() {
  if (audioUnlocked) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  audioUnlocked = true;
}

/* LOAD MODELS */
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models")
]);

/* BUTTON EVENTS */
hostBtn.addEventListener("click", () => {
  isHost = true;
  roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  alert("Meeting Code: " + roomId);
  showMedia();
});

joinBtn.addEventListener("click", () => {
  roomId = document.getElementById("roomInput").value.trim().toUpperCase();
  if (!roomId) return alert("Enter meeting code");
  showMedia();
});

startBtn.addEventListener("click", () => {
  unlockAudioContext();
  startMedia();
});

muteBtn.addEventListener("click", toggleMute);

/* UI */
function showMedia() {
  document.getElementById("joinSection").style.display = "none";
  document.getElementById("mediaSection").style.display = "block";
}

/* START MEDIA */
function startMedia() {
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: true
  }).then(stream => {
    localStream = stream;

    localVideo.srcObject = stream;
    localVideo.muted = true;
    localVideo.play();

    document.getElementById("mediaSection").style.display = "none";
    document.getElementById("videoSection").style.display = "flex";
    document.getElementById("controls").style.display = "block";

    socket.emit("join-room", roomId);
    createPeer();

    if (isHost) {
      dashboard.style.display = "block";
      initChart();
    }

    startEmotionDetection();
  });
}

/* WEBRTC */
function createPeer() {
  peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(t => peer.addTrack(t, localStream));

  peer.ontrack = e => {
    const stream = e.streams[0];

    remoteVideo.srcObject = stream;
    remoteVideo.muted = true;
    remoteVideo.play();

    remoteAudio.srcObject = stream;
    remoteAudio.play();
  };

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("ice-candidate", { roomId, candidate: e.candidate });
    }
  };
}

/* SIGNALING */
socket.on("ready", async () => {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("offer", { roomId, offer });
});

socket.on("offer", async offer => {
  await peer.setRemoteDescription(offer);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit("answer", { roomId, answer });
});

socket.on("answer", ans => peer.setRemoteDescription(ans));
socket.on("ice-candidate", c => peer.addIceCandidate(c));

/* MUTE */
function toggleMute() {
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
}

/* EMOTION DETECTION */
function startEmotionDetection() {
  setInterval(async () => {
    const det = await faceapi
      .detectSingleFace(localVideo, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (det) {
      const emotion = Object.keys(det.expressions)
        .reduce((a, b) => det.expressions[a] > det.expressions[b] ? a : b);

      socket.emit("emotion", { roomId, emotion });
    }
  }, 6000);
}

/* DASHBOARD LOGIC (HOST ONLY) */
socket.on("emotion-update", emotion => {
  if (!isHost) return;
  emotions[emotion]++;
  updateDashboard();
});

function initChart() {
  chart = new Chart(chartCanvas, {
    type: "pie",
    data: {
      labels: Object.keys(emotions),
      datasets: [{
        data: Object.values(emotions)
      }]
    },
    options: { responsive: true }
  });
}

function updateDashboard() {
  for (let e in emotions) {
    document.getElementById(e).innerText = emotions[e];
  }
  chart.data.datasets[0].data = Object.values(emotions);
  chart.update();
}























