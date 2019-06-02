"use strict";

const socket = io('http://localhost:5060');

socket.on('viewerCount', (viewerCount) => {
    var counter = document.getElementById('counter');
    counter.innerText = viewerCount;
});
