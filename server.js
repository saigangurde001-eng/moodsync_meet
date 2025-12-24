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

    io.to(roomId).emit(
      "participants-update",
      Object.values(roomParticipants[roomId])
    );

    const clients = io.sockets.adapter.rooms.get(roomId);
    if (clients && clients.size > 1) {
      socket.to(roomId).emit("ready");
    }
  });

  // Emotion data
  socket.on("emotion", ({ roomId, emotion }) => {
    socket.to(roomId).emit("emotion-update", emotion);
  });

  // WebRTC signaling
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
    for (const roomId in roomParticipants) {
      if (roomParticipants[roomId][socket.id]) {
        delete roomParticipants[roomId][socket.id];
        io.to(roomId).emit(
          "participants-update",
          Object.values(roomParticipants[roomId])
        );
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});




