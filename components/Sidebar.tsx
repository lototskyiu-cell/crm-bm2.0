
import React from 'react';
import { 
  PieChart, Users, ShoppingCart, ClipboardList, FolderOpen, 
  Box, Wrench, FileText, Lightbulb, Star, MessageSquare, Settings, LogOut,
  ChevronLeft, ChevronRight, Menu, CalendarClock
} from 'lucide-react';
import { NavItem, User } from '../types';
import { usePermissions } from '../hooks/usePermissions';

interface SidebarProps {
  currentUser: User;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

const MENU_ITEMS: NavItem[] = [
  { id: 'analytics', label: 'Аналітика', icon: PieChart, roles: ['admin', 'worker'], path: '/analytics' },
  { id: 'workers', label: 'Працівники', icon: Users, roles: ['admin'], path: '/workers' },
  { id: 'schedules', label: 'Графіки роботи', icon: CalendarClock, roles: ['admin'], path: '/schedules' },
  { id: 'orders', label: 'Замовлення', icon: ShoppingCart, roles: ['admin', 'worker'], path: '/orders' },
  { id: 'tasks', label: 'Дошка завдань', icon: ClipboardList, roles: ['admin', 'worker'], path: '/tasks' },
  { id: 'repo', label: 'Сховище робіт', icon: FolderOpen, roles: ['admin', 'worker'], path: '/repository' },
  { id: 'products', label: 'Вироби', icon: Box, roles: ['admin', 'worker'], path: '/products' },
  { id: 'tools', label: 'Витратні інструменти', icon: Wrench, roles: ['admin', 'worker'], path: '/tools' },
  { id: 'reports', label: 'Щоденні звіти', icon: FileText, roles: ['admin', 'worker'], path: '/reports' },
  // { id: 'proposals', label: 'Пропозиції', icon: Lightbulb, roles: ['admin', 'worker'], path: '/proposals' }, // HIDDEN
  // { id: 'favorites', label: 'Обране', icon: Star, roles: ['admin', 'worker'], path: '/favorites' }, // HIDDEN
  // { id: 'chat', label: 'Чат', icon: MessageSquare, roles: ['admin', 'worker'], path: '/chat' }, // HIDDEN
  { id: 'settings', label: 'Налаштування', icon: Settings, roles: ['admin', 'worker'], path: '/settings' },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentUser, currentPath, onNavigate, onLogout, collapsed, onToggle }) => {
  const { canView, loading } = usePermissions(currentUser);

  // Map Sidebar IDs to Permission Module Keys
  const getPermissionKey = (id: string): string => {
    switch(id) {
      case 'repo': return 'repository';
      default: return id;
    }
  };

  const visibleItems = MENU_ITEMS.filter(item => {
    // 1. Check legacy hardcoded roles first
    if (!item.roles.includes(currentUser.role)) return false;
    
    // 2. Check granular permissions from DB
    // Some items like 'proposals', 'favorites', 'chat' might not be in the permission matrix yet.
    // We default them to visible if legacy role check passes, OR strictly enforce if they exist in DB.
    // For now, let's filter only the ones we know exist in Settings matrix.
    const permKey = getPermissionKey(item.id);
    const controlledModules = ['tasks', 'reports', 'orders', 'repository', 'products', 'tools', 'workers', 'schedules', 'analytics', 'settings'];
    
    if (controlledModules.includes(permKey)) {
       return canView(permKey);
    }
    
    return true; // Default allow for non-controlled items
  });

  return (
    <div 
      className={`${collapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 h-screen flex flex-col fixed left-0 top-0 border-r border-slate-800 transition-all duration-300 z-50`}
    >
      <div className={`p-6 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div>
            <h1 className="text-xl font-bold text-white tracking-wider">CRM BM</h1>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
              {currentUser.role === 'admin' ? 'Адмін' : 'Працівник'}
            </div>
          </div>
        )}
        <button 
          onClick={onToggle} 
          className="text-slate-500 hover:text-white transition-colors"
        >
          {collapsed ? <Menu size={24} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin scrollbar-thumb-slate-700">
        <ul>
          {visibleItems.map((item) => {
            const isActive = currentPath.startsWith(item.path);
            return (
              <li key={item.id} title={collapsed ? item.label : ''}>
                <button
                  onClick={() => onNavigate(item.path)}
                  className={`w-full flex items-center px-6 py-3 transition-all duration-200 group relative ${
                    isActive 
                      ? 'bg-blue-600/10 text-blue-400 border-r-2 border-blue-500' 
                      : 'hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className={`transition-transform duration-200 ${collapsed ? 'mx-auto' : 'mr-3'}`}>
                    <item.icon size={20} className={isActive ? 'text-blue-400' : ''} />
                  </div>
                  
                  {!collapsed && (
                    <span className={`text-sm font-medium whitespace-nowrap ${isActive ? 'text-white' : ''}`}>
                      {item.label}
                    </span>
                  )}

                  {/* Tooltip for collapsed mode */}
                  {collapsed && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl">
                      {item.label}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={onLogout}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'px-4'} py-2 text-sm text-red-400 hover:bg-slate-800 rounded transition-colors group relative`}
          title={collapsed ? "Вийти" : ""}
        >
          <LogOut size={18} className={!collapsed ? "mr-3" : ""} />
          {!collapsed && <span>Вийти</span>}
        </button>
      </div>
    </div>
  );
};
