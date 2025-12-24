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

    setInterval(() => {
      const emotions = [
        "happy","neutral","sad",
        "angry","surprised","disgusted","fearful"
      ];
      const emotion = emotions[Math.floor(Math.random() * emotions.length)];
      io.to(roomId).emit("emotionUpdate", emotion);
    }, 3000);
  });
});

server.listen(3000, () => {
  console.log("MoodSync running on http://localhost:3000");
});
