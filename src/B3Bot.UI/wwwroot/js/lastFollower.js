"use strict";

var connection = new signalR.HubConnectionBuilder()
    .withUrl("/b3BotHub")
    .build();

connection.on("ReceiveLastFollower", function (streamUserModel) {
    var profileImg = document.getElementById('profileImageUrl');
    var userName = document.getElementById('displayName');

    profileImg.src = streamUserModel.profileImageUrl;
    userName.innerText = streamUserModel.displayName;
});

connection.onclose(async () => {
    await start();
});

connection.start().then(function () {
    connection.invoke('RequestLastFollower');
});

async function start() {
    try {
        await connection.start().then(function () {
            connection.invoke('RequestLastFollower');
        });
    } catch (err) {
        setTimeout(() => start(), 5000);
    }
}

