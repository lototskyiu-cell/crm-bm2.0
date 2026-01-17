
import React, { useState } from 'react';
import { 
  ClipboardList, Box, Menu, LayoutDashboard, 
  ShoppingCart, Users, CalendarClock, FolderOpen, Wrench, PieChart, X, LogOut,
  User as UserIcon, ChevronRight, Settings
} from 'lucide-react';
import { User } from '../types';
import { usePermissions } from '../hooks/usePermissions';

interface BottomNavProps {
  currentUser: User;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

// --- Internal Reusable Components ---

const MenuSectionHeader = ({ title }: { title: string }) => (
  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 mt-6 px-2">
    {title}
  </h3>
);

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  value?: string;
  onClick: () => void;
  isDestructive?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon: Icon, label, value, onClick, isDestructive = false }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-all active:scale-[0.98] ${
        isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-[#1f2937] text-white active:bg-[#374151]'
    }`}
  >
     <div className="flex items-center gap-4">
        <Icon size={22} className={isDestructive ? "text-red-500" : "text-gray-400"} />
        <span className="font-medium text-[15px]">{label}</span>
     </div>
     <div className="flex items-center gap-2">
        {value && <span className="text-gray-500 text-sm font-medium">{value}</span>}
        {!isDestructive && <ChevronRight size={18} className="text-gray-600" />}
     </div>
  </button>
);

export const BottomNav: React.FC<BottomNavProps> = ({ currentUser, currentPath, onNavigate, onLogout }) => {
  const { canView } = usePermissions(currentUser);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const mainLinks = [
    { id: 'tasks', label: 'Дошка', icon: LayoutDashboard, path: '/tasks' },
    { id: 'reports', label: 'Звіти', icon: ClipboardList, path: '/reports' },
    { id: 'analytics', label: 'Аналітика', icon: PieChart, path: '/analytics' },
  ];

  // Modules hidden from bottom bar but available in menu
  const menuLinks = [
    { id: 'orders', label: 'Замовлення', icon: ShoppingCart, path: '/orders' },
    { id: 'products', label: 'Склад та Вироби', icon: Box, path: '/products' },
    { id: 'tools', label: 'Інструменти', icon: Wrench, path: '/tools' },
    { id: 'workers', label: 'Працівники', icon: Users, path: '/workers' }, 
    { id: 'schedules', label: 'Графіки', icon: CalendarClock, path: '/schedules' },
    { id: 'repository', label: 'Сховище робіт', icon: FolderOpen, path: '/repository' },
  ];

  const handleNav = (path: string) => {
      setIsMenuOpen(false);
      onNavigate(path);
  }

  return (
    <>
      {/* Full Screen Menu Overlay (Dark Theme) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[45] bg-[#111827] overflow-y-auto animate-fade-in">
            <div className="pt-20 pb-24 px-4 min-h-full flex flex-col">
                <div className="flex justify-between items-center mb-2 px-2">
                    <h2 className="text-2xl font-bold text-white">Меню</h2>
                    {/* User Icon removed as per request */}
                </div>

                {/* --- SECTION: MODULES (Navigation) --- */}
                <MenuSectionHeader title="Навігація" />
                
                {menuLinks.filter(item => canView(item.id === 'repository' ? 'repo' : item.id)).map(item => (
                    <MenuItem 
                        key={item.id}
                        icon={item.icon}
                        label={item.label}
                        onClick={() => handleNav(item.path)}
                    />
                ))}

                {/* --- SECTION: SYSTEM --- */}
                <MenuSectionHeader title="Система" />
                <MenuItem icon={Settings} label="Налаштування" onClick={() => handleNav('/settings')} />

                {/* --- LOGOUT --- */}
                <div className="mt-8 mb-4">
                   <MenuItem icon={LogOut} label="Вийти з акаунту" isDestructive onClick={onLogout} />
                </div>
            </div>
        </div>
      )}

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50 flex justify-around items-center py-3 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {mainLinks.map(item => {
            const isActive = currentPath.startsWith(item.path) && !isMenuOpen;
            return (
                <button
                    key={item.id}
                    onClick={() => handleNav(item.path)}
                    className={`flex flex-col items-center justify-center w-full space-y-1 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                >
                    <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">{item.label}</span>
                </button>
            )
        })}
        
        <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex flex-col items-center justify-center w-full space-y-1 ${isMenuOpen ? 'text-blue-600' : 'text-gray-400'}`}
        >
            {isMenuOpen ? <X size={24} strokeWidth={2.5}/> : <Menu size={24} />}
            <span className="text-[10px] font-medium">{isMenuOpen ? 'Закрити' : 'Меню'}</span>
        </button>
      </div>
    </>
  );
};
