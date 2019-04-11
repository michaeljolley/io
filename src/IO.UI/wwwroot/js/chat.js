"use strict";

var connection = new signalR.HubConnectionBuilder()
    .withUrl("/IO-Chat")
    .build();

connection.on("ReceiveChatMessage", function (chatMessage) {

    console.log(JSON.stringify(chatMessage));

    var id = +(new Date());

    /*
     * Structure of chat bubble is:
     * chatMessage
     *   profile
     *     profileImg
     *   body
     *     bubble
     *       moderator (optional)
     *       message
     *       name
     */

    var newChatMessage = createChatDiv('chatMessage');
    newChatMessage.id = 'msg' + id.toString();

    var body = createChatDiv('body');

    var profile = createChatDiv('profile');

    var profileImg = document.createElement('img');
    profileImg.src = chatMessage.streamUserModel.profileImageUrl;

    profile.append(profileImg);

    var bubble = createChatDiv('bubble');
    
    var name = createChatDiv('name');
    name.innerText = chatMessage.streamUserModel.displayName;

    var message = createChatDiv('message');
    message.innerHTML = chatMessage.hubMessage;

    bubble.append(message);
    bubble.append(name);


    if (chatMessage.bits > 0) {
        newChatMessage.classList.add('bits');
        var cheer = createChatDiv('cheer');
        cheer.innerText = 'Cheer for ' + chatMessage.bits + ' bits';
        newChatMessage.append(cheer);
    }

    if (chatMessage.isModerator) {
        newChatMessage.classList.add('moderator');

        var moderator = createChatDiv('moderator');
        moderator.innerHTML = shieldSVG;
        body.prepend(moderator);
    }

    body.append(bubble);

    newChatMessage.append(body);
    newChatMessage.append(profile);

    $('#msg' + id).hide();
    $(".chatBox").append(newChatMessage);

    calcPositions(newChatMessage);

    $('#msg' + id).fadeIn('slow');

    //setTimeout(function (id) {
    //    $('#msg' + id).fadeOut('slow', () => {
    //        $('#msg' + id).remove();
    //    });
    //}, 50000, id);
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

function createChatDiv(cssClass) {
    var newDiv = document.createElement('div');
    newDiv.classList.add(cssClass);
    return newDiv;
}

function calcPositions(newMessageDiv) {
    var nextBottom = 0;
    var transparency = 100;
    $($('.chatBox .chatMessage').get().reverse()).each(function (i, el) {
        if (transparency < 0) {
            $(el).remove();
        }
        else {
            transparency = (nextBottom / 100) * 7;
            $(el).css('bottom', nextBottom).css({ 'opacity': 1 - (transparency / 100) });
            nextBottom = nextBottom + $(el).height() + 25;
        }
    });
}

const shieldSVG = "<svg xmlns = 'http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='#000000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path class='strokeColor' d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' /></svg>"