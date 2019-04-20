"use strict";

var alertConnection = new signalR.HubConnectionBuilder()
    .withUrl("/IO-Overlay")
    .build();

alertConnection.on("ReceiveLastSubscriber", function (streamUserModel) {
    var profileImg = document.getElementById('profileImageUrl');
    var userName = document.getElementById('displayName');

    profileImg.src = streamUserModel.profileImageUrl;
    userName.innerText = streamUserModel.displayName;
});

alertConnection.onclose(async () => {
    await startAlertConnection();
});

alertConnection.start();

async function startAlertConnection() {
    try {
        await alertConnection.start();
    } catch (err) {
        setTimeout(() => startAlertConnection(), 5000);
    }
}

