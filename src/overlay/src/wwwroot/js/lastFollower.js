"use strict";

const socket = io('http://localhost:5060');

socket.on('lastFollower', (lastFollower) => {
    var profileImg = document.getElementById('profileImageUrl');
    var userName = document.getElementById('displayName');
    profileImg.src = lastFollower.profile_image_url;
    userName.innerText = lastFollower.display_name || lastFollower.login;
});
