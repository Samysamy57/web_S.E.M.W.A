<<<<<<< HEAD
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("Un utilisateur est connecté :", socket.id);

  socket.on("chat message", (data) => {
    console.log("Message reçu :", data);
    socket.join(data.room)
    console.log(data.content)
    io.to(data.room).emit("chat message", data.content);
  });

  socket.on("disconnect", () => {
    console.log("Utilisateur déconnecté :", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Serveur lancé sur http://localhost:3000");
=======
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("Un utilisateur est connecté :", socket.id);

  socket.on("chat message", (data) => {
    console.log("Message reçu :", data);
    socket.join(data.room)
    console.log(data.content)
    io.to(data.room).emit("chat message", data.content);
  });

  socket.on("disconnect", () => {
    console.log("Utilisateur déconnecté :", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Serveur lancé sur http://localhost:3000");
>>>>>>> 7d9a84a914d96001583e64e38b500f9fb7a0cc54
});