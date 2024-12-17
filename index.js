var config = require('./config/config.js');
var spawn = require("./src/spawn.js");
var pkg = require('./package.json');
var WebSocket = require('ws').Server;
var Snake = require('./src/entities/snake');
var Food = require('./src/entities/food');
var sector = require('./src/entities/sector');
var messages = require('./src/messages');
var message = require('./src/utils/message');
var math = require('./src/utils/math');

var loopInterval = 230;
var counter = 0;
var clients = [];
var foods = [];
var sectors = []; // 開発用コード
var botCount = 0;
var highscoreName = config["highscoreName"];
var highscoreMessage = config["highscoreMsg"];
var fmlts;
var fpsls;

console.log('[DEBUG] You are currently running on ' + pkg.version);
console.log('[SERVER] Starting Server...');
var server;
server = new WebSocket({ port: config['port'], path: '/slither' }, function () {
    console.log('[SERVER] Server Started at 127.0.0.1:' + config['port'] + '! Waiting for Connections...');
    console.log("[BOTS] Bot Status: Bot's are currently unavailable! Please try again later.");
    //console.log('[BOTS] Creating ' + config['bots'] + ' bots!');
    //console.log('[BOTS] Bots successfully loaded: ' + botCount + (botCount === 0 ? "\n[BOTS] Reason: Bot's aren't implemented yet. Please try again later" : ''));
    generateFood(config['food']);
    generateSectors();
});

if (server.readyState === server.OPEN) {
    server.on('connection', handleConnection.bind(server));
} else {
    console.log(server.readyState);
}

// 新しい接続の処理
function handleConnection(conn) {
    if (clients.length >= config['max-connections']) {
        console.log('[SERVER] Too many connections. Closing newest connections!');
        conn.close();
        return;
    }
    try {
        conn.id = ++counter;
        clients[conn.id] = conn;
        console.log("[DEBUG] 新規接続");

        conn.on('message', (data) => {
            // --- Handle initial message (Protocol 12) ---
            if (message.readInt8(0, data) === 1) {
                console.log('[SERVER] Initial message received (Client initiating connection).');
                sendPreInit(conn);
            } else if (message.readInt8(0, data) === 99) {
                console.log('[SERVER] \'c\' message received (Client initiating connection).');
            }
    
            // --- Handle 's' message (Initialize snake) ---
            if (message.readInt8(0, data) === 115) {
                console.log('[SERVER] \'s\' message received. Initializing snake...');
                initializeSnake(conn, data);
            }
    
            // Handle other messages only if snake exists
            if (conn.snake) {
                handleMessage(conn, data);
            }
        });
    
        conn.on('error', close.bind(conn.id));
        conn.on('close', function () {
            console.log('[DEBUG] Connection closed.');
            if (conn.snake) {
                clearInterval(conn.snake.update);
                conn.snake = null;
                messages.end.build(2);
            }
            delete clients[conn.id];
        });
    } catch (e) {
        console.log('[ERROR] ' + e);
    }
}

// プロトコル 12 用の Pre-init メッセージを送信
function sendPreInit(conn) {
    let stringtowrite = '6eulXugxMjVncWxdSLcUJcxoiwpzvHyqPbNFFOpVmicMJYjceoEVMdxmZPlanhXPNYYEHnOXiCYNitOCQjYtgxOgFRizZIUlaTQgwnZwIzoLfqrYmgFrlWWeUmhUtfzjJRRZXmhTNbqJwRdYvHbOnuvFRjmVJDWLxUGZpjjRGzPFtQETqfZjhSreB';

    let arr = new Uint8Array(1 + stringtowrite.length);

    message.writeInt16(0, arr, stringtowrite.length + 1);

    message.writeInt8(2, arr, '6'.charCodeAt(0));

    message.writeString(3, arr, stringtowrite);

    console.log('[SERVER] Sending pre-init response:', arr);

    // クライアント側の処理完了を待つために遅延させる
    setTimeout(() => {
        conn.send(arr, { binary: true });
        console.log('[SERVER] Pre-init response sent.');
    }, 500);
}

