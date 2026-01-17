
import React, { useState, useEffect } from 'react';
import { AttendanceRecord, AbsenceType, TransportMode, Break, User, WorkSchedule, AdditionalExpense } from '../types';
import { API } from '../services/api';
import { DEFAULT_BREAKS } from '../services/mockStore'; 
import { PayrollService } from '../services/payroll';
import { AttendanceLogic } from '../services/attendanceLogic'; // IMPORT LOGIC
import { DeleteConfirmModal } from './DeleteConfirmModal'; // Import Confirmation Modal
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

      // --- LOGIC: DEFAULTS vs OVERRIDES ---
      // We use the helper to determine effective values
      // If record exists, helper uses it. If not, helper uses user defaults.
      const effectiveData = u ? AttendanceLogic.getEffectiveDailyData(u, record) : { transportMode: 'car', distanceTo: 0, distanceFrom: 0, fuelConsumption: 0, fuelPrice: 0, busPriceTo: 0, busPriceFrom: 0 };
      
      // Standard Fields (Not part of defaults logic)
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

      // Apply Effective Data (Merged) to UI State
      // Note: We cast effectiveData keys because helper guarantees they exist
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

  const activeSchedule = schedules.find(s => s.id === selectedScheduleId);

  // Live Calculations use state values (which are now effective values)
  const tempRecord: AttendanceRecord = {
    id: 'temp', userId, date, type: 'work',
    transportMode, distanceTo, distanceFrom, fuelConsumption, fuelPrice,
    busPriceTo, busPriceFrom, startTime, endTime, breaks,
    additionalExpenses,
    verifiedByAdmin, overtimeApproved,
    workScheduleId: selectedScheduleId
  };

  const workDuration = PayrollService.calculateWorkDuration(tempRecord);
  const transportCost = PayrollService.calculateTransportCost(tempRecord); 
  const additionalExpensesCost = PayrollService.calculateAdditionalExpensesCost(tempRecord);
  const dailySalary = user ? PayrollService.calculateDailySalary(tempRecord, user, schedules) : 0;
  const { overtimeHours } = user ? PayrollService.calculateOvertime(tempRecord, user, schedules) : { overtimeHours: 0 };
  
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

    // We save the CURRENT state values. 
    // This effectively "snapshots" the defaults + overrides into the record for this specific day.
    // This protects historical data accuracy.
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col my-auto max-h-[90vh] overflow-hidden">
        
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
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'absence' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('absence')}
          >
            Відсутність
          </button>
        </div>

        {/* Content Scroll Area */}
        <div className="p-6 overflow-y-auto min-h-0 flex-1">
          {activeTab === 'work' && (
            <div className="space-y-6">
              
              {/* Calculation Preview (Read-Only) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <div className="text-[10px] uppercase font-bold text-blue-400 mb-1">Години</div>
                  <div className="flex items-end justify-between">
                    <span className="text-xl font-bold text-blue-900">{workDuration}</span>
                    <span className="text-xs font-medium text-blue-600 mb-1">год</span>
                  </div>
                </div>
                <div className={`p-3 rounded-xl border ${overtimeHours > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                   <div className={`text-[10px] uppercase font-bold mb-1 ${overtimeHours > 0 ? 'text-green-600' : 'text-gray-400'}`}>Понаднормові</div>
                   <div className="flex items-end justify-between">
                    <span className={`text-xl font-bold ${overtimeHours > 0 ? 'text-green-800' : 'text-gray-300'}`}>+{overtimeHours}</span>
                    <span className={`text-xs font-medium mb-1 ${overtimeHours > 0 ? 'text-green-700' : 'text-gray-300'}`}>год</span>
                  </div>
                </div>
                <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                   <div className="text-[10px] uppercase font-bold text-green-600 mb-1">Зарплата</div>
                   <div className="flex items-end justify-between">
                    <span className="text-xl font-bold text-green-900">{dailySalary}</span>
                    <span className="text-xs font-medium text-green-700 mb-1">грн</span>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                   <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Компенсація + Інше</div>
                   <div className="flex items-end justify-between">
                    <span className="text-xl font-bold text-gray-700">{transportCost + additionalExpensesCost}</span>
                    <span className="text-xs font-medium text-gray-500 mb-1">грн</span>
                  </div>
                </div>
              </div>

              {/* Schedule Selection - DROPDOWN */}
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-indigo-900 uppercase flex items-center">
                    <Calendar size={12} className="mr-1.5 text-indigo-500"/> Графік роботи
                  </label>
                  {activeSchedule && (
                     <div className="flex items-center space-x-2">
                        {activeSchedule.type === 'night' ? <Moon size={12} className="text-indigo-400"/> : <Sun size={12} className="text-orange-400"/>}
                        <span className="text-[10px] font-bold text-indigo-400 bg-white px-1.5 py-0.5 rounded border border-indigo-100">
                           {activeSchedule.shiftDurationHours}г
                        </span>
                     </div>
                  )}
                </div>
                
                <div className="relative group">
                  <select 
                    value={selectedScheduleId} 
                    onChange={(e) => handleScheduleChange(e.target.value)}
                    className="w-full p-3 bg-white border border-indigo-200 rounded-lg text-sm font-medium text-gray-800 focus:ring-2 focus:ring-indigo-300 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors"
                  >
                    <option value="">-- Оберіть графік --</option>
                    {schedules.map(sch => (
                       <option key={sch.id} value={sch.id}>{sch.name} ({sch.shiftDurationHours}г)</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                     <Settings size={14} />
                  </div>
                </div>
              </div>

              {/* Transport Block */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-400 uppercase block">Транспорт</label>
                  {/* Indicator for Defaults Usage */}
                  <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 rounded uppercase font-bold">
                    {existingId ? 'Редагування' : 'Авто-Дефолти'}
                  </span>
                </div>
                
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setTransportMode('car')} className={`flex-1 py-2 flex items-center justify-center rounded-lg border text-sm font-medium transition-all ${transportMode === 'car' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200'}`}>
                    <Car size={16} className="mr-2"/> Авто
                  </button>
                  <button onClick={() => setTransportMode('bus')} className={`flex-1 py-2 flex items-center justify-center rounded-lg border text-sm font-medium transition-all ${transportMode === 'bus' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200'}`}>
                    <Bus size={16} className="mr-2"/> Автобус
                  </button>
                </div>
                
                {transportMode === 'car' ? (
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Км Туди</span>
                        <input type="number" value={distanceTo} onChange={e => setDistanceTo(Number(e.target.value))} className="w-full p-2 text-sm border rounded bg-gray-50 font-bold"/>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Км Назад</span>
                        <input type="number" value={distanceFrom} onChange={e => setDistanceFrom(Number(e.target.value))} className="w-full p-2 text-sm border rounded bg-gray-50 font-bold"/>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Витрата (л)</span>
                        <input type="number" value={fuelConsumption} onChange={e => setFuelConsumption(Number(e.target.value))} className="w-full p-2 text-sm border rounded bg-gray-50 font-bold"/>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Ціна (грн)</span>
                        <input type="number" value={fuelPrice} onChange={e => setFuelPrice(Number(e.target.value))} className="w-full p-2 text-sm border rounded bg-gray-50 font-bold"/>
                      </div>
                   </div>
                ) : (
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Квиток Туди</span>
                        <input type="number" value={busPriceTo} onChange={e => setBusPriceTo(Number(e.target.value))} className="w-full p-2 text-sm border rounded bg-gray-50 font-bold"/>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Квиток Назад</span>
                        <input type="number" value={busPriceFrom} onChange={e => setBusPriceFrom(Number(e.target.value))} className="w-full p-2 text-sm border rounded bg-gray-50 font-bold"/>
                      </div>
                   </div>
                )}
              </div>

              {/* --- NEW SECTION: ADDITIONAL EXPENSES --- */}
              <div className="border border-blue-100 rounded-xl overflow-hidden">
                <div className="bg-blue-50 px-3 py-2 border-b border-blue-100 flex items-center">
                  <ShoppingBag size={14} className="text-blue-600 mr-2"/>
                  <span className="text-xs font-bold text-blue-800 uppercase">Додаткові витрати (за дорученням)</span>
                </div>
                <div className="p-3 bg-white space-y-3">
                  {/* List */}
                  {additionalExpenses.map(exp => (
                    <div key={exp.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded border border-gray-100">
                      <div className="flex-1">
                        <div className="font-bold text-gray-800">{exp.name}</div>
                        <div className="text-[10px] text-gray-500 flex gap-2">
                           {exp.extraDistance > 0 && <span className="bg-white border px-1 rounded">+{exp.extraDistance}км</span>}
                           {exp.amount > 0 && <span className="text-blue-600 font-bold">{exp.amount} грн</span>}
                        </div>
                      </div>
                      <button onClick={() => handleRemoveExpense(exp.id)} className="text-gray-400 hover:text-red-500 p-1">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ))}

                  {/* Add Row */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold block mb-1">Назва / Комент</label>
                      <input 
                        type="text" 
                        value={newExpName} 
                        onChange={e => setNewExpName(e.target.value)}
                        className="w-full p-2 text-sm border rounded bg-gray-50"
                        placeholder="Напр: Епіцентр"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold block mb-1">+Км</label>
                      <input 
                        type="number" 
                        value={newExpDist} 
                        onChange={e => setNewExpDist(e.target.value)}
                        className="w-full p-2 text-sm border rounded bg-gray-50"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold block mb-1">Сума</label>
                      <input 
                        type="number" 
                        value={newExpAmount} 
                        onChange={e => setNewExpAmount(e.target.value)}
                        className="w-full p-2 text-sm border rounded bg-gray-50"
                        placeholder="0"
                      />
                    </div>
                    <button 
                      onClick={handleAddExpense}
                      disabled={!newExpName}
                      className="p-2 bg-slate-900 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={18}/>
                    </button>
                  </div>
                </div>
              </div>

              {/* Work Time & Breaks */}
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Початок</label>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2.5 border rounded-lg text-lg font-mono font-bold text-gray-800 bg-gray-50"/>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Кінець</label>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2.5 border rounded-lg text-lg font-mono font-bold text-gray-800 bg-gray-50"/>
                  </div>
                </div>

                <div className="bg-white border rounded-xl overflow-hidden">
                   <div className="bg-gray-50 px-3 py-2 border-b flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500 uppercase">Перерви</span>
                      {isAdmin && <button onClick={handleAddBreak} className="text-blue-600 hover:text-blue-700"><Plus size={16}/></button>}
                   </div>
                   <div className="divide-y divide-gray-100">
                      {breaks.map((brk, idx) => (
                        <div key={idx} className="p-2 flex items-center justify-between group">
                           <div className="flex items-center flex-1">
                              {/* Read Only Name unless admin */}
                              <span className="text-sm font-medium text-gray-700 w-24 truncate">{brk.name}</span>
                              
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ml-2 ${brk.isPaid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {brk.isPaid ? 'Paid' : 'Unpaid'}
                              </span>
                           </div>
                           <div className="flex items-center space-x-2">
                              {/* Read Only Duration unless admin */}
                              <span className="text-sm font-mono text-gray-600 font-bold">{brk.durationMinutes}</span>
                              <span className="text-xs text-gray-400">хв</span>
                              
                              {isAdmin && (
                                <button onClick={() => handleRemoveBreak(idx)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                              )}
                           </div>
                        </div>
                      ))}
                      {breaks.length === 0 && <div className="p-3 text-center text-xs text-gray-400 italic">Без перерв</div>}
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'absence' && (
             <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                   <label className="text-xs font-bold text-red-400 uppercase mb-2 block">Тип відсутності</label>
                   <select 
                      value={absenceType} 
                      onChange={(e) => setAbsenceType(e.target.value as AbsenceType)}
                      className="w-full p-3 bg-white border border-red-200 rounded-lg text-gray-800 font-medium focus:ring-2 focus:ring-red-200 outline-none"
                    >
                      <option value="sick">🏥 Лікарняний</option>
                      <option value="vacation">🏖 Відпустка</option>
                      <option value="unpaid">💸 За свій рахунок</option>
                      <option value="truancy">🚫 Прогул</option>
                    </select>
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Коментар</label>
                   <textarea 
                     value={comment} 
                     onChange={(e) => setComment(e.target.value)}
                     className="w-full p-4 border rounded-xl h-32 text-sm focus:ring-2 focus:ring-gray-200 outline-none resize-none"
                     placeholder="Причина..."
                   />
                </div>
             </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 p-4 border-t border-gray-100 shrink-0 space-y-3">
          {/* Overtime Approval Block */}
          {isAdmin && activeTab === 'work' && overtimeHours > 0 && (
             <div className={`p-3 rounded-lg border flex items-center justify-between ${overtimeApproved ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-center text-xs font-bold">
                   {overtimeApproved ? <CheckCircle size={14} className="text-green-600 mr-2"/> : <AlertTriangle size={14} className="text-yellow-600 mr-2"/>}
                   <span className={overtimeApproved ? 'text-green-800' : 'text-yellow-800'}>
                      {overtimeApproved ? 'Понаднормові погоджено' : 'Потрібне погодження!'}
                   </span>
                </div>
                <button 
                  onClick={() => setOvertimeApproved(!overtimeApproved)}
                  className={`text-xs px-2 py-1 rounded border shadow-sm font-bold bg-white transition-all ${overtimeApproved ? 'text-red-500 border-red-100 hover:bg-red-50' : 'text-green-600 border-green-100 hover:bg-green-50'}`}
                >
                  {overtimeApproved ? 'Відмінити' : 'Погодити'}
                </button>
             </div>
          )}

          {isAdmin && activeTab === 'work' && (
             <label className="flex items-center justify-center cursor-pointer pb-2">
                <input type="checkbox" checked={verifiedByAdmin} onChange={e => setVerifiedByAdmin(e.target.checked)} className="w-4 h-4 text-slate-900 rounded border-gray-300 focus:ring-slate-500"/>
                <span className="ml-2 text-sm font-bold text-gray-700">Запис перевірено адміністратором</span>
             </label>
          )}

          <div className="flex gap-2">
            {existingId && (
              <button 
                onClick={handleDelete}
                className="px-4 py-3.5 rounded-xl font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-all flex items-center justify-center"
              >
                <Trash2 size={20}/>
              </button>
            )}
            <button onClick={handleSave} className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center">
               <Save size={18} className="mr-2"/>
               Зберегти
            </button>
          </div>
        </div>

      </div>

      <DeleteConfirmModal 
        isOpen={deleteConfirmOpen} 
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={performDelete}
        title="Видалити запис?"
        message="Ви впевнені? Цю дію не можна скасувати. Це вплине на розрахунок зарплати."
      />
    </div>
  );
};
