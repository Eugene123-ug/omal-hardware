import React, { useState, useEffect } from 'react';
import { X, Shield, Plus, Check } from 'lucide-react';
import { api } from '../../../services/api';

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateRoleModal: React.FC<CreateRoleModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissionGroups, setPermissionGroups] = useState<Record<string, any[]>>({});
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getPermissions().then((res) => {
        if (res.data) setPermissionGroups(res.data);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const togglePermission = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllInModule = (modulePerms: any[]) => {
    const allSelected = modulePerms.every((p) => selectedKeys.has(p.key));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      modulePerms.forEach((p) => {
        if (allSelected) next.delete(p.key);
        else next.add(p.key);
      });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a role title.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.createRole({
        name: name.trim(),
        description: description.trim() || undefined,
        permissionKeys: Array.from(selectedKeys),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.message || 'Failed to create role');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating role');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 md:left-64 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Create Custom Role</h3>
              <p className="text-[11px] text-slate-500">Define custom job title and select granular permissions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Role Title *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tile Sales Specialist / Floor Supervisor"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Role Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational responsibilities and scope"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900">Granular Permissions ({selectedKeys.size} selected)</span>
              <span className="text-[11px] text-slate-400">Click to toggle permissions</span>
            </div>

            <div className="space-y-4">
              {Object.entries(permissionGroups).map(([moduleName, perms]) => (
                <div key={moduleName} className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50/50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                      Module: {moduleName}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleAllInModule(perms)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Toggle All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {perms.map((p) => {
                      const isChecked = selectedKeys.has(p.key);
                      return (
                        <label
                          key={p.key}
                          className={`flex items-start gap-2.5 p-2 rounded-xl border transition cursor-pointer select-none ${
                            isChecked
                              ? 'bg-purple-50/80 border-purple-200 text-purple-950 font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(p.key)}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 mt-0.5 shrink-0"
                          />
                          <div>
                            <div className="text-xs leading-tight font-mono">{p.key}</div>
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">{p.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isLoading ? 'Saving...' : 'Save Custom Role'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
