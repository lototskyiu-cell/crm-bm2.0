
import React, { useState } from 'react';
import { User, Role } from '../types';
import { API } from '../services/api';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [role, setRole] = useState<Role>('worker');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState(''); 
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (role === 'admin') {
        // Admin Login: Check against Firestore settings/global
        const isAdminValid = await API.verifyAdmin(login, password);
        
        if (isAdminValid) {
          localStorage.setItem('isAdmin', 'true');
          // Create static admin user session
          const adminUser: User = {
            id: 'admin_global',
            firstName: 'System',
            lastName: 'Admin',
            login: login,
            role: 'admin',
            position: 'Administrator'
          };
          onLogin(adminUser);
        } else {
          setError('Невірний логін або пароль адміністратора');
        }
      } else {
        // Worker Login: Fetch user from Firestore 'users' collection
        // Now passing password and expecting it to throw if invalid
        const user = await API.login(login, password);

        if (user) {
          if (user.role === 'worker') {
            onLogin(user);
          } else {
             setError('Цей логін не має прав доступу як Працівник');
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      // Display the specific error message from API
      setError(err.message || 'Помилка авторизації');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">CRM BM 2.0</h1>
            <p className="text-slate-500">Система управління виробництвом</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Role Switcher */}
            <div className="bg-slate-100 p-1 rounded-xl flex">
              <button
                type="button"
                onClick={() => { setRole('worker'); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  role === 'worker' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Працівник
              </button>
              <button
                type="button"
                onClick={() => { setRole('admin'); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  role === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Адмін
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100 whitespace-pre-wrap">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {role === 'admin' ? 'Admin Логін' : 'ID Працівника'}
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder={role === 'admin' ? 'Введіть логін' : 'Введіть ваш ID'}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {role === 'admin' ? 'Admin Пароль' : 'Пароль'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 disabled:opacity-50 disabled:cursor-wait"
            >
              {isLoading ? 'Перевірка...' : 'Увійти'}
            </button>
          </form>
        </div>
        <div className="bg-slate-50 px-8 py-4 text-center">
          <p className="text-xs text-slate-400">Версія 2.0.2 (Auth: Firestore Direct)</p>
        </div>
      </div>
    </div>
  );
};
