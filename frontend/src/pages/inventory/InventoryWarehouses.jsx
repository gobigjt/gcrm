import { useEffect, useState } from 'react';
import api from '../../api/client';
import Table from '../../components/Table';

export default function InventoryWarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    api.get('/inventory/warehouses')
      .then((r) => setWarehouses(r.data.warehouses || r.data || []))
      .catch(() => setWarehouses([]));
  }, []);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Warehouses</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Storage locations</p>
      </div>
      <Table cols={['Name','Location','Active']} rows={warehouses.map((w) => [w.name, w.location, w.is_active ? '✓' : '—'])} />
    </div>
  );
}

