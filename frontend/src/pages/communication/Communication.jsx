import { useEffect, useState } from 'react';
import api from '../../api/client';
import Table from '../../components/Table';
import Tabs  from '../../components/Tabs';
import Modal from '../../components/Modal';
import { Field, inputCls, selectCls, FormActions } from '../../components/FormField';

const EMPTY = { name:'', channel:'email', subject:'', body:'' };

const channelBadge = c => {
  const cls = { email:'bg-blue-100 text-blue-700', whatsapp:'bg-emerald-100 text-emerald-700', sms:'bg-amber-100 text-amber-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[c]||'bg-slate-100 text-slate-600'}`}>{c}</span>;
};

const statusBadge = s => {
  const cls = { sent:'bg-emerald-100 text-emerald-700', failed:'bg-red-100 text-red-600', pending:'bg-amber-100 text-amber-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s]||'bg-slate-100 text-slate-600'}`}>{s}</span>;
};

export default function Communication() {
  const [tab, setTab] = useState('Templates');
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const load = () => {
    api.get('/communication/templates').then(r => setTemplates(r.data.templates||r.data||[])).catch(()=>{});
    api.get('/communication/logs').then(r => setLogs(r.data.logs||r.data||[])).catch(()=>{});
  };
  useEffect(() => { load(); }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await api.post('/communication/templates', form); setModal(false); setForm(EMPTY); load(); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Communication</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Templates and delivery logs</p>
        </div>
        {tab === 'Templates' && (
          <button
            onClick={() => setModal(true)}
            className="btn-wf-primary"
          >
            + New Template
          </button>
        )}
      </div>

      <Tabs tabs={['Templates','Logs']} active={tab} onChange={setTab} />

      {tab === 'Templates' && (
        <Table
          cols={['ID','Name','Channel','Subject']}
          rows={templates.map(t => [t.id, t.name, channelBadge(t.channel), t.subject||'—'])}
          empty="No templates"
        />
      )}

      {tab === 'Logs' && (
        <Table
          cols={['Date','Channel','Recipient','Subject','Status','Sent By']}
          rows={logs.map(l => [
            l.sent_at?.slice(0,10),
            channelBadge(l.channel),
            l.recipient,
            l.subject||'—',
            statusBadge(l.status),
            l.sent_by_name||'—',
          ])}
          empty="No communication logs"
        />
      )}

      {modal && (
        <Modal title="New Template" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit}>
            <Field label="Name *"><input className={inputCls} value={form.name} onChange={set('name')} required /></Field>
            <Field label="Channel">
              <select className={selectCls} value={form.channel} onChange={set('channel')}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </Field>
            <Field label="Subject"><input className={inputCls} value={form.subject} onChange={set('subject')} /></Field>
            <Field label="Body *">
              <textarea className={inputCls} rows={4} value={form.body} onChange={set('body')} required />
            </Field>
            <FormActions onCancel={() => setModal(false)} loading={loading} />
          </form>
        </Modal>
      )}
    </div>
  );
}
