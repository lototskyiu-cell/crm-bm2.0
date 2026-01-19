import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceRecord, AbsenceType, TransportMode, Break, User, WorkSchedule, AdditionalExpense } from '../types';
import { API } from '../services/api';
import { DEFAULT_BREAKS } from '../services/mockStore'; 
import { PayrollService } from '../services/payroll';
import { AttendanceLogic } from '../services/attendanceLogic';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { X, Save, Clock, Bus, Car, Plus, Trash2, Calendar, Settings, ChevronDown, AlertTriangle } from 'lucide-react';

interface AttendanceModalProps {
  date: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isAdmin?: boolean;
}

// Хелпер для форматування годин
const formatTime = (val: number) => {
  if (!val || isNaN(val)) return '0г';
  const hrs = Math.floor(val);
  const mins = Math.round((val - hrs) * 60);
  if (mins === 0) return `${hrs}г`;
  if (hrs === 0) return `${mins}хв`;
  return `${hrs}г ${mins}хв`;
};

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

    // --- 1. BUSINESS LOGIC VALIDATION ---
    let detectedType = 'ok';
    let violationFlag = false;

    if (activeTab === 'absence') {
        detectedType = absenceType;
        violationFlag = true; // Any absence is noteworthy
    } else {
        // Compare Plan vs Fact
        const schedule = schedules.find(s => s.id === selectedScheduleId);
        if (schedule && schedule.startTime && schedule.endTime && startTime && endTime) {
            const timeToMin = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            const planStart = timeToMin(schedule.startTime);
            const planEnd = timeToMin(schedule.endTime);
            const factStart = timeToMin(startTime);
            const factEnd = timeToMin(endTime);

            const lateMins = factStart - planStart;
            const earlyLeaveMins = planEnd - factEnd;
            // Abs diff of durations
            const planDuration = planEnd - planStart;
            const factDuration = factEnd - factStart;
            const totalDiff = Math.abs(planDuration - factDuration);

            if (totalDiff > 180) { // > 3 hours difference
                detectedType = 'major_deviation';
                violationFlag = true;
            } else if (lateMins > 30) {
                detectedType = 'late';
                violationFlag = true;
            } else if (earlyLeaveMins > 15) {
                detectedType = 'early_leave';
                violationFlag = true;
            }
        }
    }

    // --- 2. RECORD CONSTRUCTION ---
    const record: any = { // Using any to inject dynamic flags
      id: existingId || `rec_${Date.now()}`,
      userId,
      date,
      type: activeTab,
      verifiedByAdmin: isAdmin ? verifiedByAdmin : false, // Worker edit resets verification usually
      overtimeApproved: isAdmin ? overtimeApproved : (overtimeApproved && verifiedByAdmin),
      workScheduleId: activeTab === 'work' ? selectedScheduleId : undefined,
      requiresAdminApproval: violationFlag // Flag for admin dashboard
    };
    
    // Explicit reset if not admin
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

    // --- 3. NOTIFICATIONS (UKRAINIAN) ---
    const statusTextMap: Record<string, string> = {
      'sick': 'Лікарняне',
      'vacation': 'Відпустка',
      'unpaid': 'За власний рахунок',
      'truancy': 'Прогул',
      'late': 'Запізнення',
      'early_leave': 'Ранній вихід',
      'major_deviation': 'Невідповідність графіку',
      'ok': 'Зміна закрита'
    };

    // Only send notification if violation exists AND user is NOT admin (admins don't notify themselves)
    if (violationFlag && !isAdmin) {
        const workerName = `${user.firstName} ${user.lastName}`;
        const statusText = statusTextMap[detectedType] || 'Інше';
        const title = activeTab === 'absence' ? 'Відсутність працівника' : 'Увага: Порушення графіку';
        
        try {
            await API.sendNotification(
                'admin', // Target global admin group
                `Працівник ${workerName}. Статус: ${statusText}. ${comment ? '('+comment+')' : ''}`,
                'alert',
                record.id,
                'admin',
                title
            );
        } catch (err) {
            console.error("Failed to send notification", err);
        }
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

  // Live Stats Calculation
  const liveStats = useMemo(() => {
    if (!user) return { hours: 0, salary: 0, expenses: 0, overtime: 0 };
    
    // Construct temp record to use PayrollService calculation
    const temp: AttendanceRecord = {
        id: 'temp',
        userId,
        date,
        type: activeTab,
        startTime,
        endTime,
        breaks,
        transportMode,
        distanceTo,
        distanceFrom,
        fuelConsumption,
        fuelPrice,
        busPriceTo,
        busPriceFrom,
        additionalExpenses,
        workScheduleId: selectedScheduleId,
        overtimeApproved: overtimeApproved // IMPORTANT for salary calc
    };

    const hours = PayrollService.calculateWorkDuration(temp);
    const { overtimeHours } = PayrollService.calculateOvertime(temp, user, schedules);
    const salary = PayrollService.calculateDailySalary(temp, user, schedules);
    const transport = PayrollService.calculateTransportCost(temp);
    const extra = PayrollService.calculateAdditionalExpensesCost(temp);

    return { hours, salary, expenses: transport + extra, overtime: overtimeHours };
  }, [user, activeTab, startTime, endTime, breaks, transportMode, distanceTo, distanceFrom, fuelConsumption, fuelPrice, busPriceTo, busPriceFrom, additionalExpenses, selectedScheduleId, overtimeApproved, schedules]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-[95%] md:w-full md:max-w-md flex flex-col my-auto max-h-[95vh] overflow-hidden m-4 md:m-0">
        
        {/* Header Title Bar */}
        <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {new Date(date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}
            </h3>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span className="font-medium">{user?.firstName} {user?.lastName}</span>
              {isAdmin && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase text-[10px]">Admin</span>}
            </div>
          </div>
          <div className="flex gap-2">
             {existingId && <button onClick={handleDelete} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={20}/></button>}
             <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 shadow-sm hover:scale-105 transition-all">
                <X size={20} />
             </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
            
            {/* TABS SWITCHER */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                <button 
                    onClick={() => setActiveTab('work')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wide flex items-center justify-center ${activeTab === 'work' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Робота
                </button>
                <button 
                    onClick={() => setActiveTab('absence')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wide flex items-center justify-center ${activeTab === 'absence' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Відсутність
                </button>
            </div>

            {/* 1. HEADER STATS (Grid 4 Uniform Blocks) */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Block 1: Work */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="text-xs text-gray-500 font-bold uppercase mb-1">РОБОТА</div>
                    <div className="text-2xl font-bold text-gray-800">
                        {activeTab === 'work' ? formatTime(liveStats.hours) : '0г'}
                    </div>
                </div>

                {/* Block 2: Overtime / Absence */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="text-xs text-gray-500 font-bold uppercase mb-1">
                        {activeTab === 'work' ? 'ПОНАДНОРМОВІ' : 'ВІДСУТНІСТЬ'}
                    </div>
                    <div className={`text-2xl font-bold ${activeTab === 'work' && liveStats.overtime > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {activeTab === 'work' ? (
                            liveStats.overtime > 0 ? `+${formatTime(liveStats.overtime)}` : '0г'
                        ) : (
                            '0г' 
                        )}
                    </div>
                </div>

                {/* Block 3: Salary */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="text-xs text-green-600 font-bold uppercase mb-1">ЗАРПЛАТА</div>
                    <div className="text-3xl font-bold text-green-600">{liveStats.salary} ₴</div>
                </div>

                {/* Block 4: Expenses */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="text-xs text-gray-500 font-bold uppercase mb-1">КОМПЕНСАЦІЯ</div>
                    <div className="text-3xl font-bold text-gray-800">{liveStats.expenses} ₴</div>
                </div>
            </div>

            {/* OVERTIME APPROVAL CHECKBOX (ADMIN ONLY) */}
            {activeTab === 'work' && liveStats.overtime > 0 && isAdmin && (
                <div className="flex items-center mb-6 bg-orange-50 p-3 rounded-xl border border-orange-200 animate-fade-in">
                    <input
                        type="checkbox"
                        id="approveOvertime"
                        checked={overtimeApproved}
                        onChange={(e) => setOvertimeApproved(e.target.checked)}
                        className="w-5 h-5 text-orange-600 rounded border-orange-300 focus:ring-orange-500 cursor-pointer"
                    />
                    <label htmlFor="approveOvertime" className="ml-3 text-sm font-bold text-orange-800 cursor-pointer select-none">
                        Погодити оплату понаднормових (+{formatTime(liveStats.overtime)})
                    </label>
                </div>
            )}

            {/* 2. SCHEDULE BLOCK */}
            <div className="bg-blue-50 p-4 rounded-lg mb-6 flex justify-between items-center border border-blue-100">
                <div className="flex items-center">
                    <div className="bg-white p-2 rounded-lg text-blue-600 mr-3 shadow-sm">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">ГРАФІК РОБОТИ</div>
                        <div className="relative">
                            <select 
                                value={selectedScheduleId}
                                onChange={(e) => handleScheduleChange(e.target.value)}
                                disabled={!isAdmin}
                                className={`appearance-none bg-transparent font-bold text-blue-900 text-lg outline-none pr-4 w-full ${!isAdmin ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                            >
                                {schedules.map(s => <option key={s.id} value={s.id}>{s.name} ({s.shiftDurationHours}г)</option>)}
                                {!schedules.length && <option value="">Без графіку</option>}
                            </select>
                            <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-900 pointer-events-none" />
                        </div>
                    </div>
                </div>
                <button className="text-blue-400 hover:text-blue-600 transition-colors">
                    <Settings size={20} />
                </button>
            </div>

            {/* 3. INPUTS (CONDITIONAL) */}
            {activeTab === 'work' ? (
                <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">ПОЧАТОК</label>
                            <input 
                                type="time" 
                                value={startTime} 
                                onChange={e => setStartTime(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">КІНЕЦЬ</label>
                            <input 
                                type="time" 
                                value={endTime} 
                                onChange={e => setEndTime(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* 4. TRANSPORT */}
                    <div className="mb-6">
                        <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                            <button 
                                onClick={() => setTransportMode('car')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center ${transportMode === 'car' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500'}`}
                            >
                                <Car size={16} className="mr-2"/> Авто
                            </button>
                            <button 
                                onClick={() => setTransportMode('bus')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center ${transportMode === 'bus' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500'}`}
                            >
                                <Bus size={16} className="mr-2"/> Автобус
                            </button>
                        </div>
                        
                        {transportMode === 'car' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Км (Всього)</label>
                                    <div className="flex gap-2">
                                        <input type="number" placeholder="Туди" value={distanceTo} onChange={e => setDistanceTo(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm bg-gray-50"/>
                                        <input type="number" placeholder="Назад" value={distanceFrom} onChange={e => setDistanceFrom(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm bg-gray-50"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Паливо (Л / Ціна)</label>
                                    <div className="flex gap-2">
                                        <input type="number" placeholder="Л" value={fuelConsumption} onChange={e => setFuelConsumption(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm bg-gray-50"/>
                                        <input type="number" placeholder="Грн" value={fuelPrice} onChange={e => setFuelPrice(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm bg-gray-50"/>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Квиток Туди</label><input type="number" value={busPriceTo} onChange={e => setBusPriceTo(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm bg-gray-50"/></div>
                                <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Квиток Назад</label><input type="number" value={busPriceFrom} onChange={e => setBusPriceFrom(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm bg-gray-50"/></div>
                            </div>
                        )}
                    </div>

                    {/* 5. BREAKS UI */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">ПЕРЕРВИ</h4>
                            <button onClick={handleAddBreak} className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors"><Plus size={14}/></button>
                        </div>
                        <div className="space-y-2">
                            {breaks.map((b, i) => (
                                <div key={i} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-xl shadow-sm">
                                    <div className="flex items-center">
                                        <input 
                                            value={b.name} 
                                            onChange={e => {const n = [...breaks]; n[i].name = e.target.value; setBreaks(n)}}
                                            className="font-medium text-gray-900 text-sm bg-transparent outline-none w-32"
                                        />
                                        {/* Badge Logic: isPaid green, !isPaid red */}
                                        {b.isPaid ? (
                                            <span className="bg-green-100 text-green-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">PAID</span>
                                        ) : (
                                            <span className="bg-red-100 text-red-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">UNPAID</span>
                                        )}
                                    </div>
                                    <div className="flex items-center">
                                        <input 
                                            type="number" 
                                            value={b.durationMinutes} 
                                            onChange={e => {const n = [...breaks]; n[i].durationMinutes = Number(e.target.value); setBreaks(n)}}
                                            className="w-12 text-right font-bold text-gray-700 text-sm bg-transparent outline-none mr-1"
                                        />
                                        <span className="text-xs text-gray-400 mr-3">хв</span>
                                        <button onClick={() => handleRemoveBreak(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Additional Expenses */}
                    {additionalExpenses.length > 0 && (
                        <div className="mb-6">
                            <div className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">ДОДАТКОВІ ВИТРАТИ</div>
                            {additionalExpenses.map(exp => (
                                <div key={exp.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg mb-1 border border-gray-100">
                                    <span className="text-sm font-medium text-gray-700">{exp.name}</span>
                                    <div className="flex items-center">
                                        <span className="font-bold text-gray-900 mr-3">{exp.amount} ₴</span>
                                        <button onClick={() => handleRemoveExpense(exp.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="flex gap-2 items-center">
                        <input placeholder="Нова витрата" value={newExpName} onChange={e => setNewExpName(e.target.value)} className="flex-1 p-2 border rounded-lg text-sm bg-gray-50"/>
                        <input type="number" placeholder="Сума" value={newExpAmount} onChange={e => setNewExpAmount(e.target.value)} className="w-20 p-2 border rounded-lg text-sm bg-gray-50"/>
                        <button onClick={handleAddExpense} className="p-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200"><Plus size={16}/></button>
                    </div>
                </>
            ) : (
                <div className="space-y-4">
                   <div>
                       <label className="block text-sm font-bold text-gray-700 mb-2">Тип відсутності</label>
                       <select value={absenceType} onChange={e => setAbsenceType(e.target.value as any)} className="w-full p-3 border rounded-xl bg-white font-bold text-gray-800">
                           <option value="sick">Лікарняний</option>
                           <option value="vacation">Відпустка</option>
                           <option value="unpaid">За свій рахунок</option>
                           <option value="truancy">Прогул</option>
                       </select>
                   </div>
                   <div>
                       <label className="block text-sm font-bold text-gray-700 mb-2">Коментар</label>
                       <textarea value={comment} onChange={e => setComment(e.target.value)} className="w-full p-3 border rounded-xl h-32 resize-none focus:outline-none focus:border-blue-500" placeholder="Причина відсутності..."/>
                   </div>
                </div>
            )}
        </div>

        {/* 6. FOOTER */}
        <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl">
            {isAdmin && (
                <label className="flex items-center mb-4 cursor-pointer">
                    <input type="checkbox" checked={verifiedByAdmin} onChange={e => setVerifiedByAdmin(e.target.checked)} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"/>
                    <span className="ml-2 text-sm font-medium text-gray-700">Запис перевірено адміністратором</span>
                </label>
            )}
            <button onClick={handleSave} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-colors shadow-lg flex items-center justify-center">
                <Save size={20} className="mr-2"/> Зберегти
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