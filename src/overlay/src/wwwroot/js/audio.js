"use strict";

const socket = io('http://localhost:5060');
const _audioPath = '/assets/audio/clips/';
const container = document.getElementById('container');

socket.on('playAudio', (soundClipName) => {

    var audio = document.createElement('audio');
    audio.src = `${_audioPath}${soundClipName}.mp3`;
    audio.id = +(new Date());
    audio.addEventListener('ended', audioStop, false);

    container.appendChild(audio);

    var playPromise = audio.play().catch(error => {
        throw error;
    });
});

socket.on('stopAudio', () => {
    container.innerHTML = '';
});

function audioStop(e) {
    e.srcElement.remove();
}
