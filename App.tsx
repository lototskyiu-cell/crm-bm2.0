
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileHeader } from './components/MobileHeader';
import { BottomNav } from './components/BottomNav';
import { Login } from './pages/Login';
import { AdminWorkers } from './pages/AdminWorkers';
import { AdminWorkSchedules } from './pages/AdminWorkSchedules';
import { AdminAttendance } from './pages/AdminAttendance';
import { WorkerCalendar } from './pages/WorkerCalendar';
import { JobRepository } from './pages/JobRepository';
import { JobCyclePage } from './pages/JobCycle';
import { Settings } from './pages/Settings'; 
import { Products } from './pages/Products'; 
import { Orders } from './pages/Orders'; 
import { TaskBoard } from './pages/TaskBoard';
import { Reports } from './pages/Reports';
import { Tools } from './pages/Tools'; 
import { User } from './types';
import { NotificationBell } from './components/NotificationBell';
import { API } from './services/api';
import { ThemeProvider } from './context/ThemeContext';

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('/analytics'); 
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Mobile Layout State
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 1. Restore Session
    const storedUser = localStorage.getItem('currentUser');
    const storedPath = localStorage.getItem('currentPath');
    
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            setCurrentUser(parsedUser);
        } catch (e) {
            console.error("Failed to parse stored user", e);
            localStorage.removeItem('currentUser');
        }
    }
    
    if (storedPath) {
        setCurrentPath(storedPath);
    }

    // 2. Check View Mode preference
    const checkLayout = () => {
        const mode = localStorage.getItem('app_view_mode');
        if (mode === 'mobile') {
            setIsMobile(true);
        } else if (mode === 'desktop') {
            setIsMobile(false);
        } else {
            // Auto
            setIsMobile(window.innerWidth < 768);
        }
    };

    checkLayout();
    window.addEventListener('resize', checkLayout);
    // Listen for storage events (triggered by Settings page)
    window.addEventListener('storage', checkLayout);
    
    return () => {
        window.removeEventListener('resize', checkLayout);
        window.removeEventListener('storage', checkLayout);
    };
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    let nextPath = '/tasks';
    if (user.role === 'admin') {
      nextPath = '/workers';
    }
    
    setCurrentPath(nextPath);
    localStorage.setItem('currentPath', nextPath);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentPath');
    setCurrentPath('/analytics');
  };

  const handleNavigate = (path: string) => {
      setSelectedCycleId(null);
      setCurrentPath(path);
      localStorage.setItem('currentPath', path);
  };

  const getPageTitle = (path: string) => {
      switch(path) {
          case '/tasks': return 'Дошка завдань';
          case '/orders': return 'Замовлення';
          case '/reports': return 'Звіти';
          case '/products': return 'Вироби';
          case '/tools': return 'Інструменти';
          case '/settings': return 'Налаштування';
          case '/workers': return 'Працівники';
          case '/schedules': return 'Графіки';
          case '/analytics': return 'Аналітика';
          case '/repository': return 'Сховище';
          default: return 'CRM BM';
      }
  };

  const renderContent = () => {
    if (!currentUser) return <Login onLogin={handleLogin} />;

    if (selectedCycleId) {
       return <JobCyclePage cycleId={selectedCycleId} onBack={() => setSelectedCycleId(null)} role={currentUser.role} />;
    }

    // Shared Routes - Now passing currentUser to all for permissions consistency
    if (currentPath === '/settings') return <Settings currentUser={currentUser} />;
    
    // Explicitly passing props where necessary if components are updated to accept them
    if (currentPath === '/products') return <Products currentUser={currentUser} />;
    
    if (currentPath === '/orders') return <Orders />;
    if (currentPath === '/tasks') return <TaskBoard currentUser={currentUser} />;
    if (currentPath === '/reports') return <Reports currentUser={currentUser} />;
    if (currentPath === '/tools') return <Tools currentUser={currentUser} />; 
    if (currentPath === '/repository') return <JobRepository onSelectCycle={setSelectedCycleId} />;

    // Admin Routes
    if (currentUser.role === 'admin') {
      switch (currentPath) {
        case '/workers': return <AdminWorkers />;
        case '/schedules': return <AdminWorkSchedules />;
        case '/analytics': return <AdminAttendance />;
        default: return <Placeholder path={currentPath}/>;
      }
    }

    // Worker Routes
    if (currentUser.role === 'worker') {
      switch (currentPath) {
        case '/analytics': return <WorkerCalendar currentUser={currentUser} />;
        default: return <Placeholder path={currentPath}/>;
      }
    }
    
    return null;
  };
  
  const Placeholder = ({path}: {path: string}) => (
    <div className="p-10 text-center text-gray-500 dark:text-gray-400">
       <h2 className="text-xl font-bold">Розділ в розробці ({path})</h2>
    </div>
  );

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  // --- MOBILE LAYOUT ---
  if (isMobile) {
      return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
            <MobileHeader 
                currentUser={currentUser} 
                onNavigate={handleNavigate}
                title={getPageTitle(currentPath)}
            />
            
            {/* Main Content with Padding for fixed Header (16) and BottomNav (20+) */}
            <main className="flex-1 pt-20 pb-24 overflow-y-auto">
                {renderContent()}
            </main>

            <BottomNav 
                currentUser={currentUser}
                currentPath={currentPath}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
            />
        </div>
      );
  }

  // --- DESKTOP LAYOUT ---
  return (
    <div className="flex min-h-screen relative bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Sidebar 
        currentUser={currentUser} 
        currentPath={currentPath}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      
      <main className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-20' : 'ml-64'} relative dark:text-gray-100`}>
        {/* Top Right Actions Layer */}
        <div className="absolute top-6 right-8 z-[90] flex items-center gap-4">
           <NotificationBell currentUser={currentUser} />
        </div>

        {renderContent()}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
