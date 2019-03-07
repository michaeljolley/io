"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/b3BotHub").build();

connection.on("NewEmoji", function (emojiUrl) {
    var img = document.createElement("img");
    img.src = emojiUrl;
    document.getElementById("container").appendChild(img);
});

connection.start();
