import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import cors from 'cors';
import { execSync, spawn } from 'child_process';
import readline from 'readline';
import iconv from 'iconv-lite';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// --- MOCK DATA & STATE ---
const SYMBOLS = ['KQ.m@SHFE.au', 'KQ.m@INE.ec'];

interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface SymbolState {
  symbol: string;
  name: string;
  currentPrice: number;
  kp: number;
  klines: Kline[];
  currentKline: Kline | null;
  positions: any[];
  orders: any[];
  stopLossCount: number;
}

const symbolStates: Record<string, SymbolState> = {};
SYMBOLS.forEach(sym => {
  symbolStates[sym] = {
    symbol: sym,
    name: sym.includes('au') ? '沪金主力' : '集运欧线主力',
    currentPrice: 0,
    kp: 0,
    klines: [],
    currentKline: null,
    positions: [],
    orders: [],
    stopLossCount: 0
  };
});

let accountBalance = 100000;
let isTradingAllowed = true;
let globalTime = new Date();
globalTime.setHours(9, 0, 0, 0);

// Strategy Parameters
let strategyParams = {
  pl: 0.01, // 1%
  sl: 0.005, // 0.5%
  ap: 0.02, // 2%
  maxStopLosses: 3,
  closeTimeDay: '14:59',
  closeTimeNight1: '22:59',
  closeTimeNight2: '00:59',
};

// --- PYTHON BRIDGE SETUP ---
let usePythonBridge = false;
let pythonProcess: any = null;

try {
  console.log('Checking Python availability...');
  execSync('python3 --version');
  console.log('Installing TqSdk2...');
  execSync('pip3 install tqsdk2 pandas', { stdio: 'inherit' });
  usePythonBridge = true;
  console.log('Python bridge ready to use.');
} catch (e) {
  console.log('Python or pip not available, falling back to Sina Finance API.');
}

if (usePythonBridge) {
  pythonProcess = spawn('python3', ['tq_bridge.py']);
  
  const rl = readline.createInterface({
    input: pythonProcess.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    try {
      const data = JSON.parse(line);
      handlePythonMessage(data);
    } catch (e) {
      console.log('Python output:', line);
    }
  });

  pythonProcess.stderr.on('data', (data: any) => {
    console.error(`Python Error: ${data}`);
  });
} else {
  // Start Sina Finance fallback simulator
  setInterval(fetchSinaFinance, 2000);
}

function handlePythonMessage(data: any) {
  if (data.type === 'tick') {
     const state = symbolStates[data.symbol];
     if (!state) return;
     
     state.currentPrice = data.price;
     globalTime = new Date(data.time.replace(' ', 'T')); 
     
     if (state.kp === 0 && state.klines.length === 0) {
        state.kp = state.currentPrice;
     }

     executeStrategy(data.symbol, state.currentPrice, globalTime);
     broadcastMarketData(data.symbol);
  } else if (data.type === 'kline') {
     const state = symbolStates[data.symbol];
     if (!state) return;
     
     state.currentKline = data.kline;
     const existingIdx = state.klines.findIndex(k => k.time === state.currentKline!.time);
     if (existingIdx >= 0) {
        state.klines[existingIdx] = state.currentKline;
     } else {
        state.klines.push(state.currentKline);
        if (state.klines.length > 100) state.klines.shift();
     }
  } else if (data.type === 'account') {
     accountBalance = data.balance;
     broadcastAccount();
  } else if (data.type === 'ready') {
     console.log(`Connected to TqSdk, tracking symbols: ${data.symbols.join(', ')}`);
  }
}

function syncPositionToPython(symbol: string) {
  if (!pythonProcess) return;
  const state = symbolStates[symbol];
  let netVol = 0;
  state.positions.forEach(p => {
     if (p.direction === 'LONG') netVol += p.volume;
     if (p.direction === 'SHORT') netVol -= p.volume;
  });
  pythonProcess.stdin.write(JSON.stringify({ type: 'set_position', symbol, volume: netVol }) + '\n');
}

