var message = require('../utils/message.js');
var type = 's'.charCodeAt(0);

exports.build = function (snake) {
    var nameLength = snake.name.length;
    var part = snake.parts.length;
    var partsLength = part * 2;
    // メッセージタイプの 's' に加えて、名前の長さ + 各座標 (x, y) を格納
    var arr = new Uint8Array(25 + nameLength + 6 + partsLength);
    var b = 0;
    b += message.writeInt8(b, arr, 0);
    b += message.writeInt8(b, arr, 0);
    b += message.writeInt8(b, arr, type);
    b += message.writeInt16(b, arr, snake.id);
    b += message.writeInt24(b, arr, snake.D);
    b += message.writeInt8(b, arr, 0);
    b += message.writeInt24(b, arr, snake.X);
    b += message.writeInt16(b, arr, snake.speed * 1E3);
    b += message.writeInt24(b, arr, 0);
    b += message.writeInt8(b, arr, snake.skin);
    b += message.writeInt24(b, arr, snake.body.x * 5);
    b += message.writeInt24(b, arr, snake.body.y * 5);
    b += message.writeInt8(b, arr, nameLength);
    b += message.writeString(b, arr, snake.name);
    b += message.writeInt24(b, arr, snake.head.x * 5);
    b += message.writeInt24(b, arr, snake.head.y * 5);

    // スネークの各部分の座標を格納 (プロトコルバージョンに合わせて調整が必要)
    prevX = snake.head.x;
    prevY = snake.head.y;

    var i = 0;
    while (i < snake.parts.length) {
        thisX = snake.parts[i].x;
        thisY = snake.parts[i].y;
        let dx = thisX - prevX;
        let dy = thisY - prevY;
        dx = Math.max(-127, Math.min(127, Math.round(dx)));
        dy = Math.max(-127, Math.min(127, Math.round(dy)));
        b += message.writeInt8(b, arr, dx + 127);
        b += message.writeInt8(b, arr, dy + 127);
        prevX = thisX;
        prevY = thisY;
        i++;
    }
    return arr;
};