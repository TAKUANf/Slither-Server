var message = require('../utils/message');

var type = 'e'.charCodeAt(0);

exports.build = function (id, snake) {
    var arr = new Uint8Array(7); // 修正: 長さを7に変更
    message.writeInt8(2, arr, type);
    message.writeInt16(3, arr, id);
    message.writeInt16(5, arr, Math.floor(snake.direction.angle * 256 / (2 * Math.PI)));
    return arr;
};
