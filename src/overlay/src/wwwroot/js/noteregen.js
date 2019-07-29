"use strict";

const socket = io('http://localhost:5060');

const streamIdEl = document.getElementById('streamId');
const submitEl = document.getElementById('submit');

submitEl.onclick = () => {

    if (streamIdEl.value && streamIdEl.value.length > 0) {
        socket.emit('StreamNoteRebuild', streamIdEl.value);
        console.log(`regen submitted for ${streamIdEl.value}`);
    }
};
