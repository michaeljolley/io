"use strict";

var socket = io('http://localhost:5060');

socket.on('OnChatMessage', (chatMessageEventArg) => {

    console.log(JSON.stringify(chatMessageEventArg));

    var strip = document.getElementsByClassName('strip')[0];

    var id = +(new Date());

    /*
    * Structure of chat bubble is:
    * box
    *   cbbl
    *   character-strip
    *     character
    *       character name {tiki}
    *           head
    *           body
    */

    var box = createChatDiv('box');
    box.id = 'msg' + id.toString();

    var cbbl = createChatDiv('cbbl');
    cbbl.innerHTML = chatMessageEventArg.message;

    var characterStrip = createChatDiv('character-strip');

    var character = createChatDiv('character');

    var head = createChatDiv('head');
    var headImg = document.createElement('img');
    headImg.src = '/assets/images/characters/tiki/head-tiki.png';
    head.append(headImg);

    var body = createChatDiv('body');
    var bodyImg = document.createElement('img');
    bodyImg.src = '/assets/images/characters/tiki/body-tiki.png';
    body.append(bodyImg);

    character.append(head);
    character.append(body);

    characterStrip.append(character);

    box.append(cbbl);
    box.append(characterStrip);

    $('#msg' + id).hide();
    strip.append(box);

    animateCSS(box, 'zoomInUp', null);
    calcPositions();

    $('#msg' + id).fadeIn('slow');

    setTimeout(function (id) {
        $('#msg' + id).fadeOut('slow', () => {
            $('#msg' + id).remove();
        });
    }, 50000, id);
});

function createChatDiv(cssClass) {
    var newDiv = document.createElement('div');
    newDiv.classList.add(cssClass);
    return newDiv;
}

function calcPositions() {
    var nextBottom = 0;
    var transparency = 100;

    // Calc bottoms & remove any divs that need
    $($('.box').get().reverse()).each(function (i, el) {
        transparency = (nextBottom / 100) * 7;

        if (transparency > 0 && (1 - (transparency / 100)) < .5) {
            $(el).remove();
        }
        else {
            nextBottom = nextBottom + $(el).height() + 25;
        }
    });

    nextBottom = 0;
    transparency = 100;

    // Iterate through remainder and move/add
    $($('.box').get().reverse()).each(function (i, el) {
        transparency = (nextBottom / 100) * 7;

        animateCSS(el, 'bounce', null);
        $(el).css('bottom', nextBottom).css({ 'opacity': 1 - (transparency / 100) });
        nextBottom = nextBottom + 225;
    });
}

function animateCSS(node, animationName, callback) {
    node.classList.add('animated', animationName)

    function handleAnimationEnd() {
        node.classList.remove('animated', animationName)
        node.removeEventListener('animationend', handleAnimationEnd)

        if (typeof callback === 'function') callback(node)
    }

    node.addEventListener('animationend', handleAnimationEnd)
}
