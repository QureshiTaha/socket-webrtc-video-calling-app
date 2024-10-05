import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const app = express();
const server = createServer(app);
const io = new Server(server);
const allusers = {};

// /your/system/path
const __dirname = dirname(fileURLToPath(import.meta.url));

// exposing public directory to outside world
app.use(express.static("public"));

// handle incoming http request
app.get("/", (req, res) => {
  console.log("GET Request /");
  res.sendFile(join(__dirname + "/app/index.html"));
});

// handle socket connections
io.on("connection", (socket) => {
  console.log(
    `Someone connected to socket server and socket id is ${socket.id}`
  );
  socket.on("join-user", (username) => {
    console.log(`${username} joined socket connection`);
    allusers[username] = { username, id: socket.id, status: "online" };
    io.emit("joined", allusers);
  });

  socket.on("offer", ({ from, to, offer }) => {
    allusers[from].status = "busy";
    if (allusers[to].status === "online") {
      io.to(allusers[to].id).emit("offer", { from, to, offer });
    } else if (allusers[to].status === "busy") {
      io.to(allusers[from].id).emit("user-busy", { from, to });
    } else {
      allusers[to].status = "offline";
      io.to(allusers[from].id).emit("user-offline", { from, to });
    }
  });

  socket.on("answer", ({ from, to, answer }) => {
    allusers[from].status = "busy";
    allusers[to].status = "busy";
    io.to(allusers[from].id).emit("answer", { from, to, answer });
  });

  socket.on("end-call", ({ from, to }) => {
    allusers[from].status = "online";
    allusers[to].status = "online";
    io.to(allusers[to].id).emit("end-call", { from, to });
    io.to(allusers[from].id).emit("end-call", { from, to });
  });

  socket.on("call-ended", (caller) => {
    const [from, to] = caller;
    allusers[from].status = "online";
    allusers[to].status = "online";
    io.to(allusers[from].id).emit("call-ended", caller);
    io.to(allusers[to].id).emit("call-ended", caller);
  });

  socket.on("icecandidate", (candidate) => {
    // console.log({ candidate });
    //broadcast to other peers
    socket.broadcast.emit("icecandidate", candidate);
  });
  socket.on("disconnected", (username) => {
    if (allusers[username]) {
      allusers[username].status = "offline";
    }
    console.log(username + "disconnected");
    socket.broadcast.emit("disconnected", allusers);
  });
});

server.listen(9000, () => {
  console.log(`Server listening on port 9000`);
});
