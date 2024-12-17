message = require('../utils/message');

// stringtowrite = 'EUlXugxMjVOpVRGUPGwqGXlETocxjLRlbRicRPxUfbnIwOEznItpEYKDSfZBKCNjwvhYppYKbqjgWMDPMypeBVgHOcwVhBmmUkcUKJVpzzHHPNcxJDRgzmhTolXREDKlVHzCLzTmBnKwPfZZhwPFVjgujgVPZXIhUR';
// ↑は修正前の古いエンコードされた文字列

// ↓ 新しい文字列
stringtowrite = '6eulXugxMjVOpVRGUPGwqGXlETocxjLRlbRicRPxUfbnIwOEznItpEYKDSfZBKCNjwvhYppYKbqjgWMDPMypeBVgHOcwVhBmmUkcUKJVpzzHHPNcxJDRgzmhTolXREDKlVHzCLzTmBnKwPfZZhwPFVjgujgVPZXIhUR';

arr = new Uint8Array(1 + stringtowrite.length);

message.writeInt8(0, arr, stringtowrite.length); // 先頭1バイトにデータ長を書き込む
message.writeString(1, arr, stringtowrite);

exports.buffer = arr