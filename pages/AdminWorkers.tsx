import React, { useState, useEffect, useRef } from 'react';
import { User, WorkSchedule, RoleConfig } from '../types';
import { API } from '../services/api';
import { uploadFileToCloudinary } from '../services/cloudinary';
import { EditUserModal } from '../components/EditUserModal';
import { Plus, Edit2, Loader, Calendar, Shield } from 'lucide-react';

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
      setFormData({ 
          ...user,
          status: user.status || 'active'
      });
      setPhotoPreview(user.avatar || null);
    } else {
      setEditingUser(null);
      setFormData({
        role: 'worker',
        allowManualLogin: false,
        skills: [],
        status: 'active'
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
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl flex items-center hover:bg-slate-800 transition-all shadow-lg active:scale-95 font-bold"
        >
          <Plus size={20} className="mr-2" strokeWidth={3} />
          Додати працівника
        </button>
      </div>

      {/* List */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {workers.map(worker => {
          const schedule = schedules.find(s => s.id === worker.workScheduleId);
          const roleName = availableRoles.find(r => r.id === worker.role)?.name || 
                           (worker.role === 'admin' ? 'Адміністратор' : worker.role === 'worker' ? 'Працівник' : worker.role);
          const isDismissed = worker.status === 'dismissed';

          return (
            <div key={worker.id} className={`bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col hover:shadow-xl hover:border-blue-100 transition-all group ${isDismissed ? 'opacity-60 grayscale bg-gray-50' : ''}`}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center">
                  <div className="relative">
                    <img 
                      src={worker.avatar || `https://ui-avatars.com/api/?name=${worker.firstName}+${worker.lastName}`} 
                      alt={worker.firstName} 
                      className="w-14 h-14 rounded-2xl object-cover border-4 border-white shadow-md"
                    />
                    {isDismissed && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">!</div>}
                  </div>
                  <div className="ml-4">
                    <h3 className="font-black text-gray-900 tracking-tight">{worker.firstName} {worker.lastName}</h3>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{worker.position || 'Без посади'}</span>
                        <div className="flex items-center mt-1.5 gap-1.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter ${worker.role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                {roleName}
                            </span>
                            {isDismissed && (
                                <span className="text-[10px] px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter bg-gray-100 text-gray-500 border border-gray-200">
                                    Архів
                                </span>
                            )}
                        </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => handleOpenModal(worker)} className="p-2 bg-gray-50 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100">
                  <Edit2 size={18} />
                </button>
              </div>
              
              <div className="space-y-3 text-sm text-gray-600 flex-1 bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Логін</span>
                  <span className="font-black text-gray-900 text-xs bg-white px-2 py-1 rounded-lg border border-gray-100">{worker.login}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Телефон</span>
                  <span className="text-gray-900 font-bold text-xs">{worker.phone || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Ставка</span>
                  <span className="font-black text-green-600 text-sm">{worker.monthlyRate?.toLocaleString()} ₴</span>
                </div>
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-100">
                   <span className="flex items-center text-[10px] text-gray-400 uppercase font-black tracking-widest"><Calendar size={12} className="mr-1.5 text-blue-400"/> Графік</span>
                   <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${schedule ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                     {schedule ? schedule.name : 'Вручну'}
                   </span>
                </div>
              </div>

              {worker.skills && worker.skills.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {worker.skills.map(skill => (
                    <span key={skill} className="px-2 py-0.5 bg-white border border-gray-100 text-gray-400 font-bold text-[9px] uppercase tracking-tighter rounded-lg">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <EditUserModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editingUser={editingUser}
        formData={formData}
        setFormData={setFormData}
        availableRoles={availableRoles}
        schedules={schedules}
        photoPreview={photoPreview}
        isUploadingPhoto={isUploadingPhoto}
        onFileChange={handleFileChange}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
      />
    </div>
  );
};
