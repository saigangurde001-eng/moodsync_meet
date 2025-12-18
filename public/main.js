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
let isMuted = false;
let emotionChart;

const emotionCounts = {
  happy: 0, neutral: 0, sad: 0,
  angry: 0, surprised: 0, fearful: 0, disgusted: 0
};

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

/* ================= MODELS ================= */
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models")
]);

/* ================= UI ================= */
function updateMicUI() {
  const btn = document.getElementById("selfMuteBtn");
  const status = document.getElementById("micStatus");

  if (!btn || !status) return;

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

/* ================= JOIN ================= */
function showJoinInput() {
  document.getElementById("joinInputArea").style.display = "block";
}

function joinMeeting() {
  roomId = document.getElementById("roomInput").value.trim().toUpperCase();
  if (!roomId) return alert("Enter meeting code");
  isHost = false;
  startCall();
}

/* ================= HOST ================= */
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

/* ================= START CALL (RESTORED WORKING LOGIC) ================= */
function startCall() {
  joinSection.style.display = "none";
  videoSection.style.display = "flex";

  if (isHost) dashboard.style.display = "block";
  else selfControls.style.display = "block";

  navigator.mediaDevices.getUserMedia({
    video: true,   // 🔥 SAME AS OLD WORKING VERSION
    audio: true
  })
  .then(stream => {
    localStream = stream;

    // 🔑 MOBILE FIX
    localVideo.setAttribute("playsinline", true);
    localVideo.muted = true;
    localVideo.srcObject = stream;
    localVideo.play().catch(() => {});

    isMuted = false;
    updateMicUI();

    socket.emit("join-room", roomId);
    startEmotionDetection();
    setTimeout(initChart, 400);
  })
  .catch(err => {
    alert("Please allow camera and microphone access");
    console.error("getUserMedia error:", err);
  });
}

/* ================= AUDIO ================= */
function toggleSelfMute() {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
  isMuted = !track.enabled;
  updateMicUI();
}

socket.on("mute-all", () => {
  if (isHost || !localStream) return;
  localStream.getAudioTracks()[0].enabled = false;
  isMuted = true;
  updateMicUI();
});

socket.on("unmute-all", () => {
  if (isHost || !localStream) return;
  localStream.getAudioTracks()[0].enabled = true;
  isMuted = false;
  updateMicUI();
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
  }, 7000); // optimized
}

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

/* ================= CHART ================= */
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