// --- STRATEGY ENGINE ---
function executeStrategy(symbol: string, price: number, currentTime: Date) {
  if (!isTradingAllowed) return;
  const state = symbolStates[symbol];

  const timeStr = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
  
  // Check for market close
  if (timeStr === strategyParams.closeTimeDay || timeStr === strategyParams.closeTimeNight1 || timeStr === strategyParams.closeTimeNight2) {
    if (state.positions.length > 0) {
      closeAllPositions(symbol, price, 'Market Close');
    }
    return;
  }

  if (state.stopLossCount >= strategyParams.maxStopLosses) {
    return; // Max stop losses reached for the day
  }

  // 1. Open Position Logic
  if (state.positions.length === 0) {
    if (state.kp === 0) return;
    
    const upperThreshold = state.kp * (1 + strategyParams.pl);
    const lowerThreshold = state.kp * (1 - strategyParams.pl);

    if (price >= upperThreshold) {
      openPosition(symbol, 'LONG', price, 1, 'Initial Open (Up)');
    } else if (price <= lowerThreshold) {
      openPosition(symbol, 'SHORT', price, 1, 'Initial Open (Down)');
    }
  } else {
    // 2. Stop Loss Logic
    for (let i = state.positions.length - 1; i >= 0; i--) {
      const pos = state.positions[i];
      const slPriceLong = pos.price * (1 - strategyParams.sl);
      const slPriceShort = pos.price * (1 + strategyParams.sl);

      if (pos.direction === 'LONG' && price <= slPriceLong) {
        closePosition(symbol, i, price, 'Stop Loss');
        state.stopLossCount++;
      } else if (pos.direction === 'SHORT' && price >= slPriceShort) {
        closePosition(symbol, i, price, 'Stop Loss');
        state.stopLossCount++;
      }
    }

    // 3. Add Position Logic
    if (state.positions.length === 1) {
      const firstPos = state.positions[0];
      const addUpper = state.kp * (1 + strategyParams.ap);
      const addLower = state.kp * (1 - strategyParams.ap);

      if (firstPos.direction === 'LONG' && price >= addUpper) {
        openPosition(symbol, 'LONG', price, 1, 'Add Position (Up)');
      } else if (firstPos.direction === 'SHORT' && price <= addLower) {
        openPosition(symbol, 'SHORT', price, 1, 'Add Position (Down)');
      }
    }
  }
}

function openPosition(symbol: string, direction: string, price: number, volume: number, reason: string) {
  const state = symbolStates[symbol];
  const margin = price * volume * 0.1; // Assume 10% margin
  if (accountBalance >= margin) {
    state.positions.push({ direction, price, volume, timestamp: Date.now() });
    state.orders.push({ type: 'OPEN', direction, price, volume, reason, timestamp: Date.now() });
    syncPositionToPython(symbol);
    broadcastAccount();
  }
}

function closePosition(symbol: string, index: number, price: number, reason: string) {
  const state = symbolStates[symbol];
  const pos = state.positions[index];
  const pnl = pos.direction === 'LONG' ? (price - pos.price) * pos.volume : (pos.price - price) * pos.volume;
  if (!usePythonBridge) {
    accountBalance += pnl;
  }
  state.orders.push({ type: 'CLOSE', direction: pos.direction, price, volume: pos.volume, pnl, reason, timestamp: Date.now() });
  state.positions.splice(index, 1);
  syncPositionToPython(symbol);
  broadcastAccount();
}

function closeAllPositions(symbol: string, price: number, reason: string) {
  const state = symbolStates[symbol];
  for (let i = state.positions.length - 1; i >= 0; i--) {
    closePosition(symbol, i, price, reason);
  }
}

