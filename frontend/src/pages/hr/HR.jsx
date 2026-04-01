import { useEffect, useState } from 'react';
import api from '../../api/client';
import Table from '../../components/Table';
import Tabs  from '../../components/Tabs';
import Modal from '../../components/Modal';
import { Field, inputCls, selectCls, FormActions } from '../../components/FormField';

const EMPTY = { employee_code:'', department:'', designation:'', phone:'', basic_salary:'', date_of_joining:'' };
const payBadge = s => {
  const cls = { draft:'bg-slate-100 text-slate-600', processed:'bg-amber-100 text-amber-700', paid:'bg-emerald-100 text-emerald-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s]||'bg-slate-100 text-slate-600'}`}>{s}</span>;
};

export default function HR() {
  const [tab,       setTab]       = useState('Employees');
  const [employees, setEmployees] = useState([]);
  const [payroll,   setPayroll]   = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [modal, setModal] = useState(false);
  const [form,  setForm]  = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const loadEmp = () => api.get('/hr/employees').then(r => setEmployees(r.data.employees||r.data||[])).catch(()=>{});
  const loadPay = () => api.get('/hr/payroll', { params:{ month, year } }).then(r => setPayroll(r.data.payroll||r.data||[])).catch(()=>{});

  useEffect(() => { loadEmp(); }, []);
  useEffect(() => { if (tab === 'Payroll') loadPay(); }, [tab, month, year]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await api.post('/hr/employees', form); setModal(false); setForm(EMPTY); loadEmp(); }
    finally { setLoading(false); }
  };

  const months = Array.from({length:12}, (_, i) => ({ v: i+1, l: new Date(0,i).toLocaleString('default',{month:'long'}) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">HR & Payroll</h2>
          <p className="text-slate-500 text-sm">Employees · Attendance · Payroll</p>
        </div>
        {tab === 'Employees' && (
          <button onClick={() => setModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            + New Employee
          </button>
        )}
      </div>

      <Tabs tabs={['Employees','Payroll']} active={tab} onChange={setTab} />

      {tab === 'Employees' && (
        <Table
          cols={['Code','Name','Email','Department','Designation','Basic Salary']}
          rows={employees.map(e => [e.employee_code, e.user_name, e.email, e.department, e.designation, `₹${Number(e.basic_salary).toLocaleString('en-IN')}`])}
          empty="No employees"
        />
      )}

      {tab === 'Payroll' && (
        <div>
          <div className="flex gap-3 mb-4">
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <Table
            cols={['Code','Name','Basic','HRA','Gross','Deductions','Net','Status']}
            rows={payroll.map(p => [
              p.employee_code, p.employee_name,
              `₹${Number(p.basic).toLocaleString('en-IN')}`,
              `₹${Number(p.hra).toLocaleString('en-IN')}`,
              `₹${Number(p.gross).toLocaleString('en-IN')}`,
              `₹${Number(p.deductions).toLocaleString('en-IN')}`,
              `₹${Number(p.net).toLocaleString('en-IN')}`,
              payBadge(p.status),
            ])}
            empty="No payroll records for this period"
          />
        </div>
      )}

      {modal && (
        <Modal title="New Employee" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit}>
            <Field label="Employee Code *"><input className={inputCls} value={form.employee_code} onChange={set('employee_code')} required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Department"><input className={inputCls} value={form.department} onChange={set('department')} /></Field>
              <Field label="Designation"><input className={inputCls} value={form.designation} onChange={set('designation')} /></Field>
              <Field label="Phone"><input className={inputCls} value={form.phone} onChange={set('phone')} /></Field>
              <Field label="Basic Salary (₹)"><input className={inputCls} type="number" value={form.basic_salary} onChange={set('basic_salary')} /></Field>
            </div>
            <Field label="Date of Joining"><input className={inputCls} type="date" value={form.date_of_joining} onChange={set('date_of_joining')} /></Field>
            <FormActions onCancel={() => setModal(false)} loading={loading} />
          </form>
        </Modal>
      )}
    </div>
  );
}
