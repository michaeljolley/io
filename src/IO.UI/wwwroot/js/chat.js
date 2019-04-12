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

    // If this chat message is from the bot then handle it separately from 
    // all other skins
    if (chatMessage.isBot) {
        newChatMessage.classList.add('bot');
        name.innerText = "IO";
    } 

    if (chatMessage.bits > 0) {
        newChatMessage.classList.add('bits');
        var cheer = createChatDiv('cheer');
        cheer.innerText = 'Cheer for ' + chatMessage.bits + ' bits';
        newChatMessage.append(cheer);
    }

    if (chatMessage.isModerator ||
        chatMessage.isBroadcaster ||
        chatMessage.isBot) {
        newChatMessage.classList.add('moderator');

        var moderator = createChatDiv('moderator');
        moderator.innerHTML = shieldSVG;
        body.prepend(moderator);
    }

    bubble.append(message);
    bubble.append(name);

    body.append(bubble);

    newChatMessage.append(body);
    newChatMessage.append(profile);

    $('#msg' + id).hide();
    $(".chatBox").append(newChatMessage);

    calcPositions(newChatMessage);

    $('#msg' + id).fadeIn('slow');

    setTimeout(function (id) {
        $('#msg' + id).fadeOut('slow', () => {
            $('#msg' + id).remove();
        });
    }, 50000, id);
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

const shieldSVG = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='#000000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path class='strokeColor' d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' /></svg>";
const swordSVG = "<svg xmlns='http://www.w3.org/2000/svg' version='1.1' x='0px' y='0px' viewBox='0 0 100 125' enable-background='new 0 0 100 100' xml:space = 'preserve' > <polygon class='strokeColor' points='36.328,63.672 41.64,70.627 90.811,23.947 99.895,0.105 76.053,9.189 29.375,58.359 ' /> <path class='strokeColor' d='M42.741,88.611l4.795-4.793L33.956,66.045L16.183,52.463l-4.794,4.797l11.463,11.463L9.373,82.201  c-2.4-0.109-4.836,0.727-6.67,2.561c-3.461,3.459-3.465,9.072-0.001,12.535c3.464,3.465,9.079,3.465,12.541,0.002  c1.834-1.834,2.665-4.27,2.556-6.67l13.48-13.48L42.741,88.611z' /></svg >";