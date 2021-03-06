/* global $ io */
(function () {
  let userList, user, timer, giverId;
  const cmdBuffer = [];
  let cmdCurrent = '';
  let cmdIndex = -1;
  const MESSAGE_HISTORY = 100;
  const COMMAND_HISTORY = 10;

  // natural sorting
  // http://my.opera.com/GreyWyvern/blog/show.dml/1671288
  function chunkify (t) {
    const tz = [];
    let x = 0;
    let y = -1;
    let n = 0;
    let i;
    let j;
    while ((i = (j = t.charAt(x++)).charCodeAt(0))) {
      const m = i === 46 || (i >= 48 && i <= 57);
      if (m !== n) {
        tz[++y] = '';
        n = m;
      }
      tz[y] += j;
    }
    return tz;
  }

  function alphanum (a, b) {
    const aa = chunkify(a.toLowerCase());
    const bb = chunkify(b.toLowerCase());

    for (let x = 0; aa[x] && bb[x]; x++) {
      if (aa[x] !== bb[x]) {
        const c = Number(aa[x]);
        const d = Number(bb[x]);
        if (c === aa[x] && d === bb[x]) {
          return c - d;
        } else return aa[x] > bb[x] ? 1 : -1;
      }
    }
    return aa.length - bb.length;
  }

  function updateUserlist () {
    const $userList = $('#users');
    const userArray = Object.keys(userList).map(function (id) {
      const user = userList[id];
      const $userEl = $('#users #user-' + id);
      if (!$userEl.length) {
        $(
          "<dl id='user-" +
            id +
            "'><dt>" +
            user.name +
            '</dt><dd>' +
            user.score +
            '</dd></dl>'
        ).appendTo($userList);
      }

      return userList[id];
    });

    $('dl#user-total dd').text(userArray.length);

    userArray.sort(function (a, b) {
      if (a.score > b.score) return -1;
      if (a.score < b.score) return 1;
      return alphanum(a.name, b.name);
    });

    userArray.forEach(function (user, index) {
      const $userLi = $userList.find('dl');
      const $userEl = $('#users #user-' + user.id);

      if ($userEl.index($userLi.selector) !== index) {
        $userEl.insertBefore($userLi.eq(index));
      }
    });
  }

  function timeDown (duration, cb) {
    const time = new Date().getTime() + duration * 1000;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    function advanceTimer () {
      const now = new Date().getTime();
      if (now < time) {
        $('#giver-timeout dd').text(Math.round((time - now) * 0.001));
        timer = setTimeout(function () {
          advanceTimer();
        }, 1000);
      } else {
        cb();
      }
    }
    advanceTimer();
  }

  function connect () {
    const socket = io.connect('');

    // do not show name entry unless we have a connection
    function loadNameEntry () {
      $('#name-entry').fadeIn();

      $('#name-entry input#username').keydown(function (event) {
        const $this = $(event.currentTarget);
        const val = $this.val().trim();
        if (event.keyCode === 13 && val) {
          socket.emit('enter username', val);
        }
      });

      socket.on('alternate name', function (message, altName) {
        $('#name-entry #name-message').text(message);
        $('#name-entry input').val(altName);
      });

      $('#name-entry input#username').focus();
    }

    // a new user has joined
    socket.on('new user', function (userInfo) {
      userList[userInfo.id] = userInfo;
      updateUserlist();
    });

    // a user has left
    socket.on('remove user', function (userId) {
      $('dl#user-' + userId).remove();
      delete userList[userId];
      // remove shouldn't need updating
      // updateUserlist()
    });

    // initial game state given to user
    socket.on('game state', function (users, giver, timeLeft) {
      userList = users;
      giverId = giver;
      if (giver) {
        $('dl#giver-name dd').text(userList[giver].name);
        $('dl#giver-score dd').text(userList[giver].score);
      }
      $('dl#giver-timeout dd').text(timeLeft);
      timeDown(timeLeft, function () {
        $('dl#giver-timeout dd').text(0);
      });
      updateUserlist();
      loadNameEntry();
    });

    // scoring event updated score
    socket.on('score update', function (scores) {
      Object.keys(scores).forEach(function (id) {
        userList[id].score = scores[id];
        $('#users #user-' + id)
          .find('dd')
          .text(scores[id]);
        if (id === giverId) {
          $('dl#giver-score dd').text(scores[id]);
        }
      });
      updateUserlist();
    });

    // username is succefful
    socket.on('username accepted', function (userInfo) {
      userList[userInfo.id] = user = userInfo;
      $('dl#user-name dd').text(userInfo.name);
      $('#name-entry').fadeOut();
      $('#game').removeClass('observer');
      $('#message-entry input').attr('disabled', null);
      $('dl#your-score dd').text(userInfo.score);
      $('dl#your-name dd').text(userInfo.name);

      $('#message-entry input').keydown(function (event) {
        const $this = $(event.currentTarget);
        const val = $this.val().trim();
        if (event.keyCode === 13 && val) {
          cmdBuffer.unshift(val);
          cmdBuffer.splice(COMMAND_HISTORY);
          cmdIndex = -1;
          socket.emit('user message', $this.val());
          $this.val('');
          event.preventDefault();
        }
        if (event.keyCode === 38) {
          if (cmdIndex < 0) cmdCurrent = val;
          cmdIndex = Math.min(
            cmdIndex + 1,
            COMMAND_HISTORY,
            cmdBuffer.length - 1
          );
          if (cmdIndex >= 0) $this.val(cmdBuffer[cmdIndex]);
          event.preventDefault();
        }
        if (event.keyCode === 40) {
          cmdIndex--;
          if (cmdIndex < 0) {
            cmdIndex = -1;
            $this.val(cmdCurrent);
          } else $this.val(cmdBuffer[cmdIndex]);
          event.preventDefault();
        }
        /*
37 - left
38 - up
39 - right
40 - down
*/
      });

      $('#message-entry input').focus();

      window.onbeforeunload = function () {
        return 'Are you sure you want to leave? Your score will be gone forever.';
      };
    });

    // giver has changed
    socket.on('new giver', function (userId) {
      giverId = userId;
      $('#giver-name dd').text(userList[userId].name);
      $('#giver-score dd').text(userList[userId].score);
      $('#giver-timeout dd').text(60);
      if (user && userId === user.id) {
        $('#card').fadeIn();
      }
      timeDown(60, function () {
        $('#giver-timeout dd').text(0);
      });
    });

    // round has ended, clears giver, hides cards,
    socket.on('end round', function () {
      giverId = null;
      $('#card').fadeOut();
      $('#card dl').remove();
      $('#giver-timeout dd').text(0);
      $('#giver-name dd').text('none');
      $('#giver-score dd').text(0);
      clearTimeout(timer);
    });

    // user is giver, and is presented a new card
    socket.on('new card', function (card) {
      $('#card dl').remove();
      $('#card a#skip-button').after(
        '<dl><dt>' + card.word + '</dt><dd><hr /><ul></ul></dd></dl>'
      );
      $.each(card.taboo, function (index, word) {
        $('#card dl dd ul').append('<li>' + word + '</li>');
      });
    });

    // generic messages for the taboo application
    socket.on('taboo message', function (type, source, message) {
      const messageHTML =
        "<li class='" +
        type +
        "'><span class='source'>{{source}}</span><span class='message'>" +
        message +
        '</span></li>';
      if (source === 'server') {
        source = '';
      } else if (type === 'user' || type === 'giver') {
        const user = userList[source];
        source = user.name + ' ( ' + user.score + ' ) : ';
      } else return;
      $(messageHTML.replace('{{source}}', source)).insertBefore(
        '#messages li:first'
      );
      $('#messages li').slice(MESSAGE_HISTORY).remove();
    });

    // name is invalid, cannot produce alternate
    socket.on('invalid name', function (message) {
      $('#name-entry #name-message').text(message);
    });

    // handle skip button
    $('#card a#skip-button').click(function (event) {
      event.preventDefault();
      socket.emit('skip card');
    });

    socket.on('disconnect', function () {
      $('#game').addClass('observer');
      $('#name-entry').fadeOut();
      window.onbeforeunload = function () {};
    });
  }

  $(function () {
    connect();
  });
})();
