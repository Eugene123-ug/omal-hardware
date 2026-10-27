import React, { useState } from 'react';
import { Calculator, X, Check, Box } from 'lucide-react';

export default function TileCalculatorModal({ product, onApply, onClose }) {
  const [calcMode, setCalcMode] = useState('dimensions'); // 'dimensions' or 'area'
  const [lengthMeters, setLengthMeters] = useState('');
  const [widthMeters, setWidthMeters] = useState('');
  const [totalAreaSqm, setTotalAreaSqm] = useState('');
  const [wastagePct, setWastagePct] = useState(10); // default 10% wastage

  const sqmPerBox = product.sqm_per_box || 1.44;

  // Calculate net area
  const rawArea = calcMode === 'dimensions'
    ? (parseFloat(lengthMeters) || 0) * (parseFloat(widthMeters) || 0)
    : (parseFloat(totalAreaSqm) || 0);

  // Area with wastage factor
  const areaWithWastage = rawArea * (1 + (wastagePct / 100));

  // Boxes needed (rounded up)
  const boxesNeeded = rawArea > 0 ? Math.ceil(areaWithWastage / sqmPerBox) : 0;
  const actualCoverage = (boxesNeeded * sqmPerBox).toFixed(2);
  const estimatedCost = (boxesNeeded * product.selling_price).toFixed(2);

  const handleApply = () => {
    if (boxesNeeded > 0) {
      onApply(boxesNeeded, parseFloat(actualCoverage));
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <Calculator className="w-5 h-5" />
            <h3 className="font-semibold text-white">Tile Square Meter Calculator</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          {/* Selected Tile Info */}
          <div className="bg-slate-800/40 border border-slate-700/60 p-3 rounded-xl">
            <div className="font-medium text-slate-200">{product.name}</div>
            <div className="text-xs text-amber-400/90 mt-1 flex items-center gap-2">
              <span>Coverage: <strong>{sqmPerBox} m² per box</strong></span>
              {product.pieces_per_box > 0 && <span>• {product.pieces_per_box} pcs/box</span>}
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setCalcMode('dimensions')}
              className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                calcMode === 'dimensions' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}>
              Room Dimensions (L x W)
            </button>
            <button
              onClick={() => setCalcMode('area')}
              className={`py-1.5 text-xs font-medium rounded-lg transition-colors ${
                calcMode === 'area' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}>
              Total Area (m²)
            </button>
          </div>

          {/* Inputs */}
          {calcMode === 'dimensions' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Length (Meters)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={lengthMeters}
                  onChange={(e) => setLengthMeters(e.target.value)}
                  placeholder="e.g. 5.5"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Width (Meters)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={widthMeters}
                  onChange={(e) => setWidthMeters(e.target.value)}
                  placeholder="e.g. 4.0"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Total Floor / Wall Area (m²)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={totalAreaSqm}
                onChange={(e) => setTotalAreaSqm(e.target.value)}
                placeholder="e.g. 35.0"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Wastage factor */}
          <div>
            <label className="text-xs text-slate-400 flex items-center justify-between mb-1">
              <span>Wastage & Cut Allowance</span>
              <span className="text-amber-400 font-semibold">{wastagePct}%</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[0, 5, 10, 15].map(pct => (
                <button
                  key={pct}
                  onClick={() => setWastagePct(pct)}
                  className={`py-1 text-xs rounded-lg border transition-colors ${
                    wastagePct === pct
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                      : 'border-slate-700 hover:border-slate-600 text-slate-400'
                  }`}>
                  {pct}% {pct === 10 ? '(Rec.)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Calculation Summary Box */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Net Room Area:</span>
              <span className="font-semibold text-white">{rawArea.toFixed(2)} m²</span>
            </div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Area + {wastagePct}% Wastage:</span>
              <span className="font-semibold text-amber-300">{areaWithWastage.toFixed(2)} m²</span>
            </div>
            <div className="border-t border-amber-500/20 pt-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <Box className="w-4 h-4" />
                <span>Boxes Required:</span>
              </div>
              <span className="text-2xl font-bold text-white">{boxesNeeded} <span className="text-sm font-normal text-slate-400">boxes</span></span>
            </div>
            <div className="flex justify-between text-xs text-slate-400 pt-1">
              <span>Actual Tile Coverage: {actualCoverage} m²</span>
              <span>Total: <strong className="text-emerald-400">GHS {estimatedCost}</strong></span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium">
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={boxesNeeded <= 0}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold flex items-center justify-center gap-2 transition-colors">
              <Check className="w-4 h-4" />
              <span>Apply {boxesNeeded} Boxes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
