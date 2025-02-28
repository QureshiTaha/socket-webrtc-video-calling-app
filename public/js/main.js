const createUserBtn = document.getElementById("create-user");
const username = document.getElementById("username");
const allusersHtml = document.getElementById("allusers");
const remoteVideo = document.getElementById("remoteVideo");
const remoteAudio = document.getElementById("remoteAudio");
const endCallBtn = document.getElementById("end-call-btn");
const videoToggle = document.getElementById("video-toggle");
const NotificationPlayer = document.getElementById("notificationPlayer");
const DisconnectedPlayer = document.getElementById("disconnectedPlayer");
const answerButton = document.getElementById("answerCall");
const declineButton = document.getElementById("declineCall");
const logout = document.getElementById("logout");
const usernameContainer = document.querySelector(".username-input");
const localVideoContainer = document.getElementById("local-video-container");
const remoteVideoContainer = document.getElementById("remote-video-container");
const widgetContainer = document.getElementById("widget-container");

const toastLiveExample = document.getElementById('liveToast')
const liveToastTitle = document.getElementById('liveToastTitle')
const liveToastBody = document.getElementById('liveToastBody')

const socket = io();
let localStream;
let caller = [];
let onCall = false;

// Single Method for peer connection
const PeerConnection = (function () {
  let peerConnection;

  const createPeerConnection = () => {
    const config = {
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    };
    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
    peerConnection.ontrack = function (event) {
      console.log("event", event.streams);
      const Rvideo = document.createElement("video");
      Rvideo.setAttribute("playsinline", true);
      Rvideo.setAttribute("autoplay", true);
      Rvideo.setAttribute("id", `${event.streams[0].id}`);
      Rvideo.classList.add("remote-video");

      if (!document.getElementById(`${event.streams[0].id}`)) {
        remoteVideoContainer.appendChild(Rvideo);
      }

      Rvideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = function (event) {
      if (event.candidate) {
        socket.emit("icecandidate", event.candidate);
      }
    };
    peerConnection.oniceconnectionstatechange = function (event) {
      console.log(
        "ICE connection state change:",
        event.target.iceConnectionState
      );
    };
    return peerConnection;
  };

  return {
    getInstance: () => {
      if (!peerConnection) {
        peerConnection = createPeerConnection();
      }
      return peerConnection;
    },
    rebuild: () => {
      if (!peerConnection) {
        peerConnection = createPeerConnection();
      } else {
        peerConnection.close();
        peerConnection = createPeerConnection();
      }
      return peerConnection;
    },
  };
})();

// handle browser events
createUserBtn.addEventListener("click", async (e) => {
  if (username.value !== "") {
    const video = document.createElement("video");
    video.setAttribute("playsinline", true);
    video.setAttribute("muted", true);
    video.setAttribute("autoplay", true);
    video.setAttribute("id", "localVideo");
    container = document.getElementById("local-video-container");
    container.appendChild(video);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    console.log({ stream });
    localStream = stream;
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute("playsinline", true);
    video.setAttribute("autoplay", true);
    video.setAttribute("muted", true);
    videoToggle.children[0].classList.add("fa-video-slash");
    socket.emit("join-user", username.value);
    usernameContainer.classList.add("d-none");
    logout.classList.remove("d-none");
  }
});
endCallBtn.addEventListener("click", (e) => {
  socket.emit("call-ended", caller);
});
// Add an event listener for the beforeunload event
window.addEventListener("beforeunload", async (event) => {
  await socket.emit("disconnected", username.value);
  event.preventDefault();
});
logout.addEventListener("click", async (e) => {
  console.log("disconnect");
  await socket.emit("disconnected", username.value);
  logout.classList.add("d-none");
  usernameContainer.classList.remove("d-none");
  allusersHtml.innerHTML = "";
  localVideoContainer.innerHTML = "";
  videoToggle.children[0].classList.add("fa-video-slash");
  videoToggle.children[0].classList.remove("fa-video");
  localStream.getVideoTracks()[0].enabled = false;
});
// Video Toggle
videoToggle.addEventListener("click", (e) => {
  if (localStream.getVideoTracks()[0].enabled) {
    localStream.getVideoTracks()[0].enabled = false;
    videoToggle.children[0].classList.remove("fa-video-slash");
    videoToggle.children[0].classList.add("fa-video");
  } else {
    localStream.getVideoTracks()[0].enabled = true;
    videoToggle.children[0].classList.add("fa-video-slash");
    videoToggle.children[0].classList.remove("fa-video");
  }
});

// handle socket events
socket.on("joined", (allusers) => {
  createUsersHtml(allusers);
});
socket.on("offer", async ({ from, to, offer }) => {
  NotificationPlayer.loop = true;
  NotificationPlayer.volume = 0.5;
  NotificationPlayer.play();
  widgetContainer.classList.remove("d-none");
  caller = [from, to];
  notifyMe({ callerName: `${from}` });
  answerButton.addEventListener("click", async () => {
    NotificationPlayer.pause();
    onCall = true;
    const pc = PeerConnection.getInstance();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { from, to, answer: pc.localDescription });
    answerButton.classList.add("d-none");
    declineButton.classList.add("d-none");
  });
  declineButton.addEventListener("click", () => {
    NotificationPlayer.pause();
    endCall();
  });
  answerButton.classList.remove("d-none");
  declineButton.classList.remove("d-none");
  setTimeout(() => {
    if (!onCall) {
      NotificationPlayer.pause();
      endCall();
    }
  }, 45000);
});
socket.on("answer", async ({ from, to, answer }) => {
  const pc = PeerConnection.getInstance();
  await pc.setRemoteDescription(answer);
  widgetContainer.classList.remove("d-none");
  endCallBtn.classList.remove("d-none");
  socket.emit("end-call", { from, to });
  caller = [from, to];
});
socket.on("icecandidate", async (candidate) => {
  console.log({ candidate });
  const pc = PeerConnection.getInstance();
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
});
socket.on("end-call", ({ from, to }) => {
  endCallBtn.classList.remove("d-none");
});
socket.on("call-ended", (caller) => {
  DisconnectedPlayer.play();
  endCall();
});

