const socket = io();

/* FACE API */
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models")
]);

let localStream, peer, roomId, chart;
let isHost = false;
let userName = "";

const emotionLabels = ["happy","neutral","sad","angry","surprised","disgusted"];
const emotions = { happy:0, neutral:0, sad:0, angry:0, surprised:0, disgusted:0 };

/* DOM */
const joinSection = document.getElementById("joinSection");
const mediaSection = document.getElementById("mediaSection");
const videoSection = document.getElementById("videoSection");
const dashboard = document.getElementById("dashboard");
const chatSection = document.getElementById("chatSection");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const remoteAudio = document.getElementById("remoteAudio");

const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

const hostBtn = document.getElementById("hostBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");

/* HOST / JOIN */
hostBtn.onclick = () => {
  userName = nameInput.value.trim();
  if (!userName) return alert("Enter name");

  isHost = true;
  roomId = Math.random().toString(36).substring(2,8).toUpperCase();
  alert("Meeting Code: " + roomId);

  joinSection.style.display = "none";
  mediaSection.style.display = "block";
};

joinBtn.onclick = () => {
  userName = nameInput.value.trim();
  roomId = roomInput.value.trim().toUpperCase();
  if (!userName || !roomId) return alert("Enter details");

  joinSection.style.display = "none";
  mediaSection.style.display = "block";
};

startBtn.onclick = startMedia;

/* MEDIA */
function startMedia() {
  navigator.mediaDevices.getUserMedia({ video:true, audio:true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;

    mediaSection.style.display = "none";
    videoSection.style.display = "block";
    chatSection.style.display = "block";

    socket.emit("join-room", { roomId, name:userName, isHost });

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
    iceServers:[{ urls:"stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(t => peer.addTrack(t, localStream));

  peer.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    remoteAudio.srcObject = e.streams[0];
  };

  peer.onicecandidate = e => {
    if (e.candidate)
      socket.emit("ice-candidate", { roomId, candidate:e.candidate });
  };
}

socket.on("ready", async () => {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("offer", { roomId, offer });
});

socket.on("offer", async offer => {
  await peer.setRemoteDescription(offer);
  const ans = await peer.createAnswer();
  await peer.setLocalDescription(ans);
  socket.emit("answer", { roomId, answer:ans });
});

socket.on("answer", ans => peer.setRemoteDescription(ans));
socket.on("ice-candidate", c => peer.addIceCandidate(c));

/* EMOTIONS */
function startEmotionDetection() {
  const v = document.createElement("video");
  v.srcObject = localStream;
  v.play();

  setInterval(async () => {
    const r = await faceapi
      .detectSingleFace(v, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();
    if (!r) return;

    const e = Object.keys(r.expressions)
      .reduce((a,b)=>r.expressions[a]>r.expressions[b]?a:b);

    socket.emit("emotion", { roomId, emotion:e });
  }, 5000);
}

socket.on("emotion-update", e => {
  if (!isHost || !emotions[e]) return;
  emotions[e]++;
  chart.data.datasets[0].data = emotionLabels.map(x=>emotions[x]);
  chart.update();
});

/* CHART */
function initChart() {
  chart = new Chart(document.getElementById("emotionChart"), {
    type:"pie",
    data:{
      labels:emotionLabels,
      datasets:[{ data:emotionLabels.map(e=>emotions[e]) }]
    }
  });
}

/* CHAT */
sendChatBtn.onclick = sendChat;
chatInput.onkeypress = e => e.key==="Enter" && sendChat();

function sendChat() {
  if (!chatInput.value) return;
  socket.emit("chat-message", {
    roomId,
    name:userName,
    message:chatInput.value
  });
  chatInput.value="";
}

socket.on("chat-message", d => {
  const div = document.createElement("div");
  div.className="chat-message";
  div.innerHTML = `<b>${d.name}</b> (${d.time}): ${d.message}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

/* FULLSCREEN */
fullscreenBtn.onclick = () => {
  document.fullscreenElement
    ? document.exitFullscreen()
    : videoSection.requestFullscreen();
};
