const socket = io();

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const joinSection = document.getElementById("joinSection");
const videoSection = document.getElementById("videoSection");
const dashboard = document.getElementById("dashboard");

let localStream;
let peerConnection;
let roomId;
let isHost = false;

const emotionCounts = {
  happy: 0,
  neutral: 0,
  sad: 0,
  angry: 0,
  surprised: 0,
  fearful: 0,
  disgusted: 0
};

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models")
]);

window.onload = () => {
  roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  document.getElementById("roomInput").value = roomId;
};

function copyCode() {
  navigator.clipboard.writeText(roomId);
  alert("Meeting code copied!");
}

function startAsHost() {
  isHost = true;
  startCall();
}

function joinMeeting() {
  roomId = document.getElementById("roomInput").value.trim().toUpperCase();
  isHost = false;
  startCall();
}

function startCall() {
  joinSection.style.display = "none";
  videoSection.style.display = "flex";
  if (isHost) dashboard.style.display = "block";

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;
      socket.emit("join-room", roomId);
      startEmotionDetection();
      initChart();
    });
}

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
  const total = Object.values(emotionCounts).reduce((a, b) => a + b, 0);
  if (!total) return;

  let top = "neutral", max = 0;

  for (let e in emotionCounts) {
    if (emotionCounts[e] > max) {
      max = emotionCounts[e];
      top = e;
    }
    const percent = ((emotionCounts[e] / total) * 100).toFixed(1);
    document.getElementById(e).innerText = `${emotionCounts[e]} (${percent}%)`;
  }

  document.getElementById("overallMood").innerText = top;
  emotionChart.data.datasets[0].data = Object.values(emotionCounts);
  emotionChart.update();
}

let emotionChart;
function initChart() {
  if (!isHost) return;
  emotionChart = new Chart(
    document.getElementById("emotionChart"),
    {
      type: "pie",
      data: {
        labels: Object.keys(emotionCounts),
        datasets: [{
          data: Object.values(emotionCounts)
        }]
      }
    }
  );
}

/* WebRTC */
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







