var express = require('express'),
    app = express.createServer(express.static(__dirname)),
    io = require('socket.io').listen(app);

app.listen(8080);

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/laser.html');
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
var mirrorTypesExpanded = [['left','up'],['right','up'],['right','down'],['left','down'],['left','up']];

var Mirror = function(arg){ //ALWAYS left/right then up/down
    d1 = arg[0];
    d2 = arg[1];
    this.kind = 'mirror';
    if (d1 == 'down' || d1 == 'up'){
        this.name = 'mirror-'+d2[0]+d1[0];
        this.rotate = mirrorTypesExpanded[mirrorTypes.indexOf(d2[0]+d1[0])+1];
    } else if (d2 == 'down' || d2 == 'up'){
        this.name = 'mirror-'+d1[0]+d2[0];
        this.rotate = mirrorTypesExpanded[mirrorTypes.indexOf(d1[0]+d2[0])+1];
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
    this.boardRows = this.boardColumns = 12;
    this.board = [];
    for(i=0;i<this.boardRows;i++){
        this.board.push([]);
        for(j=0;j<this.boardColumns;j++){
            this.board[i].push("empty");
        }
    }
    this.board[0][0] = "laser";
    this.board[this.boardRows - 1][this.boardColumns - 1] = "bullseye";
    this.board[0][7] = new Mirror(["left", "down"]);
    this.board[1][7] = new Mirror(["left", "up"]);
    this.board[1][4] = new Mirror(["right", "down"]);
    this.board[7][4] = new Mirror(["right", "up"]);
    this.board[6][3] = "block";
    this.board[6][4] = "block";
    this.board[6][5] = "block";
    this.board[6][6] = "block";
    this.board[3][3] = "block";
    this.board[0][3] = "block";
};

Game.prototype = {
    findTile: function(type){
        for(i=0;i<this.boardRows;i++){
            for(j=0;j<this.boardColumns;j++){
                if(this.board[i][j] == type){
                    return [i,j];
                }
            }
        }
    },
    toJson: function(){
        var simpleBoard = [];
        for(i=0;i<this.boardRows;i++){
            simpleBoard.push([]);
            for(j=0;j<this.boardColumns;j++){
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
            curPosition = [curPosition[0] + searchDirection[0],
                        curPosition[1] + searchDirection[1]];
            if (this.isOnBoard(curPosition)){
                type = this.board[curPosition[0]][curPosition[1]];
                if (type == "bullseye"){
                    laserPath.push(curPosition);
                    console.log('win condition');
                    break;
                } else if (type == "empty"){
                    continue;
                } else if (type == "block"){
                    laserPath.push(curPosition);
                    break;
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
    },
    isOnBoard : function(pos){
        if (pos[0] < this.boardRows && pos[0] > -1 &&
            pos[1] < this.boardColumns && pos[1] > -1){
            return true;
        } else {
            return false;
        }
    }
};


game1 = new Game();

io.sockets.on('connection', function (socket) {
    socket.emit('gameState', game1.toJson());

    socket.on('rotate', function (data) {
        if (game1.board[data.row][data.column].kind == "mirror") {
            game1.board[data.row][data.column] = new Mirror(game1.board[data.row][data.column].rotate);
        }
        io.sockets.emit('gameState', game1.toJson());
    });

    socket.on('drag', function(data) {
        if(data.start.row != data.end.row || data.start.column != data.end.column) {
            if(game1.isOnBoard([data.end.row, data.end.column]) &&
                game1.isOnBoard([data.start.row, data.start.column]) &&
                game1.board[data.end.row][data.end.column] == "empty"){
                    game1.board[data.end.row][data.end.column] = game1.board[data.start.row][data.start.column];
                    game1.board[data.start.row][data.start.column] = "empty";
            }
        }
        io.sockets.emit('gameState', game1.toJson());
    });
});


