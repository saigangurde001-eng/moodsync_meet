const socket = io();

/* Load Face API models */
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models")
]).then(() => {
  console.log("FaceAPI models loaded");
});

let localStream, peer, roomId, chart;
let isHost = false;
let userName = "";

/* UPDATED emotions */
const emotions = {
  happy: 0,
  neutral: 0,
  sad: 0,
  angry: 0,
  surprised: 0,
  disgusted: 0
};

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
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
  joinSection.style.display = "none";
  mediaSection.style.display = "block";
}

/* Media */
function startMedia() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;
      localVideo.play();

      mediaSection.style.display = "none";
      videoSection.style.display = "block";

      socket.emit("join-room", { roomId, name: userName, isHost });
      createPeer();

      if (isHost) {
        dashboard.style.display = "block";
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

  localStream.getTracks().forEach(track =>
    peer.addTrack(track, localStream)
  );

  peer.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.play();
    remoteAudio.srcObject = e.streams[0];
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

/* Emotion Detection */
function startEmotionDetection() {
  const emotionVideo = document.createElement("video");
  emotionVideo.srcObject = localStream;
  emotionVideo.muted = true;
  emotionVideo.playsInline = true;
  emotionVideo.play();

  setInterval(async () => {
    const result = await faceapi
      .detectSingleFace(
        emotionVideo,
        new faceapi.TinyFaceDetectorOptions()
      )
      .withFaceExpressions();

    if (!result) return;

    const expressions = result.expressions;
    const emotion = Object.keys(expressions)
      .reduce((a, b) =>
        expressions[a] > expressions[b] ? a : b
      );

    socket.emit("emotion", { roomId, emotion });
  }, 5000);
}

/* Dashboard */
socket.on("emotion-update", emotion => {
  if (!isHost || !emotions.hasOwnProperty(emotion)) return;
  emotions[emotion]++;
  updateDashboard();
});

function initChart() {
  chart = new Chart(emotionChartCanvas, {
    type: "pie",
    data: {
      labels: Object.keys(emotions),
      datasets: [{
        data: Object.values(emotions)
      }]
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




























