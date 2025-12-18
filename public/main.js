const socket = io();

let localStream;
let peer;
let roomId;
let isHost = false;
let chart;

const emotions = {
  happy: 0,
  neutral: 0,
  sad: 0,
  angry: 0,
  surprised: 0,
  fearful: 0,
  disgusted: 0
};

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

/* Load emotion models */
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models")
]);

/* ================= HOST / JOIN ================= */

function hostMeeting() {
  isHost = true;
  roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  alert("Meeting Code: " + roomId);
  showMediaStart();
}

function joinMeeting() {
  roomId = document.getElementById("roomInput").value.trim().toUpperCase();
  if (!roomId) return alert("Enter meeting code");
  showMediaStart();
}

function showMediaStart() {
  document.getElementById("joinSection").style.display = "none";
  document.getElementById("mediaSection").style.display = "block";
}

/* ================= START MEDIA ================= */

function startMedia() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localStream = stream;
      localVideo.srcObject = stream;
      localVideo.muted = true;
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
    })
    .catch(err => {
      alert("Please allow camera & microphone");
      console.error(err);
    });
}

/* ================= WEBRTC ================= */

function createPeer() {
  peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(track =>
    peer.addTrack(track, localStream)
  );

  peer.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.play().catch(() => {});
  };

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("ice-candidate", {
        roomId,
        candidate: e.candidate
      });
    }
  };
}

/* 🔑 READY → CREATE OFFER (HOST OR FIRST PEER) */
socket.on("ready", async () => {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("offer", { roomId, offer });
});

/* 🔁 RECEIVE OFFER */
socket.on("offer", async offer => {
  await peer.setRemoteDescription(offer);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit("answer", { roomId, answer });
});

/* 🔁 RECEIVE ANSWER */
socket.on("answer", async answer => {
  await peer.setRemoteDescription(answer);
});

/* 🔁 ICE CANDIDATES */
socket.on("ice-candidate", async candidate => {
  if (candidate) {
    await peer.addIceCandidate(candidate);
  }
});

/* ================= MUTE ================= */

function toggleMute() {
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
}

/* ================= EMOTION DETECTION ================= */

function startEmotionDetection() {
  setInterval(async () => {
    const det = await faceapi
      .detectSingleFace(
        localVideo,
        new faceapi.TinyFaceDetectorOptions()
      )
      .withFaceExpressions();

    if (det && det.expressions) {
      const emotion = Object.keys(det.expressions)
        .reduce((a, b) =>
          det.expressions[a] > det.expressions[b] ? a : b
        );

      socket.emit("emotion", { roomId, emotion });
    }
  }, 6000);
}

/* ================= DASHBOARD ================= */

socket.on("emotion-update", emotion => {
  if (!isHost) return;
  emotions[emotion]++;
  updateDashboard();
});

function initChart() {
  chart = new Chart(document.getElementById("emotionChart"), {
    type: "pie",
    data: {
      labels: Object.keys(emotions),
      datasets: [{
        data: Object.values(emotions)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function updateDashboard() {
  for (let e in emotions) {
    const el = document.getElementById(e);
    if (el) el.innerText = emotions[e];
  }
  chart.data.datasets[0].data = Object.values(emotions);
  chart.update();
}


















