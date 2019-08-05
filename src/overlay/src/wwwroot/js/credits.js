"use strict";

var socket = io('http://localhost:5060');

socket.on('OnCreditsRoll', (streamEventArg) => {

    /* Build a div.marquee with p and p.header and add to body
    * Moderators = streamEventArg.stream.moderators
    * Followers = streamEventArg.stream.followers
    * Raids = streamEventArg.stream.raiders
    * Subscribers = streamEventArg.stream.subscribers
    * Cheerers = streamEventArg.stream.cheers
    * Contributors = streamEventArg.stream.contributors
    */

    if (streamEventArg &&
        streamEventArg.stream) {

        const stream = streamEventArg.stream;

        const marquee = document.createElement('div');
        marquee.classList.add('marquee');

        /* Moderators */
        if (stream.moderators &&
            stream.moderators.length > 0) {
            const modHeader = addParagraph('Moderators', true);
            marquee.append(modHeader);

            foreach (mod in stream.moderators) {
                const m = addParagraph(mod.display_name || mod.login, false);
                marquee.append(m);
            }
        }

        /* Subscribers */
        if (stream.subscribers &&
            stream.subscribers.length > 0) {
            const subHeader = addParagraph('Subscribers', true);
            marquee.append(subHeader);

            const subscribers = stream.subscribers.map(m => m.user);

            foreach (sub in stream.subscribers) {
                if (sub.user) {
                    const s = addParagraph(mod.user.display_name || mod.user.login, false);
                    marquee.append(s);
                }
            }
        }


        /* Cheerers */


        /* Raiders */


        /* Followers */


        /* Contributors */



        /* Based on how many of the above, change the CSS transition time */

        const body = document.getElementsByTagName('body');
        body.append(marquee);

    }
});

function addParagraph(title, isHeader) {
    const p = document.createElement('p');
    p.innerText = title;
    if (isHeader) {
        p.classList.add('header');
    }
    return p;
}
