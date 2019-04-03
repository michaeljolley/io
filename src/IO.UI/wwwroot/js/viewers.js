"use strict";

var connection = new signalR.HubConnectionBuilder()
    .withUrl("/IO")
    .build();

connection.on("ReceiveViewerCount", function (count) {
    console.log('Updated viewer count: ' + count);
    var counter = document.getElementById('counter');
    counter.innerText = count;
});

connection.onclose(async () => {
    console.log('Closing (Viewer)');
    await start();
});

connection.start().then(function () {
    console.log('Connecting (Viewer)');
    connection.invoke('RequestViewerCount');
});

async function start() {
    try {
        console.log('Reconnecting (Viewer)');
        await connection.start();
    } catch (err) {
        setTimeout(() => start(), 5000);
    }
}
