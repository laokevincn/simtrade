import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface OrderBookProps {
  symbol: string;
  tick: any;
  kp: number;
}

export default function OrderBook({ symbol, tick, kp }: OrderBookProps) {
  if (!tick) return <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 animate-pulse h-full"></div>;

  const diff = tick.price - kp;
  const pct = kp > 0 ? (diff / kp) * 100 : 0;
  const isUp = diff >= 0;

  return (
    <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 flex flex-col justify-between h-full">
      <div>
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">{symbol || '加载中...'}</h2>
        <div className="flex items-baseline space-x-3">
          <span className={`text-4xl font-bold font-mono ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {tick.price.toFixed(2)}
          </span>
          <div className={`flex items-center text-sm font-medium ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isUp ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
            {Math.abs(diff).toFixed(2)} ({Math.abs(pct).toFixed(2)}%)
          </div>
        </div>
      </div>
      
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-800/50 p-3 rounded-lg">
          <div className="text-gray-500 mb-1">开盘基准价 (kp)</div>
          <div className="font-mono text-gray-200 text-lg">{kp.toFixed(2)}</div>
        </div>
        <div className="bg-gray-800/50 p-3 rounded-lg">
          <div className="text-gray-500 mb-1">时间</div>
          <div className="font-mono text-gray-200 text-lg">{new Date(tick.time).toLocaleTimeString()}</div>
        </div>
      </div>
    </div>
  );
}
