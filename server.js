const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId }) => {
    socket.join(roomId);

    // DEMO emotion stream (replace with real detection if needed)
    setInterval(() => {
      const emotions = [
        "happy","neutral","sad",
        "angry","surprised","disgusted","fearful"
      ];
      const randomEmotion =
        emotions[Math.floor(Math.random() * emotions.length)];

      socket.to(roomId).emit("emotionUpdate", randomEmotion);
      socket.emit("emotionUpdate", randomEmotion);
    }, 3000);
  });
});

server.listen(3000, () => {
  console.log("MoodSync running on http://localhost:3000");
});
