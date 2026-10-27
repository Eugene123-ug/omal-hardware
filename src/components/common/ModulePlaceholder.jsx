import React from 'react';
import { Layers, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';

export default function ModulePlaceholder({
  moduleName,
  description,
  phase = 'Phase 2',
  requiredRoles = ['super_admin', 'admin'],
  foundationalEntities = []
}) {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                Foundational Architecture Active
              </span>
              <span className="text-xs text-slate-400">• Scheduled: {phase}</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">{moduleName}</h2>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {description || 'This module has its foundational database schema, Knex PostgreSQL migrations, input validation schemas, and REST endpoints established in Phase 1.'}
        </p>

        {/* Established Foundational Entities */}
        {foundationalEntities.length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Phase 1 Database Entities & Migrations Verified
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {foundationalEntities.map((entity, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{entity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Role Permissions Guard Notice */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Authorized Roles: <strong>{requiredRoles.join(', ')}</strong></span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Status: Ready for Workflow Expansion</span>
        </div>
      </div>
    </div>
  );
}
