"use strict";

var alertConnection = new signalR.HubConnectionBuilder()
    .withUrl("/IO-Overlay")
    .build();

alertConnection.on("ReceiveViewerCount", function (count) {
    console.log('Updated viewer count: ' + count);
    var counter = document.getElementById('counter');
    counter.innerText = count;
});

alertConnection.onclose(async () => {
    console.log('Closing (Viewer)');
    await startAlertConnection();
});

alertConnection.start();

async function startAlertConnection() {
    try {
        console.log('Reconnecting (Viewer)');
        await alertConnection.start();
    } catch (err) {
        setTimeout(() => startAlertConnection(), 5000);
    }
}
