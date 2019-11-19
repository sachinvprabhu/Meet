// grab the room from the URL
function randomToken() {
	return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}
var room = randomToken();
if (location.hash) {
	room = location.hash.replace("#", "");
} else {
	location.hash = room;
}

// create our webrtc connection
navigator.mediaDevices.enumerateDevices()
	.then((devices) => {

		this.devices = devices.filter(dev => dev.kind === 'videoinput');

		window.webrtc = new SimpleWebRTC({
			"url": "webrtc.cfapps.eu10.hana.ondemand.com",
			// the id/element dom element that will hold "our" video
			localVideoEl: 'localVideo',
			// the id/element dom element that will hold remote videos
			remoteVideosEl: '',
			// immediately ask for camera access
			autoRequestMedia: true,
			debug: false,
			detectSpeakingEvents: true,
			localVideo: {
				autoplay: true, // automatically play the video stream on the page
				mirror: true, // flip the local video to mirror mode (for UX)
				muted: true // mute local video stream to prevent echo
			},
			media: {
				audio: true,
				video: {
					deviceId: this.devices[this.devices.length - 1].deviceId
				}
			}
		});


		// when it's ready, join if we got a room from the URL
		webrtc.on('readyToCall', function () {
			var video = this.getLocalVideoContainer();

			//$("#localVideoCopy")[0].srcObject = video.captureStream();
			if (room) webrtc.joinRoom(room);
		});
		var highVolume = null;
		var lowVolume = null;
		webrtc.on('channelMessage', function (peer, label, data) {
			if (data.type === "speaking") {
				var mainVideo = document.getElementById('mainVideo');
				mainVideo.srcObject = peer.videoEl.srcObject;
				var volumeBar = document.getElementById('volume_' + peer.id);
				volumeBar.style.maxWidth = "100%";
			} else if (data.type === "stoppedSpeaking") {
				var volumeBar = document.getElementById('volume_' + peer.id);
				volumeBar.style.maxWidth = "2%";
			} else if (data.type === "volume") {
				var volumeBar = document.getElementById('volume_' + peer.id);
				if (data.volume && volumeBar) {
					if (data.volume < lowVolume || !lowVolume) {
						lowVolume = data.volume;
					}
					if (data.volume > highVolume || !highVolume) {
						highVolume = data.volume;
					}
					var normalizedVolume = (data.volume - lowVolume) / (highVolume - lowVolume) * 100;
					volumeBar.style.width = (normalizedVolume) + "%";
				}
			} else if(data.type === "STT"){
				
				var messageContainer = document.getElementById("transcripts");
				var message = document.createElement('div');
				message.className = 'message';
				
				var sender = document.createElement("span");
				sender.className="sender";
				sender.innerHTML=peer.id;
				message.appendChild(sender);
				
				var messageText = document.createElement("span");
				messageText.className="text";
				messageText.innerHTML= data.transcript;
				message.appendChild(messageText);
				
				messageContainer.appendChild(message);
			} else {
				console.log("message", data);
			}
		});
		webrtc.on('videoAdded', function (video, peer) {
			console.log('video added', peer);
			var remotes = document.getElementById('remotes');
			if (remotes) {
				var d = document.createElement('div');
				d.className = 'videoContainer';
				d.id = 'container_' + webrtc.getDomId(peer);
				d.appendChild(video);
				var vol = document.createElement('div'); webrtc.getPeers()
				vol.id = 'volume_' + peer.id;
				vol.className = 'volume_bar';
				video.height = "100%";
				vol.style.maxWidth = "2%";
				video.onclick = function () {
					var mainVideo = document.getElementById('mainVideo');
					mainVideo.srcObject = this.srcObject;
				};
				d.appendChild(vol);
				remotes.appendChild(d);
			}
		});
		webrtc.on('videoRemoved', function (video, peer) {
			console.log('video removed', peer);
			var container = document.getElementById('container_' + webrtc.getDomId(peer));
			if (container) {
				container.remove();
			}
		});
	}).catch((err) => {
		alert("Error loading camera");
	});

var recognition = new webkitSpeechRecognition();
recognition.continuous = false;
recognition.interimResults = false;

recognition.onresult = function (event) {
	var results = $(event.results).toArray();
	var messageContainer = document.getElementById("transcripts");
	var message = document.createElement('div');
	message.className = 'message';
	
	var sender = document.createElement("span");
	sender.className="sender";
	sender.innerHTML="Me:"
	message.appendChild(sender);
	
	var messageText = document.createElement("span");
	messageText.className="text";
	messageText.innerHTML=results[results.length - 1][0].transcript;
	message.appendChild(messageText);
	
	messageContainer.appendChild(message);

	console.log({ type: "text", content: results[results.length - 1][0].transcript });

	webrtc.getPeers().forEach(peer => {
		if(peer.getDataChannel().readyState === "open"){
			peer.getDataChannel().send(JSON.stringify({
				type: "STT",
				transcript: results[results.length - 1][0].transcript
			}));
		}
	});
}
recognition.onend = function () {
	//console.log("Ended")
	setTimeout(function () {
		recognition.start()
	});
}
setTimeout(function () {
	recognition.start();
}, 3000);
