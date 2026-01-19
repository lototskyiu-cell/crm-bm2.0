
import React, { useState, useEffect } from 'react';
import { WorkSchedule, WorkScheduleDay, ScheduleType, Break, User } from '../types';
import { API } from '../services/api';
import { Plus, X, Moon, Sun, Trash2, CalendarClock, AlertCircle, Clock, Loader } from 'lucide-react';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export const AdminWorkSchedules: React.FC = () => {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);

  // Form State - NO DEFAULTS
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<ScheduleType | null>(null);
  const [formDays, setFormDays] = useState<WorkScheduleDay[]>(
    Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, isWorking: false, isNight: false }))
  );
  const [formDuration, setFormDuration] = useState<string>('');
  const [formStartTime, setFormStartTime] = useState<string>('');
  const [formEndTime, setFormEndTime] = useState<string>('');
  const [formBreaks, setFormBreaks] = useState<Break[]>([]);

  useEffect(() => {
    refreshList();
  }, []);

  const refreshList = async () => {
    setIsLoading(true);
    try {
      const [scheds, usrs] = await Promise.all([
        API.getSchedules(),
        API.getUsers()
      ]);
      setSchedules(scheds);
      // Filter out dismissed users so they don't count towards schedule assignment stats
      setUsers(usrs.filter(u => u.status !== 'dismissed'));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (schedule?: WorkSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormName(schedule.name);
      setFormType(schedule.type);
      setFormDays(schedule.days ? JSON.parse(JSON.stringify(schedule.days)) : Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, isWorking: false, isNight: false })));
      setFormDuration(schedule.shiftDurationHours?.toString() || '');
      setFormStartTime(schedule.startTime || '');
      setFormEndTime(schedule.endTime || '');
      setFormBreaks(schedule.breaks ? JSON.parse(JSON.stringify(schedule.breaks)) : []);
    } else {
      setEditingSchedule(null);
      // EMPTY STATE
      setFormName('');
      setFormType(null);
      setFormDays(Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, isWorking: false, isNight: false })));
      setFormDuration('');
      setFormStartTime('');
      setFormEndTime('');
      setFormBreaks([]);
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName) {
      alert('Введіть назву графіка');
      return;
    }

    const scheduleData: WorkSchedule = {
      id: editingSchedule ? editingSchedule.id : `sch_${Date.now()}`,
      name: formName,
      type: formType,
      days: formDays,
      shiftDurationHours: formDuration ? Number(formDuration) : undefined,
      startTime: formStartTime,
      endTime: formEndTime,
      breaks: formBreaks
    };

    try {
      await API.saveSchedule(scheduleData);
      refreshList();
      setIsModalOpen(false);
    } catch (e) {
      alert("Error saving schedule");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Видалити цей графік?')) {
      try {
        await API.deleteSchedule(id);
        refreshList();
      } catch (e) {
        alert("Error deleting schedule");
      }
    }
  };

  // Helper to count assigned workers
  const getAssignedWorkerCount = (scheduleId: string) => {
    return users.filter(u => u.workScheduleId === scheduleId).length;
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader className="animate-spin text-blue-600"/></div>;

  // Empty State View
  if (schedules.length === 0 && !isModalOpen) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[80vh]">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <CalendarClock size={48} className="text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Графіки роботи ще не створені</h2>
        <p className="text-gray-500 max-w-md mb-8">
          Створіть перший графік, щоб призначити його працівникам.
          Система не містить попередньо встановлених шаблонів.
        </p>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center"
        >
          <Plus size={24} className="mr-2" />
          Створити графік
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Графіки роботи</h1>
          <p className="text-gray-500">Конфігурація робочих змін та розкладів</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-slate-900 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-slate-800 transition-all flex items-center shadow-sm"
        >
          <Plus size={18} className="mr-2" />
          Створити графік
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {schedules.map(schedule => {
          const workerCount = getAssignedWorkerCount(schedule.id);
          const days = schedule.days || []; // Fallback for safety
          const workingDaysCount = days.filter(d => d.isWorking).length;
          const nightDaysCount = days.filter(d => d.isNight).length;

          return (
            <div key={schedule.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
              <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 mb-1">{schedule.name}</h3>
                  <div className="flex items-center space-x-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                    <span className="flex items-center">
                      {schedule.type === 'night' ? <Moon size={12} className="mr-1"/> : <Sun size={12} className="mr-1"/>}
                      {schedule.type === 'day' ? 'Денний' : schedule.type === 'night' ? 'Нічний' : schedule.type === 'mixed' ? 'Змішаний' : 'Не вказано'}
                    </span>
                    <span>•</span>
                    <span>{schedule.shiftDurationHours ? `${schedule.shiftDurationHours} год` : 'Гнучкий'}</span>
                  </div>
                </div>
                <div className="flex space-x-1">
                   <button onClick={() => handleOpenModal(schedule)} className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                     <Clock size={18} />
                   </button>
                   <button onClick={() => handleDelete(schedule.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                     <Trash2 size={18} />
                   </button>
                </div>
              </div>
              
              {/* Mini Grid Visualization */}
              <div className="p-5 grid grid-cols-7 gap-1">
                {days.length > 0 ? days.map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <div className="text-[10px] text-gray-400 font-bold mb-1">{WEEKDAYS[idx]}</div>
                    <div 
                      className={`w-full h-8 rounded-md flex items-center justify-center transition-colors border ${
                        day.isWorking 
                          ? day.isNight 
                            ? 'bg-slate-800 border-slate-900 text-white' 
                            : 'bg-blue-100 border-blue-200 text-blue-700'
                          : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      {day.isWorking && (day.isNight ? <Moon size={12} /> : <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>)}
                    </div>
                  </div>
                )) : (
                   <div className="col-span-7 text-center text-xs text-red-400">Помилка структури графіка</div>
                )}
              </div>

              <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex justify-between items-center text-sm">
                <span className="text-gray-500">Працівників: <strong className="text-gray-900">{workerCount}</strong></span>
                <button onClick={() => handleOpenModal(schedule)} className="text-blue-600 font-medium text-xs hover:underline">Редагувати</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSchedule ? 'Редагування графіка' : 'Новий графік роботи'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8">
              
              {/* A. BASIC INFO */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Назва графіка <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Наприклад: Зміна А (Денна)"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Тип графіка</label>
                   <div className="flex gap-4">
                      {['day', 'night', 'mixed'].map((type) => (
                        <label key={type} className={`flex-1 cursor-pointer border rounded-lg p-3 flex items-center justify-center transition-all ${formType === type ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                          <input 
                            type="radio" 
                            name="scheduleType" 
                            className="hidden" 
                            checked={formType === type}
                            onChange={() => setFormType(type as ScheduleType)}
                          />
                          <span className="font-medium capitalize">
                            {type === 'day' ? 'Денний' : type === 'night' ? 'Нічний' : 'Змішаний'}
                          </span>
                        </label>
                      ))}
                   </div>
                </div>
              </div>

              {/* B. WORKING DAYS CONFIGURATION */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Дні тижня</h3>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="grid grid-cols-7 gap-2 text-center mb-2">
                     {WEEKDAYS.map(d => <div key={d} className="text-xs font-bold text-gray-400">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {formDays.map((day, idx) => (
                      <div key={idx} className={`flex flex-col gap-2 p-2 rounded-lg border transition-all ${day.isWorking ? (day.isNight ? 'bg-slate-800 border-slate-900' : 'bg-white border-blue-300 shadow-sm') : 'bg-transparent border-transparent opacity-50 hover:opacity-100'}`}>
                        <label className="flex items-center justify-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={day.isWorking}
                            onChange={(e) => {
                              const newDays = [...formDays];
                              newDays[idx].isWorking = e.target.checked;
                              if (!e.target.checked) newDays[idx].isNight = false;
                              setFormDays(newDays);
                            }}
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </label>
                        <label className="flex items-center justify-center cursor-pointer" title="Нічна зміна">
                          <input 
                            type="checkbox" 
                            checked={day.isNight}
                            disabled={!day.isWorking}
                            onChange={(e) => {
                              const newDays = [...formDays];
                              newDays[idx].isNight = e.target.checked;
                              setFormDays(newDays);
                            }}
                            className="hidden" 
                          />
                          <div className={`p-1.5 rounded-full transition-colors ${day.isNight ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-400 hover:bg-gray-300'}`}>
                             <Moon size={12} />
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* C. SHIFT PARAMETERS */}
              <div>
                 <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Параметри зміни</h3>
                 <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Тривалість (год)</label>
                      <input 
                        type="number" 
                        value={formDuration}
                        onChange={e => setFormDuration(e.target.value)}
                        placeholder="-"
                        className="w-full p-2.5 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Початок</label>
                      <input 
                        type="time" 
                        value={formStartTime}
                        onChange={e => setFormStartTime(e.target.value)}
                        className="w-full p-2.5 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Кінець</label>
                      <input 
                        type="time" 
                        value={formEndTime}
                        onChange={e => setFormEndTime(e.target.value)}
                        className="w-full p-2.5 border rounded-lg"
                      />
                    </div>
                 </div>
              </div>

              {/* D. BREAKS CONFIGURATION */}
              <div>
                 <div className="flex justify-between items-center mb-3">
                   <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Перерви</h3>
                   <button 
                     onClick={() => setFormBreaks([...formBreaks, { id: `b_${Date.now()}`, name: '', durationMinutes: 0, isPaid: false }])}
                     className="text-xs flex items-center bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-gray-700 transition-colors font-medium"
                   >
                     <Plus size={14} className="mr-1"/> Додати перерву
                   </button>
                 </div>

                 {formBreaks.length === 0 ? (
                   <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                     Список перерв порожній
                   </div>
                 ) : (
                   <div className="space-y-2">
                     {formBreaks.map((brk, idx) => (
                       <div key={idx} className="flex gap-3 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                         <input 
                           placeholder="Назва"
                           value={brk.name}
                           onChange={e => {
                             const newBreaks = [...formBreaks];
                             newBreaks[idx].name = e.target.value;
                             setFormBreaks(newBreaks);
                           }}
                           className="flex-1 p-2 border rounded text-sm"
                         />
                         <div className="flex items-center bg-white border rounded px-2">
                           <input 
                             type="number"
                             value={brk.durationMinutes}
                             onChange={e => {
                               const newBreaks = [...formBreaks];
                               newBreaks[idx].durationMinutes = Number(e.target.value);
                               setFormBreaks(newBreaks);
                             }}
                             className="w-12 p-2 text-sm outline-none text-right"
                           />
                           <span className="text-xs text-gray-400 mr-1">хв</span>
                         </div>
                         <label className="flex items-center space-x-2 cursor-pointer bg-white px-3 py-2 border rounded hover:bg-gray-50">
                           <input 
                             type="checkbox" 
                             checked={brk.isPaid}
                             onChange={e => {
                               const newBreaks = [...formBreaks];
                               newBreaks[idx].isPaid = e.target.checked;
                               setFormBreaks(newBreaks);
                             }}
                             className="rounded text-green-600 focus:ring-green-500"
                           />
                           <span className="text-xs font-medium text-gray-600">Оплачувана</span>
                         </label>
                         <button 
                           onClick={() => {
                             const newBreaks = [...formBreaks];
                             newBreaks.splice(idx, 1);
                             setFormBreaks(newBreaks);
                           }}
                           className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end">
               <button 
                 onClick={handleSave}
                 className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg"
               >
                 Зберегти графік
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
