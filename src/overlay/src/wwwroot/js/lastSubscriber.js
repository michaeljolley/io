"use strict";

const socket = io('http://localhost:5060');

socket.on('lastSubscriber', (lastSubscriber) => {
    var profileImg = document.getElementById('profileImageUrl');
    var userName = document.getElementById('displayName');
    profileImg.src = lastSubscriber.profile_image_url;
    userName.innerText = lastSubscriber.display_name || lastSubscriber.login;
});
