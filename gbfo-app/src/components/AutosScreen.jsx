import React, { useEffect, useState, useMemo } from "react";
import {
  Car, Search, SlidersHorizontal, ChevronDown, ChevronRight, Plus,
  ShieldCheck, ClipboardCheck, FileText, Info, LogOut,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import AutoForm from "./AutoForm";

const colorClasses = {
  violet: { bg: "bg-violet-100", fg: "text-violet-600" },
  blue: { bg: "bg-blue-100", fg: "text-blue-600" },
  orange: { bg: "bg-orange-100", fg: "text-orange-500" },
  teal: { bg: "bg-teal-100", fg: "text-teal-600" },
  pink: { bg: "bg-pink-100", fg: "text-pink-600" },
  emerald: { bg: "bg-emerald-100", fg: "text-emerald-600" },
};

function estadoPillClasses(estado) {
  if (estado === "Al día" || estado === "Pagado") return { bg: "bg-emerald-100", text: "text-emerald-700" };
  if (estado === "Por vencer") return { bg: "bg-amber-100", text: "text-amber-700" };
  return { bg: "bg-red-100", text: "text-red-700" };
}

function formatCLP(valor) {
  if (valor === null || valor === undefined || valor === "") return "-";
  return "$" + Number(valor).toLocaleString("es-CL");
}

function formatFecha(fecha) {
  if (!fecha) return "-";
  const d = new Date(fecha + "T00:00:00");
  const texto = d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  return texto.replace(".", "");
}

function AutoStatItem({ icon: Icon, label, estado, vence, valor }) {
  const p = estadoPillClasses(estado);
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-5 h-5 text-slate-300 shrink-0" strokeWidth={1.8} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-slate-900 text-base leading-tight">{label}</p>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.bg} ${p.text}`}>{estado}</span>
        </div>
        <p className="text-sm text-slate-500 mt-1">Vence: {formatFecha(vence)}</p>
      </div>
      <p className="text-sm font-bold text-slate-900 shrink-0">{formatCLP(valor)}</p>
    </div>
  );
}

function AutoRow({ auto, onEdit }) {
  const c = colorClasses[auto.color_tag] || colorClasses.violet;
  return (
    <button
      onClick={() => onEdit(auto)}
      className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4 flex flex-col gap-3 text-left active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
          <Car className={`w-6 h-6 ${c.fg}`} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-base leading-tight">{auto.patente}</p>
          <p className="text-xs text-slate-500 mt-0.5">{auto.tipo}</p>
          <p className="text-xs text-slate-500">{auto.marca} {auto.modelo} · Año {auto.anio}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
      </div>
      <div className="flex flex-col gap-3.5 border-t border-slate-100 pt-3.5">
        <AutoStatItem icon={ShieldCheck} label="Seguro" estado={auto.seguro_estado} vence={auto.seguro_vence} valor={auto.seguro_valor} />
        <AutoStatItem icon={ClipboardCheck} label="Revisión técnica" estado={auto.revision_estado} vence={auto.revision_vence} valor={auto.revision_valor} />
        <AutoStatItem icon={FileText} label="Patente" estado={auto.permiso_estado} vence={auto.permiso_vence} valor={auto.permiso_valor} />
      </div>
    </button>
  );
}

export default function AutosScreen({ session }) {
  const [autos, setAutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingAuto, setEditingAuto] = useState(null);

  const fetchAutos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("autos").select("*").order("patente");
    if (!error) setAutos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAutos();
  }, []);

  const autosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return autos;
    return autos.filter(
      (a) =>
        a.patente.toLowerCase().includes(q) ||
        a.marca.toLowerCase().includes(q) ||
        a.modelo.toLowerCase().includes(q)
    );
  }, [autos, search]);

  const handleSaved = () => {
    setShowForm(false);
    setEditingAuto(null);
    fetchAutos();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center">
      <div className="w-full max-w-sm bg-slate-50 min-h-screen flex flex-col">
        <div className="px-5 pt-6 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Autos</h1>
            <p className="text-xs text-slate-400">{session.user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditingAuto(null); setShowForm(true); }}
              className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center"
              aria-label="Agregar auto"
            >
              <Plus className="w-5 h-5 text-white" strokeWidth={2.4} />
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 text-slate-500" strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <div className="px-5 flex items-center gap-2 pb-4">
          <div className="flex-1 bg-white border border-slate-100 shadow-sm rounded-xl px-3 py-2.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" strokeWidth={2} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar auto por patente, marca..."
              className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none flex-1"
            />
          </div>
          <button className="bg-white border border-slate-100 shadow-sm rounded-xl px-3 py-2.5 flex items-center gap-1.5 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" strokeWidth={2} />
            <span className="text-sm font-semibold text-slate-600">Filtrar</span>
            <ChevronDown className="w-4 h-4 text-slate-400" strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 flex flex-col gap-3 pb-6">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900 text-base">Mis autos</p>
            <p className="text-sm text-slate-500">{autosFiltrados.length} autos</p>
          </div>

          {loading && <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>}

          {!loading && autosFiltrados.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No hay autos que coincidan con tu búsqueda.</p>
            </div>
          )}

          {autosFiltrados.map((auto) => (
            <AutoRow key={auto.id} auto={auto} onEdit={(a) => { setEditingAuto(a); setShowForm(true); }} />
          ))}

          <div className="bg-white rounded-2xl border border-slate-100 px-4 py-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" strokeWidth={1.8} />
            <div>
              <p className="font-bold text-slate-900 text-sm">Mantén tus autos al día</p>
              <p className="text-sm text-slate-500 mt-0.5">Toca un auto para editar sus datos, o usa el botón + para agregar uno nuevo.</p>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <AutoForm
          auto={editingAuto}
          onClose={() => { setShowForm(false); setEditingAuto(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
