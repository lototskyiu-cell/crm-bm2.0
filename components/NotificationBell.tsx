
import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, AlertTriangle, Info, CheckCircle, Trash2 } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { User } from '../types';

interface NotificationBellProps {
  currentUser: User;
  variant?: 'default' | 'dark';
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser, variant = 'default' }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 1. ROBUST DATA FETCHING
  useEffect(() => {
    if (!currentUser) return;

    // Simple Query: Fetch last 50 notifications sorted by time.
    // No 'where' clauses that might trigger index errors.
    const q = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        try {
            const allNotes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // 2. CLIENT-SIDE FILTERING (The "Bulletproof" part)
            const filteredNotes = allNotes.filter((note: any) => {
                // Show if specifically for this user
                const isForMe = note.userId === currentUser.id;
                // Show if for 'admin' role (if supported) and user is admin
                const isForAdmin = (note.to === 'admin' || note.userId === 'admin') && currentUser.role === 'admin';
                // Show if global
                const isGlobal = note.to === 'global';
                
                return isForMe || isForAdmin || isGlobal;
            });

            setNotifications(filteredNotes);
            
            // Count unread
            const unread = filteredNotes.filter((n: any) => !n.read).length;
            setUnreadCount(unread);
            setError(null);
        } catch (err) {
            console.error("Notification Processing Error:", err);
            setError("Помилка даних");
        }
    }, (err) => {
        console.error("Notification Access Error:", err);
        // Silently fail or show small indicator, don't crash app
        setError("Немає доступу");
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Click Outside to Close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
        console.error("Error marking read:", e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
        const batch = writeBatch(db);
        let hasUpdates = false;
        notifications.forEach(n => {
            if (!n.read) {
                batch.update(doc(db, 'notifications', n.id), { read: true });
                hasUpdates = true;
            }
        });
        if (hasUpdates) await batch.commit();
    } catch (e) {
        console.error("Error marking all read:", e);
    }
  };

  const buttonClass = variant === 'dark'
    ? "p-2 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition-all relative"
    : "p-2 bg-white text-gray-500 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-all relative border border-gray-200 shadow-sm";

  return (
    <div className="relative" ref={wrapperRef}>
      {/* BELL BUTTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClass}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* DROPDOWN */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-[100] animate-fade-in-up origin-top-right ring-1 ring-black/5">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-700 text-sm">Сповіщення</h3>
            {unreadCount > 0 && (
                <button 
                    onClick={handleMarkAllRead}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                >
                    Прочитати всі
                </button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {error && (
                 <div className="p-4 text-center text-red-500 text-xs flex flex-col items-center">
                    <AlertTriangle className="mb-1" size={16}/>
                    {error}. Перевірте з'єднання.
                </div>
            )}

            {!error && notifications.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center">
                <Bell className="mb-2 opacity-20" size={32} />
                Сповіщень немає
              </div>
            )}

            {notifications.map(n => (
              <div 
                key={n.id} 
                className={`p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex gap-3 group ${!n.read ? 'bg-blue-50/40' : ''}`}
              >
                <div className="mt-1 shrink-0">
                    {n.type === 'warning' ? <AlertTriangle size={16} className="text-orange-500"/> :
                     n.type === 'success' ? <CheckCircle size={16} className="text-green-500"/> :
                     <Info size={16} className="text-blue-500"/>}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-tight ${!n.read ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                      {n.message}
                  </p>
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleString('uk-UA') : 'Тільки що'}
                  </span>
                </div>

                {!n.read && (
                  <button 
                    onClick={(e) => handleMarkRead(n.id, e)}
                    className="text-gray-300 hover:text-blue-600 p-1 self-start opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Позначити прочитаним"
                  >
                    <Check size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
