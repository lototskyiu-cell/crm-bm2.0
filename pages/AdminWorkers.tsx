
import React, { useState, useEffect, useRef } from 'react';
import { User, WorkSchedule, RoleConfig } from '../types';
import { API } from '../services/api';
import { uploadFileToCloudinary } from '../services/cloudinary';
import { Plus, Edit2, X, Camera, Calendar, Loader, Shield } from 'lucide-react';

export const AdminWorkers: React.FC = () => {
  const [workers, setWorkers] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<User>>({});
  const [showPassword, setShowPassword] = useState(false);
  
  // Photo Upload State
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersData, schedulesData, rolesData] = await Promise.all([
        API.getUsers(),
        API.getSchedules(),
        API.getPermissions()
      ]);
      setWorkers(usersData);
      setSchedules(schedulesData);
      setAvailableRoles(rolesData);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (user?: User) => {
    setShowPassword(false);
    setIsUploadingPhoto(false);
    
    if (user) {
      setEditingUser(user);
      setFormData({ ...user });
      setPhotoPreview(user.avatar || null);
    } else {
      setEditingUser(null);
      setFormData({
        role: 'worker',
        allowManualLogin: false,
        skills: []
      });
      setPhotoPreview(null);
    }
    setIsModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Show Local Preview immediately
    const localUrl = URL.createObjectURL(file);
    setPhotoPreview(localUrl);
    setIsUploadingPhoto(true);

    try {
        // 2. Upload to Cloudinary
        const uploadedUrl = await uploadFileToCloudinary(file);
        
        // 3. Update Form Data
        setFormData(prev => ({ ...prev, avatar: uploadedUrl }));
    } catch (error) {
        console.error("Upload failed", error);
        alert("Не вдалося завантажити фото. Перевірте з'єднання.");
        // Revert preview if upload fails
        setPhotoPreview(editingUser?.avatar || null);
    } finally {
        setIsUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (isUploadingPhoto) {
        alert("Будь ласка, зачекайте завершення завантаження фото.");
        return;
    }

    try {
      const newUser: User = {
        id: editingUser ? editingUser.id : `u_${Date.now()}`,
        ...formData
      } as User;
      
      await API.saveUser(newUser);
      await loadData(); // Reload list
      setIsModalOpen(false);
    } catch (error) {
      alert("Error saving user");
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader className="animate-spin text-blue-600"/></div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Працівники</h1>
          <p className="text-gray-500">Управління персоналом та доступами</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          Додати працівника
        </button>
      </div>

      {/* List */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {workers.map(worker => {
          const schedule = schedules.find(s => s.id === worker.workScheduleId);
          // Find friendly role name
          const roleName = availableRoles.find(r => r.id === worker.role)?.name || 
                           (worker.role === 'admin' ? 'Адміністратор' : worker.role === 'worker' ? 'Працівник' : worker.role);

          return (
            <div key={worker.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <img 
                    src={worker.avatar || `https://ui-avatars.com/api/?name=${worker.firstName}+${worker.lastName}`} 
                    alt={worker.firstName} 
                    className="w-12 h-12 rounded-full object-cover border border-gray-100"
                  />
                  <div className="ml-3">
                    <h3 className="font-bold text-gray-900">{worker.firstName} {worker.lastName}</h3>
                    <div className="flex flex-col">
                        <span className="text-sm text-gray-500">{worker.position || 'Без посади'}</span>
                        <div className="flex items-center mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${worker.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                {roleName}
                            </span>
                        </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => handleOpenModal(worker)} className="text-gray-400 hover:text-blue-600">
                  <Edit2 size={18} />
                </button>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600 flex-1">
                <div className="flex justify-between">
                  <span>Логін:</span>
                  <span className="font-mono text-gray-900">{worker.login}</span>
                </div>
                <div className="flex justify-between">
                  <span>Телефон:</span>
                  <span className="text-gray-900">{worker.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ставка:</span>
                  <span className="font-medium text-green-600">{worker.monthlyRate} ₴</span>
                </div>
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-50">
                   <span className="flex items-center text-xs text-gray-400 uppercase font-bold"><Calendar size={12} className="mr-1"/> Графік</span>
                   <span className={`text-xs px-2 py-0.5 rounded ${schedule ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                     {schedule ? schedule.name : 'Не призначено'}
                   </span>
                </div>
              </div>

              {worker.skills && worker.skills.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {worker.skills.map(skill => (
                    <span key={skill} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-gray-800">
                {editingUser ? 'Редагування профілю' : 'Новий працівник'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div className="flex justify-center mb-4">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                  <div 
                    onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}
                    className="w-28 h-28 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 relative overflow-hidden group cursor-pointer hover:border-blue-400 transition-colors"
                  >
                    {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex flex-col items-center">
                            <Camera size={28} />
                            <span className="text-[10px] uppercase font-bold mt-1">Фото</span>
                        </div>
                    )}
                    
                    {/* Overlays */}
                    {isUploadingPhoto ? (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader className="animate-spin text-white" size={24}/>
                        </div>
                    ) : (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs font-bold">Змінити</span>
                        </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Імʼя</label>
                  <input 
                    className="w-full mt-1 p-2 border rounded-md" 
                    value={formData.firstName || ''}
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Прізвище</label>
                  <input 
                    className="w-full mt-1 p-2 border rounded-md" 
                    value={formData.lastName || ''}
                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Дата народження</label>
                  <input 
                    type="date"
                    className="w-full mt-1 p-2 border rounded-md" 
                    value={formData.dob || ''}
                    onChange={e => setFormData({...formData, dob: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Телефон</label>
                  <input 
                    className="w-full mt-1 p-2 border rounded-md" 
                    value={formData.phone || ''}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Логін</label>
                  <input 
                    className="w-full mt-1 p-2 border rounded-md bg-gray-50" 
                    value={formData.login || ''}
                    onChange={e => setFormData({...formData, login: e.target.value})}
                    // Logic: Worker cannot change login, only Admin can. This is admin view, so allowed.
                  />
                </div>
                
                {/* PASSWORD FIELD WITH TOGGLE */}
                <div className="relative">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Пароль</label>
                    <div className="relative">
                        <input 
                            type={showPassword ? "text" : "password"}
                            className="w-full p-2 border rounded-md pr-10 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Введіть новий пароль"
                            value={formData.password || ''}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                        <button
                            type="button"
                            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-blue-600 focus:outline-none"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? "Приховати" : "Показати"}
                        >
                            {showPassword ? (
                                // Eye Slash (Hide)
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                </svg>
                            ) : (
                                // Eye (Show)
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
                
                <div className="pt-4 border-t border-gray-100 mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Посада (для відображення)</label>
                    <input 
                      className="w-full p-2 border rounded-md" 
                      placeholder="Напр. Старший зварювальник"
                      value={formData.position || ''}
                      onChange={e => setFormData({...formData, position: e.target.value})}
                    />
                  </div>

                  {/* Access Profile Dropdown */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <label className="block text-sm font-bold text-blue-800 mb-1 flex items-center">
                          <Shield size={14} className="mr-1"/> Профіль доступу (Права)
                      </label>
                      <select 
                          className="w-full p-2 border border-blue-200 rounded-md bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
                      <p className="text-[10px] text-gray-500 mt-1">Визначає, які розділи бачить користувач.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Місячна ставка (грн)</label>
                    <input 
                      type="number"
                      className="w-full mt-1 p-2 border rounded-md" 
                      value={formData.monthlyRate || ''}
                      onChange={e => setFormData({...formData, monthlyRate: Number(e.target.value)})}
                    />
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Графік роботи</label>
                    <select 
                      className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
                      value={formData.workScheduleId || ''}
                      onChange={e => setFormData({...formData, workScheduleId: e.target.value})}
                    >
                      <option value="">Не призначено (Вручну)</option>
                      {schedules.map(sch => (
                        <option key={sch.id} value={sch.id}>{sch.name}</option>
                      ))}
                    </select>
                    {schedules.length === 0 && (
                      <p className="text-[10px] text-red-500 mt-1">
                        Графіки ще не створені. Перейдіть у розділ "Графіки роботи".
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center">
                    <input 
                      type="checkbox"
                      checked={formData.allowManualLogin || false}
                      onChange={e => setFormData({...formData, allowManualLogin: e.target.checked})}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Дозволити ручний вхід</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end">
              <button 
                onClick={handleSave}
                disabled={isUploadingPhoto}
                className="bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center"
              >
                {isUploadingPhoto ? <Loader size={16} className="animate-spin mr-2" /> : null}
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
