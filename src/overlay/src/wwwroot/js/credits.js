"use strict";

var socket = io('http://localhost:5060');

socket.on('OnCreditsRoll', (streamEventArg) => {

    /* Clear the body tag to ensure we're starting over */
    const body = document.getElementsByTagName('body');
    body.innerText = '';

    /* Build a div.marquee with p and p.header and add to body
    * Moderators = streamEventArg.stream.moderators
    * Followers = streamEventArg.stream.followers
    * Raids = streamEventArg.stream.raiders
    * Subscribers = streamEventArg.stream.subscribers
    * Cheerers = streamEventArg.stream.cheers
    */

    if (streamEventArg &&
        streamEventArg.stream) {

        const stream = streamEventArg.stream;

        const marquee = document.createElement('div');
        marquee.classList.add('marquee');

        const topper = document.createElement('h2');
        topper.innerText = 'Thanks for supporting the stream!';
        marquee.append(topper);

        /* Moderators */
        if (stream.moderators &&
            stream.moderators.length > 0) {
            const modHeader = addParagraph('Moderators', true);
            marquee.append(modHeader);

            foreach (mod in stream.moderators) {
                marquee.append(addParagraph(mod.display_name || mod.login, false));
            }
        }

        /* Subscribers */
        if (stream.subscribers &&
            stream.subscribers.length > 0) {
            const subHeader = addParagraph('Subscribers', true);
            marquee.append(subHeader);

            const tempSubs = [];
            const subscribers = stream.subscribers
                                        .map(m => m.user)
                                        .filter((n) => {
                                            return tempSubs.indexOf(n.id) === -1 &&
                                                    tempSubs.push(n.id);
                                            });

            foreach (sub in subscribers) {
                marquee.append(addParagraph(sub.display_name || sub.login, false));
            }
        }

        /* Cheerers */
        if (stream.cheers &&
            stream.cheers.length > 0) {
            const subHeader = addParagraph('Cheers', true);
            marquee.append(subHeader);

            const tempCheers = [];
            const cheerers = stream.cheers
                                        .map(m => m.user)
                                        .filter((n) => {
                                            return tempCheers.indexOf(n.id) === -1 &&
                                                    tempCheers.push(n.id);
                                            });


            foreach (cheer in cheerers) {
                marquee.append(addParagraph(cheer.display_name || cheer.login, false));
            }
        }

        /* Raiders */
        if (stream.raiders &&
            stream.raiders.length > 0) {
            const raiderHeader = addParagraph('Raiders', true);
            marquee.append(raiderHeader);

            const tempRaiders = [];
            const raiders = stream.raiders
                                        .map(m => m.user)
                                        .filter((n) => {
                                            return tempRaiders.indexOf(n.id) === -1 &&
                                                    tempRaiders.push(n.id);
                                            });


            foreach (raider in raiders) {
                marquee.append(addParagraph(raider.display_name || raider.login, false));
            }
        }

        /* Followers */
        if (stream.followers &&
            stream.followers.length > 0) {
            const followHeader = addParagraph('Followers', true);
            marquee.append(followHeader);

            const tempFollows = [];
            const followers = stream.followers
                                        .filter((n) => {
                                            return tempFollows.indexOf(n.id) === -1 &&
                                                    tempFollows.push(n.id);
                                            });


            foreach (follow in followers) {
                marquee.append(addParagraph(follow.display_name || follow.login, false));
            }
        }

        /* Based on how many of the above, change the CSS transition time */

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
