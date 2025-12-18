const socket = io();

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const joinSection = document.getElementById("joinSection");
const videoSection = document.getElementById("videoSection");
const dashboard = document.getElementById("dashboard");
const selfControls = document.getElementById("selfControls");
const mediaStart = document.getElementById("mediaStart");

let localStream;
let peerConnection;
let roomId;
let isHost = false;
let isMuted = false;
let emotionChart;

const emotionCounts = {
  happy: 0, neutral: 0, sad: 0,
  angry: 0, surprised: 0, fearful: 0, disgusted: 0
};

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

/* LOAD MODELS */
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models")
]);

/* UI */
function updateMicUI() {
  const btn = document.getElementById("selfMuteBtn");
  const status = document.getElementById("micStatus");

  if (isMuted) {
    btn.innerText = "Unmute Mic 🎤";
    status.innerText = "🔇 You are muted";
    status.style.color = "red";
  } else {
    btn.innerText = "Mute Mic 🔇";
    status.innerText = "🎤 Mic is ON";
    status.style.color = "green";
  }
}

/* JOIN */
function showJoinInput() {
  document.getElementById("joinInputArea").style.display = "block";
}

function joinMeeting() {
  roomId = document.getElementById("roomInput").value.trim().toUpperCase();
  if (!roomId) return alert("Enter meeting code");
  isHost = false;
  startCall();
}

/* HOST */
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

/* START CALL (NO MEDIA YET) */
function startCall() {
  joinSection.style.display = "none";
  videoSection.style.display = "flex";
  mediaStart.style.display = "block";

  if (isHost) dashboard.style.display = "block";
  else selfControls.style.display = "block";
}

/* 🔑 EXPLICIT MEDIA START — MOBILE FIX */
function startMedia() {
  mediaStart.style.display = "none";

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;

      localVideo.srcObject = stream;
      localVideo.muted = true;
      localVideo.play().catch(() => {});

      isMuted = false;
      updateMicUI();

      socket.emit("join-room", roomId);
      startEmotionDetection();
      setTimeout(initChart, 400);
    })
    .catch(err => {
      alert("Please allow camera & microphone");
      console.error(err);
    });
}

/* AUDIO */
function toggleSelfMute() {
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
  isMuted = !track.enabled;
  updateMicUI();
}

/* EMOTIONS */
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
  }, 7000);
}

/* DASHBOARD */
socket.on("emotion-update", emotion => {
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

  if (emotionChart) {
    emotionChart.data.datasets[0].data = Object.values(emotionCounts);
    emotionChart.update();
  }
}

/* PIE CHART */
function initChart() {
  if (!isHost || emotionChart) return;

  const ctx = document.getElementById("emotionChart").getContext("2d");
  emotionChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(emotionCounts),
      datasets: [{ data: Object.values(emotionCounts) }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}
















