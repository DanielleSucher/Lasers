window.onload = function() {
    var socket = io.connect('http://localhost');
    var paper = new Raphael(document.getElementById('paper'), 400, 400);
    var grid = paper.set();
    var tiles = []; // non-moveable tiles
    var tileSet = paper.set(); // moveable tiles
    var laser = paper.set();


    socket.on('connect', function () {
        socket.on('gameState', function (data) {
            paper.clear();
            drawGrid();
            drawBoard(data);
        });
    });


    function drawBoard(gameState){
        for(var i=0;i<8;i++){
            for(var j=0;j<8;j++){
                if(gameState.board[i][j] != "empty"){
                    drawTile(i,j,gameState.board[i][j]);
                }
            }
        }
        // make all moveable tiles draggable
        tileSet.drag(move,down,up);
        // draw the laser path itself
        for(i=0; i < gameState.laserPath.length - 1; i++){
            drawLaser(gameState.laserPath[i], gameState.laserPath[i+1]);
        }
    }


    function drawGrid(){
        for(var i=0;i<8;i++){
            for(var j=0;j<8;j++){
                grid.push(paper.rect(50*i, 50*j, 50, 50).attr({stroke: '#000'}));
            }
        }
    }


    function drawTile(column,row,type){
        if(type != "laser" && type != "bullseye") {
            // add all moveable tiles to tileSet
            tileSet.push(paper.image("img/"+type+".png", 50*row, 50*column, 50, 50).data("type",type));
            // rotate on server and emit updated gamestate to all clients when a moveable tile is double-clicked
            tileSet.items.last().dblclick(function() {
                var x = Math.floor(this.getBBox(true).x/50);
                var y = Math.floor(this.getBBox(true).y/50);
                socket.emit('rotate', {row:y,column:x});
            });
        } else {
            // add all static tiles to the tile array
            tiles.push(paper.image("img/"+type+".png", 50*row, 50*column, 50, 50).data("type",type));
        }
    }


    function drawLaser(start, end){
        laser.push(paper.path("M"+(start[1]*50+25)+" "+(start[0]*50+25)+"L"+(end[1]*50+25)+" "+(end[0]*50+25)).attr({stroke: "#FF0000", "stroke-width":3}));
    }


    // define what happens when a tile is dragged
    var ox=0;
    var oy=0;
    var start = {};
    var end = {};
    var down = function () {
        var box = this.getBBox(true);
        var x = Math.floor((box.x + box.width/2)/50);
        var y = Math.floor((box.y + box.height/2)/50);
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
        var x = Math.floor((box.x + box.width/2)/50);
        var y = Math.floor((box.y + box.height/2)/50);
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
