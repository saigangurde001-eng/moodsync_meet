const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const roomParticipants = {};

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, name, isHost }) => {
    socket.join(roomId);

    if (!roomParticipants[roomId]) {
      roomParticipants[roomId] = {};
    }

    roomParticipants[roomId][socket.id] = { name, isHost };

    const clients = io.sockets.adapter.rooms.get(roomId);
    if (clients && clients.size > 1) {
      socket.to(roomId).emit("ready");
    }
  });

  /* EMOTIONS */
  socket.on("emotion", ({ roomId, emotion }) => {
    socket.to(roomId).emit("emotion-update", emotion);
  });

  /* CHAT */
  socket.on("chat-message", ({ roomId, name, message }) => {
    io.to(roomId).emit("chat-message", {
      name,
      message,
      time: new Date().toLocaleTimeString()
    });
  });

  /* WEBRTC */
  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
