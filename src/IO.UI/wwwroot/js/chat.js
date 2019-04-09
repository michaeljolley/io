"use strict";

var connection = new signalR.HubConnectionBuilder()
    .withUrl("/IO-Chat")
    .build();

connection.on("ReceiveChatMessage", function (chatMessage) {
    var msg = document.createElement('div');

    var id = +(new Date());
    msg.id = 'msg' + id.toString();

    console.log(JSON.stringify(chatMessage));

    msg.classList.add('chatMessage');
    msg.innerHTML = chatMessage.hubMessage;

    $('#msg' + id).hide();
    $(".chatBox").append(msg);

    calcPositions(msg);

    $('#msg' + id).fadeIn('slow');

    setTimeout(function (id) {
        $('#msg' + id).fadeOut('slow', () => {
            $('#msg' + id).remove();
        });
    }, 50000, id);
});


connection.on("ReceiveEmote", function (emojiUrl) {
    console.log(emojiUrl);
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

function calcPositions(newMessageDiv) {
    var nextBottom = 0;
    var transparency = 100;
    $($('.chatBox .chatMessage').get().reverse()).each(function (i, el) {
        if (transparency < 0) {
            $(el).remove();
        }
        else {
            transparency = (nextBottom / 100) * 15;
            $(el).css('bottom', nextBottom).css({ 'opacity': 1 - (transparency / 100) });
            nextBottom = nextBottom + $(el).height() + 25;
        }
    });
}