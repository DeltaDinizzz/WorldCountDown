import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Play, Pause, RotateCcw, Download, Upload, Settings, TrendingUp, Wheat, Baby, Sprout, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// =====================
// Utils
// =====================
function formatNumber(value: number, opts: { abbreviate?: boolean; decimals?: number; locale?: string } = {}) {
  const { abbreviate = true, decimals = 0, locale = "pt-BR" } = opts;
  if (!abbreviate) {
    return value.toLocaleString(locale, { maximumFractionDigits: decimals });
  }
  const abs = Math.abs(value);
  const units = ["", "K", "M", "B", "T"] as const;
  let idx = 0;
  let v = value;
  while (Math.abs(v) >= 1000 && idx < units.length - 1) {
    v /= 1000;
    idx++;
  }
  return `${v.toLocaleString(locale, { maximumFractionDigits: decimals })}${units[idx]}`;
}

function nowMs() { return performance.now(); }

function useAnimationClock({ running }: { running: boolean }) {
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const loop = () => {
      setTick((t) => t + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    if (running) rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running]);
  return tick; // value not used; just forces rerenders
}

// =====================
// Types
// =====================
interface CounterSpec {
  id: string;
  label: string;
  icon?: string; // emoji name fallback
  unit?: string; // sufixo, ex: "t", "kg", "mi"
  ratePerSecond: number; // incremento por segundo
  baseValue: number; // valor base no startTime
  decimals?: number;
  color?: string; // tailwind class
}

interface PersistedState {
  counters: CounterSpec[];
  startEpochMs: number; // epoch em ms da última redefinição
  running: boolean;
  abbreviate: boolean;
}

const DEFAULTS: PersistedState = {
  startEpochMs: Date.now(),
  running: true,
  abbreviate: true,
  counters: [
    { id: "milho", label: "Milho Produzido", icon: "🌽", unit: "t", ratePerSecond: 5.2, baseValue: 0, decimals: 0, color: "from-amber-400 to-yellow-500" },
    { id: "soja", label: "Soja Produzida", icon: "🫘", unit: "t", ratePerSecond: 4.1, baseValue: 0, decimals: 0, color: "from-lime-400 to-emerald-500" },
    { id: "nascimentos", label: "Crianças Nascidas", icon: "👶", unit: "", ratePerSecond: 0.2, baseValue: 0, decimals: 0, color: "from-pink-400 to-fuchsia-500" },
    { id: "co2", label: "Emissões CO₂", icon: "🏭", unit: "t", ratePerSecond: 12.5, baseValue: 0, decimals: 0, color: "from-slate-400 to-zinc-500" },
  ],
};

const ICON_MAP: Record<string, React.ReactNode> = {
  "🌽": <Wheat className="w-5 h-5" />, // not exact, but a nice icon
  "🫘": <Sprout className="w-5 h-5" />,
  "👶": <Baby className="w-5 h-5" />,
  "🏭": <Factory className="w-5 h-5" />,
};

