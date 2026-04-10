import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

function fmtDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700/50 px-3 py-2">
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{value || '—'}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(user || null);
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  useEffect(() => {
    api.get('/auth/me')
      .then((r) => setProfile(r.data || user || null))
      .catch(() => setProfile(user || null));
  }, [user]);

  const name = profile?.name || user?.name || 'User';
  const email = profile?.email || user?.email || '—';
  const role = profile?.role || user?.role || '—';

  const setPwdField = (k) => (e) => setPwd((p) => ({ ...p, [k]: e.target.value }));
  const submitPwd = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdErr('');
    if (!pwd.current_password || !pwd.new_password) {
      setPwdErr('Enter current and new password.');
      return;
    }
    if (pwd.new_password.length < 6) {
      setPwdErr('New password must be at least 6 characters.');
      return;
    }
    if (pwd.new_password !== pwd.confirm_password) {
      setPwdErr('Confirm password does not match.');
      return;
    }
    setPwdBusy(true);
    try {
      const r = await api.post('/auth/change-password', {
        current_password: pwd.current_password,
        new_password: pwd.new_password,
      });
      setPwd({ current_password: '', new_password: '', confirm_password: '' });
      setPwdMsg(r.data?.message || 'Password updated');
    } catch (err) {
      setPwdErr(err?.response?.data?.message || 'Failed to update password');
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-slate-800 dark:text-slate-100">My Profile</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Logged-in account details</p>
      </div>

      <div className="bg-white dark:bg-[#1a1d2e] rounded-2xl shadow-card border border-slate-200/80 dark:border-slate-700/50 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full bg-[#eeedfe] text-[#3c3489] flex items-center justify-center text-sm font-semibold">
            {String(name)[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="text-base font-semibold text-slate-800 dark:text-slate-100">{name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{email}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Info label="Full name" value={name} />
          <Info label="Email" value={email} />
          <Info label="Role" value={role} />
          <Info label="Active" value={profile?.is_active === false ? 'No' : 'Yes'} />
          <Info label="Created at" value={fmtDate(profile?.created_at)} />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Update Password</h3>
          {pwdMsg && <div className="text-xs text-emerald-600 dark:text-emerald-400">{pwdMsg}</div>}
          {pwdErr && <div className="text-xs text-red-600 dark:text-red-400">{pwdErr}</div>}
          <form onSubmit={submitPwd} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Current password</label>
              <input type="password" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" value={pwd.current_password} onChange={setPwdField('current_password')} />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">New password</label>
              <input type="password" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" value={pwd.new_password} onChange={setPwdField('new_password')} />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Confirm password</label>
              <input type="password" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" value={pwd.confirm_password} onChange={setPwdField('confirm_password')} />
            </div>
            <div className="md:col-span-3">
              <button type="submit" className="btn-wf-primary" disabled={pwdBusy}>
                {pwdBusy ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
          <Link to="/settings" className="btn-wf-secondary">
            Open Settings
          </Link>
        </div>
      </div>
    </div>
  );
}

