function AI(grid) {
  this.grid = grid;
}

// static evaluation function
AI.prototype.eval = function() {
  var emptyCells = this.grid.availableCells().length;
  //各种计算的权重，可以自己手动的调试
  var smoothWeight = 0.1,
      //monoWeight   = 0.0,
      //islandWeight = 0.0,
      mono2Weight  = 1.0,
      emptyWeight  = 2.7,
      maxWeight    = 1.0;

  return this.grid.smoothness() * smoothWeight
       //+ this.grid.monotonicity() * monoWeight
       //- this.grid.islands() * islandWeight
       + this.grid.monotonicity2() * mono2Weight
       + Math.log(emptyCells) * emptyWeight
       + this.grid.maxValue() * maxWeight;
};

// alpha-beta depth first search
AI.prototype.search = function(depth, alpha, beta, positions, cutoffs) {
  var bestScore;
  var bestMove = -1;
  var result;

  // the maxing player
  if (this.grid.playerTurn) {
    bestScore = alpha;
    //遍历四个方向
    for (var direction in [0, 1, 2, 3]) {
      var newGrid = this.grid.clone();
      //逐一搜寻方向
      if (newGrid.move(direction).moved) {
        positions++;
        //如果已经赢了直接返回
        if (newGrid.isWin()) {
          return { move: direction, score: 10000, positions: positions, cutoffs: cutoffs };
        }
        //如果还没有赢得话就继续想下走
        var newAI = new AI(newGrid);
        //当深度为0的时候停止
        if (depth == 0) {
          result = { move: direction, score: newAI.eval() };
        } else {//继承父节点的alpha
          //递归的搜寻  注意每移动一次轮次翻转 player->computer->player->computer->....
          result = newAI.search(depth-1, bestScore, beta, positions, cutoffs);
          if (result.score > 9900) { // win
            result.score--; // to slightly penalize higher depth from win
          } 
          positions = result.positions;
          cutoffs = result.cutoffs;
        }
        //如果返回的分数>当前最好分数则给bestScore和bestMove重新赋值
        if (result.score > bestScore) {
          bestScore = result.score;
          bestMove = direction;
        }
        //如果最好的分数大于beta也即意味着上一层节点不会继续向下走 切分
        if (bestScore > beta) {
          cutoffs++
          //既然不会往这儿走，那么分数还是你上层的beta

          return { move: bestMove, score: beta, positions: positions, cutoffs: cutoffs };
        }
      }
    }
  }

  else { // computer's turn, we'll do heavy pruning to keep the branching factor low
    bestScore = beta;

    // try a 2 and 4 in each cell and measure how annoying it is
    // with metrics from eval
    var candidates = [];
    //得到可以填充块的坐标
    var cells = this.grid.availableCells();
    //分数为2 或者 4
    var scores = { 2: [], 4: [] };
    for (var value in scores) {
      for (var i in cells) {
        scores[value].push(null);
        var cell = cells[i];
        var tile = new Tile(cell, parseInt(value, 10));
        this.grid.insertTile(tile);
        //算出分数，下面的计算可以看出要算出分数最大的，我们知道min节点是使游戏变得更难
        //那么smoothness要越小越好，所以加上符号(越大越好) islands意味着有数字的格子，当然越多越好
        //通俗理解就是不能合并在一起的越多越好
        scores[value][i] = -this.grid.smoothness() + this.grid.islands();
        this.grid.removeTile(cell);
      }
    }

    // now just pick out the most annoying moves
    var maxScore = Math.max(Math.max.apply(null, scores[2]), Math.max.apply(null, scores[4]));
    for (var value in scores) { // 2 and 4
      //将最大分数的候选者选出来（满足最大分数的可能不止一个）
      for (var i=0; i<scores[value].length; i++) {
        if (scores[value][i] == maxScore) {
          candidates.push( { position: cells[i], value: parseInt(value, 10) } );
        }
      }
    }

    // search on each candidate
    for (var i=0; i<candidates.length; i++) {
      var position = candidates[i].position;
      var value = candidates[i].value;
      var newGrid = this.grid.clone();
      var tile = new Tile(position, value);
      newGrid.insertTile(tile);
      newGrid.playerTurn = true;
      positions++;
      newAI = new AI(newGrid);
      //min节点往下的alpha还是上层的，beta是最好的分数，也就是说下层节点如果你取得的最大值只能是beta，
      //如果大于beta我会把你pass掉
      result = newAI.search(depth, alpha, bestScore, positions, cutoffs);
      positions = result.positions;
      cutoffs = result.cutoffs;
      //竟然有比beta还小的分数，好，我选择你
      if (result.score < bestScore) {
        bestScore = result.score;
      }
      //如果最好的分数小于上层的下界 意味着上层节点肯定不会继续向下走
      if (bestScore < alpha) {
        cutoffs++;
        //返回的分数是还是上层的值也就是说你反正不会走我这条路，那你的分数还是你原来的分数
        //关于此处的move:null 注意上面的result的depth是继承父节点的，意味着depth>0
        //也就是说最后一步必为max节点，min节点是不会有move操作的，所以直接返回null
        return { move: null, score: alpha, positions: positions, cutoffs: cutoffs };
      }
    }
  }
//计算到最好返回这些计算的值
  return { move: bestMove, score: bestScore, positions: positions, cutoffs: cutoffs };
}

// performs a search and returns the best move
AI.prototype.getBest = function() {
  return this.iterativeDeep();
}

// performs iterative deepening over the alpha-beta search
AI.prototype.iterativeDeep = function() {
  var start = (new Date()).getTime();
  var depth = 0;
  var best;
  //没有规定固定的depth 而是规定了计算时间，在规定时间内能计算到的深度
  do {
    var newBest = this.search(depth, -10000, 10000, 0 ,0);
    if (newBest.move == -1) {
      break;
    } else {
      best = newBest;
    }
    depth++;
  } while ( (new Date()).getTime() - start < minSearchTime);
  return best
}

AI.prototype.translate = function(move) {
 return {
    0: 'up',
    1: 'right',
    2: 'down',
    3: 'left'
  }[move];
}
