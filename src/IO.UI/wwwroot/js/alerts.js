"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/IO-Alert").build();

connection.on("ReceiveNewFollower", function (follower) {

    if (follower.displayName &&
        follower.displayName.length > 0) {

        var msg = follower.displayName + ' just followed!';

        var div = createDiv('newFollower');
        $("#container").append(div);
        typeWriter(div, msg, 0);

        setTimeout(removeDiv, 7500, div.id);
    }
});

connection.on("ReceiveNewCheer", function (bitReceived) {

    if (bitReceived.username &&
        bitReceived.username.length > 0) {

        var msg = bitReceived.username + ' just cheered ' + bitReceived.bitsUsed + ' bits!';

        var div = createDiv('newCheer');
        $("#container").append(div);
        typeWriter(div, msg, 0);

        setTimeout(removeDiv, 7500, div.id);
    }
});

connection.on("ReceiveNewSubscriber", function (subscription) {

    var name = subscription.recipientDisplayName === undefined ? subscription.displayName : subscription.recipientDisplayName;
    var msg = name + ' just subscribed!';

    var div = createDiv('newSubscriber');
    $("#container").append(div);
    typeWriter(div, msg, 0);

    setTimeout(removeDiv, 7500, div.id);
});

connection.on("ReceiveNewRaid", function (raid) {

    var msg = raid.raidNotification.displayName + ' just raided with ' + raid.raidNotification.msgParamViewerCount + ' viewers!';

    var div = createDiv('newRaid');
    $("#container").append(div);
    typeWriter(div, msg, 0);

    setTimeout(removeDiv, 7500, div.id);
});

connection.onclose(async () => {
    console.log('Closing (Alerts)');
    await start();
});

connection.start();

async function start() {
    try {
        console.log('Reconnecting (Alerts)');
        await connection.start();
    } catch (err) {
        setTimeout(() => start(), 5000);
    }
}

function createDiv(cssClass) {
    var id = +(new Date());

    var newDiv = document.createElement('div');
    newDiv.classList.add(cssClass);
    newDiv.id = id;

    return newDiv;
}

function typeWriter(container, textToWrite, i) {
    var speed = 50;
    if (i < textToWrite.length) {
        container.innerHTML += textToWrite.charAt(i);
        i++;
        setTimeout(typeWriter, speed, container, textToWrite, i);
    }
}

function removeDiv(id) {
    $('#' + id).fadeOut('slow', () => {
        $('#' + id).remove();
    });
}