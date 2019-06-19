"use strict";

const socket = io('http://localhost:5060');

socket.on('newCheer', (user, userInfo, message) => {
    const displayName = userInfo['display-name'] ? userInfo['display-name'] : userInfo.username;
    const msg = `${displayName} just cheered ${user.bits} bits`;
    addAndStart(msg, 'applause', userInfo.profile_image_url, 10);
});

socket.on('newRaid', (username, userInfo, viewers) => {
    const displayName = userInfo['display-name'] ? userInfo['display-name'] : userInfo.username;
    const msg = `DEFEND! ${displayName} is raiding with ${viewers} accomplices!`;
    addAndStart(msg, 'goodbadugly', userInfo.profile_image_url, 10);
});

socket.on('newSubscription', (user, userInfo, isRenewal, wasGift, message) => {
    // const displayName = userInfo['display-name'] ? userInfo['display-name'] : userInfo.username;
    // const msg = `DEFEND! ${displayName} is raiding with ${viewers} accomplices!`;
    // attemptToStart(new queueItem(msg, '', 30));
});

socket.on('newFollow', (follower, userInfo) => {
    const displayName = userInfo['display-name'] ? userInfo['display-name'] : userInfo.username;
    const msg = `Welcome ${displayName}! Thanks for following!`;
    attemptToStart(msg, '', userInfo.profile_image_url, 10);
});

let messageQueue = [];

const intro = 'fadeInDown';
const outro = 'fadeOutDown';
let isActive = false;

const messageObj = document.getElementById('message');
const messageBody = document.getElementById('displayName');
const profileImg = document.getElementById('profileImageUrl');

function addAndStart(m, a, p, t) {
    messageQueue.push({message: m, audio: a, profileImageUrl: p, timeout: t});
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
