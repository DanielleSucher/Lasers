var express = require('express'),
    app = express.createServer(express.static(__dirname)),
    io = require('socket.io').listen(app);

app.listen(8080);

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/lasers.html');
});


var direction = {
    'left' : [0, -1],
    'right' : [0, 1],
    'up' : [-1, 0],
    'down' : [1, 0]
};

var directionName = function(arr){
    for (var x in direction){
        if (direction[x][0] == arr[0] && direction[x][1] == arr[1]){
            return x;
        }
    }
    return false;
};

var mirrorTypes = ['lu', 'ru', 'rd', 'ld', 'lu'];
var mirrorHash = {'lu': ['left','up'],
                    'ru': ['right', 'up'], 
                    'rd':['right','down'], 
                    'ld': ['left', 'down'], 
                    'lu': ['left', 'up']
                };

var Mirror = function(d1, d2){ //ALWAYS left/right then up/down
    this.kind = 'mirror';
    if (d1 == 'down' || d1 == 'up'){
        this.name = 'mirror-'+d2[0]+d1[0];
        this.rotate = mirrorHash[mirrorTypes[mirrorTypes.indexOf(d2[0]+d1[0])+1]];
    } else if (d2 == 'down' || d2 == 'up'){
        this.name = 'mirror-'+d1[0]+d2[0];
        this.rotate = mirrorHash[mirrorTypes[mirrorTypes.indexOf(d1[0]+d2[0])+1]];
    } else {
        throw "bad input to Mirror";
    }
    this.from = {
        'up':null,
        'down':null,
        'left':null,
        'right':null
    };
    this.from[d1] = direction[d2];
    this.from[d2] = direction[d1];
    
};

var Game = function(){
    // board is an array where each array therein is a row, and each item in such inner arrays is a column,
    // making a grid of squares that can have stuff in them
    this.board = [];
    for(i=0;i<8;i++){
        this.board.push([]);
        for(j=0;j<8;j++){
            this.board[i].push("empty");
        }
    }
    this.board[0][0] = "laser";
    this.board[7][7] = "bullseye";
    this.board[0][7] = new Mirror("left", "down");
    this.board[1][7] = new Mirror("left", "up");
    this.board[1][4] = new Mirror("right", "down");
    this.board[7][4] = new Mirror("right", "up");
};

Game.prototype = {
    findTile: function(type){
        for(i=0;i<8;i++){
            for(j=0;j<8;j++){
                if(this.board[i][j] == type){
                    return [i,j];
                }
            }
        }
    },
    toJson: function(){
        var simpleBoard = [];
        for(i=0;i<8;i++){
            simpleBoard.push([]);
            for(j=0;j<8;j++){
                var tile = this.board[i][j];
                if (typeof tile == 'string'){
                    simpleBoard[i].push(tile);
                } else {
                    simpleBoard[i].push(tile.name);
                }
            }
        }
        result = {
            'laserPath': this.calcLaser(),
            'board': simpleBoard
        };
        return result;
    },
    calcLaser: function(){
        var laserStart = this.findTile("laser");
        var searchDirection = direction.right;
        var laserPath = [laserStart];
        var curPosition = laserStart;
        while (true){
            console.log('search direction:', searchDirection);
            console.log('curPosition:', curPosition);
            curPosition = [curPosition[0] + searchDirection[0],
                        curPosition[1] + searchDirection[1]];
            if (curPosition[0] < 8 && curPosition[0] > -1 &&
                curPosition[1] < 8 && curPosition[1] > -1){
                type = this.board[curPosition[0]][curPosition[1]];
                if (type == "bullseye"){
                    laserPath.push(curPosition);
                    console.log('win condition');
                    break;
                } else if (type == "empty"){
                    continue;
                } else if (type == "laser"){
                    continue;
                } else if (type.kind == "mirror"){
                    var fromDirection = [-searchDirection[0], -searchDirection[1]];
                    searchDirection = type.from[directionName(fromDirection)];
                    laserPath.push(curPosition);
                    console.log('mirror hit!');
                    if (searchDirection === null){
                        break;
                    } else {
                        continue;
                    }
                }
            } else {
                laserPath.push(curPosition);
                break;
            }
        }
        return laserPath;
    }
};

game1 = new Game();

io.sockets.on('connection', function (socket) {
    socket.emit('gameState', game1.toJson());

    socket.on('rotate', function (data) {
        console.log(data);
        console.log(game1.board[data.x][data.y]);
        if (game1.board[data.x][data.y].kind == "mirror") {
            game1.board[data.x][data.y] = new Mirror(game1.board[data.x][data.y].rotate[0],
                                                            game1.board[data.x][data.y].rotate[1]);
        }
        console.log(game1.board[data.x][data.y]);
        socket.emit('gameState', game1.toJson());
    });
});


