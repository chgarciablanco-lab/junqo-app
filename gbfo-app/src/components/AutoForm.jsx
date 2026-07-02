import React, { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const coloresDisponibles = ["violet", "blue", "orange", "teal", "pink", "emerald"];
const estados = ["Al día", "Por vencer", "Vencido", "Pagado"];

function emptyForm(auto) {
  return {
    patente: auto?.patente || "",
    tipo: auto?.tipo || "",
    marca: auto?.marca || "",
    modelo: auto?.modelo || "",
    anio: auto?.anio || "",
    color_tag: auto?.color_tag || "violet",
    seguro_estado: auto?.seguro_estado || "Al día",
    seguro_vence: auto?.seguro_vence || "",
    seguro_valor: auto?.seguro_valor || "",
    revision_estado: auto?.revision_estado || "Al día",
    revision_vence: auto?.revision_vence || "",
    revision_valor: auto?.revision_valor || "",
    permiso_estado: auto?.permiso_estado || "Al día",
    permiso_vence: auto?.permiso_vence || "",
    permiso_valor: auto?.permiso_valor || "",
  };
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-400";

function SeccionTramite({ titulo, prefix, form, setForm }) {
  return (
    <div className="border border-slate-100 rounded-xl p-3 flex flex-col gap-2.5">
      <p className="text-sm font-bold text-slate-900">{titulo}</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Estado">
          <select
            className={inputClass}
            value={form[`${prefix}_estado`]}
            onChange={(e) => setForm({ ...form, [`${prefix}_estado`]: e.target.value })}
          >
            {estados.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </Field>
        <Field label="Vence">
          <input
            type="date"
            className={inputClass}
            value={form[`${prefix}_vence`] || ""}
            onChange={(e) => setForm({ ...form, [`${prefix}_vence`]: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Valor ($)">
        <input
          type="number"
          className={inputClass}
          value={form[`${prefix}_valor`] || ""}
          onChange={(e) => setForm({ ...form, [`${prefix}_valor`]: e.target.value })}
          placeholder="0"
        />
      </Field>
    </div>
  );
}

export default function AutoForm({ auto, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm(auto));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditing = Boolean(auto);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      anio: parseInt(form.anio, 10),
      seguro_valor: form.seguro_valor ? parseFloat(form.seguro_valor) : null,
      revision_valor: form.revision_valor ? parseFloat(form.revision_valor) : null,
      permiso_valor: form.permiso_valor ? parseFloat(form.permiso_valor) : null,
      seguro_vence: form.seguro_vence || null,
      revision_vence: form.revision_vence || null,
      permiso_vence: form.permiso_vence || null,
      updated_at: new Date().toISOString(),
    };

    const query = isEditing
      ? supabase.from("autos").update(payload).eq("id", auto.id)
      : supabase.from("autos").insert(payload);

    const { error } = await query;
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el auto ${auto.patente}? Esta acción no se puede deshacer.`)) return;
    setSaving(true);
    const { error } = await supabase.from("autos").delete().eq("id", auto.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {isEditing ? "Editar auto" : "Nuevo auto"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Patente">
              <input
                required
                className={inputClass}
                value={form.patente}
                onChange={(e) => setForm({ ...form, patente: e.target.value.toUpperCase() })}
                placeholder="ABC D12"
              />
            </Field>
            <Field label="Tipo">
              <input
                required
                className={inputClass}
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                placeholder="SUV, Sedán..."
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Marca">
              <input
                required
                className={inputClass}
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
              />
            </Field>
            <Field label="Modelo">
              <input
                required
                className={inputClass}
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Año">
              <input
                required
                type="number"
                className={inputClass}
                value={form.anio}
                onChange={(e) => setForm({ ...form, anio: e.target.value })}
              />
            </Field>
            <Field label="Color de tarjeta">
              <select
                className={inputClass}
                value={form.color_tag}
                onChange={(e) => setForm({ ...form, color_tag: e.target.value })}
              >
                {coloresDisponibles.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>

          <SeccionTramite titulo="Seguro" prefix="seguro" form={form} setForm={setForm} />
          <SeccionTramite titulo="Revisión técnica" prefix="revision" form={form} setForm={setForm} />
          <SeccionTramite titulo="Patente / Permiso de circulación" prefix="permiso" form={form} setForm={setForm} />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex flex-col gap-2 mt-1">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-violet-600 text-white font-semibold text-sm rounded-xl py-3 disabled:opacity-60"
            >
              {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Agregar auto"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="w-full text-red-500 font-semibold text-sm rounded-xl py-2.5 border border-red-200"
              >
                Eliminar auto
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