// =====================
// Main Component
// =====================
export default function DashboardRealtimeCounters() {
  const [state, setState] = useState<PersistedState>(() => {
    const raw = localStorage.getItem("realtime-counters-v1");
    if (raw) {
      try { return JSON.parse(raw) as PersistedState; } catch {}
    }
    return DEFAULTS;
  });

  const [openAdd, setOpenAdd] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // persist
  useEffect(() => {
    localStorage.setItem("realtime-counters-v1", JSON.stringify(state));
  }, [state]);

  // render clock
  useAnimationClock({ running: state.running });

  const elapsedSec = useMemo(() => (Date.now() - state.startEpochMs) / 1000, [state.startEpochMs, state.running]);

  function valueOf(c: CounterSpec) {
    return c.baseValue + c.ratePerSecond * elapsedSec;
  }

  function resetAll() {
    setState((s) => ({ ...s, startEpochMs: Date.now(), counters: s.counters.map(c => ({ ...c, baseValue: 0 })) }));
  }

  function toggleRun() {
    setState((s) => ({ ...s, running: !s.running }));
  }

  function removeCounter(id: string) {
    setState((s) => ({ ...s, counters: s.counters.filter(c => c.id !== id) }));
  }

  function updateCounter(id: string, patch: Partial<CounterSpec>) {
    setState((s) => ({ ...s, counters: s.counters.map(c => c.id === id ? { ...c, ...patch } : c) }));
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contadores-${new Date().toISOString()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function importJSON(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        // validação mínima
        if (!data || !Array.isArray(data.counters)) throw new Error("Arquivo inválido");
        setState(data);
        setImportOpen(false);
      } catch (e) {
        alert("Falha ao importar JSON: " + (e as Error).message);
      }
    };
    reader.readAsText(file);
  }

  const since = new Date(state.startEpochMs).toLocaleString("pt-BR");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Painel de Contadores em Tempo Real</h1>
            <p className="text-sm text-slate-400">Atualizando desde <span className="font-semibold text-slate-200">{since}</span>.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant={state.running ? "secondary" : "default"} onClick={toggleRun} className="gap-2">
              {state.running ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
              {state.running ? "Pausar" : "Iniciar"}
            </Button>
            <Button variant="secondary" onClick={resetAll} className="gap-2">
              <RotateCcw className="w-4 h-4"/> Resetar
            </Button>
            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4"/> Novo contador</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Adicionar contador</DialogTitle>
                </DialogHeader>
                <AddCounterForm onSubmit={(c) => { setState((s)=> ({...s, counters: [...s.counters, c]})); setOpenAdd(false); }} />
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={exportJSON} className="gap-2"><Download className="w-4 h-4"/> Exportar</Button>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Upload className="w-4 h-4"/> Importar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar configuração</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Input type="file" accept="application/json" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) importJSON(f); }} />
                  <p className="text-xs text-slate-400">Selecione um arquivo JSON exportado deste painel.</p>
                </div>
              </DialogContent>
            </Dialog>
            <div className="flex items-center gap-2 rounded-xl border border-slate-700/60 px-3 py-1.5">
              <Settings className="w-4 h-4 text-slate-400"/>
              <Label htmlFor="abbr" className="text-xs">Abreviar números</Label>
              <Switch id="abbr" checked={state.abbreviate} onCheckedChange={(v)=> setState((s)=> ({...s, abbreviate: v}))} />
            </div>
          </div>
        </header>

        {/* Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {state.counters.map((c) => (
            <CounterCard
              key={c.id}
              c={c}
              value={valueOf(c)}
              abbreviate={state.abbreviate}
              onRemove={()=>removeCounter(c.id)}
              onUpdate={(patch)=>updateCounter(c.id, patch)}
            />
          ))}
        </section>

        {/* Footer */}
        <footer className="pt-6 text-xs text-slate-500 flex items-center gap-2">
          <TrendingUp className="w-4 h-4"/>
          Valores simulados: cada contador usa uma taxa (por segundo) configurável. Você pode importar dados reais no futuro conectando uma API.
        </footer>
      </div>
    </div>
  );
}

