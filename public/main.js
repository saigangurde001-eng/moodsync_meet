const socket = io();

let localStream;
let peer;
let roomId;
let isHost = false;
let chart;

const emotions = { happy: 0, neutral: 0, sad: 0, angry: 0 };

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const mobilePlay = document.getElementById("mobilePlay");

/* Load models */
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

/* Start media */
function startMedia() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
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
        document.getElementById("dashboard").style.display = "block";
        initChart();
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
    remoteVideo.srcObject = e.streams[0];

    // 🔑 GAP FIX — THIS IS WHAT WAS MISSING
    remoteVideo.setAttribute("playsinline", true);
    remoteVideo.muted = true;   // must start muted on mobile
    remoteVideo.play().catch(() => {});

    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      mobilePlay.style.display = "block";
    }
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

/* Mobile unmute */
function enableRemotePlayback() {
  mobilePlay.style.display = "none";
  remoteVideo.muted = false;
  remoteVideo.play().catch(() => {});
}

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




















