import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge, Toggle } from './Primitives';
import { MotionPanel } from './Animated';
import { Film, Scan, Heart, Lock } from 'lucide-react';
import schemaData from '../../lib/uiSchema.json';

type ControlType = 'toggle' | 'select' | 'number' | 'text';
type Control = {
  id: string;
  label: string;
  type: ControlType;
  description?: string;
  default: boolean | string | number;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  locked?: boolean;
  placeholder?: string;
};
type Category = {
  id: string;
  label: string;
  description: string;
  icon: string;
  controls: Control[];
};
type Schema = { categories: Category[] };

const ICON_COMPONENTS: Record<string, typeof Film> = {
  Film,
  Scan,
  Heart,
};

export type ControlValues = Record<string, boolean | string | number>;

export function DynamicController({
  values,
  onChange,
}: {
  values: ControlValues;
  onChange: (id: string, value: boolean | string | number) => void;
}) {
  const schema = schemaData as Schema;
  const [activeCategory, setActiveCategory] = useState<string>(schema.categories[0]?.id ?? '');

  const handleToggle = useCallback((id: string) => {
    const current = values[id] ?? false;
    onChange(id, !current);
  }, [values, onChange]);

  const handleChange = useCallback((id: string, value: boolean | string | number) => {
    onChange(id, value);
  }, [onChange]);

  const category = schema.categories.find((c) => c.id === activeCategory) ?? schema.categories[0];
  const Icon = ICON_COMPONENTS[category?.icon ?? 'Film'] ?? Film;

  const connectedCount = useMemo(() => {
    return schema.categories.reduce((acc, cat) => acc + cat.controls.length, 0);
  }, [schema]);

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gradient mb-1">Schema Matrix Controller</h2>
          <p className="text-sm text-ink-300">Data-driven control surface. All credentials handled server-side.</p>
        </div>
        <Badge variant="accent">{connectedCount} controls active</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {schema.categories.map((cat) => {
          const CatIcon = ICON_COMPONENTS[cat.icon] ?? Film;
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
                active
                  ? 'bg-accent-dim text-accent border border-accent/30'
                  : 'bg-white/[0.03] text-ink-300 border border-white/[0.06] hover:text-ink-100'
              }`}
            >
              <CatIcon size={14} />
              {cat.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <MotionPanel className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center shrink-0">
              <Icon size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-50">{category?.label}</h3>
              <p className="text-xs text-ink-400">{category?.description}</p>
            </div>
          </MotionPanel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {category?.controls.map((control) => (
              <ControlRenderer
                key={control.id}
                control={control}
                value={values[control.id] ?? control.default}
                onToggle={handleToggle}
                onChange={handleChange}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ControlRenderer({
  control,
  value,
  onToggle,
  onChange,
}: {
  control: Control;
  value: boolean | string | number;
  onToggle: (id: string) => void;
  onChange: (id: string, value: boolean | string | number) => void;
}) {
  const isLocked = control.locked;

  if (control.type === 'toggle') {
    return (
      <MotionPanel className={`p-4 ${isLocked ? 'border-accent/20' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-ink-100">{control.label}</p>
              {isLocked && <Lock size={11} className="text-accent" />}
            </div>
            {control.description && (
              <p className="text-[10px] text-ink-400">{control.description}</p>
            )}
          </div>
          <Toggle
            checked={Boolean(value)}
            onChange={() => onToggle(control.id)}
          />
        </div>
      </MotionPanel>
    );
  }

  if (control.type === 'select') {
    return (
      <MotionPanel className="p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-ink-200">{control.label}</label>
            {isLocked && <Lock size={10} className="text-accent" />}
          </div>
          <select
            value={String(value)}
            onChange={(e) => onChange(control.id, e.target.value)}
            className="input-field text-sm"
          >
            {control.options?.map((opt) => (
              <option key={opt} value={opt} className="bg-ink-900">{opt}</option>
            ))}
          </select>
        </div>
      </MotionPanel>
    );
  }

  if (control.type === 'number') {
    return (
      <MotionPanel className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-ink-200">{control.label}</label>
              {isLocked && <Lock size={10} className="text-accent" />}
            </div>
            <span className="text-[10px] font-mono text-ink-400">
              {value}{control.unit ? ` ${control.unit}` : ''}
            </span>
          </div>
          <input
            type="number"
            value={Number(value)}
            min={control.min}
            max={control.max}
            step={control.step}
            onChange={(e) => onChange(control.id, parseFloat(e.target.value) || 0)}
            className="input-field text-sm"
          />
        </div>
      </MotionPanel>
    );
  }

  if (control.type === 'text') {
    return (
      <MotionPanel className="p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-ink-200">{control.label}</label>
            {isLocked && <Lock size={10} className="text-accent" />}
          </div>
          <input
            type="text"
            value={String(value)}
            placeholder={control.placeholder}
            onChange={(e) => onChange(control.id, e.target.value)}
            className="input-field text-sm"
          />
        </div>
      </MotionPanel>
    );
  }

  return null;
}