// --- MARKET SIMULATOR (Fallback to Sina Finance) ---
async function fetchSinaFinance() {
  try {
    const res = await fetch('http://hq.sinajs.cn/list=nf_AU0,nf_EC0', {
      headers: { 'Referer': 'https://finance.sina.com.cn/' }
    });
    const buffer = await res.arrayBuffer();
    const text = iconv.decode(Buffer.from(buffer), 'gbk');
    
    globalTime = new Date();
    const timestamp = Math.floor(globalTime.getTime() / 60000) * 60; // 1-minute bucket

    const lines = text.split('\n');
    
    SYMBOLS.forEach((sym, index) => {
      const state = symbolStates[sym];
      const line = lines[index];
      if (!line) return;
      
      const match = line.match(/="([^"]*)"/);
      if (!match || !match[1]) return;
      
      const parts = match[1].split(',');
      if (parts.length < 9) return;
      
      // Sina Finance format: name, time, open, high, low, close, current, ...
      const name = parts[0];
      if (name && name.length > 0) {
        state.name = name;
      }

      const currentPrice = parseFloat(parts[6]); // current price
      if (isNaN(currentPrice) || currentPrice === 0) return;
      
      state.currentPrice = currentPrice;
      if (state.kp === 0) state.kp = currentPrice;

      // Update K-line
      if (!state.currentKline || state.currentKline.time !== timestamp) {
        if (state.currentKline) {
          state.klines.push(state.currentKline);
          if (state.klines.length > 100) state.klines.shift();
        }
        state.currentKline = {
          time: timestamp,
          open: state.currentPrice,
          high: state.currentPrice,
          low: state.currentPrice,
          close: state.currentPrice,
        };
      } else {
        state.currentKline.high = Math.max(state.currentKline.high, state.currentPrice);
        state.currentKline.low = Math.min(state.currentKline.low, state.currentPrice);
        state.currentKline.close = state.currentPrice;
      }

      executeStrategy(sym, state.currentPrice, globalTime);
      broadcastMarketData(sym);
    });
  } catch (e) {
    console.error('Failed to fetch from Sina Finance:', e);
  }
}

function broadcastMarketData(symbol: string) {
  const state = symbolStates[symbol];
  const marketData = {
    type: 'market',
    symbol,
    name: state.name,
    tick: { price: state.currentPrice, time: globalTime.toISOString() },
    kline: state.currentKline,
  };
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(marketData));
    }
  });
}

function broadcastAccount() {
  const accountData = {
    type: 'account',
    balance: accountBalance,
    symbols: Object.fromEntries(
      Object.entries(symbolStates).map(([sym, state]) => [
        sym,
        {
          name: state.name,
          positions: state.positions,
          orders: state.orders,
          stopLossCount: state.stopLossCount,
          kp: state.kp
        }
      ])
    )
  };
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(accountData));
    }
  });
}

wss.on('connection', (ws) => {
  // Send initial data
  const initialStates = Object.fromEntries(
    Object.entries(symbolStates).map(([sym, state]) => [
      sym,
      {
        name: state.name,
        klines: state.klines,
        kp: state.kp,
        positions: state.positions,
        orders: state.orders,
        stopLossCount: state.stopLossCount
      }
    ])
  );

  ws.send(JSON.stringify({
    type: 'init',
    symbols: SYMBOLS,
    states: initialStates,
    account: { balance: accountBalance },
    params: strategyParams
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'updateParams') {
        strategyParams = { ...strategyParams, ...data.params };
        ws.send(JSON.stringify({ type: 'paramsUpdated', params: strategyParams }));
      } else if (data.type === 'reset') {
        if (!usePythonBridge) accountBalance = 100000;
        SYMBOLS.forEach(sym => {
          const state = symbolStates[sym];
          state.positions = [];
          state.orders = [];
          state.stopLossCount = 0;
          state.kp = state.currentPrice;
          syncPositionToPython(sym);
        });
        broadcastAccount();
      }
    } catch (e) {
      console.error('Failed to parse message', e);
    }
  });
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', time: globalTime.toISOString(), usingPythonBridge: usePythonBridge });
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
