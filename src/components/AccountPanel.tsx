import React from 'react';
import { Activity, DollarSign, Layers, AlertTriangle } from 'lucide-react';

interface AccountPanelProps {
  balance: number;
  state: any;
}

export default function AccountPanel({ balance, state }: AccountPanelProps) {
  if (!state) return <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 animate-pulse h-64"></div>;

  const { positions, orders, stopLossCount } = state;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-800/20">
        <h2 className="text-lg font-semibold text-gray-100 flex items-center">
          <DollarSign className="w-5 h-5 mr-2 text-indigo-400" />
          账户总览
        </h2>
        <div className="text-2xl font-mono font-bold text-white">
          ¥{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-gray-800">
        <div className="p-5 bg-gray-900 flex flex-col justify-center">
          <div className="text-gray-500 text-sm mb-1 flex items-center">
            <Layers className="w-4 h-4 mr-1.5" /> 当前持仓
          </div>
          <div className="text-xl font-semibold text-gray-200">{positions?.length || 0}</div>
        </div>
        <div className="p-5 bg-gray-900 flex flex-col justify-center">
          <div className="text-gray-500 text-sm mb-1 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-1.5" /> 今日止损次数
          </div>
          <div className="text-xl font-semibold text-gray-200">{stopLossCount || 0}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">最近订单</h3>
        <div className="space-y-3">
          {orders?.slice().reverse().slice(0, 5).map((order: any, i: number) => (
            <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-gray-800/50 border border-gray-800/50">
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${order.type === 'OPEN' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {order.type === 'OPEN' ? '开仓' : '平仓'}
                  </span>
                  <span className={`text-sm font-bold ${order.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {order.direction === 'LONG' ? '多' : '空'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{order.reason}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-gray-200">{order.price.toFixed(2)}</div>
                {order.pnl !== undefined && (
                  <div className={`text-xs font-mono mt-0.5 ${order.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {order.pnl >= 0 ? '+' : ''}{order.pnl.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {(!orders || orders.length === 0) && (
            <div className="text-center text-gray-600 py-6 text-sm">暂无订单</div>
          )}
        </div>
      </div>
    </div>
  );
}
