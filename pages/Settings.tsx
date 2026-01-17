
import React, { useState, useEffect, useRef } from 'react';
import { User, TransportMode, RoleConfig, ModulePermission } from '../types';
import { API } from '../services/api';
import { uploadFileToCloudinary } from '../services/cloudinary';
import { Save, Car, Bus, User as UserIcon, Lock, Loader, AlertTriangle, Trash2, RefreshCw, X, Box, ClipboardList, ShoppingCart, Folder, Wrench, Shield, Check, Plus, CornerDownRight, Smartphone, Monitor, LayoutTemplate, Camera, Image as ImageIcon } from 'lucide-react';

interface SettingsProps {
  currentUser: User;
}

type TrashTab = 'task' | 'order' | 'product' | 'cycle' | 'setupMap';

// ... (Existing MODULES constant logic remains same)
interface ModuleDef {
  key: string;
  label: string;
  isGroup?: boolean; // Main page entry
  parent?: string;   // ID of the parent module
}

const MODULES: ModuleDef[] = [
  // --- Main Pages ---
  { key: 'tasks', label: 'Дошка завдань', isGroup: true },
  { key: 'reports', label: 'Щоденні звіти', isGroup: true },
  { key: 'orders', label: 'Замовлення', isGroup: true },
  { key: 'repository', label: 'Сховище робіт', isGroup: true },

  // --- Products Page (Granular) ---
  { key: 'products', label: 'Вироби / Склад (Доступ до сторінки)', isGroup: true },
  { key: 'products_catalog', label: 'Вкладка: Каталог (Готові вироби)', parent: 'products' },
  { key: 'products_wip', label: 'Вкладка: WIP (Незавершене)', parent: 'products' },
  { key: 'products_warehouse', label: 'Вкладка: Склад виробів', parent: 'products' },
  { key: 'products_defects', label: 'Вкладка: Брак', parent: 'products' },
  { key: 'products_drawings', label: 'Розділ: Креслення', parent: 'products' },
  { key: 'products_maps', label: 'Розділ: Карти наладки', parent: 'products' },

  // --- Tools Page (Granular) ---
  { key: 'tools', label: 'Інструменти (Доступ до сторінки)', isGroup: true },
  { key: 'tools_catalog', label: 'Вкладка: Каталог', parent: 'tools' },
  { key: 'tools_warehouse', label: 'Вкладка: Склад', parent: 'tools' },
  { key: 'tools_production', label: 'Вкладка: Виробництво', parent: 'tools' },
  { key: 'tools_analytics', label: 'Вкладка: Аналітика', parent: 'tools' },

  // --- Admin / Other ---
  { key: 'workers', label: 'Працівники', isGroup: true },
  { key: 'schedules', label: 'Графіки роботи', isGroup: true },
  { key: 'analytics', label: 'Аналітика (HR)', isGroup: true },
  { key: 'settings', label: 'Налаштування', isGroup: true },
];

