
import React, { useState, useEffect } from 'react';
import { AttendanceRecord, AbsenceType, TransportMode, Break, User, WorkSchedule, AdditionalExpense } from '../types';
import { API } from '../services/api';
import { DEFAULT_BREAKS } from '../services/mockStore'; 
import { PayrollService } from '../services/payroll';
import { AttendanceLogic } from '../services/attendanceLogic';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { X, Save, Clock, Bus, Car, Plus, Trash2, CheckCircle, Calendar, AlertTriangle, Info, Settings, Moon, Sun, ShoppingBag } from 'lucide-react';

interface AttendanceModalProps {
  date: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isAdmin?: boolean;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({ 
  date, userId, isOpen, onClose, onSave, isAdmin = false 
}) => {
  const [user, setUser] = useState<User | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'work' | 'absence'>('work');
  
  // Schedule Logic
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');

  // Work Fields
  const [transportMode, setTransportMode] = useState<TransportMode>('car');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState(''); 
  
  // Car
  const [distanceTo, setDistanceTo] = useState(0);
  const [distanceFrom, setDistanceFrom] = useState(0);
  const [fuelConsumption, setFuelConsumption] = useState(0);
  const [fuelPrice, setFuelPrice] = useState(0);
  
  // Bus
  const [busPriceTo, setBusPriceTo] = useState(0);
  const [busPriceFrom, setBusPriceFrom] = useState(0);
  
  // Breaks
  const [breaks, setBreaks] = useState<Break[]>([]);

  // Additional Expenses
  const [additionalExpenses, setAdditionalExpenses] = useState<AdditionalExpense[]>([]);
  const [newExpName, setNewExpName] = useState('');
  const [newExpDist, setNewExpDist] = useState<string>('');
  const [newExpAmount, setNewExpAmount] = useState<string>('');
  
  // Absence Fields
  const [absenceType, setAbsenceType] = useState<AbsenceType>('sick');
  const [comment, setComment] = useState('');
  
  // Admin Fields
  const [verifiedByAdmin, setVerifiedByAdmin] = useState(false);
  const [overtimeApproved, setOvertimeApproved] = useState(false);
  
  const [existingId, setExistingId] = useState<string | null>(null);
  
  // Deletion State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, userId, date]);

  const loadData = async () => {
    try {
      const [allUsers, allSchedules, allRecords] = await Promise.all([
        API.getUsers(),
        API.getSchedules(),
        API.getAttendanceRecords(userId) 
      ]);

      const u = allUsers.find(us => us.id === userId);
      setUser(u);
      setSchedules(allSchedules);

      // Find specific record for this date
      const record = allRecords.find(r => r.date === date);

      const effectiveData = u ? AttendanceLogic.getEffectiveDailyData(u, record) : { transportMode: 'car', distanceTo: 0, distanceFrom: 0, fuelConsumption: 0, fuelPrice: 0, busPriceTo: 0, busPriceFrom: 0 };
      
      if (record) {
        setExistingId(record.id);
        setVerifiedByAdmin(record.verifiedByAdmin || false);
        setOvertimeApproved(record.overtimeApproved || false);
        
        if (record.type === 'work') {
          setActiveTab('work');
          setStartTime(record.startTime || '09:00');
          setEndTime(record.endTime || '');
          setSelectedScheduleId(record.workScheduleId || u?.workScheduleId || '');
          setBreaks(record.breaks && record.breaks.length > 0 ? record.breaks : JSON.parse(JSON.stringify(DEFAULT_BREAKS)));
          setAdditionalExpenses(record.additionalExpenses || []);
        } else {
          setActiveTab('absence');
          setAbsenceType(record.absenceType || 'sick');
          setComment(record.comment || '');
          setBreaks(JSON.parse(JSON.stringify(DEFAULT_BREAKS)));
          setSelectedScheduleId(u?.workScheduleId || '');
        }
      } else {
        // NEW RECORD
        setExistingId(null);
        setVerifiedByAdmin(false);
        setOvertimeApproved(false);
        setAdditionalExpenses([]);
        
        // Auto-select schedule
        const defaultScheduleId = u?.workScheduleId || '';
        setSelectedScheduleId(defaultScheduleId);
        
        const defaultSchedule = allSchedules.find(s => s.id === defaultScheduleId);
        if (defaultSchedule) {
           setBreaks(JSON.parse(JSON.stringify(defaultSchedule.breaks)));
        } else {
           setBreaks(JSON.parse(JSON.stringify(DEFAULT_BREAKS)));
        }
      }

      setTransportMode(effectiveData.transportMode as TransportMode);
      setDistanceTo(effectiveData.distanceTo as number);
      setDistanceFrom(effectiveData.distanceFrom as number);
      setFuelConsumption(effectiveData.fuelConsumption as number);
      setFuelPrice(effectiveData.fuelPrice as number);
      setBusPriceTo(effectiveData.busPriceTo as number);
      setBusPriceFrom(effectiveData.busPriceFrom as number);

    } catch (e) {
      console.error(e);
    }
  };

  const handleScheduleChange = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    const newSchedule = schedules.find(s => s.id === scheduleId);
    if (newSchedule) {
       if (confirm('Оновити список перерв згідно з обраним графіком?')) {
          setBreaks(JSON.parse(JSON.stringify(newSchedule.breaks)));
       }
    }
  };

