const socket = io();

let localStream, peer, roomId, chart;
let isHost = false;
let userName = "";

const emotions = { happy: 0, neutral: 0, sad: 0, angry: 0 };

const hostVideo = document.getElementById("hostVideo");
const speakerVideo = document.getElementById("speakerVideo");
const remoteAudio = document.getElementById("remoteAudio");

const dashboard = document.getElementById("dashboard");
const emotionChartCanvas = document.getElementById("emotionChart");

const hostBtn = document.getElementById("hostBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const nameInput = document.getElementById("nameInput");

/* UI */
hostBtn.onclick = () => {
  userName = nameInput.value.trim();
  if (!userName) return alert("Enter name");

  isHost = true;
  roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  alert("Meeting Code: " + roomId);
  showMedia();
};

joinBtn.onclick = () => {
  userName = nameInput.value.trim();
  if (!userName) return alert("Enter name");

  roomId = document.getElementById("roomInput").value.trim().toUpperCase();
  if (!roomId) return alert("Enter meeting code");

  showMedia();
};

startBtn.onclick = startMedia;

function showMedia() {
  document.getElementById("joinSection").style.display = "none";
  document.getElementById("mediaSection").style.display = "block";
}

/* Media */
function startMedia() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;

      if (isHost) {
        hostVideo.srcObject = stream;
        hostVideo.muted = true;
        hostVideo.play();
      }

      document.getElementById("mediaSection").style.display = "none";
      document.getElementById("videoSection").style.display = "flex";

      socket.emit("join-room", { roomId, name: userName, isHost });
      createPeer();

      if (isHost) {
        dashboard.style.display = "block";
        initChart();
      }

      if (!/Mobi|Android/i.test(navigator.userAgent)) {
        detectSpeaking();
      }

      startEmotionDetection();
    });
}

/* WebRTC */
function createPeer() {
  peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(t => peer.addTrack(t, localStream));

  peer.ontrack = e => {
    const stream = e.streams[0];

    // Everyone sees host
    if (!isHost) {
      hostVideo.srcObject = stream;
      hostVideo.play();
    }

    // Everyone sees active speaker
    speakerVideo.srcObject = stream;
    speakerVideo.play();

    remoteAudio.srcObject = stream;
    remoteAudio.play();
  };

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("ice-candidate", { roomId, candidate: e.candidate });
    }
  };
}

/* Signaling */
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

/* Active speaker detection (PC only) */
function detectSpeaking() {
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(localStream);
  const analyser = ctx.createAnalyser();
  src.connect(analyser);
  analyser.fftSize = 256;

  const data = new Uint8Array(analyser.frequencyBinCount);

  setInterval(() => {
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    if (avg > 25) socket.emit("speaking", { roomId });
    else socket.emit("silent", { roomId });
  }, 800);
}

/* Emotion detection */
function startEmotionDetection() {
  setInterval(async () => {
    const det = await faceapi
      .detectSingleFace(hostVideo, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (det) {
      const emotion = Object.keys(det.expressions)
        .reduce((a, b) => det.expressions[a] > det.expressions[b] ? a : b);

      socket.emit("emotion", { roomId, emotion });
    }
  }, 6000);
}

/* Dashboard */
socket.on("emotion-update", emotion => {
  if (!isHost) return;
  emotions[emotion]++;
  updateDashboard();
});

function initChart() {
  chart = new Chart(emotionChartCanvas, {
    type: "pie",
    data: {
      labels: Object.keys(emotions),
      datasets: [{ data: Object.values(emotions) }]
    }
  });
}

function updateDashboard() {
  for (let e in emotions) {
    document.getElementById(e).innerText = emotions[e];
  }
  chart.data.datasets[0].data = Object.values(emotions);
  chart.update();
}
























