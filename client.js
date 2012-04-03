var boardWidth, boardHeight;
boardWidth = boardHeight = 500;

// add a 'last' method to arrays
if(!Array.prototype.last) {
    Array.prototype.last = function() {
        return this[this.length - 1];
    };
}

// add 'contains' methods to arrays
if(!Array.prototype.contains) {
    Array.prototype.contains = function(x) {
        return this.indexOf(x) == -1 ? false : true ;
    };
}
if(!Array.prototype.doesNotContain) {
    Array.prototype.doesNotContain = function(x) {
        return this.indexOf(x) == -1 ? true : false ;
    };
}

function BoardDisplay(socket, holder, newGameButton){
    this.holder = holder;
    this.socket = socket;
    this.newGameButton = newGameButton;
    this.paper = new Raphael(holder, boardWidth, boardHeight);
    this.grid = this.paper.set();
    this.tiles = []; // non-moveable tiles
    this.tileSet = this.paper.set(); // moveable tiles
    this.laser = this.paper.set();
}

BoardDisplay.prototype = {
    onStartGame : function(data){
        this.rows = data.board.length;
        this.columns = data.board[0].length;
        this.tileWidth = boardWidth / this.columns;
        this.tileHeight = boardHeight / this.rows;
        this.board = data.board;
        this.oldBoard = data.board;
        this.boardObjects = [];
        for (var i=0; i<this.rows; i++){
            var row = [];
            for (var j=0; j<this.columns; j++){
                row.push([]);
            }
            this.boardObjects.push(row);
        }
        this.laserPath = data.laserPath;
        this.win = data.win;
        this.paper.clear();
        this.drawGrid();
        this.drawBoard();
        if (data.win){
            newGame.hidden = false;
        }
    },
    onGameState : function(data){
        this.oldBoard = this.board;
        this.board = data.board;
        this.laserPath = data.laserPath;
        this.win = data.win;
        //this.tileSet.remove();
        this.laser.remove();
        this.drawBoard(true);
        //this.drawBoard();
        if (data.win){
            newGame.hidden = false;
        }
    },
    forEachTile : function(func){
        for(var i=0;i<this.rows;i++){
            for(var j=0;j<this.columns;j++){
                func(i, j);
            }
        }
    },
    drawBoard : function(justUpdate){
        if (justUpdate === undefined){justUpdate = false;}
        var self = this;
        // draw the laser path itself
        for(var i=0; i < this.laserPath.length - 1; i++){
            this.drawLaser(i, i+1);
        }
        // draw the moveable tiles
        this.forEachTile(function(i, j){
            if (justUpdate){
                if (self.oldBoard[i][j] != self.board[i][j]){
                    console.log('considering removing object at ',i,' ,',j,'...');
                    console.log(self.boardObjects[i][j]);
                    if (self.oldBoard[i][j].slice(0,6) === 'mirror'){
                        console.log('removing object at ',i,', ',j);
                        self.boardObjects[i][j].remove();
                    }
                    self.drawTile(i,j);
                    console.log('updating tile ', i, ',', j)
                }
            } else {
                if(["empty", "bullseye", "block"].doesNotContain(self.board[i][j])){
                    self.drawTile(i,j);
                }
            }
        });

    },
    drawGrid : function(){
        var self = this;
        this.forEachTile(function(i, j){
            self.grid.push(self.paper.rect(self.tileWidth*j, self.tileHeight*i, self.tileWidth, self.tileHeight).attr({stroke: '#000'}));
            if(["block", "bullseye"].contains(self.board[i][j])){
                self.drawTile(i,j);
            }
        });
    },
    drawTile : function(row,column){
        var self = this;

        // define what happens when a tile is dragged
        var down = function () {
            var box = this.getBBox(true);
            this.originalPosition = [box.x, box.y];
            this.ox=0;
            this.oy=0;
            this.currentlyBeingDragged=true;
            var x = Math.floor((box.x + box.width/2)/box.width);
            var y = Math.floor((box.y + box.height/2)/box.height);
            this.dragStart = {row:y,column:x};
        };
        var move = function (dx, dy) {
            this.attr({
                transform: "...T" + (dx - this.ox) + "," + (dy - this.oy)
            });
            this.ox=dx;
            this.oy=dy;
        };
        var up = function () {
            this.currentlyBeingDragged=false;
            var box = this.getBBox();
            var x = Math.floor((box.x + box.width/2)/self.tileWidth);
            var y = Math.floor((box.y + box.height/2)/self.tileHeight);
            end = {row:y,column:x};
            // drag on server and emit updated gamestate to all clients when a moveable tile is dragged
            self.socket.emit('drag', {start:this.dragStart,end:end});
            this.ox=0;
            this.oy=0;
            this.attr({
                transform: "...T"+box.x-this.originalPosition[0]+","+box.y-this.originalPosition[1]
            });
        }
        var type = this.board[row][column];
        var tile;
        if(["empty"].contains(type)){
            ;
        } else if(["laser", "bullseye", "block"].doesNotContain(type)){
            // add all moveable tiles to tileSet
            tile = this.paper.image("img/"+type+".png", this.tileWidth*column, this.tileHeight*row, this.tileWidth, this.tileHeight).data("type",type);
            this.tileSet.push(tile);
            this.boardObjects[row][column] = tile;
            // rotate on server and emit updated gamestate to all clients when a moveable tile is double-clicked
            tile.dblclick(function() {
                var box = this.getBBox(true);
                var x = Math.floor((box.x + box.width/2) / self.tileWidth);
                var y = Math.floor((box.y + box.height/2) / self.tileHeight);
                self.socket.emit('rotate', {row:y,column:x});
            });
            // make all moveable tiles draggable
            tile.drag(move,down,up);
        } else {
            // add all static tiles to the tile array
            tile = this.paper.image("img/"+type+".png", this.tileWidth*column, this.tileHeight*row, this.tileWidth, this.tileHeight).data("type",type);
            this.tiles.push(tile);
        }
    },
    drawLaser: function(i1, i2){
        var start = this.laserPath[i1];
        var end = this.laserPath[i2];
        this.laser.push(this.paper.path(
                    "M"+((start[1]+.5)*this.tileWidth)+" "+
                    ((start[0]+.5)*this.tileHeight)+"L"+
                    ((end[1]+.5)*this.tileWidth)+" "+
                    ((end[0]+.5)*this.tileHeight))
                .attr({stroke: "#FF0000", "stroke-width":3}));
    },
}

window.onload = function() {
    var socket = io.connect('http://localhost');
    var board = new BoardDisplay(socket,
            document.getElementById("paper"),
            document.getElementById("newGame"));
    newGame.addEventListener('click', function(){
        socket.emit('newGame');
        newGame.hidden = true;
    });

    socket.on('connect', function () {
        socket.on('startGame', function(data){board.onStartGame(data);});
        socket.on('gameState', function(data){board.onGameState(data);});
    });



};
