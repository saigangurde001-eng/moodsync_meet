const socket = io();

/* UI elements */
const joinScreen = document.getElementById("joinScreen");
const meetingScreen = document.getElementById("meetingScreen");

const hostBtn = document.getElementById("hostBtn");
const joinBtn = document.getElementById("joinBtn");
const endMeetingBtn = document.getElementById("endMeetingBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const usernameInput = document.getElementById("username");
const roomInput = document.getElementById("roomId");
const meetingCodeDisplay = document.getElementById("meetingCodeDisplay");

const video = document.getElementById("video");
const emotionText = document.getElementById("emotionText");
const overallMoodText = document.getElementById("overallMood");

/* Emotion counts */
const emotions = {
  happy: 0,
  neutral: 0,
  sad: 0,
  angry: 0,
  surprised: 0,
  disgusted: 0,
  fearful: 0
};

let localStream = null;
let emotionChart;

/* ---------- INIT ---------- */
window.onload = () => {
  joinScreen.style.display = "flex";
  meetingScreen.style.display = "none";
};

/* ---------- START MEETING ---------- */
async function startMeeting(isHost) {
  const username = usernameInput.value.trim();
  const roomId = roomInput.value.trim();

  if (!username || !roomId) {
    alert("Enter name and meeting code");
    return;
  }

  joinScreen.style.display = "none";
  meetingScreen.style.display = "block";
  meetingCodeDisplay.innerText = `Meeting: ${roomId}`;

  socket.emit("join-room", { roomId, username, isHost });

  localStream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = localStream;

  initChart();
}

hostBtn.onclick = () => startMeeting(true);
joinBtn.onclick = () => startMeeting(false);

/* ---------- EMOTION UPDATE ---------- */
socket.on("emotionUpdate", (emotion) => {
  if (!emotions.hasOwnProperty(emotion)) return;

  emotions[emotion]++;
  document.getElementById(`${emotion}Count`).innerText = emotions[emotion];
  emotionText.innerText = emotion;

  updateChart();
  updateOverallMood();
});

/* ---------- CHART ---------- */
function initChart() {
  const ctx = document.getElementById("emotionChart");
  emotionChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(emotions),
      datasets: [{
        data: Object.values(emotions)
      }]
    }
  });
}

function updateChart() {
  emotionChart.data.datasets[0].data = Object.values(emotions);
  emotionChart.update();
}

/* ---------- OVERALL MOOD ---------- */
function updateOverallMood() {
  let maxEmotion = "neutral";
  let maxValue = 0;

  for (let e in emotions) {
    if (emotions[e] > maxValue) {
      maxValue = emotions[e];
      maxEmotion = e;
    }
  }

  overallMoodText.innerText =
    maxEmotion === "happy" || maxEmotion === "surprised"
      ? "Engaging 😊"
      : maxEmotion === "neutral"
      ? "Neutral 😐"
      : "Low Engagement 😴";
}

/* ---------- FULLSCREEN ---------- */
fullscreenBtn.onclick = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};

/* ---------- END MEETING ---------- */
endMeetingBtn.onclick = () => {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  socket.disconnect();
  location.reload();
};