function initializeSnake(conn, data) {
    let skin = message.readInt8(2, data);
    let name = message.readString(3, data, data.byteLength);

    console.log("[DEBUG] initializeSnake - received data:", data);

    conn.snake = new Snake(conn.id, name, {
        x: 28907.6,
        y: 21137.4
    }, skin);
    conn.snake.spang = 1;

    console.log('[DEBUG] Initialized snake:', conn.snake);

    send(conn.id, messages.initial);
    broadcast(messages.snake.build(conn.snake));

    console.log((conn.snake.name === '' ? '[DEBUG] An unnamed snake' : '[DEBUG] A new snake called ' + conn.snake.name) + ' has connected!');
    spawnSnakes(conn.id);

    conn.snake.update = setInterval(function () {
        if (!conn.snake) {
            console.log('[DEBUG] Snake is null, clearing interval');
            clearInterval(this);
            return;
        }
        var distance = conn.snake.speed * loopInterval / 8;
        conn.snake.body.x += conn.snake.direction.x * distance;
        conn.snake.body.y += conn.snake.direction.y * distance;

        console.log('[DEBUG] Snake updated - id:', conn.snake.id, 'x:', conn.snake.body.x, 'y:', conn.snake.body.y, 'direction:', conn.snake.direction);

        var R = config['gameRadius'];
        var r = (Math.pow((conn.snake.body.x - R), 2)) + (Math.pow((conn.snake.body.y - R), 2));
        if (r > Math.pow(R, 2)) {
            console.log('[DEBUG] Outside of Radius');
            var arr = new Uint8Array(6);
            message.writeInt8(2, arr, "s".charCodeAt(0));
            message.writeInt16(3, arr, conn.id);
            message.writeInt8(5, arr, 1);
            broadcast(arr);
            broadcast(messages.end.build(0));
            delete clients[conn.id];
            conn.close();
            clearInterval(conn.snake.update);
            conn.snake = null;
            return;
        }

        broadcast(messages.position.build(conn.id, conn.snake));
        broadcast(messages.direction.build(conn.id, conn.snake));
    }, loopInterval);

    send(conn.id, messages.leaderboard.build([conn], clients.length, [conn]));
    send(conn.id, messages.highscore.build(highscoreName, highscoreMessage));
    send(conn.id, messages.minimap.build(foods));
}

