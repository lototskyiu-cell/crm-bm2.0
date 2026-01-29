import React, { useState, useEffect, useMemo } from 'react';
import { User, AttendanceRecord, WorkSchedule } from '../types';
import { API } from '../services/api';
import { PayrollService } from '../services/payroll';
import { AttendanceModal } from '../components/AttendanceModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'; 
import { uk } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader, CheckCircle, Clock, XCircle, Trash2, AlertTriangle } from 'lucide-react';

interface WorkerCalendarProps {
  currentUser: User;
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

export const WorkerCalendar: React.FC<WorkerCalendarProps> = ({ currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // ✅ 1. STRICT STATE: Default is null. No auto-selection.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mobile Check
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ✅ 2. RESET LOGIC: When month changes, clear selection.
  useEffect(() => {
    loadRecords();
    setSelectedDate(null); 
  }, [currentDate]);

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const [userRecords, schedulesData] = await Promise.all([
        API.getAttendanceRecords(currentUser.id, currentDate),
        API.getSchedules()
      ]);
      setRecords(userRecords);
      setSchedules(schedulesData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const recordsMap = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};
    records.forEach(record => {
      if (record.date) {
        map[record.date] = record; 
      }
    });
    return map;
  }, [records]);

  // --- ANALYTICS CALCULATION (UPDATED) ---
  const monthlyStats = useMemo(() => {
    return records.reduce((acc, record) => {
        if (record.type === 'work') {
            const duration = PayrollService.calculateWorkDuration(record);
            const { overtimeHours } = PayrollService.calculateOvertime(record, currentUser, schedules);
            const salary = PayrollService.calculateDailySalary(record, currentUser, schedules);
            const transport = PayrollService.calculateTransportCost(record);
            const additional = PayrollService.calculateAdditionalExpensesCost(record);

            // Total Pay includes everything: Salary (which includes approved overtime) + Transport + Additional
            acc.totalPay += (salary + transport + additional);
            acc.totalHours += duration;
            acc.overtimeMinutes += (overtimeHours * 60);
            acc.travelCost += transport;
            acc.otherExpenses += additional;
        }
        return acc;
    }, { totalPay: 0, totalHours: 0, overtimeMinutes: 0, travelCost: 0, otherExpenses: 0 });
  }, [records, currentUser, schedules]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  // Calculate empty cells for grid alignment (Monday start)
  const startDay = getDay(startOfMonth(currentDate)); // 0 (Sun) - 6 (Sat)
  // Logic: Mon(1)->0, Tue(2)->1 ... Sun(0)->6
  const emptyCells = (startDay + 6) % 7;

  const handleDateClick = (date: Date) => {
    // ✅ 3. EXACT FORMAT: Normalize to YYYY-MM-DD for clicked day
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
    setModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, record: AttendanceRecord) => {
    e.stopPropagation();
    setRecordToDelete(record);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete) {
      try {
        await API.deleteAttendanceRecord(recordToDelete.id);
        setDeleteModalOpen(false);
        setRecordToDelete(null);
        loadRecords(); // Refresh UI
      } catch (e) {
        alert("Помилка видалення запису");
      }
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader className="animate-spin text-blue-600"/></div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Мій календар</h1>
        <div className="flex items-center space-x-4 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold uppercase w-32 text-center select-none text-gray-800">
            {format(currentDate, 'LLLL yyyy', { locale: uk })}
          </span>
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {isMobile ? (
        // --- MOBILE VIEW: VERTICAL LIST ---
        <div className="flex flex-col gap-3">
           {days.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const record = recordsMap[dateKey];
              
              let statusLabel = null;
              let badge = null;

              if (record) {
                  if (record.type === 'absence') {
                      switch(record.absenceType) {
                          case 'sick': badge = <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded text-sm font-bold">Лікарняний</span>; break;
                          case 'vacation': badge = <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm font-bold">Відпустка</span>; break;
                          case 'unpaid': badge = <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm font-bold">За свій рах.</span>; break;
                          case 'truancy': badge = <span className="bg-red-100 text-red-700 px-3 py-1 rounded text-sm font-bold">Прогул</span>; break;
                          default: badge = <span className="bg-red-50 text-red-500 px-3 py-1 rounded text-sm font-bold">Відсутність</span>;
                      }
                  } else {
                      // Work Logic for Mobile
                      const duration = PayrollService.calculateWorkDuration(record);
                      const { overtimeHours } = PayrollService.calculateOvertime(record, currentUser, schedules);
                      const hasUnapprovedOvertime = record.verifiedByAdmin && overtimeHours > 0 && !record.overtimeApproved;

                      statusLabel = (
                          <div className="flex flex-col items-end">
                             <div className="flex items-center gap-1">
                                <span className="text-xl font-bold text-gray-900">
                                  {formatTime(duration)}
                                </span>
                                {hasUnapprovedOvertime && (
                                  <span className="text-yellow-500 text-sm" title="Відхилення від графіку > 30 хв">⚠️</span>
                                )}
                             </div>
                             {record.verifiedByAdmin ? (
                                <span className="text-xs text-green-600 font-bold flex items-center"><CheckCircle size={10} className="mr-1"/> Перевірено</span>
                             ) : (
                                <span className="text-xs text-gray-400">В обробці</span>
                             )}
                          </div>
                      );
                  }
              } else {
                  statusLabel = <span className="text-gray-300">-</span>;
              }

              return (
                  <div 
                    key={dateKey} 
                    onClick={() => handleDateClick(day)}
                    className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center active:scale-[0.98] transition-transform"
                  >
                     <div>
                        <div className="font-bold text-gray-800 text-lg capitalize">
                           {format(day, 'd MMMM', { locale: uk })}
                        </div>
                        <div className="text-xs text-gray-400 uppercase font-bold mt-1">
                           {format(day, 'EEEE', { locale: uk })}
                        </div>
                     </div>
                     <div className="text-right">
                        {badge || statusLabel}
                     </div>
                  </div>
              );
           })}
        </div>
      ) : (
        // --- DESKTOP VIEW: GRID ---
        <div className="grid grid-cols-7 gap-4">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => (
            <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase py-2">
                {d}
            </div>
            ))}
            
