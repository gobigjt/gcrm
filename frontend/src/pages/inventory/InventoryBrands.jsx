import { useEffect, useState } from 'react';
import api from '../../api/client';
import Table from '../../components/Table';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../utils/apiErrorMessage';
import { promptDestructive } from '../../utils/promptDestructive';

export default function InventoryBrandsPage() {
  const { show } = useToast();
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const load = () => {
    api.get('/inventory/brands').then((r) => setItems(r.data.brands || r.data || [])).catch(() => setItems([]));
  };
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/inventory/brands', { name: name.trim() });
      setName('');
      load();
      show('Brand added successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not add brand'), 'error');
    }
  };

  const saveEdit = async (id) => {
    if (!editingName.trim()) return;
    try {
      await api.patch(`/inventory/brands/${id}`, { name: editingName.trim() });
      setEditingId(null);
      setEditingName('');
      load();
      show('Brand updated successfully', 'success');
    } catch (err) {
      show(apiErrorMessage(err, 'Could not update brand'), 'error');
    }
  };

  const remove = (id) => {
    promptDestructive(show, {
      message: 'Delete this brand?',
      onConfirm: async () => {
        try {
          await api.delete(`/inventory/brands/${id}`);
          load();
          show('Brand deleted successfully', 'success');
        } catch (err) {
          show(apiErrorMessage(err, 'Could not delete brand'), 'error');
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">Brands</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Brand master CRUD</p>
      </div>
      <form onSubmit={add} className="flex gap-2 max-w-lg">
        <input className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="New brand name" />
        <button className="btn-wf-primary" type="submit">Add</button>
      </form>
      <Table
        cols={['Name', 'Actions']}
        rows={items.map((b) => [
          editingId === b.id ? (
            <input
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
            />
          ) : b.name,
          editingId === b.id ? (
            <div className="flex gap-2">
              <button type="button" className="text-brand-600 hover:underline" onClick={() => saveEdit(b.id)}>Save</button>
              <button type="button" className="text-slate-500 hover:underline" onClick={() => { setEditingId(null); setEditingName(''); }}>Cancel</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" className="text-brand-600 hover:underline" onClick={() => { setEditingId(b.id); setEditingName(b.name || ''); }}>Edit</button>
              <button type="button" className="text-red-600 hover:underline" onClick={() => remove(b.id)}>Delete</button>
            </div>
          ),
        ])}
      />
    </div>
  );
}

