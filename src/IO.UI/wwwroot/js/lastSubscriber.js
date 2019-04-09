"use strict";

var connection = new signalR.HubConnectionBuilder()
    .withUrl("/IO-Overlay")
    .build();

connection.on("ReceiveLastSubscriber", function (streamUserModel) {
    var profileImg = document.getElementById('profileImageUrl');
    var userName = document.getElementById('displayName');

    profileImg.src = streamUserModel.profileImageUrl;
    userName.innerText = streamUserModel.displayName;
});

connection.onclose(async () => {
    await start();
});

connection.start();

async function start() {
    try {
        await connection.start();
    } catch (err) {
        setTimeout(() => start(), 5000);
    }
}