socket.on("disconnected", (allusers) => {
  console.log("disconnected", { username });
  createUsersHtml(allusers);
});

socket.on("error", (error) => {
  console.log("error", error);
  liveToastBody.innerText = error;
  liveToastTitle.innerText = "Error";
  toastBootstrap.show();  
  alert(error);
});

socket.on("update-users", (allusers) => {
  createUsersHtml(allusers);
})

const endCall = () => {
  const pcOld = PeerConnection.getInstance();
  const pc = PeerConnection.rebuild();
  if (pc) {
    console.log("pcOld",pcOld);
    console.log("call ended with pc new",pc);
    // Distroy and recreate peerconnection
    endCallBtn.classList.add("d-none");
    declineButton.classList.add("d-none");
    answerButton.classList.add("d-none");
    widgetContainer.classList.add("d-none");
    document.querySelectorAll(".remote-video").forEach((el) => el.remove());
    document.querySelectorAll(".local-video").forEach((el) => el.remove());
    caller = [];
    onCall = false;
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  } else {
    console.log("call ended without pc");
  }
};

const createUsersHtml = (allusers) => {
  allusersHtml.innerHTML = "";
  for (const user in allusers) {
    const li = document.createElement("li");
    li.setAttribute("id", user);
    li.textContent = `${user} ${user === username.value ? "(You)" : ""}`;

    if (user !== username.value) {
      const button = document.createElement("button");
      button.classList.add("call-btn");
      button.addEventListener("click", async () => {
        const pc = PeerConnection.getInstance();
        const offer = await pc.createOffer();
        console.log("offer", { offer });
        await pc.setLocalDescription(offer);
        socket.emit("offer", {
          from: username.value,
          to: user,
          offer: pc.localDescription,
        });
      });
      const img = document.createElement("img");
      img.setAttribute("src", "/images/phone.png");
      img.setAttribute("width", 20);
      button.appendChild(img);
      li.appendChild(button);
      Userstatus = document.createElement("span");
      Userstatus.classList.add("userStatus");
      Userstatus.classList.add(allusers[user].status);
      li.appendChild(Userstatus);
    }
    allusersHtml.appendChild(li);
  }
};
