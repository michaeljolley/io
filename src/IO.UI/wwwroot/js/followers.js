"use strict";

var alertConnection = new signalR.HubConnectionBuilder()
    .withUrl("/IO-Overlay")
    .build();

alertConnection.on("ReceiveFollowerCount", function (count) {
    console.log('Updated follower count: ' + count);
    var counter = document.getElementById('counter');
    counter.innerText = count;
});

alertConnection.onclose(async () => {
    console.log('Closing (Follower)');
    await startAlertConnection();
});

alertConnection.start();

async function startAlertConnection() {
    try {
        console.log('Reconnecting (Follower)');
        await alertConnection.start();
    } catch (err) {
        setTimeout(() => startAlertConnection(), 5000);
    }
}

