const socket = io();

/* =======================
   LOAD FACE API MODELS
======================= */
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models")
]);

/* =======================
   GLOBAL STATE
======================= */
let localStream, peer, roomId, chart;
let isHost = false;
let userName = "";

/* Fixed emotion order */
const emotionLabels = ["happy","neutral","sad","angry","surprised","disgusted"];
const emotions = {
  happy: 0,
  neutral: 0,
  sad: 0,
  angry: 0,
  surprised: 0,
  disgusted: 0
};

/* =======================
   DOM ELEMENTS
======================= */
const joinSection = document.getElementById("joinSection");
const mediaSection = document.getElementById("mediaSection");
const videoSection = document.getElementById("videoSection");
const chatSection = document.getElementById("chatSection");
const dashboard = document.getElementById("dashboard");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const remoteAudio = document.getElementById("remoteAudio");

const hostBtn = document.getElementById("hostBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");

/* Chat */
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");
const chatDot = document.getElementById("chatDot");

/* Video labels */
const localLabel = document.getElementById("localLabel");
const remoteLabel = document.getElementById("remoteLabel");

/* =======================
   HOST / JOIN
======================= */
hostBtn.onclick = () => {
  userName = nameInput.value.trim();
  if (!userName) return alert("Enter name");

  isHost = true;
  roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  alert("Meeting Code: " + roomId);

  joinSection.style.display = "none";
  mediaSection.style.display = "block";
};

joinBtn.onclick = () => {
  userName = nameInput.value.trim();
  roomId = roomInput.value.trim().toUpperCase();

  if (!userName || !roomId) return alert("Enter name & meeting code");

  joinSection.style.display = "none";
  mediaSection.style.display = "block";
};

startBtn.onclick = startMedia;

/* =======================
   MEDIA
======================= */
function startMedia() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;

      mediaSection.style.display = "none";
      videoSection.style.display = "block";
      chatSection.style.display = "block";
      chatInput.focus();

      socket.emit("join-room", { roomId, name: userName, isHost });

      localLabel.innerText = isHost ? "HOST (YOU)" : "YOU";

      createPeer();

      if (isHost) {
        dashboard.style.display = "block";
        initChart();
      }

      startEmotionDetection();
    })
    .catch(() => alert("Camera / mic permission denied"));
}

/* =======================
   WEBRTC
======================= */
function createPeer() {
  peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(track =>
    peer.addTrack(track, localStream)
  );

  peer.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    remoteAudio.srcObject = e.streams[0];
    remoteLabel.innerText = isHost ? "PARTICIPANT" : "HOST";
  };

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("ice-candidate", { roomId, candidate: e.candidate });
    }
  };
}

/* =======================
   SIGNALING
======================= */
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

/* =======================
   EMOTION DETECTION
======================= */
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
    const emotion = Object.keys(expressions).reduce(
      (a, b) => expressions[a] > expressions[b] ? a : b
    );

    socket.emit("emotion", { roomId, emotion });
  }, 5000);
}

/* =======================
   HOST DASHBOARD + GLOW
======================= */
socket.on("emotion-update", e => {
  if (!isHost || !emotions.hasOwnProperty(e)) return;

  emotions[e]++;

  emotionLabels.forEach(label => {
    document.getElementById(label).innerText = emotions[label];
  });

  chart.data.datasets[0].data = emotionLabels.map(x => emotions[x]);
  chart.update();

  // Emotion glow
  remoteVideo.className = "";
  remoteVideo.classList.add("glow-" + e);
});

/* =======================
   PIE CHART
======================= */
function initChart() {
  chart = new Chart(document.getElementById("emotionChart"), {
    type: "pie",
    data: {
      labels: emotionLabels,
      datasets: [{
        data: emotionLabels.map(e => emotions[e]),
        backgroundColor: [
          "#22c55e",
          "#9ca3af",
          "#3b82f6",
          "#ef4444",
          "#facc15",
          "#a855f7"
        ]
      }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}

/* =======================
   CHAT
======================= */
sendChatBtn.onclick = sendChat;
chatInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendChat();
});

function sendChat() {
  const message = chatInput.value.trim();
  if (!message) return;

  socket.emit("chat-message", {
    roomId,
    name: userName,
    message
  });

  chatInput.value = "";
}

socket.on("chat-message", d => {
  const div = document.createElement("div");
  div.className = "chat-message";
  div.innerHTML = `<b>${d.name}</b> (${d.time}): ${d.message}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;

  chatDot.style.display = "inline-block";
});

chatInput.addEventListener("focus", () => {
  chatDot.style.display = "none";
});

/* =======================
   FULLSCREEN
======================= */
fullscreenBtn.onclick = () => {
  if (!document.fullscreenElement) {
    videoSection.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};
