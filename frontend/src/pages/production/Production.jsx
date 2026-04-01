import { useEffect, useState } from 'react';
import api from '../../api/client';
import Table from '../../components/Table';
import Tabs  from '../../components/Tabs';

const statusBadge = (s) => {
  const cls = { planned:'bg-slate-100 text-slate-600', in_progress:'bg-amber-100 text-amber-700', completed:'bg-emerald-100 text-emerald-700', cancelled:'bg-red-100 text-red-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s]||'bg-slate-100 text-slate-600'}`}>{s}</span>;
};

export default function Production() {
  const [tab, setTab] = useState('Work Orders');
  const [workOrders, setWorkOrders] = useState([]);
  const [boms,       setBoms]       = useState([]);

  useEffect(() => {
    api.get('/production/work-orders').then(r => setWorkOrders(r.data.work_orders||r.data||[]));
    api.get('/production/boms').then(r => setBoms(r.data.boms||r.data||[]));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Production</h2>
        <p className="text-slate-500 text-sm">Bill of Materials · Work Orders</p>
      </div>

      <Tabs tabs={['Work Orders','BOM']} active={tab} onChange={setTab} />

      {tab === 'Work Orders' && (
        <Table
          cols={['WO Number','Product','Quantity','Status','Planned Start','Planned End']}
          rows={workOrders.map(w => [w.wo_number, w.product_name, w.quantity, statusBadge(w.status), w.planned_start||'—', w.planned_end||'—'])}
          empty="No work orders"
        />
      )}

      {tab === 'BOM' && (
        <Table
          cols={['Name','Product','Version','Active']}
          rows={boms.map(b => [b.name, b.product_name, b.version, b.is_active ? '✓' : '—'])}
          empty="No BOMs"
        />
      )}
    </div>
  );
}
