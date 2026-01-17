
import React from 'react';
import { Settings } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { User } from '../types';

interface MobileHeaderProps {
  currentUser: User;
  onNavigate: (path: string) => void;
  title?: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ currentUser, onNavigate }) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#0f172a] text-white z-40 flex items-center justify-between px-4 shadow-md">
      {/* LEFT: Logo/Title */}
      <div className="font-bold text-lg tracking-wide">
        CRM BM
      </div>

      {/* RIGHT: Icons Group */}
      <div className="flex items-center gap-4">
        {/* 1. Notifications */}
        <NotificationBell currentUser={currentUser} variant="dark" />

        {/* 2. Settings (The Gear) */}
        <button 
            onClick={() => onNavigate('/settings')}
            className="p-1 text-gray-300 hover:text-white transition-colors"
        >
            <Settings className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
};
