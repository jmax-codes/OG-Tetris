
import React, { useState, useEffect, useCallback } from 'react';
import { COLS, ROWS, PIECES, INITIAL_SPEED, SPEED_INCREMENT } from '../constants';
import { PieceType, Piece, Grid, GameState } from '../types';
import { useInterval } from '../hooks/useInterval';

const createEmptyGrid = (): Grid => 
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

const getRandomPiece = (): PieceType => {
  const types: PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  return types[Math.floor(Math.random() * types.length)];
};

const TetrisGame: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    grid: createEmptyGrid(),
    activePiece: null,
    nextPiece: getRandomPiece(),
    score: 0,
    level: 1,
    lines: 0,
    isPaused: false,
    isGameOver: false,
  });

  const [dropTime, setDropTime] = useState<number | null>(INITIAL_SPEED);

  const checkCollision = (piece: Piece, grid: Grid, moveX = 0, moveY = 0) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x] !== 0) {
          const newX = piece.position.x + x + moveX;
          const newY = piece.position.y + y + moveY;

          if (
            newX < 0 ||
            newX >= COLS ||
            newY >= ROWS ||
            (newY >= 0 && grid[newY][newX] !== null)
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const lockPiece = useCallback(() => {
    setGameState(prev => {
      // ROOT CAUSE FIX: Safety guard against null activePiece during race conditions
      if (!prev.activePiece) return prev;

      const newGrid = prev.grid.map(row => [...row]);
      const { shape, position } = prev.activePiece;

      shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const gridY = position.y + y;
            const gridX = position.x + x;
            if (gridY >= 0 && gridY < ROWS && gridX >= 0 && gridX < COLS) {
              newGrid[gridY][gridX] = prev.activePiece!.type;
            }
          }
        });
      });

      let linesCleared = 0;
      const filteredGrid = newGrid.filter(row => {
        const isFull = row.every(cell => cell !== null);
        if (isFull) linesCleared++;
        return !isFull;
      });

      while (filteredGrid.length < ROWS) {
        filteredGrid.unshift(Array(COLS).fill(null));
      }

      const newLines = prev.lines + linesCleared;
      const newLevel = Math.floor(newLines / 10) + 1;
      const scoreTable = [0, 40, 100, 300, 1200];
      const newScore = prev.score + (scoreTable[linesCleared] * newLevel);

      return {
        ...prev,
        grid: filteredGrid,
        activePiece: null, // Piece is now locked, trigger next spawn
        score: newScore,
        lines: newLines,
        level: newLevel
      };
    });
  }, []);

  const spawnPiece = useCallback(() => {
    console.log('[SpawnPiece] Triggered');
    const type = gameState.nextPiece;
    const shape = PIECES[type];
    const newPiece: Piece = {
      type,
      shape,
      position: { x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 },
    };

    setGameState(prev => {
        if (checkCollision(newPiece, prev.grid)) {
            console.log('[SpawnPiece] Game Over on spawn');
            return { ...prev, isGameOver: true };
        }
        console.log('[SpawnPiece] Success');
        return {
            ...prev,
            activePiece: newPiece,
            nextPiece: getRandomPiece()
        }
    });
  }, [gameState.nextPiece]);

  const drop = useCallback(() => {
    if (!gameState.activePiece || gameState.isPaused || gameState.isGameOver) return;

    if (!checkCollision(gameState.activePiece, gameState.grid, 0, 1)) {
      setGameState(prev => ({
        ...prev,
        activePiece: prev.activePiece ? {
          ...prev.activePiece,
          position: { ...prev.activePiece.position, y: prev.activePiece.position.y + 1 }
        } : null
      }));
    } else {
      lockPiece();
    }
  }, [gameState.activePiece, gameState.grid, gameState.isPaused, gameState.isGameOver, lockPiece]);

  const hardDrop = () => {
    console.log('[HardDrop] triggered');
    if (!gameState.activePiece || gameState.isPaused || gameState.isGameOver) {
        console.log('[HardDrop] Aborted: paused/gameover/no-piece');
        return;
    }
    
    setGameState(prev => {
      if (!prev.activePiece) {
          console.log('[HardDrop] State Abort: No active piece');
          return prev;
      }
      
      // 1. Calculate drop distance
      let offset = 0;
      while (!checkCollision(prev.activePiece, prev.grid, 0, offset + 1)) {
        offset++;
      }
      console.log(`[HardDrop] Calculated offset: ${offset}`);
      
      // 2. Create the dropped piece at final position
      const finalPosition = { ...prev.activePiece.position, y: prev.activePiece.position.y + offset };
      const finalPiece = { ...prev.activePiece, position: finalPosition };
      console.log('[HardDrop] Final Position:', finalPosition);
      
      // 3. Lock piece into grid
      const newGrid = prev.grid.map(row => [...row]);
      let cellsLocked = 0;
      finalPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const gridY = finalPiece.position.y + y;
            const gridX = finalPiece.position.x + x;
            if (gridY >= 0 && gridY < ROWS && gridX >= 0 && gridX < COLS) {
              newGrid[gridY][gridX] = finalPiece.type;
              cellsLocked++;
            }
          }
        });
      });
      console.log(`[HardDrop] Cells locked: ${cellsLocked}`);

      // 4. Clear lines
      let linesCleared = 0;
      const filteredGrid = newGrid.filter(row => {
        const isFull = row.every(cell => cell !== null);
        if (isFull) linesCleared++;
        return !isFull;
      });

      while (filteredGrid.length < ROWS) {
        filteredGrid.unshift(Array(COLS).fill(null));
      }
      console.log(`[HardDrop] Lines cleared: ${linesCleared}`);

      // 5. Update score
      const newLines = prev.lines + linesCleared;
      const newLevel = Math.floor(newLines / 10) + 1;
      const scoreTable = [0, 40, 100, 300, 1200];
      const newScore = prev.score + (scoreTable[linesCleared] * newLevel);

      return {
        ...prev,
        grid: filteredGrid,
        activePiece: null, // Triggers spawnPiece via useEffect
        score: newScore,
        lines: newLines,
        level: newLevel
      };
    });
  };

  const handleRotate = () => {
    if (!gameState.activePiece || gameState.isPaused || gameState.isGameOver) return;
    const rotateShape = (shape: number[][]) => shape[0].map((_, index) => shape.map(col => col[index]).reverse());
    const rotatedShape = rotateShape(gameState.activePiece.shape);
    const rotatedPiece = { ...gameState.activePiece, shape: rotatedShape };
    
    if (!checkCollision(rotatedPiece, gameState.grid)) {
      setGameState(prev => ({ ...prev, activePiece: rotatedPiece }));
    }
  };

  const move = (dir: number) => {
    if (!gameState.activePiece || gameState.isPaused || gameState.isGameOver) return;
    if (!checkCollision(gameState.activePiece, gameState.grid, dir, 0)) {
      setGameState(prev => ({
        ...prev,
        activePiece: prev.activePiece ? {
          ...prev.activePiece,
          position: { ...prev.activePiece.position, x: prev.activePiece.position.x + dir }
        } : null
      }));
    }
  };

  useInterval(() => {
    drop();
  }, dropTime);

  const isProcessingRef = React.useRef(false); // Debounce ref

  useEffect(() => {
    console.log('[Effect] Checking spawn condition', { active: !!gameState.activePiece, gameOver: gameState.isGameOver });
    if (!gameState.activePiece && !gameState.isGameOver) {
      console.log('[Effect] Triggering spawnPiece');
      spawnPiece();
      isProcessingRef.current = false; // Reset lock on spawn
    }
  }, [gameState.activePiece, gameState.isGameOver, spawnPiece]);

  useEffect(() => {
    setDropTime(INITIAL_SPEED * Math.pow(SPEED_INCREMENT, gameState.level - 1));
  }, [gameState.level]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.isGameOver) return;
      
      // Debounce hard drop and other critical actions if needed
      if (e.key === ' ' || e.key === '5') {
          if (isProcessingRef.current) return;
      }

      switch (e.key.toLowerCase()) {
        case 'arrowleft': case 'a': case '7': move(-1); break;
        case 'arrowright': case 'd': case '9': move(1); break;
        case 'arrowdown': case 's': drop(); break;
        case 'arrowup': case 'w': case '8': handleRotate(); break;
        case ' ': case '5': 
            isProcessingRef.current = true;
            hardDrop(); 
            break;
        case 'p': setGameState(prev => ({ ...prev, isPaused: !prev.isPaused })); break;
        case 'r': restartGame(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.activePiece, gameState.grid, gameState.isPaused, gameState.isGameOver]);

  const restartGame = () => {
    setGameState({
      grid: createEmptyGrid(),
      activePiece: null,
      nextPiece: getRandomPiece(),
      score: 0,
      level: 1,
      lines: 0,
      isPaused: false,
      isGameOver: false,
    });
  };

  const renderGrid = () => {
    const displayGrid = gameState.grid.map(row => row.map(cell => cell ? '[]' : '.'));
    if (gameState.activePiece) {
      const { shape, position } = gameState.activePiece;
      shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const gridY = position.y + y;
            const gridX = position.x + x;
            if (gridY >= 0 && gridY < ROWS && gridX >= 0 && gridX < COLS) {
              displayGrid[gridY][gridX] = '[]';
            }
          }
        });
      });
    }
    return displayGrid;
  };

  const renderedGrid = renderGrid();
  
  // Optimized size - fits screen while remaining visible
  const cellHeight = "2.8vh"; 
  const containerHeight = `calc(${ROWS} * ${cellHeight})`;
  const containerWidth = `calc(${COLS} * ${cellHeight} * 1.2)`; 

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black overflow-hidden select-none p-[1vh]">
      
      {/* Header - More compact to allow bigger grid */}
      <div className="mb-[1vh] text-center w-full">
        <h1 className="text-[9vh] tracking-[0.25em] mr-[-0.25em] crt-glow font-bold opacity-90 leading-none inline-block">TETRIS</h1>
        <p className="text-[2.5vh] opacity-40 tracking-[0.6em] mr-[-0.6em] uppercase mt-[0.5vh]">ELECTRONIKA 60 REPLICA (1984)</p>
        
        <div className="flex justify-center mt-[1.2vh]">
          <button onClick={restartGame} className="border border-[#00ff00]/40 px-[4vh] py-[0.8vh] hover:bg-[#00ff00] hover:text-black transition-all crt-border-glow text-[1.9vh] uppercase tracking-[0.2em] font-bold">
            [ RESTART SYSTEM ]
          </button>
        </div>
      </div>

      {/* Main Body - Symmetrical Layout */}
      <div className="flex flex-row items-stretch justify-center gap-[2vw]">
        
        {/* Left Stats - Equal Width */}
        <div className="flex flex-col gap-[1.8vh] w-[18vw] max-w-[260px]" style={{ height: containerHeight }}>
          <div className="border border-[#00ff00]/60 p-[2.2vh] crt-border-glow bg-[#00ff00]/5 flex-1 flex flex-col">
            <div className="flex flex-col gap-[1.8vh] justify-center flex-1 border-b border-[#00ff00]/20 pb-[2vh] mb-[2vh]">
              <span className="opacity-40 text-[1.6vh] tracking-widest uppercase font-bold text-center">STATISTICS</span>
              <div className="flex justify-between items-baseline border-b border-[#00ff00]/20 pb-[0.7vh]">
                <span className="text-[2.1vh] uppercase font-bold">LINES:</span>
                <span className="crt-glow font-bold text-[2.8vh]">{gameState.lines}</span>
              </div>
              <div className="flex justify-between items-baseline border-b border-[#00ff00]/20 pb-[0.7vh]">
                <span className="text-[2.1vh] uppercase font-bold">LEVEL:</span>
                <span className="crt-glow font-bold text-[2.8vh]">{gameState.level}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[2.1vh] uppercase font-bold">SCORE:</span>
                <span className="crt-glow font-bold text-[2.8vh]">{gameState.score}</span>
              </div>
            </div>

            {/* Next Piece - Moved to Bottom */}
            <div className="flex flex-col items-center justify-center min-h-[16vh]">
               <h2 className="text-[1.6vh] uppercase opacity-70 mb-[1.2vh] tracking-[0.2em] font-bold">NEXT PIECE:</h2>
               <div className="flex flex-col items-center justify-center p-[1vh] h-[10vh]">
                  {PIECES[gameState.nextPiece].map((row, y) => (
                    <div key={y} className="flex">
                      {row.map((cell, x) => (
                        <span key={`${y}-${x}`} className={`w-[2.2vh] h-[2.2vh] flex items-center justify-center ${cell ? 'opacity-100 crt-glow text-[#00ff00]' : 'opacity-0'}`}>
                          {cell ? '[]' : ''}
                        </span>
                      ))}
                    </div>
                  ))}
               </div>
            </div>
          </div>

          <div className="border border-[#00ff00]/60 p-[2.2vh] crt-border-glow bg-[#00ff00]/5 min-h-[15vh] flex flex-col justify-center">
            <h2 className="text-center text-[1.8vh] mb-[2vh] opacity-70 tracking-[0.2em] font-bold uppercase border-b border-[#00ff00]/20 pb-[1vh]">NAVIGATION</h2>
            <div className="flex flex-col gap-[1.5vh] text-center">
               <a href="#" className="text-[1.6vh] tracking-[0.2em] font-bold uppercase hover:bg-[#00ff00] hover:text-black transition-all py-[0.5vh] border border-[#00ff00]/30 hover:border-[#00ff00]">HISTORY</a>
               <a href="#" className="text-[1.6vh] tracking-[0.2em] font-bold uppercase hover:bg-[#00ff00] hover:text-black transition-all py-[0.5vh] border border-[#00ff00]/30 hover:border-[#00ff00]">MOVIES ABOUT TETRIS</a>
            </div>
          </div>
        </div>

        {/* The Grid */}
        <div className="relative flex flex-col">
          <div className="flex">
            <div className="flex flex-col select-none opacity-40">
              {Array.from({ length: ROWS }).map((_, i) => (
                <div key={i} style={{ height: cellHeight, lineHeight: cellHeight }} className="text-[2.2vh] px-[1.2vh] font-mono">&lt; !</div>
              ))}
            </div>

            <div className="bg-black/80 border border-[#00ff00]/50 relative overflow-hidden flex flex-col shadow-[0_0_4vh_rgba(0,255,0,0.15)]" 
                 style={{ width: containerWidth, height: containerHeight }}>
              
              <div className="flex-1">
                {renderedGrid.map((row, y) => (
                  <div key={y} className="flex" style={{ height: cellHeight }}>
                    {row.map((cell, x) => (
                      <span key={x} 
                            style={{ width: `calc(${containerWidth} / ${COLS})`, height: cellHeight, lineHeight: cellHeight }}
                            className={`text-center inline-block whitespace-pre font-bold text-[2.4vh] transition-all duration-75 ${cell === '[]' ? 'crt-glow scale-110 text-[#00ff00]' : 'opacity-30 text-[#00ff00]/70'}`}>
                        {cell}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              
              {gameState.isPaused && !gameState.isGameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 z-20 backdrop-blur-sm border-y-2 border-[#00ff00]/60">
                  <div className="text-[6vh] crt-glow tracking-[0.2em] font-bold leading-none text-center">PAUSED</div>
                  <div className="text-[2vh] tracking-[0.3em] opacity-60 mt-[2vh] animate-pulse uppercase text-center">PRESS [P] TO RESUME</div>
                </div>
              )}

              {gameState.isGameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20">
                  <div className="text-red-500 text-[5.5vh] mb-[1.5vh] font-bold tracking-[0.2em] crt-glow uppercase text-center">GAME OVER</div>
                  <div className="text-[2.6vh] mb-[4vh] opacity-70 tracking-widest uppercase font-bold text-center">SCORE: {gameState.score}</div>
                  <button onClick={restartGame} className="border-2 border-[#00ff00] px-[4vh] py-[1.6vh] hover:bg-[#00ff00] hover:text-black transition-all tracking-[0.3em] font-bold text-[1.8vh] uppercase">RESTART</button>
                </div>
              )}
            </div>

            <div className="flex flex-col select-none opacity-40">
              {Array.from({ length: ROWS }).map((_, i) => (
                <div key={i} style={{ height: cellHeight, lineHeight: cellHeight }} className="text-[2.2vh] px-[1.2vh] font-mono">! &gt;</div>
              ))}
            </div>
          </div>
          <div className="mt-[1vh] flex flex-col items-center opacity-40 select-none font-mono">
             <div className="text-[2.2vh] tracking-tighter leading-none">&lt;!========================!&gt;</div>
             <div className="text-[2.2vh] tracking-[0.3em] mt-[0.4vh] leading-none">\/\/\/\/\/\/\/\/\/\/\/\</div>
          </div>
        </div>

        {/* Right Controls - Equal Width */}
        <div className="w-[18vw] max-w-[260px] border border-[#00ff00]/60 p-[2.2vh] crt-border-glow text-sm bg-[#00ff00]/5 flex flex-col" style={{ height: containerHeight }}>
          <h2 className="text-center text-[2.8vh] mb-[2.5vh] crt-glow border-b border-[#00ff00]/40 pb-[1.2vh] tracking-[0.2em] font-bold uppercase leading-none">CONTROLS</h2>
          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-[1.8vh]">
              <p className="text-[1.8vh] opacity-40 tracking-[0.3em] font-bold uppercase">NAVIGATION:</p>
              <div className="flex justify-between items-center"><span className="text-[2.2vh] font-bold uppercase">[A / LEFT]</span> <span className="opacity-60 text-[2.0vh] font-bold uppercase">MOVE</span></div>
              <div className="flex justify-between items-center"><span className="text-[2.2vh] font-bold uppercase">[D / RIGHT]</span> <span className="opacity-60 text-[2.0vh] font-bold uppercase">MOVE</span></div>
              <div className="flex justify-between items-center"><span className="text-[2.2vh] font-bold uppercase">[W / UP]</span> <span className="opacity-60 text-[2.0vh] font-bold uppercase">ROTATE</span></div>
              <div className="flex justify-between items-center"><span className="text-[2.2vh] font-bold uppercase">[S / DOWN]</span> <span className="opacity-60 text-[2.0vh] font-bold uppercase">SOFT</span></div>
            </div>
            <div className="space-y-[1.8vh] pt-[1.8vh] border-t border-[#00ff00]/20">
              <div className="flex justify-between items-center font-bold">
                <span className="text-[#00ff00] crt-glow text-[2.5vh] tracking-widest uppercase">[SPACE / 5]</span> 
                <span className="opacity-60 text-[2.0vh] uppercase font-bold">HARD DROP</span>
              </div>
            </div>
            <div className="border-t border-[#00ff00]/20 pt-[1.8vh]">
              <div className="grid grid-cols-3 gap-[1.2vh] text-center font-bold">
                <div className="opacity-10 flex items-center justify-center text-[1.2vh]">4</div>
                <div className="border border-[#00ff00]/30 py-[1.2vh] flex items-center justify-center text-[1.6vh] hover:bg-[#00ff00]/10 cursor-pointer uppercase transition-colors">[8] ROT</div>
                <div className="opacity-10 flex items-center justify-center text-[1.2vh]">6</div>
                <div className="border border-[#00ff00]/30 py-[1.2vh] flex items-center justify-center text-[1.6vh] hover:bg-[#00ff00]/10 cursor-pointer uppercase transition-colors">[7] L</div>
                <div className="border border-[#00ff00]/40 py-[1.2vh] crt-glow bg-[#00ff00]/15 flex items-center justify-center text-[1.6vh] font-black">[5]</div>
                <div className="border border-[#00ff00]/30 py-[1.2vh] flex items-center justify-center text-[1.6vh] hover:bg-[#00ff00]/10 cursor-pointer uppercase transition-colors">[9] R</div>
              </div>
            </div>
            <div className="border-t border-[#00ff00]/20 pt-[2vh] flex justify-between text-[1.8vh] opacity-60 font-bold tracking-[0.2em] uppercase">
              <span className="hover:opacity-100 cursor-pointer px-[0.5vh] transition-all">[P] PAUSE</span>
              <span className="hover:opacity-100 cursor-pointer px-[0.5vh] transition-all">[R] RESET</span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-0 crt-scanline pointer-events-none z-50 opacity-40"></div>
    </div>
  );
};

export default TetrisGame;
