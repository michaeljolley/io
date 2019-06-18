"use strict";

const socket = io('http://localhost:5060');

socket.on('lastSubscriber', (lastSubscriber) => {
    var profileImg = document.getElementById('subscriberProfileImageUrl');
    var userName = document.getElementById('subscriberDisplayName');
    profileImg.src = lastSubscriber.profile_image_url;
    userName.innerText = lastSubscriber.display_name || lastSubscriber.login;
});

socket.on('lastFollower', (lastFollower) => {
    var profileImg = document.getElementById('followerProfileImageUrl');
    var userName = document.getElementById('followerDisplayName');
    profileImg.src = lastFollower.profile_image_url;
    userName.innerText = lastFollower.display_name || lastFollower.login;
});

let showFollower = false;
const follower = document.getElementById('follower');
const subscriber = document.getElementById('subscriber');
const intro = 'fadeInDown';
const outro = 'fadeOutDown';

function toggleState() {
    if (showFollower) {
        follower.classList.remove(outro);
        subscriber.classList.remove(intro);
        subscriber.classList.add(outro);
        follower.classList.add(intro);
    }
    else {
        subscriber.classList.remove(outro);
        follower.classList.remove(intro);
        follower.classList.add(outro);
        subscriber.classList.add(intro);
    }
    showFollower = !showFollower;
}

toggleState();

setInterval(() => {
    toggleState();
}, 20000);
