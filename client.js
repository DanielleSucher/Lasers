var boardWidth, boardHeight;
boardWidth = boardHeight = 500;

window.onload = function() {
    var socket = io.connect('http://localhost');
    var paper = new Raphael(document.getElementById('paper'), boardWidth, boardHeight);
    var grid = paper.set();
    var tiles = []; // non-moveable tiles
    var tileSet = paper.set(); // moveable tiles
    var laser = paper.set();


    socket.on('connect', function () {
        socket.on('gameState', function (data) {
            paper.clear();
            drawGrid(data);
            drawBoard(data);
        });
    });


    function drawBoard(gameState){
        var rows = gameState.board.length;
        var columns = gameState.board[0].length;
        for(var i=0;i<rows;i++){
            for(var j=0;j<columns;j++){
                if(gameState.board[i][j] != "empty"){
                    drawTile(i,j,gameState);
                }
            }
        }
        // make all moveable tiles draggable
        tileSet.drag(move,down,up);
        // draw the laser path itself
        for(i=0; i < gameState.laserPath.length - 1; i++){
            drawLaser(i, i+1, gameState);
        }
    }


    function drawGrid(gameState){
        var rows = gameState.board.length;
        var columns = gameState.board[0].length;
        var tileWidth = boardWidth / columns;
        var tileHeight = boardHeight / rows;
        for(var i=0;i<rows;i++){
            for(var j=0;j<columns;j++){
                grid.push(paper.rect(tileWidth*j, tileHeight*i, tileWidth, tileHeight).attr({stroke: '#000'}));
            }
        }
    }


    function drawTile(row,column,gameState){
        var type = gameState.board[row][column];
        var rows = gameState.board.length;
        var columns = gameState.board[0].length;
        var tileWidth = boardWidth / columns;
        var tileHeight = boardHeight / rows;
        if(type != "laser" && type != "bullseye") {
            // add all moveable tiles to tileSet
            tileSet.push(paper.image("img/"+type+".png", tileWidth*column, tileHeight*row, tileWidth, tileHeight).data("type",type));
            // rotate on server and emit updated gamestate to all clients when a moveable tile is double-clicked
            tileSet.items.last().dblclick(function() {
                var box = this.getBBox(true);
                var x = Math.floor(box.x/tileWidth + .5);
                var y = Math.floor(box.y/tileHeight + .5);
                socket.emit('rotate', {row:y,column:x});
            });
        } else {
            // add all static tiles to the tile array
            tiles.push(paper.image("img/"+type+".png", tileWidth*column, tileHeight*row, tileWidth, tileHeight).data("type",type));
        }
    }


    function drawLaser(i1, i2, gameState){
        var start = gameState.laserPath[i1];
        var end = gameState.laserPath[i2];
        var rows = gameState.board.length;
        var columns = gameState.board[0].length;
        var tileWidth = boardWidth / columns;
        var tileHeight = boardHeight / rows;
        laser.push(paper.path("M"+((start[1]+.5)*tileWidth)+" "+((start[0]+.5)*tileHeight)+"L"+((end[1]+.5)*tileWidth)+" "+((end[0]+.5)*tileHeight)).attr({stroke: "#FF0000", "stroke-width":3}));
    }


    // define what happens when a tile is dragged
    var ox=0;
    var oy=0;
    var start = {};
    var end = {};
    var down = function () {
        var box = this.getBBox(true);
        var x = Math.floor((box.x + box.width/2)/box.width);
        var y = Math.floor((box.y + box.height/2)/box.height);
        start = {row:y,column:x};
    },
    move = function (dx, dy) {
        this.attr({
            transform: "...T" + (dx - ox) + "," + (dy - oy)
        });
        ox=dx;
        oy=dy;
    },
    up = function () {
        var box = this.getBBox();
        var x = Math.floor((box.x + box.width/2)/box.width);
        var y = Math.floor((box.y + box.height/2)/box.height);
        end = {row:y,column:x};
        // drag on server and emit updated gamestate to all clients when a moveable tile is dragged
        socket.emit('drag', {start:start,end:end});
        ox=0;
        oy=0;
    };


    // add a 'last' method to arrays
    if(!Array.prototype.last) {
        Array.prototype.last = function() {
            return this[this.length - 1];
        };
    }

};
