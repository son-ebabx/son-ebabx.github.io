//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; //stream from getUserMedia()
var rec; //Recorder.js object
var input; //MediaStreamAudioSourceNode we'll be recording

// shim for AudioContext when it's not avb.
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext; //audio context to help us record

var recordButton = document.getElementById("recordButton");
var stopButton = document.getElementById("stopButton");

var recorded = document.getElementById("recorded");
var temps = document.getElementById("length");
var recordingsList = document.getElementById("recordingsList");

//add events to those 2 buttons
recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
// playButton.addEventListener("click", playRecording);

var filename = new Date().toISOString();

document.getElementById("recording-tmp").innerText = filename + ".wav";

var volumeFrame;
var requestAnimationFrame =
  window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.msRequestAnimationFrame;

var cancelAnimationFrame =
  window.cancelAnimationFrame || window.mozCancelAnimationFrame;

var start = window.mozAnimationStartTime;

var sec = 0;
function pad(val) {
  return val > 9 ? val : "0" + val;
}
var timer;

function startRecording() {
  console.log("recordButton clicked");

  if (!stopButton.disabled && recordButton.disabled) {
    setTimeout(function () {
      stopRecording();
    }, 50000);
  }

  /*
		Simple constraints object, for more advanced audio features see
		https://addpipe.com/blog/audio-constraints-getusermedia/
	*/

  var constraints = { audio: true, video: false };

  /*
    	Disable the record button until we get a success or fail from getUserMedia() 
	*/

  recordButton.disabled = true;
  stopButton.disabled = false;

  function createRemap(inMin, inMax, outMin, outMax) {
    return function remaper(x) {
      return ((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    };
  }

  const mapVolume = createRemap(0, 150, 0, 100);

  /*
    	We're using the standard promise based getUserMedia() 
    	https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
	*/

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(function (stream) {
      console.log(
        "getUserMedia() success, stream created, initializing Recorder.js ..."
      );

      /*
			create an audio context after getUserMedia is called
			sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
			the sampleRate defaults to the one set in your OS for your playback device

		*/
      audioContext = new AudioContext();

      /*  assign to gumStream for later use  */
      gumStream = stream;

      /* use the stream */
      input = audioContext.createMediaStreamSource(stream);

      /* 
			Create the Recorder object and configure to record mono sound (1 channel)
			Recording 2 channels  will double the file size
		*/
      rec = new Recorder(input, { numChannels: 1 });

      // temps.style.display = "block";
      timer = setInterval(function () {
        document.getElementById("seconds").innerHTML = pad(++sec % 60);
        document.getElementById("minutes").innerHTML = pad(
          parseInt(sec / 60, 10)
        );
      }, 1000);
      //start the recording process
      rec.record();

      document.getElementById("recording-icon").style.borderColor = "#ed341d";
      document.getElementById("recording-icon").style.borderWidth = "10px";
      document.getElementById("recording-icon").style.borderRadius = "100%";

      document.getElementById("stopButton").style.backgroundColor = "white";
      // document.getElementById("playButton").style.borderColor =
      // "transparent transparent transparent #666666";

      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      microphone.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      function readVolume() {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        const arraySum = array.reduce((a, value) => a + value, 0);
        const average = arraySum / array.length;
        const volume = Math.round(mapVolume(average));
        document.querySelector("#l").style.width = volume + "%";
        document.querySelector("#r").style.width = volume + "%";
        volumeFrame = requestAnimationFrame(readVolume);
      }

      volumeFrame = requestAnimationFrame(readVolume);
    })
    .catch(function (err) {
      recordButton.disabled = false;
      stopButton.disabled = true;
    });
}

function stopRecording() {
  cancelAnimationFrame(volumeFrame);

  filename = new Date().toISOString();

  document.getElementById("recording-tmp").innerText = filename + ".wav";

  document.querySelector("#l").style.width = "1%";
  document.querySelector("#r").style.width = "1%";

  console.log("stopButton clicked");
  // temps.style.display = "none";
  document.getElementById("seconds").innerHTML = "00";
  document.getElementById("minutes").innerHTML = "00";
  sec = 0;
  clearInterval(timer);

  //disable the stop button, enable the record too allow for new recordings
  stopButton.disabled = true;
  recordButton.disabled = false;

  //reset button just in case the recording is stopped while paused

  //tell the recorder to stop the recording
  rec.stop();

  document.getElementById("recording-icon").style.borderRadius = "2px";
  document.getElementById("recording-icon").style.borderColor = "#525896";
  document.getElementById("recording-icon").style.borderWidth = "10px";

  document.getElementById("stopButton").style.backgroundColor = "#666666";
  // document.getElementById("playButton").style.borderColor =
  //   "transparent transparent transparent white";
  // document.getElementById("playButton").disabled = false;

  // document.getElementById("recording-icon").style.borderRadius = "2px";
  // document.getElementById("recording-icon").style.borderColor = "transparent transparent transparent #525896";
  // document.getElementById("recording-icon").style.borderWidth = "10px 0px 10px 20px";

  //stop microphone access
  gumStream.getAudioTracks()[0].stop();

  //create the wav blob and pass it on to createDownloadLink
  rec.exportWAV(createDownloadLink);
}

function createDownloadLink(blob) {
  var url = URL.createObjectURL(blob);
  var au = document.createElement("audio");
  var li = document.createElement("li");

  //name of .wav file to use during upload and download (without extendion)

  //add controls to the <audio> element
  au.controls = true;
  au.src = url;

  //add the new audio element to li

  // ANCIEN SAVE TODO

  var title = document.createElement("p");
  title.innerHTML = filename + '.wav';
  li.appendChild(title);
  li.appendChild(au);

  // upload.addEventListener("click", function(event){
  var upload = document.createElement("a");
  upload.href = "#";
  upload.classList += "hoverme";
  upload.innerHTML = "Envoyer l'enregistrement";
  upload.addEventListener("click", function (event) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function (e) {
      if (this.readyState === 4) {
        console.log("Server returned: ", e.target.responseText);
      }
    };
    var fd = new FormData();
    fd.append("audio_data", blob, filename);
    xhr.open("POST", "https://recorder.antoine.world/upload.php", true);
    xhr.send(fd);
    setTimeout(function () {
      upload.innerHTML = "Merci pour cet enregistrement !";
      upload.classList = "disabled";
    }, 600);
  });

  recorded.style.display = "block";

  li.appendChild(document.createTextNode(" ")); //add a space in between
  li.appendChild(upload);

  //add the li element to the ol
  recordingsList.appendChild(li);

  $(".modal").toggle();
  $('.modal-bg').toggle();

  $(".hoverme").on("click", function () {
    function random(max) {
      return Math.random() * (max - 0) + 0;
    }

    var c = document.createDocumentFragment();
    for (var i = 0; i < 100; i++) {
      var styles =
        "transform: translate3d(" +
        (random(500) - 250) +
        "px, " +
        (random(200) - 150) +
        "px, 0) rotate(" +
        random(360) +
        "deg);\
						  background: hsla(" +
        random(360) +
        ",100%,50%,1);\
						  animation: bang 700ms ease-out forwards;\
						  opacity: 0";

      var e = document.createElement("i");
      e.style.cssText = styles.toString();
      c.appendChild(e);
    }

    // $(".list").delay(300).fadeOut(300);
    // $(".recorder").delay(300).fadeOut(300);

    // setTimeout(function () {
    //   $(".thanks").show();
    // }, 650);

    // document.body.appendChild(c);
    $(this).append(c);
  });
}

$(document).ready(function () {
  $("#close-modal").click(function () {
    $(".modal").toggle();
    $('.modal-bg').toggle();
  });
});

// function playRecording() {
//   document.getElementById("recordButton").style.backgroundColor = "#666666";
//   document.getElementById("playButton").style.borderColor =
//     "transparent transparent transparent rgb(110,225,40)";
//   document.getElementById("recording-icon").style.borderRadius = "2px";
//   document.getElementById("recording-icon").style.borderColor =
//     "transparent transparent transparent #525896";
//   document.getElementById("recording-icon").style.borderWidth =
//     "10px 0px 10px 20px";

//   recordingsList.querySelector("li:last-child > audio").play();
//   recordingsList
//     .querySelector("li:last-child > audio")
//     .addEventListener("ended", function () {
//       recordButton.disabled = false;
//       stopButton.disabled = true;
//       playButton.disabled = false;
//       document.getElementById("recordButton").style.backgroundColor = "red";
//       document.getElementById("playButton").style.borderColor =
//         "transparent transparent transparent white";
//       document.getElementById("recording-icon").style.borderRadius = "2px";
//       document.getElementById("recording-icon").style.borderColor = "#525896";
//       document.getElementById("recording-icon").style.borderWidth = "10px";
//     });

//   const analyser = audioContext.createAnalyser();
//   const microphone = audioContext.createMediaStreamSource(stream);
//   const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

//   analyser.smoothingTimeConstant = 0.8;
//   analyser.fftSize = 1024;

//   microphone.connect(analyser);
//   analyser.connect(scriptProcessor);
//   scriptProcessor.connect(audioContext.destination);

//   function readVolume() {
//     const array = new Uint8Array(analyser.frequencyBinCount);
//     analyser.getByteFrequencyData(array);
//     const arraySum = array.reduce((a, value) => a + value, 0);
//     const average = arraySum / array.length;
//     const volume = Math.round(mapVolume(average));
//     document.querySelector("#l").style.width = volume + "%";
//     document.querySelector("#r").style.width = volume + "%";
//     volumeFrame = requestAnimationFrame(readVolume);
//   }

//   volumeFrame = requestAnimationFrame(readVolume);
//   recordButton.disabled = true;
//   stopButton.disabled = true;
//   playButton.disabled = true;
// }