// メッセージ処理
function handleMessage(conn, data) {
    if (!conn.snake) {
        console.log('[SERVER] Received message before snake initialized. Ignoring.');
        return;
    }

    if (data.length === 0) {
        console.log('[SERVER] No Data to handle!');
        return;
    }

    var firstByte = message.readInt8(0, data);
    var messageType = String.fromCharCode(firstByte);

    // デバッグ用
    console.log(`[SERVER] Received message: type=${messageType}, length=${data.length}`);

    console.log("[SERVER] Raw data (hex):", Array.from(new Uint8Array(data)).map(x => x.toString(16).padStart(2, '0')).join(' '));

    if (data.length === 1) {
        // Single-byte messages (e.g., pong)
        let value = firstByte;
        if (value <= 250) {
            // Handle direction change
            if (conn.snake) {
                
                const radians = value * 2 * Math.PI / 251;
                const speed = conn.snake.speed / conn.snake.spang;
                conn.snake.direction.x = Math.cos(radians);
                conn.snake.direction.y = Math.sin(radians);
                conn.snake.direction.angle = radians;

                console.log(`[SERVER] Direction change: radians=${radians}, speed=${speed}`);
            }
        } else if (value === 251) {
            // Pong message
            send(conn.id, messages.pong);
            console.log(`[SERVER] Pong sent to client ${conn.id}`);
        } else if (value === 253) {
            console.log(`[DEBUG] Snake ${conn.id} is in normal mode (not boosting)`);
            if (conn.snake) {
                conn.snake.speed = 5.79; // Reset to normal speed
                conn.snake.spang = Math.min(conn.snake.speed / (4.8 * 10), 1);
            }
        } else if (value === 254) {
            console.log(`[DEBUG] Snake ${conn.id} is in speed mode (boosting)`);
            if (conn.snake) {
                conn.snake.speed = 10; // Adjust the boost speed as needed
                conn.snake.spang = Math.min(conn.snake.speed / (4.8 * 10), 1);
            }
        } else {
            console.log('[SERVER] Unknown single-byte message:', value);
        }
    } else {
        // Multi-byte messages
        var secondByte = message.readInt8(1, data);
        var value, len, i, cx, cy, tr, dir, wang, ang, v, pci;

        if (firstByte === 115) { // 's' - snake initialization
            console.log('[SERVER] \'s\' message received. Initializing snake...');
            let skin = message.readInt8(2, data);
            let name = message.readString(3, data, data.byteLength);
            conn.snake = new Snake(conn.id, name, {
                x: 28907.6,
                y: 21137.4
            }, skin);
            conn.snake.spang = 1;

            send(conn.id, messages.initial);
            broadcast(messages.snake.build(conn.snake));

            console.log((conn.snake.name === '' ? '[DEBUG] An unnamed snake' : '[DEBUG] A new snake called ' + conn.snake.name) + ' has connected!');
            spawnSnakes(conn.id);

            conn.snake.update = setInterval(function () {
                if (!conn.snake) {
                    console.log('[DEBUG] Snake is null, clearing interval');
                    clearInterval(this);
                    return;
                }
                var distance = conn.snake.speed * loopInterval / 8;
                conn.snake.body.x += conn.snake.direction.x * distance;
                conn.snake.body.y += conn.snake.direction.y * distance;

                var R = config['gameRadius'];
                var r = (Math.pow((conn.snake.body.x - R), 2)) + (Math.pow((conn.snake.body.y - R), 2));
                if (r > Math.pow(R, 2)) {
                    console.log('[DEBUG] Outside of Radius');
                    var arr = new Uint8Array(6);
                    message.writeInt8(2, arr, "s".charCodeAt(0));
                    message.writeInt16(3, arr, conn.id);
                    message.writeInt8(5, arr, 1);
                    broadcast(arr);
                    broadcast(messages.end.build(0));
                    delete clients[conn.id];
                    conn.close();
                    clearInterval(conn.snake.update);
                    conn.snake = null;
                    return;
                }

                broadcast(messages.position.build(conn.id, conn.snake));
                broadcast(messages.direction.build(conn.id, conn.snake));
            }, loopInterval);

            send(conn.id, messages.leaderboard.build([conn], clients.length, [conn]));
            send(conn.id, messages.highscore.build(highscoreName, highscoreMessage));
            send(conn.id, messages.minimap.build(foods));
        } else if (firstByte === 99) {
             console.log("[SERVER] 'c' message handling moved to handleConnection.");
        } else if (firstByte === 118) { // 'v' -  Victory message (仮定)
            let msg = message.readString(1, data, data.byteLength);
            console.log('[SERVER] Victory message received: ' + msg);
        }
        else if (firstByte === 88) {
            let value = message.readInt16(1, data);
            console.log('[SERVER] New message type \'X\' received. Value:', value);
            // 新しいメッセージタイプの処理をここに追加
        }
        else if (firstByte === 71) { // 'G' - Movement update without specific direction change
            // Handle continuous movement
            console.log('[SERVER] \'G\' message received (continuous movement update).');
            if(conn.snake){
                conn.snake.speed = message.readInt16(3, data) / 1000; // 1 バイトから 2 バイトに変更 (仮定)
                conn.snake.spang = Math.min(conn.snake.speed / (4.8 * 10), 1);
                conn.snake.direction.x = message.readInt8(5, data);
                conn.snake.direction.y = message.readInt8(6, data);
                console.log(`[SERVER] Snake ${conn.id} continuous movement update: speed=${conn.snake.speed}, direction=(${conn.snake.direction.x}, ${conn.snake.direction.y})`);
            }
        } else if (firstByte === 102) { // 'f' - Food consumption
            let foodId = message.readInt16(1, data);
            console.log('[SERVER] Food request message received. Food ID: ' + foodId);
            // Handle food consumption
            for (i = 0; i < foods.length; i++) {
                if (foods[i].id === foodId) {
                    if (!foods[i].eaten) {
                        foods[i].eaten = true;
                        foods[i].eaten_by = conn.snake;
                        foods[i].eaten_fr = 0;
                        // Increase snake length
                        conn.snake.fam += foods[i].sz * 16777215;
                        snl(conn.snake);
                        // Send update to clients
                        broadcast(messages.eat.build(foodId, conn.snake.fam));
                        // Remove food after a delay (handled in the main loop)
                        console.log(`[SERVER] Food ${foodId} eaten by snake ${conn.id}`);
                        break;
                    }
                }
            }
         } else if (firstByte === 87) { // 'W' - Sectors
            console.log('[SERVER] Sector information request message received.');
            // Implement logic to send visible sector information to the client
        } else if (firstByte === 101) { // 'e' - set direction
            if (!conn.snake) return;
            console.log('[SERVER] \'e\' message received (set direction).');
            let direction = message.readInt24(3, data) / (2 * Math.PI) * 256;
            conn.snake.direction.angle = direction * 2 * Math.PI / 256;
            console.log(`[SERVER] Snake ${conn.id} direction changed to: ${conn.snake.direction.angle}`);
        } else if (firstByte === 255 && secondByte === 0) {
            console.log('[SERVER] Received 0xFF 0x00 message. Handling as unknown.');
            // Handle 0xFF 0x00 message here
        } else {
            console.log('[ERROR] Unhandled message ' + String.fromCharCode(firstByte));
        }
    }
}

