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
    // this.board[0][7] = new Mirror(["left", "down"]);
    // this.board[1][7] = new Mirror(["left", "up"]);
    // this.board[1][4] = new Mirror(["right", "down"]);
    // this.board[7][4] = new Mirror(["right", "up"]);
    this.board[2][0] = "block";
    this.board[2][1] = "block";
    this.board[2][2] = "block";
    this.board[2][3] = "block";
    this.board[2][4] = "block";
    this.board[2][0] = "block";
    this.board[2][6] = "block";
    this.board[6][3] = "block";
    this.board[6][4] = "block";
    this.board[6][5] = "block";
    this.board[6][6] = "block";
    this.board[3][3] = "block";
    this.board[0][3] = "block";
    this.board[3][0] = "block";
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
                    break;
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
    },
    isValidBoard : function(mirror_count){
        var toCheck = [[0,0,"right",0]]; //starting position, starting direction, 0 mirrors used
        var checked = [];
        var valid = false;
        var getNeighbors = function(node){
            console.log(node);
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


game1 = new Game();

console.log(game1.isValidBoard(3));