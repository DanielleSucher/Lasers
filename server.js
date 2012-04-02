var express = require('express'),
    app = express.createServer(express.static(__dirname)),
    io = require('socket.io').listen(app);
io.set('log level', 1);

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

var getPerps = function(direction){
    if(direction[0] === 0){
        return ["up","down"];
    } else {
        return ["right","left"];
    }
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

var getSolvableGame = function(size, numBlocks){
    var attempts = 5; // with a given number of blocks before trying numBlocks - 1
    console.log('starting to look for a solvable game for ', numBlocks, ' blocks');
    for (var attempt = 0; attempt < attempts; attempt++){
        g = new Game(size);
        for (var i = 0; i < numBlocks; i++){
            g.addTile('block');
        }
        var maxMirrors = 10;
        for (var i = 0; i < maxMirrors; i++){
            if (g.isValidBoard(i)){
                console.log('required mirrors:', i);
                for (var m = 0; m < i; m++){
                    g.addTile(new Mirror(['right', 'up']));
                }
                return g;
            }
        }
        console.log('game thrown out, trying another');
    }
    console.log('could not find solvable game with ', numBlocks, 'blocks');
    return getSolvableGame(size, numBlocks-1);
}

var Game = function(size){
    // board is an array where each array therein is a row, and each item in such inner arrays is a column,
    // making a grid of squares that can have stuff in them
    this.boardRows = this.boardColumns = size;
    this.board = [];
    this.win = false;
    for(i=0;i<this.boardRows;i++){
        this.board.push([]);
        for(j=0;j<this.boardColumns;j++){
            this.board[i].push("empty");
        }
    }
    this.board[0][0] = "laser";
    this.board[this.boardRows - 1][this.boardColumns - 1] = "bullseye";
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
        return false;
    },
    addTile: function(tile){
        if (!this.findTile('empty')){return;}
        while (true){
            tryRow = Math.floor(Math.random() * this.boardRows);
            tryColumn = Math.floor(Math.random() * this.boardColumns);
            if (this.board[tryRow][tryColumn] == 'empty'){
                this.board[tryRow][tryColumn] = tile;
                break
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
            'board': simpleBoard,
            'win' : this.win
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
                    this.win = true;
                    break;
                } else if (type == "empty"){
                    continue;
                } else if (type == "block"){
                    laserPath.push(curPosition);
                    break;
                } else if (type == "laser"){
                    break;
                } else if (type.kind == "mirror"){
                    var fromDirection = [-searchDirection[0], -searchDirection[1]];
                    searchDirection = type.from[directionName(fromDirection)];
                    laserPath.push(curPosition);
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
    },
    isValidBoard : function(mirror_count){
        var toCheck = [[0,0,"right",0]]; //starting position, starting direction, 0 mirrors used
        var checked = [];
        var valid = false;
        var getNeighbors = function(node){
            //console.log(node);
            var searchDirection = direction[node[2]];
            var curPosition = [node[0],node[1]];
            var neighbors = [];
            while (true){
                curPosition = [curPosition[0] + searchDirection[0],
                            curPosition[1] + searchDirection[1]];
                if (this.isOnBoard(curPosition)){
                    type = this.board[curPosition[0]][curPosition[1]];
                    if (type == "empty"){
                        if(node[3] < mirror_count){
                            var perps = getPerps(searchDirection);
                            neighbors.push(curPosition.concat([perps[0], node[3]+1]));
                            neighbors.push(curPosition.concat([perps[1], node[3]+1]));
                        }
                        continue;
                    } else if (type == "bullseye"){
                        valid = true;
                        break;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
            return neighbors;
        };
        while(true){
            var check = toCheck.pop();
            if(valid){
                return valid;
            } else {
                toCheck = toCheck.concat(getNeighbors.call(this,check));
                if(toCheck.length === 0){
                    return valid;
                }
            }
        }
    }
};


game1 = getSolvableGame(12, 60);

io.sockets.on('connection', function (socket) {
    socket.emit('startGame', game1.toJson());

    socket.on('newGame', function (data) {
        game1 = getSolvableGame(12, 60);
        io.sockets.emit('startGame', game1.toJson());
    });
    
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


