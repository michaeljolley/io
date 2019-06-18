"use strict";

const socket = io('http://localhost:5060');
let messageQueue = [];

const intro = 'fadeInDown';
const outro = 'fadeOutDown';
let isActive = false;

const messageObj = document.getElementById('message');
const messageBody = document.getElementById('displayName');
const profileImg = document.getElementById('profileImageUrl');

setInterval(() => {
    const message = `AdronHall just cheered ${messageQueue.length} bits`;
    console.log(message);
    addAndStart(new queueItem(message, 'applause', 'https://static-cdn.jtvnw.net/jtv_user_pictures/590e3f6f-8a85-4704-9342-dc375bed546c-profile_image-300x300.jpeg', 10));
}, 8000);

setInterval(() => {
    const message = `DEFEND! noopkat is raiding with 147 accomplices!`;
    console.log(message);
    addAndStart(new queueItem(message, 'goodbadugly', 'https://static-cdn.jtvnw.net/jtv_user_pictures/590e3f6f-8a85-4704-9342-dc375bed546c-profile_image-300x300.jpeg', 10));
}, 12000);

socket.on('newCheer', (user, userInfo, message) => {
    const displayName = userInfo['display-name'] ? userInfo['display-name'] : userInfo.username;
    const msg = `${displayName} just cheered ${user.bits} bits`;
    addAndStart(new queueItem(msg, '', '', 10));
});

socket.on('newRaid', (username, userInfo, viewers) => {
    const displayName = userInfo['display-name'] ? userInfo['display-name'] : userInfo.username;
    const msg = `DEFEND! ${displayName} is raiding with ${viewers} accomplices!`;
    addAndStart(new queueItem(msg, 'goodbadugly', '', 10));
});

socket.on('newSubscription', (user, userInfo, isRenewal, wasGift, message) => {
    // const displayName = userInfo['display-name'] ? userInfo['display-name'] : userInfo.username;
    // const msg = `DEFEND! ${displayName} is raiding with ${viewers} accomplices!`;
    // attemptToStart(new queueItem(msg, '', 30));
});

socket.on('newFollow', (follower, userInfo) => {
    // const displayName = userInfo['display-name'] ? userInfo['display-name'] : userInfo.username;
    // const msg = `DEFEND! ${displayName} is raiding with ${viewers} accomplices!`;
    // attemptToStart(new queueItem(msg, '', 30));
});

function addAndStart(qItem) {
    messageQueue.push(qItem);
    console.log(JSON.stringify(messageQueue));
    if (isActive == false) {
        processMessage(messageQueue[0], false);
    }
}

function processMessage(qItem, bypass) {

    if (isActive == true &&
        bypass == false) {
        return;
    }

    isActive = true;

    messageObj.classList.remove(outro);

    messageBody.innerHTML = qItem.message;
    profileImg.src = qItem.profileImageUrl;

    messageObj.classList.add(intro);

    // Emit playAudio if needed
    if(qItem.audio && qItem.audio.length > 0) {
        socket.emit('playAudio', qItem.audio);
    }

    messageQueue.splice(0, 1);

    setTimeout(() => {
        messageObj.classList.remove(intro);
        messageObj.classList.add(outro);

        setTimeout(() => {
            profileImg.src = '';
            messageBody.innerHTML = '';

            if (messageQueue.length > 0) {
                processMessage(messageQueue[0], true);
            }
            else {
                isActive = false;
            }
        }, 2000);
    }, qItem.timeout * 1000);
}

class queueItem {
    constructor(m, a, p, t) {
        this.message = m;
        this.audio = a;
        this.profileImageUrl = p;
        this.timeout = t;
    }

    message = '';
    audio = '';
    timeout = 10;
    profileImageUrl = '';
}
