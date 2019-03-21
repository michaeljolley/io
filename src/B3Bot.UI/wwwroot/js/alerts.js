"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/b3BotHub").build();

connection.on("NewFollower", function (follower) {

    var div = document.createElement("div");
    var id = +(new Date());

    div.classList.add('newFollower');

    div.innerText = follower.displayName + ' just followed.';

    


    $("#container").append(div);
}); 

connection.on("NewCheer", function (bitReceived) {

    var div = document.createElement("div");
    var id = +(new Date());

    div.innerText = bitReceived.username + ' just cheered ' + bitReceived.bitsUsed + '.';

    $("#container").append(div);
}); 

connection.on("NewSubscription", function (subscription) {

    var div = document.createElement("div");
    var id = +(new Date());

    var name = subscription.recipientDisplayName === undefined ? subscription.displayName : subscription.recipientDisplayName;

    div.innerText = name + ' just subscribed.';

    $("#container").append(div);
}); 

connection.start();
