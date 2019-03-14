"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/b3BotHub").build();

connection.on("NewEmoji", function (emojiUrl) {
    var img = document.createElement("img");
    var id = +(new Date());
    img.src = emojiUrl;
    img.classList.add('emoji');
    img.id = 'emoji' + id.toString();
    $("#container").append(img);
    $(img).marqueeify({
        speed: 400
    });
    setTimeout(function (id) {
        $('#emoji' + id).remove();
    }, 10000, id);
});

connection.on("NewChatMessage", function (chatMessage) {
    var msg = document.createElement('div');

    var id = +(new Date());
    msg.id = 'msg' + id.toString();

    msg.classList.add('chatMessage');
    msg.classList.add('animated');
    msg.classList.add('lightSpeedIn');
    msg.innerHTML = chatMessage.hubMessage;
    $(".chatBox").prepend(msg);

    setTimeout(function (id) {
        $('#msg' + id).removeClass('lightSpeedIn');
        $('#msg' + id).addClass('lightSpeedOut');
    }, 60000, id);
});

connection.start();

(function ($, window, undefined) {
    $.fn.marqueeify = function (options) {
        var settings = $.extend({
            speed: 100, // In pixels per second
            container: $(this).parent()
        }, options);

        return this.each(function () {
            var containerWidth, containerHeight, elWidth, elHeight,
                move, getSizes, initialLeft, initialTop, calcRandomInitialPlacement,
                direction,
                $el = $(this);

            getSizes = function () {
                containerWidth = settings.container.outerWidth();
                containerHeight = settings.container.outerHeight();
                elWidth = $el.outerWidth();
                elHeight = $el.outerHeight();
            };

            calcRandomInitialPlacement = function () {
                initialLeft = Math.floor(Math.random() * (containerWidth - 0 + 1));
                initialTop = Math.floor(Math.random() * (containerHeight - 0 + 1));
                $el.css({ left: initialLeft, top: initialTop });
                direction = initialTop % 2;
            };

            move = {
                right: function () {
                    $el.animate({ left: (direction ? (containerWidth - elWidth) : 0) }, {
                        duration: ((containerWidth / settings.speed) * 1000), queue: false, easing: "linear", complete: function () {
                            move.left();
                        }
                    });
                },
                left: function () {
                    $el.animate({ left: (direction ? 0 : (containerWidth - elWidth)) }, {
                        duration: ((containerWidth / settings.speed) * 1000), queue: false, easing: "linear", complete: function () {
                            move.right();
                        }
                    });
                },
                down: function () {
                    $el.animate({ top: (direction ? (containerHeight - elHeight) : 0) }, {
                        duration: ((containerHeight / settings.speed) * 1000), queue: false, easing: "linear", complete: function () {
                            move.up();
                        }
                    });
                },
                up: function () {
                    $el.animate({ top: (direction ? 0 : (containerHeight - elHeight)) }, {
                        duration: ((containerHeight / settings.speed) * 1000), queue: false, easing: "linear", complete: function () {
                            move.down();
                        }
                    });
                }
            };

            getSizes();
            calcRandomInitialPlacement();

            move.right();
            move.down();

            // Make that shit responsive!
            $(window).resize(function () {
                getSizes();
            });
        });
    };
})(jQuery, window);