  const handleAddBreak = () => {
    setBreaks([...breaks, { id: `b_${Date.now()}`, name: 'Нова перерва', durationMinutes: 15, isPaid: false }]);
  };

  const handleRemoveBreak = (index: number) => {
    const newBreaks = [...breaks];
    newBreaks.splice(index, 1);
    setBreaks(newBreaks);
  };

  const handleAddExpense = () => {
    if (!newExpName) return;
    setAdditionalExpenses([
      ...additionalExpenses, 
      { 
        id: `ae_${Date.now()}`, 
        name: newExpName, 
        extraDistance: Number(newExpDist), 
        amount: Number(newExpAmount) 
      }
    ]);
    setNewExpName('');
    setNewExpDist('');
    setNewExpAmount('');
  };

  const handleRemoveExpense = (id: string) => {
    setAdditionalExpenses(additionalExpenses.filter(e => e.id !== id));
  };

  const handleSave = async () => {
    if (!user) return;

    const record: AttendanceRecord = {
      id: existingId || `rec_${Date.now()}`,
      userId,
      date,
      type: activeTab,
      verifiedByAdmin: isAdmin ? verifiedByAdmin : false,
      overtimeApproved: isAdmin ? overtimeApproved : (overtimeApproved && verifiedByAdmin),
      workScheduleId: activeTab === 'work' ? selectedScheduleId : undefined
    };
    
    if (!isAdmin) {
       record.verifiedByAdmin = false; 
       record.overtimeApproved = false; 
    } else {
       record.overtimeApproved = overtimeApproved;
    }

    if (activeTab === 'work') {
      record.transportMode = transportMode;
      if (transportMode === 'car') {
        record.distanceTo = distanceTo;
        record.distanceFrom = distanceFrom;
        record.fuelConsumption = fuelConsumption;
        record.fuelPrice = fuelPrice;
      } else {
        record.busPriceTo = busPriceTo;
        record.busPriceFrom = busPriceFrom;
      }
      record.startTime = startTime;
      record.endTime = endTime;
      record.breaks = breaks;
      record.additionalExpenses = additionalExpenses;
    } else {
      record.absenceType = absenceType;
      record.comment = comment;
    }

    try {
      await API.saveAttendanceRecord(record, user, schedules);
      onSave();
      onClose();
    } catch (e) {
      alert("Error saving record");
    }
  };

