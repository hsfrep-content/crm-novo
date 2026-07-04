import { useState } from 'react';
import { api } from '../api';
import { NEIGHBORHOODS, STAGES } from '../lib';
import { Modal, Field, Input, Select, Button } from './ui';

export default function NewLeadModal({ open, onClose, onCreated, defaultStage = 'novo_lead' }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: '', phone: '', whatsapp: '', email: '', source: 'manual',
    interest_neighborhood: '', interest_type: '', tags: [],
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleTag = (tag) =>
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const lead = await api.leads.create({
        ...form,
        stage: defaultStage,
        email: form.email || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        interest_neighborhood: form.interest_neighborhood || null,
        interest_type: form.interest_type || null,
      });
      onCreated(lead);
      onClose();
      setForm({ name: '', phone: '', whatsapp: '', email: '', source: 'manual', interest_neighborhood: '', interest_type: '', tags: [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Novo lead — ${STAGES.find((s) => s.id === defaultStage)?.label}`}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nome *">
          <Input value={form.name} onChange={set('name')} required autoFocus placeholder="Nome do contato" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <Input value={form.phone} onChange={set('phone')} placeholder="(81) 9…" />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.whatsapp} onChange={set('whatsapp')} placeholder="(81) 9…" />
          </Field>
        </div>
        <Field label="E-mail">
          <Input type="email" value={form.email} onChange={set('email')} placeholder="email@exemplo.com" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Origem">
            <Select value={form.source} onChange={set('source')} className="w-full">
              <option value="manual">Manual</option>
              <option value="indicacao">Indicação</option>
              <option value="site">Site</option>
              <option value="canal-pro">Canal Pro</option>
            </Select>
          </Field>
          <Field label="Tipo de imóvel">
            <Select value={form.interest_type} onChange={set('interest_type')} className="w-full">
              <option value="">—</option>
              <option>Apartamento</option>
              <option>Casa</option>
              <option>Cobertura</option>
              <option>Flat</option>
              <option>Terreno</option>
            </Select>
          </Field>
        </div>
        <Field label="Bairros de interesse">
          <div className="flex flex-wrap gap-1.5">
            {NEIGHBORHOODS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleTag(n)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors ${
                  form.tags.includes(n)
                    ? 'bg-accent-600 text-white ring-accent-600'
                    : 'bg-white text-zinc-600 ring-zinc-200 hover:ring-accent-400 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>
        {error && <p className="text-sm text-signal-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Criar lead'}</Button>
        </div>
      </form>
    </Modal>
  );
}