// =====================
// Counter Card
// =====================
function CounterCard({ c, value, abbreviate, onRemove, onUpdate }: {
  c: CounterSpec; value: number; abbreviate: boolean; onRemove: () => void; onUpdate: (patch: Partial<CounterSpec>) => void;
}) {
  const pretty = formatNumber(value, { abbreviate, decimals: c.decimals ?? 0 });
  const rate = c.ratePerSecond;

  return (
    <Card className="relative overflow-hidden border-slate-800/60 bg-slate-900/50">
      <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${c.color || "from-sky-500/30 to-blue-500/30"}`} />
      <CardHeader className="relative z-10 pb-2">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
              {ICON_MAP[c.icon || ""] || <span className="text-xl">{c.icon || "📈"}</span>}
            </div>
            <span className="truncate">{c.label}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={onRemove} title="Remover"><span className="text-lg">✖</span></Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-3">
          <div className="text-3xl font-extrabold tracking-tight">
            {pretty} {c.unit}
          </div>
          <div className="text-xs text-slate-400">Taxa: {formatNumber(rate, { abbreviate: false, decimals: 3 })} /s ({formatNumber(rate*60, {abbreviate:false, decimals:2})}/min, {formatNumber(rate*3600, {abbreviate:false, decimals:2})}/h)</div>
          <InlineEditor c={c} onUpdate={onUpdate} />
        </motion.div>
      </CardContent>
    </Card>
  );
}

function InlineEditor({ c, onUpdate }: { c: CounterSpec; onUpdate: (patch: Partial<CounterSpec>) => void }) {
  const [label, setLabel] = useState(c.label);
  const [unit, setUnit] = useState(c.unit || "");
  const [rate, setRate] = useState(c.ratePerSecond.toString());
  const [decimals, setDecimals] = useState(String(c.decimals ?? 0));
  const [timeUnit, setTimeUnit] = useState("s");

  // convert displayed rate to per second when timeUnit changes or on save
  function toPerSecond(num: number, unit: string) {
    switch(unit){
      case "s": return num;
      case "min": return num / 60;
      case "h": return num / 3600;
      case "dia": return num / 86400;
      default: return num;
    }
  }

  function save() {
    const r = parseFloat(rate.replace(",","."));
    if (isNaN(r)) return alert("Informe uma taxa válida");
    onUpdate({ label, unit, ratePerSecond: toPerSecond(r, timeUnit), decimals: parseInt(decimals || "0") || 0 });
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-12">
        <Label className="text-[10px] uppercase tracking-wide text-slate-400">Editar</Label>
      </div>
      <div className="col-span-6">
        <Label className="text-xs">Título</Label>
        <Input value={label} onChange={(e)=>setLabel(e.target.value)} />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Unidade</Label>
        <Input value={unit} onChange={(e)=>setUnit(e.target.value)} placeholder="t, kg, mi…" />
      </div>
      <div className="col-span-3">
        <Label className="text-xs">Taxa</Label>
        <Input value={rate} onChange={(e)=>setRate(e.target.value)} placeholder="ex: 1.5" />
      </div>
      <div className="col-span-1">
        <Label className="text-xs">Dec.</Label>
        <Input value={decimals} onChange={(e)=>setDecimals(e.target.value)} />
      </div>
      <div className="col-span-4">
        <Label className="text-xs">Tempo</Label>
        <Select value={timeUnit} onValueChange={setTimeUnit}>
          <SelectTrigger className="w-full"><SelectValue placeholder="/s"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="s">por segundo</SelectItem>
            <SelectItem value="min">por minuto</SelectItem>
            <SelectItem value="h">por hora</SelectItem>
            <SelectItem value="dia">por dia</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-8 flex gap-2">
        <Button size="sm" variant="secondary" onClick={save} className="w-full">Salvar</Button>
      </div>
    </div>
  );
}

// =====================
// Add Counter Form
// =====================
function AddCounterForm({ onSubmit }: { onSubmit: (c: CounterSpec) => void }) {
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [icon, setIcon] = useState("📈");
  const [rate, setRate] = useState("1");
  const [timeUnit, setTimeUnit] = useState("s");
  const [decimals, setDecimals] = useState("0");
  const [color, setColor] = useState("from-sky-500 to-blue-600");

  function toPerSecond(num: number, unit: string) {
    switch(unit){
      case "s": return num;
      case "min": return num / 60;
      case "h": return num / 3600;
      case "dia": return num / 86400;
      default: return num;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const r = parseFloat(rate.replace(",","."));
    if (!label.trim()) return alert("Dê um nome ao contador");
    if (isNaN(r)) return alert("Informe uma taxa válida");
    const c: CounterSpec = {
      id: `${label.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2,7)}`,
      label: label.trim(),
      unit: unit.trim(),
      icon,
      color,
      ratePerSecond: toPerSecond(r, timeUnit),
      baseValue: 0,
      decimals: parseInt(decimals || "0") || 0,
    };
    onSubmit(c);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-8">
          <Label>Título</Label>
          <Input value={label} onChange={(e)=>setLabel(e.target.value)} placeholder="Ex.: Arroz colhido"/>
        </div>
        <div className="col-span-4">
          <Label>Unidade</Label>
          <Input value={unit} onChange={(e)=>setUnit(e.target.value)} placeholder="t, kg, mi…"/>
        </div>
        <div className="col-span-6">
          <Label>Ícone (emoji)</Label>
          <Input value={icon} onChange={(e)=>setIcon(e.target.value)} placeholder="🌾, 🧑‍🎓, 🚗…"/>
        </div>
        <div className="col-span-6">
          <Label>Cor (gradiente)</Label>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Cor"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="from-amber-400 to-yellow-500">Amarelo</SelectItem>
              <SelectItem value="from-lime-400 to-emerald-500">Verde</SelectItem>
              <SelectItem value="from-pink-400 to-fuchsia-500">Rosa</SelectItem>
              <SelectItem value="from-sky-500 to-blue-600">Azul</SelectItem>
              <SelectItem value="from-slate-400 to-zinc-500">Cinza</SelectItem>
              <SelectItem value="from-purple-400 to-indigo-600">Roxo</SelectItem>
              <SelectItem value="from-orange-400 to-red-500">Laranja</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-5">
          <Label>Taxa</Label>
          <Input value={rate} onChange={(e)=>setRate(e.target.value)} placeholder="1.5"/>
        </div>
        <div className="col-span-3">
          <Label>Tempo</Label>
          <Select value={timeUnit} onValueChange={setTimeUnit}>
            <SelectTrigger className="w-full"><SelectValue placeholder="/s"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="s">por segundo</SelectItem>
              <SelectItem value="min">por minuto</SelectItem>
              <SelectItem value="h">por hora</SelectItem>
              <SelectItem value="dia">por dia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-4">
          <Label>Decimais</Label>
          <Input value={decimals} onChange={(e)=>setDecimals(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit">Adicionar</Button>
      </div>
    </form>
  );
}