export const Settings: React.FC<SettingsProps> = ({ currentUser }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'access' | 'trash'>('profile');
  
  // View Mode
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile' | 'auto'>('auto');

  // Trash State
  const [activeTrashTab, setActiveTrashTab] = useState<TrashTab>('task');
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [isTrashLoading, setIsTrashLoading] = useState(false);
  
  // Access Rights State
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [activeAccessRole, setActiveAccessRole] = useState<string>('worker');
  const [isPermissionsSaving, setIsPermissionsSaving] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  // Local Form State
  const [password, setPassword] = useState('');
  const [defaults, setDefaults] = useState({
    transportMode: 'car' as TransportMode,
    fuelConsumption: 0,
    fuelPrice: 0,
    distanceTo: 0,
    distanceFrom: 0,
    busPriceTo: 0,
    busPriceFrom: 0,
  });

  // Photo Upload State
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadUser();
    const storedViewMode = localStorage.getItem('app_view_mode') as 'desktop' | 'mobile' | 'auto';
    if (storedViewMode) setViewMode(storedViewMode);
  }, [currentUser]);

  // Sync photo preview when user loads
  useEffect(() => {
      if (user) {
          setPhotoPreview(user.avatar || null);
      }
  }, [user]);

  // ... (Existing useEffects for Permissions and Trash)
  useEffect(() => {
      if (activeTab === 'access' && currentUser.role === 'admin') {
          loadPermissions();
      }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'trash') {
        loadTrashItems();
    }
  }, [activeTab, activeTrashTab]);

  const loadUser = async () => {
    setIsLoading(true);
    try {
      if (currentUser.role === 'admin') {
         const adminSettings = await API.getAdminSettings();
         if (adminSettings) {
           setUser({
             ...currentUser,
             login: adminSettings.adminLogin || currentUser.login,
           });
           setPassword(adminSettings.adminPassword || '');
         } else {
           setUser(currentUser);
           setPassword('');
         }
      } else {
         const freshUser = await API.getUser(currentUser.id);
         if (freshUser) {
            setUser(freshUser);
            setPassword(freshUser.password || '');
            if (freshUser.defaults) {
              setDefaults({ ...defaults, ...freshUser.defaults });
            }
         } else {
            setUser(currentUser);
         }
      }
    } catch (e) {
      console.error("Failed to load profile", e);
      setUser(currentUser);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;

      // Local Preview
      const localUrl = URL.createObjectURL(file);
      setPhotoPreview(localUrl);
      setIsPhotoUploading(true);

      try {
          // Upload
          const uploadedUrl = await uploadFileToCloudinary(file);
          
          // Immediate Save
          const updatedUser = { ...user, avatar: uploadedUrl };
          await API.saveUser(updatedUser);
          
          // Update Local State
          setUser(updatedUser);
          alert("Фото профілю оновлено!");
          
      } catch (error) {
          console.error("Photo upload failed", error);
          alert("Не вдалося завантажити фото");
          setPhotoPreview(user.avatar || null); // Revert
      } finally {
          setIsPhotoUploading(false);
      }
  };

  const loadPermissions = async () => {
      try {
          const loadedRoles = await API.getPermissions();
          if (loadedRoles.length === 0) {
              // Default fallback
              const defaultWorker: RoleConfig = {
                  id: 'worker',
                  name: 'Працівник',
                  permissions: { settings: { view: true, edit: true } }
              };
              setRoles([defaultWorker]);
          } else {
              setRoles(loadedRoles);
          }
      } catch (e) {
          console.error("Failed to load permissions", e);
      }
  };

  const loadTrashItems = async () => {
      setIsTrashLoading(true);
      try {
          const items = await API.getTrashItems(activeTrashTab);
          setTrashItems(items);
      } catch (e) {
          console.error("Failed to load trash items", e);
      } finally {
          setIsTrashLoading(false);
      }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      // Save View Mode
      localStorage.setItem('app_view_mode', viewMode);
      window.dispatchEvent(new Event('storage')); // Trigger update in App

      if (user.role === 'admin') {
         if (!user.login || !password) {
           alert("Логін та пароль адміністратора не можуть бути порожніми");
           return;
         }
         await API.saveAdminSettings(user.login, password);
         alert('Налаштування адміністратора успішно оновлено!');
      } else {
         const updatedUser: User = {
           ...user,
           password: password,
           defaults: {
             transportMode: defaults.transportMode,
             fuelConsumption: Number(defaults.fuelConsumption),
             fuelPrice: Number(defaults.fuelPrice),
             distanceTo: Number(defaults.distanceTo),
             distanceFrom: Number(defaults.distanceFrom),
             busPriceTo: Number(defaults.busPriceTo),
             busPriceFrom: Number(defaults.busPriceFrom),
           }
         };
         await API.saveUser(updatedUser);
         setUser(updatedUser);
         alert('Профіль працівника та налаштування збережено!');
      }
      
      // Force reload to apply layout changes if mode changed
      window.location.reload();
      
    } catch (e) {
      console.error(e);
      alert('Помилка збереження налаштувань');
    }
  };

  // ... (Existing handlers for Permissions and Trash)
  const handleSavePermissions = async () => {
      setIsPermissionsSaving(true);
      try {
          await API.savePermissions(roles);
          alert('Права доступу збережено!');
      } catch (e) {
          alert('Помилка збереження прав');
      } finally {
          setIsPermissionsSaving(false);
      }
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;
    const newId = `role_${Date.now()}`;
    const newRole: RoleConfig = { id: newId, name: newRoleName.trim(), permissions: {} };
    const updatedRoles = [...roles, newRole];
    setRoles(updatedRoles);
    setIsPermissionsSaving(true);
    try {
        await API.savePermissions(updatedRoles);
        setNewRoleName(""); 
        setActiveAccessRole(newId);
        alert(`Роль "${newRoleName}" створено!`);
    } catch (e) {
        alert("Помилка створення ролі");
    } finally {
        setIsPermissionsSaving(false);
    }
  };

  const togglePermission = (roleId: string, moduleKey: string, type: 'view' | 'edit') => {
      setRoles(prevRoles => prevRoles.map(role => {
          if (role.id !== roleId) return role;
          const currentPerms = role.permissions || {};
          const modulePerm = currentPerms[moduleKey] || { view: false, edit: false };
          return {
              ...role,
              permissions: {
                  ...currentPerms,
                  [moduleKey]: { ...modulePerm, [type]: !modulePerm[type] }
              }
          };
      }));
  };

  const handleRestore = async (type: TrashTab, id: string) => {
    if (confirm('Відновити цей елемент?')) {
        try { await API.restoreItem(type, id); loadTrashItems(); } catch (e) { alert('Не вдалося відновити елемент'); }
    }
  };

  const handlePermanentDelete = async (type: TrashTab, id: string) => {
    if (confirm('УВАГА: Це дію неможливо відмінити! Видалити назавжди?')) {
        try { await API.permanentlyDeleteItem(type, id); loadTrashItems(); } catch (e) { alert('Не вдалося видалити елемент'); }
    }
  };

  if (isLoading) return <div className="p-12 flex justify-center"><Loader className="animate-spin text-blue-600" size={32}/></div>;
  if (!user) return <div className="p-8 text-center text-red-500">Помилка: Користувача не знайдено</div>;

  const currentRoleConfig = roles.find(r => r.id === activeAccessRole);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <UserIcon className="mr-3 text-slate-700" /> Налаштування
          </h1>
          <div className="bg-gray-100 p-1 rounded-lg flex overflow-x-auto max-w-full">
             <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-white shadow text-slate-900' : 'text-gray-500'}`}>Профіль</button>
             {user.role === 'admin' && (
                 <>
                    <button onClick={() => setActiveTab('access')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center whitespace-nowrap ${activeTab === 'access' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}><Shield size={16} className="mr-2"/> Права</button>
                    <button onClick={() => setActiveTab('trash')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center whitespace-nowrap ${activeTab === 'trash' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}><Trash2 size={16} className="mr-2"/> Кошик</button>
                 </>
             )}
          </div>
      </div>

      {/* --- PROFILE TAB --- */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 gap-6 animate-fade-in">
            
            {/* --- PROFILE PHOTO SECTION --- */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-2 flex flex-col items-center">
                <h2 className="text-lg font-bold text-gray-800 mb-4 self-start w-full border-b border-gray-100 pb-2">Мій Профіль</h2>
                
                <div className="relative group cursor-pointer" onClick={() => !isPhotoUploading && fileInputRef.current?.click()}>
                    {/* Avatar Circle */}
                    <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-gray-50 shadow-inner bg-gray-100 relative">
                        {photoPreview ? (
                            <img src={photoPreview} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300 font-bold">
                                {user.firstName?.[0] || "U"}
                            </div>
                        )}
                    </div>

                    {/* Loading Spinner */}
                    {isPhotoUploading && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center z-20">
                            <Loader className="animate-spin text-white" size={24} />
                        </div>
                    )}

                    {/* Hover/Edit Overlay */}
                    {!isPhotoUploading && (
                        <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <Camera className="text-white" size={32} />
                        </div>
                    )}
                </div>
                
                <p className="text-xs text-gray-400 mt-3 font-medium">Натисніть на фото, щоб змінити</p>

                {/* Hidden Input */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handlePhotoUpload} 
                    hidden 
                    accept="image/*" 
                />
            </div>

            {/* VIEW MODE SETTINGS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center">
                    <LayoutTemplate size={18} className="text-gray-500 mr-2" />
                    <span className="font-bold text-gray-700">Інтерфейс</span>
                </div>
                <div className="p-6">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Режим відображення</label>
                    <div className="grid grid-cols-3 gap-3">
                        <button 
                            onClick={() => setViewMode('auto')}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${viewMode === 'auto' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}`}
                        >
                            <div className="flex gap-1 mb-2">
                                <Smartphone size={16}/>
                                <Monitor size={16}/>
                            </div>
                            <span className="text-sm font-bold">Авто</span>
                        </button>
                        <button 
                            onClick={() => setViewMode('desktop')}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${viewMode === 'desktop' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}`}
                        >
                            <Monitor size={20} className="mb-2"/>
                            <span className="text-sm font-bold">ПК (Desktop)</span>
                        </button>
                        <button 
                            onClick={() => setViewMode('mobile')}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${viewMode === 'mobile' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}`}
                        >
                            <Smartphone size={20} className="mb-2"/>
                            <span className="text-sm font-bold">Мобільний</span>
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 flex items-center">
                        <AlertTriangle size={12} className="mr-1"/>
                        Зміни застосуються після збереження та перезавантаження.
                    </p>
                </div>
            </div>

            {/* SECURITY */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center">
                    <Lock size={18} className="text-gray-500 mr-2" />
                    <span className="font-bold text-gray-700">Безпека та Вхід</span>
                    </div>
                    {user.role === 'admin' && (
                    <span className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded font-bold uppercase">Admin Access</span>
                    )}
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Логін для входу</label>
                        {user.role === 'admin' ? (
                        <input 
                            type="text" 
                            value={user.login}
                            onChange={e => setUser({...user, login: e.target.value})}
                            className="w-full p-3 border border-blue-200 bg-blue-50 rounded-lg text-blue-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        ) : (
                        <div className="p-3 bg-gray-100 rounded-lg text-gray-500 font-mono border border-gray-200 flex justify-between">
                            {user.login}
                            <Lock size={14} className="text-gray-400"/>
                        </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Пароль</label>
                        <input 
                        type="text" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-gray-800"
                        placeholder="Встановіть новий пароль"
                        />
                    </div>
                </div>
            </div>

            {/* DEFAULTS (WORKER ONLY) */}
            {user.role === 'worker' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center">
                    <Car size={18} className="text-gray-500 mr-2" />
                    <span className="font-bold text-gray-700">Дефолтні дані для звітів</span>
                    </div>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                    <button 
                        onClick={() => setDefaults({...defaults, transportMode: 'car'})}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center transition-all ${defaults.transportMode === 'car' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Car size={16} className="mr-2"/> Власне авто
                    </button>
                    <button 
                        onClick={() => setDefaults({...defaults, transportMode: 'bus'})}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center transition-all ${defaults.transportMode === 'bus' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Bus size={16} className="mr-2"/> Громадський транспорт
                    </button>
                    </div>

                    {defaults.transportMode === 'car' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Відстань до роботи (км)</label>
                            <input type="number" value={defaults.distanceTo} onChange={e => setDefaults({...defaults, distanceTo: Number(e.target.value)})} className="w-full p-3 border border-gray-200 rounded-lg font-bold text-gray-700 focus:border-blue-500 outline-none" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Відстань з роботи (км)</label>
                            <input type="number" value={defaults.distanceFrom} onChange={e => setDefaults({...defaults, distanceFrom: Number(e.target.value)})} className="w-full p-3 border border-gray-200 rounded-lg font-bold text-gray-700 focus:border-blue-500 outline-none" placeholder="0" />
                        </div>
                        </div>
                        <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Витрата пального (л/100км)</label>
                            <input type="number" value={defaults.fuelConsumption} onChange={e => setDefaults({...defaults, fuelConsumption: Number(e.target.value)})} className="w-full p-3 border border-gray-200 rounded-lg font-bold text-gray-700 focus:border-blue-500 outline-none" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ціна пального (грн/л)</label>
                            <input type="number" value={defaults.fuelPrice} onChange={e => setDefaults({...defaults, fuelPrice: Number(e.target.value)})} className="w-full p-3 border border-gray-200 rounded-lg font-bold text-gray-700 focus:border-blue-500 outline-none" placeholder="0" />
                        </div>
                        </div>
                    </div>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ціна квитка ТУДИ (грн)</label>
                            <input type="number" value={defaults.busPriceTo} onChange={e => setDefaults({...defaults, busPriceTo: Number(e.target.value)})} className="w-full p-3 border border-gray-200 rounded-lg font-bold text-gray-700 focus:border-blue-500 outline-none" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ціна квитка НАЗАД (грн)</label>
                            <input type="number" value={defaults.busPriceFrom} onChange={e => setDefaults({...defaults, busPriceFrom: Number(e.target.value)})} className="w-full p-3 border border-gray-200 rounded-lg font-bold text-gray-700 focus:border-blue-500 outline-none" placeholder="0" />
                        </div>
                    </div>
                    )}
                </div>
            </div>
            )}

            <div className="flex justify-end pt-2">
            <button 
                onClick={handleSave}
                className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center"
            >
                <Save size={20} className="mr-2" /> Зберегти зміни
            </button>
            </div>
        </div>
      )}

      {/* --- ACCESS RIGHTS TAB --- */}
      {activeTab === 'access' && (
          // ... (Same as before)
          <div className="space-y-6 animate-fade-in">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-grow w-full">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Створити новий профіль (Роль)</label>
                      <input type="text" className="border border-gray-300 p-2 rounded-lg w-full focus:ring-2 focus:ring-green-500 outline-none" placeholder="Назва ролі (напр. Комірник, ОТК)" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}/>
                  </div>
                  <button onClick={handleAddRole} disabled={!newRoleName.trim() || isPermissionsSaving} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 h-[42px] disabled:opacity-50 flex items-center justify-center shrink-0 w-full md:w-auto transition-colors shadow-sm"><Plus size={18} className="mr-1" /> Додати</button>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-4">
                          <label className="text-sm font-bold text-gray-700">Оберіть роль:</label>
                          <select value={activeAccessRole} onChange={(e) => setActiveAccessRole(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold min-w-[200px]">
                              <option value="worker">Працівник (Default)</option>
                              {roles.filter(r => r.id !== 'worker').map(r => (<option key={r.id} value={r.id}>{r.name}</option>))}
                          </select>
                      </div>
                      <button onClick={handleSavePermissions} disabled={isPermissionsSaving} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 flex items-center disabled:opacity-50 transition-colors shadow-lg">
                          {isPermissionsSaving ? <Loader size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>} Зберегти права
                      </button>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                              <tr>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Розділ / Вкладка</th>
                                  <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Доступ (View)</th>
                                  <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Редагування (Edit)</th>
                              </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                              {MODULES.map(module => {
                                  const rolePerms = currentRoleConfig?.permissions || {};
                                  const modPerm = rolePerms[module.key] || { view: false, edit: false };
                                  const isChild = !!module.parent;
                                  return (
                                      <tr key={module.key} className="hover:bg-gray-50">
                                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${isChild ? 'pl-10 text-gray-600' : 'font-bold text-gray-900'}`}>{isChild && <CornerDownRight size={14} className="inline mr-2 text-gray-400"/>}{module.label}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-center"><input type="checkbox" className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" checked={modPerm.view} onChange={() => togglePermission(activeAccessRole, module.key, 'view')}/></td>
                                          <td className="px-6 py-4 whitespace-nowrap text-center"><input type="checkbox" className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer" checked={modPerm.edit} onChange={() => togglePermission(activeAccessRole, module.key, 'edit')} disabled={!modPerm.view}/></td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* --- TRASH TAB --- */}
      {activeTab === 'trash' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px] flex flex-col animate-fade-in">
            <div className="bg-gray-50 border-b border-gray-100 flex justify-between items-center p-2">
               <div className="flex gap-1 overflow-x-auto">
                  <button onClick={() => setActiveTrashTab('task')} className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center ${activeTrashTab === 'task' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}><ClipboardList size={16} className="mr-2"/> Завдання</button>
                  <button onClick={() => setActiveTrashTab('order')} className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center ${activeTrashTab === 'order' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}><ShoppingCart size={16} className="mr-2"/> Замовлення</button>
                  <button onClick={() => setActiveTrashTab('product')} className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center ${activeTrashTab === 'product' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}><Box size={16} className="mr-2"/> Вироби</button>
                  <button onClick={() => setActiveTrashTab('cycle')} className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center ${activeTrashTab === 'cycle' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}><Folder size={16} className="mr-2"/> Цикли</button>
                  <button onClick={() => setActiveTrashTab('setupMap')} className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center ${activeTrashTab === 'setupMap' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}><Wrench size={16} className="mr-2"/> Карти</button>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto">
               {isTrashLoading ? (
                   <div className="flex justify-center items-center h-40"><Loader className="animate-spin text-gray-300"/></div>
               ) : (
                   <div className="divide-y divide-gray-100">
                        {trashItems.length === 0 && <div className="flex flex-col items-center justify-center py-20 text-gray-400"><Trash2 size={48} className="mb-4 opacity-20"/><p>Кошик порожній</p></div>}
                        {trashItems.map((item) => (
                            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mr-4 border border-gray-200"><Trash2 size={18} className="text-gray-400"/></div>
                                    <div>
                                        <div className="font-bold text-gray-900">{item.title || item.name || item.orderNumber || 'Без назви'}</div>
                                        <div className="text-xs text-gray-400 flex items-center"><span className="uppercase font-bold mr-2 text-red-300">{activeTrashTab}</span><span>Видалено: {item.deletedAt ? new Date(item.deletedAt).toLocaleString('uk-UA') : 'Unknown'}</span></div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleRestore(activeTrashTab, item.id)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center"><RefreshCw size={14} className="mr-1"/> Відновити</button>
                                    <button onClick={() => handlePermanentDelete(activeTrashTab, item.id)} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center"><X size={14} className="mr-1"/> Знищити</button>
                                </div>
                            </div>
                        ))}
                   </div>
               )}
            </div>
        </div>
      )}
    </div>
  );
};