function generateFood(amount) {
    var color, i, id, results, size, x, y;
    i = 0;
    results = [];
    while (i < amount) {
        x = math.randomInt(0, 65535);
        y = math.randomInt(0, 65535);
        id = x * config['gameRadius'] * 3 + y;
        color = math.randomInt(0, config['foodColors']);
        size = math.randomInt(config['foodSize'][0], config['foodSize'][1]);
        foods.push(new Food(id, {
            x: x,
            y: y
        }, size, color));
        results.push(i++);
    }
    return results;
}

function generateSectors() {
    var i, results, sectorsAmount;
    sectorsAmount = config['gameRadius'] / config['sectorSize'];
    i = 0;
    results = [];
    while (i < sectorsAmount) {
        results.push(i++);
    }
    return results;
}

function spawnSnakes(id) {
    clients.forEach(function (newClient) {
        if (newClient.id !== id) {
            send(id, messages.snake.build(newClient.snake));
        }
    });
}

// クライアントにメッセージを送信
function send(id, data) {
    var client = clients[id];
    if (client /* && client.readyState == client.OPEN */) {
        var currentTime = Date.now();
        var deltaTime = client.lastTime ? currentTime - client.lastTime : 0;
        client.lastTime = currentTime;
        message.writeInt16(0, data, deltaTime);
        client.send(data, { binary: true });
    }
}

// すべてのクライアントにメッセージをブロードキャスト
function broadcast(data) {
    for (var i = 0; i < clients.length; i++) {
        send(i, data);
    }
}

// プレイヤーが死亡したときの処理
function killPlayer(playerId, endType) {
    broadcast(messages.end.build(endType));
}

// スコア計算のためのパラメータを更新
function setMscps(mscps) {
    fmlts = [mscps + 1 + 2048];
    fpsls = [mscps + 1 + 2048];

    for (var i = 0; i <= mscps; i++) {
        fmlts[i] = (i >= mscps ? fmlts[i - 1] : Math.pow(1 - 1.0 * i / mscps, 2.25));
        fpsls[i] = (i === 0 ? 0 : fpsls[i - 1] + 1.0 / fmlts[i - 1]);
    }

    var fmltsFiller = fmlts[mscps];
    var fpslsFiller = fpsls[mscps];

    for (var i = 0; i < 2048; i++) {
        fmlts[mscps + 1 + i] = fmltsFiller;
        fpsls[mscps + 1 + i] = fpslsFiller;
    }
}

function close() {
    console.log('[SERVER] Server Closed');
    server.close();
}