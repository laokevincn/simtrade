import React, { useState, useEffect } from 'react';
import { Settings2, Save, RefreshCw } from 'lucide-react';

interface StrategyControlProps {
  params: any;
  onUpdate: (params: any) => void;
  onReset: () => void;
}

export default function StrategyControl({ params, onUpdate, onReset }: StrategyControlProps) {
  const [localParams, setLocalParams] = useState(params);

  useEffect(() => {
    setLocalParams(params);
  }, [params]);

  if (!localParams) return <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 animate-pulse h-64"></div>;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalParams({ ...localParams, [name]: parseFloat(value) || value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(localParams);
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-800/20">
        <h2 className="text-lg font-semibold text-gray-100 flex items-center">
          <Settings2 className="w-5 h-5 mr-2 text-indigo-400" />
          策略参数设置
        </h2>
        <button
          onClick={onReset}
          className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800"
          title="重置账户与策略状态"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">开仓阈值 (pl)</label>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                name="pl"
                value={localParams.pl}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">止损阈值 (sl)</label>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                name="sl"
                value={localParams.sl}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">加仓阈值 (ap)</label>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                name="ap"
                value={localParams.ap}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">每日最大止损次数</label>
            <div className="relative">
              <input
                type="number"
                name="maxStopLosses"
                value={localParams.maxStopLosses}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-800">
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-indigo-900/20"
          >
            <Save className="w-4 h-4" />
            <span>应用更改</span>
          </button>
        </div>
      </form>
    </div>
  );
}
