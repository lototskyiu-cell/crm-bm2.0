import React, { useRef } from 'react';
import { User, RoleConfig, WorkSchedule } from '../types';
import { X, Camera, Loader, Shield, Lock, Calendar, Save } from 'lucide-react';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingUser: User | null;
  formData: Partial<User>;
  setFormData: (data: Partial<User>) => void;
  availableRoles: RoleConfig[];
  schedules: WorkSchedule[];
  photoPreview: string | null;
  isUploadingPhoto: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showPassword?: boolean;
  setShowPassword?: (show: boolean) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingUser,
  formData,
  setFormData,
  availableRoles,
  schedules,
  photoPreview,
  isUploadingPhoto,
  onFileChange,
  showPassword,
  setShowPassword
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const roleName = availableRoles.find(r => r.id === formData.role)?.name || 
                   (formData.role === 'admin' ? 'Адміністратор' : 'Працівник');

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center overflow-y-auto py-4 px-4 transition-all duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl relative w-full max-w-md mx-auto my-auto overflow-hidden animate-scaleIn">
        {/* Кнопка закриття */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-gray-100 dark:bg-slate-700 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all active:scale-90"
        >
          <X size={20} />
        </button>

        {/* Заголовок */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/20">
          <h2 className="text-xl font-black text-gray-800 dark:text-white pr-8">
            {editingUser ? 'Редагувати профіль' : 'Новий працівник'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-bold">
            {editingUser ? `ID: ${editingUser.id}` : 'Створення нового аккаунту'}
          </p>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Фото профілю */}
          <div className="flex flex-col items-center justify-center pb-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={onFileChange} 
              className="hidden" 
              accept="image/*"
            />
            <div 
              onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400 border-4 border-white dark:border-slate-800 shadow-xl relative overflow-hidden group cursor-pointer hover:border-blue-400 transition-all"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center">
                  <Camera size={24} />
                  <span className="text-[8px] uppercase font-black mt-1 tracking-tighter">Фото</span>
                </div>
              )}
              
              {isUploadingPhoto ? (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader className="animate-spin text-white" size={20}/>
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-[10px] font-black uppercase">Змінити</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Статус */}
            <div className="bg-gray-50 dark:bg-slate-900/30 p-3 rounded-2xl border border-gray-100 dark:border-slate-700">
              <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Статус аккаунту</label>
              <select
                value={formData.status || 'active'}
                onChange={e => setFormData({...formData, status: e.target.value as 'active' | 'dismissed'})}
                className={`w-full p-2.5 rounded-xl border-2 font-bold text-sm outline-none transition-all ${formData.status === 'active' ? 'bg-green-50/50 border-green-100 text-green-700' : 'bg-red-50/50 border-red-100 text-red-700'}`}
              >
                <option value="active">🟢 Працює (Активний)</option>
                <option value="dismissed">🔴 Звільнено (Архів)</option>
              </select>
            </div>

            {/* Основні дані */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Ім'я</label>
                <input 
                  className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all" 
                  value={formData.firstName || ''}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                  placeholder="Іван"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Прізвище</label>
                <input 
                  className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all" 
                  value={formData.lastName || ''}
                  onChange={e => setFormData({...formData, lastName: e.target.value})}
                  placeholder="Петренко"
                />
              </div>
            </div>

            {/* День народження (Виправлення для мобілки) */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">День народження</label>
              <div className="relative">
                <input 
                  type="date"
                  className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all appearance-none" 
                  value={formData.dob || ''}
                  onChange={e => setFormData({...formData, dob: e.target.value})}
                />
                <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Телефон</label>
              <input 
                className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all font-mono" 
                value={formData.phone || ''}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="+380 (__) ___-__-__"
              />
            </div>

            {/* Безпека */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
              <h3 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center">
                <Lock size={12} className="mr-1.5" /> Безпека та доступ
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Логін</label>
                  <input 
                    className="w-full p-3 bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl font-black text-sm outline-none transition-all focus:border-blue-400 dark:focus:border-blue-600" 
                    value={formData.login || ''}
                    onChange={e => setFormData({...formData, login: e.target.value})}
                    placeholder="ivan_worker"
                  />
                </div>
                
                <div className="relative">
                  <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Пароль</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      className="w-full p-3 bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-xl font-bold text-sm outline-none transition-all focus:border-blue-400 dark:focus:border-blue-600 pr-12"
                      placeholder="••••••••"
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    {setShowPassword && (
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 px-4 flex items-center text-gray-400 hover:text-blue-600 focus:outline-none"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Професійні дані */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-700 space-y-4">
              <h3 className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em] mb-4 flex items-center">
                <Shield size={12} className="mr-1.5" /> Робочий профіль
              </h3>

              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Посада</label>
                <input 
                  className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all" 
                  placeholder="Старший оператор"
                  value={formData.position || ''}
                  onChange={e => setFormData({...formData, position: e.target.value})}
                />
              </div>

              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100/50 dark:border-blue-900/20 shadow-inner">
                <label className="block text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-2 ml-1">Профіль прав доступу</label>
                <select 
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-xl font-black text-sm outline-none transition-all focus:ring-4 focus:ring-blue-400/10"
                  value={formData.role || 'worker'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  {availableRoles.length > 0 ? (
                    availableRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                  ) : (
                    <>
                      <option value="worker">Працівник (Default)</option>
                      <option value="admin">Адмін</option>
                    </>
                  )}
                </select>
                <p className="text-[9px] text-blue-400 font-bold mt-2 text-center uppercase tracking-tighter">Впливає на видимість розділів системи</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Ставка (грн)</label>
                  <input 
                    type="number"
                    className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all" 
                    value={formData.monthlyRate || ''}
                    onChange={e => setFormData({...formData, monthlyRate: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Графік</label>
                  <select 
                    className="w-full p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl font-bold text-sm focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none transition-all"
                    value={formData.workScheduleId || ''}
                    onChange={e => setFormData({...formData, workScheduleId: e.target.value})}
                  >
                    <option value="">Ручний ввід</option>
                    {schedules.map(sch => (
                      <option key={sch.id} value={sch.id}>{sch.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <input 
                type="checkbox"
                id="manualLogin"
                checked={formData.allowManualLogin || false}
                onChange={e => setFormData({...formData, allowManualLogin: e.target.checked})}
                className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="manualLogin" className="ml-3 text-xs font-bold text-gray-600 dark:text-slate-400 cursor-pointer select-none">
                Дозволити вхід через логін/пароль
              </label>
            </div>
          </div>
        </div>

        {/* Дії */}
        <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 text-gray-500 dark:text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-95"
          >
            Скасувати
          </button>
          <button 
            onClick={onSave}
            disabled={isUploadingPhoto}
            className="flex-[2] bg-slate-900 dark:bg-blue-600 text-white py-3 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-slate-200 dark:shadow-none hover:bg-slate-800 dark:hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isUploadingPhoto ? <Loader className="animate-spin" size={16} /> : <Save size={16}/>}
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
};