  const handleDelete = () => {
    if (!existingId) return;
    setDeleteConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!existingId) return;
    try {
        await API.deleteAttendanceRecord(existingId);
        setDeleteConfirmOpen(false);
        onSave(); // Refresh parent data
        onClose();
    } catch (e) {
        alert("Помилка видалення запису");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-[95%] md:w-full md:max-w-md flex flex-col my-auto max-h-[90vh] overflow-hidden m-4 md:m-0">
        
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {new Date(date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}
            </h3>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span className="font-medium">{user?.firstName} {user?.lastName}</span>
              {isAdmin && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase text-[10px]">Admin</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-600 shadow-sm border border-gray-100 hover:scale-105 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100/50 p-1 mx-6 mt-4 rounded-xl shrink-0">
          <button 
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'work' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('work')}
          >
            Записати роботу
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'absence' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('absence')}
          >
            Відсутність
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'work' ? (
             <div className="space-y-6 animate-fade-in">
               {/* Time & Schedule */}
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Початок</label>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2.5 border rounded-lg bg-gray-50"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Кінець</label>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2.5 border rounded-lg bg-gray-50"/>
                  </div>
               </div>
               
               {/* Transport Mode */}
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Транспорт</label>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                     <button onClick={() => setTransportMode('car')} className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center ${transportMode === 'car' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}><Car size={14} className="mr-1"/> Авто</button>
                     <button onClick={() => setTransportMode('bus')} className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center ${transportMode === 'bus' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}><Bus size={14} className="mr-1"/> Громадський</button>
                  </div>
               </div>

               {transportMode === 'car' ? (
                 <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Км (Туди)</label><input type="number" value={distanceTo} onChange={e => setDistanceTo(Number(e.target.value))} className="w-full p-2 border rounded font-bold"/></div>
                       <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Км (Назад)</label><input type="number" value={distanceFrom} onChange={e => setDistanceFrom(Number(e.target.value))} className="w-full p-2 border rounded font-bold"/></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Витрата (л/100)</label><input type="number" value={fuelConsumption} onChange={e => setFuelConsumption(Number(e.target.value))} className="w-full p-2 border rounded"/></div>
                       <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ціна (грн/л)</label><input type="number" value={fuelPrice} onChange={e => setFuelPrice(Number(e.target.value))} className="w-full p-2 border rounded"/></div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Квиток (Туди)</label><input type="number" value={busPriceTo} onChange={e => setBusPriceTo(Number(e.target.value))} className="w-full p-2 border rounded font-bold"/></div>
                       <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Квиток (Назад)</label><input type="number" value={busPriceFrom} onChange={e => setBusPriceFrom(Number(e.target.value))} className="w-full p-2 border rounded font-bold"/></div>
                    </div>
                 </div>
               )}

               {/* Breaks */}
               <div>
                  <div className="flex justify-between items-center mb-2">
                     <label className="block text-xs font-bold text-gray-500 uppercase">Перерви</label>
                     <button onClick={handleAddBreak} className="text-xs text-blue-600 font-bold hover:underline flex items-center"><Plus size={12} className="mr-1"/> Додати</button>
                  </div>
                  <div className="space-y-2">
                     {breaks.map((b, i) => (
                        <div key={b.id || i} className="flex gap-2 items-center">
                           <input value={b.name} onChange={e => {const n = [...breaks]; n[i].name = e.target.value; setBreaks(n)}} className="flex-1 p-2 border rounded text-sm"/>
                           <input type="number" value={b.durationMinutes} onChange={e => {const n = [...breaks]; n[i].durationMinutes = Number(e.target.value); setBreaks(n)}} className="w-16 p-2 border rounded text-sm text-center"/>
                           <span className="text-xs text-gray-400">хв</span>
                           <button onClick={() => handleRemoveBreak(i)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Additional Expenses */}
               <div>
                  <div className="flex justify-between items-center mb-2">
                     <label className="block text-xs font-bold text-gray-500 uppercase">Додаткові витрати</label>
                  </div>
                  <div className="space-y-2 mb-2">
                     {additionalExpenses.map(exp => (
                        <div key={exp.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100 text-sm">
                           <span>{exp.name}</span>
                           <div className="flex items-center gap-3">
                              {exp.extraDistance > 0 && <span className="text-xs text-gray-500">{exp.extraDistance} км</span>}
                              <span className="font-bold">{exp.amount} ₴</span>
                              <button onClick={() => handleRemoveExpense(exp.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                           </div>
                        </div>
                     ))}
                  </div>
                  <div className="flex gap-2 items-end bg-gray-50 p-2 rounded border border-gray-200">
                     <div className="flex-1"><label className="text-[9px] uppercase text-gray-400 font-bold">Назва</label><input value={newExpName} onChange={e => setNewExpName(e.target.value)} className="w-full p-1 border rounded text-sm"/></div>
                     <div className="w-16"><label className="text-[9px] uppercase text-gray-400 font-bold">Сума</label><input type="number" value={newExpAmount} onChange={e => setNewExpAmount(e.target.value)} className="w-full p-1 border rounded text-sm"/></div>
                     <button onClick={handleAddExpense} disabled={!newExpName} className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700 disabled:opacity-50"><Plus size={16}/></button>
                  </div>
               </div>

               {/* Admin Controls */}
               {isAdmin && (
                  <div className="border-t pt-4 mt-4">
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Адміністрування</label>
                     <div className="flex gap-4">
                        <label className="flex items-center space-x-2 cursor-pointer bg-green-50 px-3 py-2 rounded border border-green-100">
                           <input type="checkbox" checked={verifiedByAdmin} onChange={e => setVerifiedByAdmin(e.target.checked)} className="text-green-600 focus:ring-green-500 rounded"/>
                           <span className="text-sm font-medium text-green-800">Перевірено</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer bg-yellow-50 px-3 py-2 rounded border border-yellow-100">
                           <input type="checkbox" checked={overtimeApproved} onChange={e => setOvertimeApproved(e.target.checked)} className="text-yellow-600 focus:ring-yellow-500 rounded"/>
                           <span className="text-sm font-medium text-yellow-800">Овертайм ОК</span>
                        </label>
                     </div>
                  </div>
               )}
             </div>
          ) : (
             <div className="space-y-6 animate-fade-in">
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Тип відсутності</label>
                   <select value={absenceType} onChange={e => setAbsenceType(e.target.value as any)} className="w-full p-3 border rounded-lg bg-white">
                      <option value="sick">Лікарняний</option>
                      <option value="vacation">Відпустка</option>
                      <option value="unpaid">За свій рахунок</option>
                      <option value="truancy">Прогул</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Коментар</label>
                   <textarea value={comment} onChange={e => setComment(e.target.value)} className="w-full p-3 border rounded-lg h-32 resize-none" placeholder="Причина відсутності..."/>
                </div>
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center shrink-0">
           {existingId ? (
              <button onClick={handleDelete} className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 transition-colors" title="Видалити запис"><Trash2 size={20}/></button>
           ) : (<div></div>)}
           <button onClick={handleSave} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-colors flex items-center">
              <Save size={18} className="mr-2"/> Зберегти
           </button>
        </div>
      </div>

      {deleteConfirmOpen && (
        <DeleteConfirmModal 
            isOpen={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            onConfirm={performDelete}
            title="Видалити запис?"
            message="Ви впевнені? Ця дія незворотня."
        />
      )}
    </div>
  );
};
