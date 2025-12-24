const socket = io();

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models")
]).then(() => console.log("FaceAPI loaded"));

let localStream, peer, roomId, chart;
let isHost = false;

const emotions = {
  happy: 0, neutral: 0, sad: 0,
  angry: 0, surprised: 0, disgusted: 0
};

const joinSection = document.getElementById("joinSection");
const mediaSection = document.getElementById("mediaSection");
const videoSection = document.getElementById("videoSection");
const dashboard = document.getElementById("dashboard");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const remoteAudio = document.getElementById("remoteAudio");

const hostBtn = document.getElementById("hostBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const endMeetingBtn = document.getElementById("endMeetingBtn");

hostBtn.onclick = () => {
  isHost = true;
  roomId = Math.random().toString(36).substring(2,8).toUpperCase();
  alert("Meeting Code: " + roomId);
  joinSection.style.display = "none";
  mediaSection.style.display = "block";
};

joinBtn.onclick = () => {
  roomId = roomInput.value.trim().toUpperCase();
  joinSection.style.display = "none";
  mediaSection.style.display = "block";
};

startBtn.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
  localVideo.srcObject = localStream;

  mediaSection.style.display = "none";
  videoSection.style.display = "block";

  socket.emit("join-room", { roomId });
  createPeer();

  if (isHost) {
    dashboard.style.display = "block";
    initChart();
  }

  startEmotionDetection();
};

function createPeer() {
  peer = new RTCPeerConnection({ iceServers:[{urls:"stun:stun.l.google.com:19302"}] });

  localStream.getTracks().forEach(t => peer.addTrack(t, localStream));

  peer.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    remoteAudio.srcObject = e.streams[0];
  };

  peer.onicecandidate = e => {
    if (e.candidate) socket.emit("ice-candidate", { roomId, candidate:e.candidate });
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

socket.on("answer", a => peer.setRemoteDescription(a));
socket.on("ice-candidate", c => peer.addIceCandidate(c));

function startEmotionDetection() {
  setInterval(async () => {
    const r = await faceapi.detectSingleFace(localVideo,new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
    if (!r) return;
    const e = Object.keys(r.expressions).reduce((a,b)=>r.expressions[a]>r.expressions[b]?a:b);
    socket.emit("emotion",{roomId,emotion:e});
  },5000);
}

socket.on("emotion-update", e => {
  if (!isHost) return;
  emotions[e]++;
  chart.data.datasets[0].data = Object.values(emotions);
  chart.update();
});

function initChart() {
  chart = new Chart(document.getElementById("emotionChart"), {
    type:"pie",
    data:{ labels:Object.keys(emotions), datasets:[{data:Object.values(emotions)}] }
  });
}

/* 🛑 END MEETING */
endMeetingBtn.onclick = () => {
  socket.emit("end-meeting", { roomId });
  onMeetingEnded();
};

socket.on("meeting-ended", onMeetingEnded);

function onMeetingEnded() {
  if (localStream) localStream.getTracks().forEach(t=>t.stop());
  alert("Meeting Ended");
  location.reload();
}

/* Fullscreen */
fullscreenBtn.onclick = () => {
  if (!document.fullscreenElement) videoSection.requestFullscreen();
  else document.exitFullscreen();
};
