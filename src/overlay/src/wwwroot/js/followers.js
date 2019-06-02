"use strict";

const socket = io('http://localhost:5060');

socket.on('followerCount', (followerCount) => {
    var counter = document.getElementById('counter');
    counter.innerText = followerCount;
});
