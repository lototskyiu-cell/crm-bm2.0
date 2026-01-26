import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User } from '../types';
import { X, Gift, PartyPopper } from 'lucide-react';

interface BirthdayManagerProps {
  currentUser: User | null;
}

export const BirthdayManager: React.FC<BirthdayManagerProps> = ({ currentUser }) => {
  const [showPersonalGreeting, setShowPersonalGreeting] = useState(false);
  const [colleagueBirthdays, setColleagueBirthdays] = useState<User[]>([]);
  const [showColleagueNotification, setShowColleagueNotification] = useState(false);
  const [startMusic, setStartMusic] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const checkBirthdays = async () => {
      const today = new Date();
      // Format MM-DD for stable comparison
      const currentMonthDay = String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      const currentYear = today.getFullYear();

      // 1. Check if it's the current user's birthday
      if (currentUser.dob?.endsWith(currentMonthDay)) {
        const storageKey = `personal_bday_shown_${currentYear}_${currentUser.id}`;
        if (!localStorage.getItem(storageKey)) {
          setShowPersonalGreeting(true);
        }
      }

      // 2. Check for colleague birthdays
      try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        
        const birthdayColleagues: User[] = [];
        
        snapshot.docs.forEach(doc => {
          const userData = doc.data() as User;
          const userId = doc.id;
          
          // Exclude self and check if their birthday is today
          if (userId !== currentUser.id && userData.dob?.endsWith(currentMonthDay) && userData.status !== 'dismissed') {
            birthdayColleagues.push({ ...userData, id: userId });
          }
        });

        if (birthdayColleagues.length > 0) {
          const idsString = birthdayColleagues.map(u => u.id).join('_');
          const colleaguesStorageKey = `colleagues_bday_shown_${currentYear}_${currentMonthDay}_${idsString}`;
          
          if (!localStorage.getItem(colleaguesStorageKey)) {
            setColleagueBirthdays(birthdayColleagues);
            setShowColleagueNotification(true);
          }
        }
      } catch (error) {
        console.error("Помилка перевірки днів народження:", error);
      }
    };

    checkBirthdays();
  }, [currentUser]);

  const handleClosePersonal = () => {
    if (currentUser) {
      const today = new Date();
      localStorage.setItem(`personal_bday_shown_${today.getFullYear()}_${currentUser.id}`, 'true');
    }
    setShowPersonalGreeting(false);
    setStartMusic(false);
  };

  const handleCloseColleagues = () => {
    const today = new Date();
    const currentMonthDay = String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const idsString = colleagueBirthdays.map(u => u.id).join('_');
    localStorage.setItem(`colleagues_bday_shown_${today.getFullYear()}_${currentMonthDay}_${idsString}`, 'true');
    
    setShowColleagueNotification(false);
  };

  // --- PERSONAL GREETING RENDER ---
  if (showPersonalGreeting) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 text-white p-4 animate-fadeIn backdrop-blur-md">
        <div className="max-w-2xl w-full text-center relative z-10 animate-scaleIn">
          {!startMusic ? (
             <div className="bg-slate-800/50 p-10 rounded-[2.5rem] border border-yellow-500/30 shadow-[0_0_80px_rgba(234,179,8,0.2)]">
                <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(234,179,8,0.4)]">
                   <Gift size={48} className="text-slate-900" />
                </div>
                <h2 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-300 uppercase tracking-tighter">
                    Вам надійшло святкове повідомлення!
                </h2>
                <button 
                   onClick={() => setStartMusic(true)}
                   className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:scale-110 active:scale-95 text-slate-900 font-black py-5 px-12 rounded-full text-2xl transition-all shadow-[0_10px_40px_rgba(234,179,8,0.3)] flex items-center mx-auto gap-3"
                >
                   ВІДКРИТИ <PartyPopper size={28} />
                </button>
             </div>
          ) : (
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-12 rounded-[3rem] border-2 border-yellow-400/50 shadow-[0_0_100px_rgba(255,215,0,0.2)] relative overflow-hidden">
               {/* Confetti-like background elements */}
               <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-600/20 blur-[100px] rounded-full"></div>
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-pink-600/20 blur-[100px] rounded-full"></div>

               <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-400 mb-10 tracking-tighter">
                З ДНЕМ НАРОДЖЕННЯ! 🎂
              </h1>
              <div className="text-xl leading-relaxed text-blue-100/80 space-y-6 font-medium max-w-lg mx-auto">
                <p>Бажаємо вам професійного зростання, стабільності, впевненості у завтрашньому дні та нових досягнень.</p>
                <p>Нехай робота приносить задоволення, а кожен новий рік відкриває ще більше можливостей.</p>
              </div>
              
              <div className="mt-12 pt-8 border-t border-white/10">
                <p className="text-lg text-gray-300">З повагою,</p>
                <p className="text-2xl font-bold text-yellow-400 mt-2 tracking-wider uppercase">
                  Команда УЛЬТРАКОНТАКТ
                </p>
              </div>

              <button 
                onClick={handleClosePersonal} 
                className="mt-10 px-6 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
              >
                Дякую, закрити ✕
              </button>

              {/* YouTube Audio Hook */}
              <div className="absolute opacity-0 pointer-events-none w-1 h-1 overflow-hidden">
                <iframe 
                  width="1" height="1" 
                  src="https://www.youtube.com/embed/hjsR9mMlMok?autoplay=1&loop=1&playlist=hjsR9mMlMok" 
                  allow="autoplay"
                ></iframe>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- COLLEAGUE NOTIFICATION RENDER ---
  if (showColleagueNotification && colleagueBirthdays.length > 0) {
    return (
      <div className="fixed top-20 right-6 z-[9990] max-w-sm w-full bg-white dark:bg-slate-800 border-l-4 border-purple-500 shadow-2xl rounded-2xl overflow-hidden animate-slideIn">
        <div className="p-5 relative">
          <button 
            onClick={handleCloseColleagues}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-2xl mr-4 shadow-inner">
               🎂
            </div>
            <div className="pr-6">
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 tracking-tight">Свято в команді!</h3>
              <div className="text-slate-500 dark:text-slate-400 text-sm space-y-3 mt-2">
                {colleagueBirthdays.map(colleague => (
                  <div key={colleague.id} className="pb-3 border-b last:border-0 border-slate-100 dark:border-slate-700">
                    <p className="leading-snug">
                      Сьогодні день народження у вашого колеги: <br/>
                      <span className="font-bold text-purple-600 dark:text-purple-400 text-base">{colleague.firstName} {colleague.lastName}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase font-black mt-2 tracking-widest">Не забудьте привітати! 🎉</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};