const socket = io();

window.addEventListener("DOMContentLoaded", () => {

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

  // Initial state
  joinScreen.style.display = "flex";
  meetingScreen.style.display = "none";

  async function startMeeting(isHost) {
    console.log("Host/Join clicked", isHost);

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

  hostBtn.addEventListener("click", () => startMeeting(true));
  joinBtn.addEventListener("click", () => startMeeting(false));

  socket.on("emotionUpdate", (emotion) => {
    if (!emotions[emotion]) emotions[emotion] = 0;
    emotions[emotion]++;
    document.getElementById(`${emotion}Count`).innerText = emotions[emotion];
    emotionText.innerText = emotion;
    updateChart();
    updateOverallMood();
  });

  function initChart() {
    const ctx = document.getElementById("emotionChart");
    emotionChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: Object.keys(emotions),
        datasets: [{ data: Object.values(emotions) }]
      }
    });
  }

  function updateChart() {
    emotionChart.data.datasets[0].data = Object.values(emotions);
    emotionChart.update();
  }

  function updateOverallMood() {
    let max = "neutral";
    for (let e in emotions) {
      if (emotions[e] > emotions[max]) max = e;
    }
    overallMoodText.innerText =
      max === "happy" || max === "surprised"
        ? "Engaging 😊"
        : max === "neutral"
        ? "Neutral 😐"
        : "Low Engagement 😴";
  }

  fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });

  endMeetingBtn.addEventListener("click", () => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    socket.disconnect();
    location.reload();
  });

});
