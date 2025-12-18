const socket = io();

let localStream;
let peer;
let roomId;
let isHost = false;
let chart;

const emotions = { happy: 0, neutral: 0, sad: 0, angry: 0 };

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const remoteAudio = document.getElementById("remoteAudio");

/* Load emotion models */
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models")
]);

/* Host / Join */
function hostMeeting() {
  isHost = true;
  roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  alert("Meeting Code: " + roomId);
  showMedia();
}

function joinMeeting() {
  roomId = document.getElementById("roomInput").value.trim().toUpperCase();
  if (!roomId) return alert("Enter meeting code");
  showMedia();
}

function showMedia() {
  document.getElementById("joinSection").style.display = "none";
  document.getElementById("mediaSection").style.display = "block";
}

/* 🎯 START MEDIA — MOBILE SAFE */
function startMedia() {
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    }
  }).then(stream => {
    localStream = stream;

    /* 🔥 Force mic ON (mobile fix) */
    localStream.getAudioTracks().forEach(t => t.enabled = true);

    /* Local video (mobile-safe) */
    localVideo.setAttribute("playsinline", true);
    localVideo.setAttribute("autoplay", true);
    localVideo.muted = true;
    localVideo.srcObject = stream;
    localVideo.play().catch(() => {});

    document.getElementById("mediaSection").style.display = "none";
    document.getElementById("videoSection").style.display = "flex";
    document.getElementById("controls").style.display = "block";

    socket.emit("join-room", roomId);
    createPeer();

    if (isHost) {
      document.getElementById("dashboard").style.display = "block";
      initChart();
    }

    startEmotionDetection();
  }).catch(err => {
    alert("Camera / microphone permission required");
    console.error(err);
  });
}

/* WebRTC */
function createPeer() {
  peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(track =>
    peer.addTrack(track, localStream)
  );

  peer.ontrack = e => {
    const stream = e.streams[0];

    /* Video (muted autoplay-safe) */
    remoteVideo.srcObject = stream;
    remoteVideo.setAttribute("playsinline", true);
    remoteVideo.muted = true;
    remoteVideo.play().catch(() => {});

    /* 🔊 Audio (critical for mobile) */
    remoteAudio.srcObject = stream;
    remoteAudio.muted = false;
    remoteAudio.play().catch(() => {});
  };

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("ice-candidate", { roomId, candidate: e.candidate });
    }
  };
}

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

/* Mute */
function toggleMute() {
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
}

/* Emotion detection */
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

/* Dashboard */
socket.on("emotion-update", e => {
  if (!isHost) return;
  emotions[e]++;
  updateDashboard();
});

function initChart() {
  chart = new Chart(document.getElementById("emotionChart"), {
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






















