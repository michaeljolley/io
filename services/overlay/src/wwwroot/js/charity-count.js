'use strict';

const socket = io('http://localhost:5060');

socket.on('CharityCount', charityCountEventArg => {
  var counter = document.getElementById('counter');

  var total = charityCountEventArg.amount;
  var packedBags = Math.floor((total * 2) / 500);

  counter.innerText = packedBags;
});
