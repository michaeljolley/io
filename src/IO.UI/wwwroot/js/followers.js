"use strict";

var connection = new signalR.HubConnectionBuilder()
    .withUrl("/IO-Overlay")
    .build();

connection.on("ReceiveFollowerCount", function (count) {
    console.log('Updated follower count: ' + count);
    var counter = document.getElementById('counter');
    counter.innerText = count;
});

connection.onclose(async () => {
    console.log('Closing (Follower)');
    await start();
});

connection.start();

async function start() {
    try {
        console.log('Reconnecting (Follower)');
        await connection.start();
    } catch (err) {
        setTimeout(() => start(), 5000);
    }
}