            {/* Render Empty Cells */}
            {Array.from({ length: emptyCells }).map((_, index) => (
            <div key={`empty-${index}`} className="h-32" />
            ))}

            {days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const record = recordsMap[dateKey];
            const isSelected = selectedDate === dateKey;

            // Status Styles
            let statusStyle = 'bg-white hover:border-blue-300';
            let textClass = 'text-gray-700';
            let borderClass = 'border-gray-100';
            let label = null;
            let icon = null;
            let hours = null;

            if (record) {
                if (record.type === 'absence') {
                    switch(record.absenceType) {
                        case 'sick':
                            statusStyle = 'bg-yellow-50 hover:bg-yellow-100';
                            textClass = 'text-yellow-700';
                            borderClass = 'border-yellow-200';
                            label = 'Лікарняний';
                            icon = <div className="font-bold text-lg">Л</div>;
                            break;
                        case 'vacation':
                            statusStyle = 'bg-blue-50 hover:bg-blue-100';
                            textClass = 'text-blue-700';
                            borderClass = 'border-blue-200';
                            label = 'Відпустка';
                            icon = <div className="font-bold text-lg">В</div>;
                            break;
                        case 'unpaid':
                            statusStyle = 'bg-blue-50 hover:bg-blue-100'; 
                            textClass = 'text-blue-700';
                            borderClass = 'border-blue-200';
                            label = 'За свій рах.';
                            icon = <div className="font-bold text-lg">З</div>;
                            break;
                        case 'truancy':
                            statusStyle = 'bg-red-50 hover:bg-red-100';
                            textClass = 'text-red-700';
                            borderClass = 'border-red-200';
                            label = 'Прогул';
                            icon = <div className="font-bold text-lg">X</div>;
                            break;
                        default:
                            statusStyle = 'bg-red-50 hover:bg-red-100';
                            textClass = 'text-red-700';
                            borderClass = 'border-red-200';
                            label = 'Відсутність';
                            icon = <XCircle size={16} className="text-red-500" />;
                    }
                } else if (record.type === 'work') {
                if (record.verifiedByAdmin) {
                    statusStyle = 'bg-green-50 hover:bg-green-100';
                    textClass = 'text-green-700';
                    borderClass = 'border-green-200';
                    label = 'Перевірено';
                    icon = <CheckCircle size={16} className="text-green-500" />;
                } else {
                    statusStyle = 'bg-blue-50 hover:bg-blue-100';
                    textClass = 'text-blue-700';
                    borderClass = 'border-blue-200';
                    label = 'В обробці';
                    icon = <Clock size={16} className="text-blue-500" />;
                }
                const duration = PayrollService.calculateWorkDuration(record);
                hours = formatTime(duration);
                }
            }

            let outlineStyle = `border-2 ${borderClass}`;
            if (isSelected) {
                outlineStyle = 'ring-2 ring-slate-900 border-transparent z-10'; 
            }

            return (
                <button
                key={dateKey}
                onClick={() => handleDateClick(day)}
                className={`
                    h-32 rounded-xl flex flex-col items-start justify-between p-3 transition-all relative group
                    ${statusStyle}
                    ${outlineStyle}
                `}
                >
                {record && (
                    <div 
                    onClick={(e) => handleDeleteClick(e, record)}
                    className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-full text-gray-400 hover:text-red-600 hover:bg-white shadow-sm transition-all z-20 opacity-0 group-hover:opacity-100"
                    title="Видалити запис"
                    >
                    <Trash2 size={16} />
                    </div>
                )}

                <div className="flex justify-between w-full items-start">
                    <span className={`text-lg font-bold ${textClass}`}>
                    {format(day, 'd')}
                    </span>
                    {icon}
                </div>
                
                {label && (
                    <div className="w-full">
                    <div className={`text-[10px] font-bold uppercase tracking-wide opacity-80 text-left ${textClass}`}>
                        {label}
                        {record && record.type === 'work' && record.verifiedByAdmin && PayrollService.calculateOvertime(record, currentUser, schedules).overtimeHours > 0 && !record.overtimeApproved && (
                           <span className="text-yellow-500 ml-1">⚠️</span>
                        )}
                    </div>
                    {hours && (
                        <div className={`text-xs font-mono mt-1 text-left opacity-100 ${textClass}`}>
                        {hours}
                        </div>
                    )}
                    </div>
                )}
                </button>
            );
            })}
        </div>
      )}

      {/* --- MONTHLY ANALYTICS FOOTER --- */}
      <div className="mt-8 animation-fade-in">
          <h3 className="text-gray-400 font-bold uppercase text-xs mb-4 tracking-wider">
              Підсумок за {format(currentDate, 'LLLL yyyy', { locale: uk })}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Card 1: TOTAL PAY */}
              <div className="bg-[#0f172a] text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Загальна виплата</div>
                      <div className="text-3xl font-bold">
                          {monthlyStats.totalPay.toLocaleString()} ₴
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                          Попередній розрахунок
                      </div>
                  </div>
              </div>

              {/* Card 2: HOURS */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Загальні години</div>
                  <div className="text-3xl font-bold text-gray-800">
                      {formatTime(monthlyStats.totalHours)}
                  </div>
                  {monthlyStats.overtimeMinutes > 0 && (
                      <div className="mt-1 text-xs text-orange-500 font-bold">
                          +{formatTime(monthlyStats.overtimeMinutes / 60)} понаднормових
                      </div>
                  )}
              </div>

              {/* Card 3: TRAVEL EXPENSES */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Витрати на проїзд</div>
                  <div className="text-3xl font-bold text-blue-600">
                      {monthlyStats.travelCost.toLocaleString()} ₴
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                      Компенсація палива та квитків
                  </div>
              </div>

              {/* Card 4: OTHER EXPENSES */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Інші витрати</div>
                  <div className="text-3xl font-bold text-purple-600">
                      {monthlyStats.otherExpenses.toLocaleString()} ₴
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                      Додаткові доручення та покупки
                  </div>
              </div>
          </div>
      </div>

      {modalOpen && selectedDate && (
        <AttendanceModal
          isOpen={modalOpen}
          date={selectedDate}
          userId={currentUser.id}
          onClose={() => setModalOpen(false)}
          onSave={loadRecords}
        />
      )}

      {/* DELETE CONFIRM MODAL */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Видалити запис?"
        message="Ви впевнені? Це незворотня дія."
      />
    </div>
  );
};
