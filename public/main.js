const socket = io();

let localStream, peer, roomId, isHost = false, chart;
let audioUnlocked = false;

const emotions = { happy: 0, neutral: 0, sad: 0, angry: 0 };

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const remoteAudio = document.getElementById("remoteAudio");

const hostBtn = document.getElementById("hostBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const muteBtn = document.getElementById("muteBtn");

/* 🔑 AUDIO UNLOCK */
function unlockAudioContext() {
  if (audioUnlocked) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  audioUnlocked = true;
}

/* EVENT BINDINGS */
hostBtn.addEventListener("click", () => {
  isHost = true;
  roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  alert("Meeting Code: " + roomId);
  showMedia();
});

joinBtn.addEventListener("click", () => {
  roomId = document.getElementById("roomInput").value.trim().toUpperCase();
  if (!roomId) return alert("Enter meeting code");
  showMedia();
});

startBtn.addEventListener("click", () => {
  unlockAudioContext();
  startMedia();
});

muteBtn.addEventListener("click", toggleMute);

/* UI */
function showMedia() {
  document.getElementById("joinSection").style.display = "none";
  document.getElementById("mediaSection").style.display = "block";
}

/* MEDIA */
function startMedia() {
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: true
  }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
    localVideo.muted = true;
    localVideo.play();

    document.getElementById("mediaSection").style.display = "none";
    document.getElementById("videoSection").style.display = "flex";
    document.getElementById("controls").style.display = "block";

    socket.emit("join-room", roomId);
    createPeer();
  });
}

/* WEBRTC */
function createPeer() {
  peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(t => peer.addTrack(t, localStream));

  peer.ontrack = e => {
    const stream = e.streams[0];
    remoteVideo.srcObject = stream;
    remoteVideo.muted = true;
    remoteVideo.play();
    remoteAudio.srcObject = stream;
    remoteAudio.play();
  };

  peer.onicecandidate = e => {
    if (e.candidate) socket.emit("ice-candidate", { roomId, candidate: e.candidate });
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

function toggleMute() {
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
}























