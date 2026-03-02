import React, { useEffect, useState } from 'react';
import Chart from './components/Chart';
import OrderBook from './components/OrderBook';
import AccountPanel from './components/AccountPanel';
import StrategyControl from './components/StrategyControl';
import { Activity } from 'lucide-react';

export default function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [activeSymbol, setActiveSymbol] = useState<string>('');
  
  const [marketData, setMarketData] = useState<Record<string, { tick: any; kline: any }>>({});
  const [klines, setKlines] = useState<Record<string, any[]>>({});
  const [symbolStates, setSymbolStates] = useState<Record<string, any>>({});
  
  const [balance, setBalance] = useState<number>(0);
  const [params, setParams] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'init') {
        setSymbols(data.symbols);
        if (data.symbols.length > 0) setActiveSymbol(data.symbols[0]);
        
        const initialKlines: Record<string, any[]> = {};
        const initialStates: Record<string, any> = {};
        
        data.symbols.forEach((sym: string) => {
          initialKlines[sym] = data.states[sym].klines;
          initialStates[sym] = {
            name: data.states[sym].name,
            kp: data.states[sym].kp,
            positions: data.states[sym].positions,
            orders: data.states[sym].orders,
            stopLossCount: data.states[sym].stopLossCount
          };
        });
        
        setKlines(initialKlines);
        setSymbolStates(initialStates);
        setBalance(data.account.balance);
        setParams(data.params);
      } else if (data.type === 'market') {
        const sym = data.symbol;
        setMarketData(prev => ({
          ...prev,
          [sym]: { tick: data.tick, kline: data.kline }
        }));
        setSymbolStates(prev => {
          if (prev[sym] && data.name && prev[sym].name !== data.name) {
             return {
               ...prev,
               [sym]: { ...prev[sym], name: data.name }
             };
          }
          return prev;
        });
      } else if (data.type === 'account') {
        setBalance(data.balance);
        setSymbolStates(prev => {
          const newStates = { ...prev };
          Object.keys(data.symbols).forEach(sym => {
            newStates[sym] = {
              ...newStates[sym],
              name: data.symbols[sym].name || newStates[sym]?.name,
              positions: data.symbols[sym].positions,
              orders: data.symbols[sym].orders,
              stopLossCount: data.symbols[sym].stopLossCount,
              kp: data.symbols[sym].kp
            };
          });
          return newStates;
        });
      } else if (data.type === 'paramsUpdated') {
        setParams(data.params);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  const handleUpdateParams = (newParams: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'updateParams', params: newParams }));
    }
  };

  const handleReset = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'reset' }));
    }
  };

  const activeMarketData = marketData[activeSymbol];
  const activeKlines = klines[activeSymbol] || [];
  const activeState = symbolStates[activeSymbol] || { kp: 0, positions: [], orders: [], stopLossCount: 0, name: activeSymbol };

  const getDisplayName = (sym: string) => {
    const state = symbolStates[sym];
    if (state && state.name) {
      return `${state.name} (${sym.split('@')[1] || sym})`;
    }
    return sym;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-indigo-500/30">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
              <Activity className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">
              量化模拟交易平台
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700/50">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]'}`}></div>
              <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                {isConnected ? '已连接' : '未连接'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Symbol Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-gray-800 pb-px">
          {symbols.map(sym => (
            <button
              key={sym}
              onClick={() => setActiveSymbol(sym)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSymbol === sym 
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' 
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              {getDisplayName(sym)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Market Data & Chart */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="h-40">
                <OrderBook symbol={getDisplayName(activeSymbol)} tick={activeMarketData?.tick} kp={activeState.kp} />
              </div>
              <div className="h-40">
                <AccountPanel balance={balance} state={activeState} />
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-1">
              <Chart data={activeKlines} currentKline={activeMarketData?.kline} />
            </div>
          </div>

          {/* Right Column: Strategy Control & Logs */}
          <div className="space-y-6">
            <div className="h-[420px]">
              <StrategyControl params={params} onUpdate={handleUpdateParams} onReset={handleReset} />
            </div>
            
            {/* Recent Orders Log */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 flex flex-col h-[300px]">
              <div className="p-4 border-b border-gray-800 bg-gray-800/30">
                <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">最近订单记录 ({getDisplayName(activeSymbol)})</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeState.orders?.length === 0 ? (
                  <div className="text-gray-600 text-sm italic text-center py-4">暂无订单记录</div>
                ) : (
                  activeState.orders?.slice().reverse().map((order: any, i: number) => (
                    <div key={i} className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          order.type === 'OPEN' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {order.type === 'OPEN' ? '开仓' : '平仓'} {order.direction === 'LONG' ? '多' : '空'}
                        </span>
                        <span className="text-gray-500 font-mono text-[10px]">
                          {new Date(order.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="text-gray-300 font-mono">
                          {order.volume} 手 @ {order.price.toFixed(2)}
                        </div>
                        {order.pnl !== undefined && (
                          <div className={`font-mono font-medium ${order.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {order.pnl >= 0 ? '+' : ''}{order.pnl.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div className="text-gray-500 text-[10px] mt-1 uppercase tracking-wider">{order.reason}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
