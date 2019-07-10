"use strict";

const socket = io('http://localhost:5060');
const _audioPath = '/assets/audio/clips/';
const container = document.getElementById('container');

let avEnabled = true;

socket.on('playAudio', (IMediaEventArg) => {
    if (avEnabled) {
        var audio = document.createElement('audio');
        audio.src = `${_audioPath}${mediaEventArg.clipName}.mp3`;
        audio.id = +(new Date());
        audio.addEventListener('ended', audioStop, false);

        container.appendChild(audio);

        var playPromise = audio.play().catch(error => {
            throw error;
        });
    }
});

socket.on('stopAudio', () => {
    container.innerHTML = '';
});

socket.on('avStateChanged', (isEnabled) => {
    avEnabled = isEnabled;
});


function audioStop(e) {
    e.srcElement.remove();
}
