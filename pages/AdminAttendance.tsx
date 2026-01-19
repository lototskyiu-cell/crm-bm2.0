
import React, { useState, useEffect } from 'react';
import { User, AttendanceRecord, WorkSchedule } from '../types';
import { API } from '../services/api';
import { PayrollService } from '../services/payroll';
import { AttendanceModal } from '../components/AttendanceModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal'; // Import Modal
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Calendar, DollarSign, Info, Clock, AlertTriangle, Filter, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Users, Table as TableIcon, FileText, Loader, Trash2 } from 'lucide-react';

export const AdminAttendance: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);

  // Payroll View State
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]); // Empty = All
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());
  const [showTableUserIds, setShowTableUserIds] = useState<Set<string>>(new Set());

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth)
  });
  
  const workingDaysInMonth = PayrollService.getWorkingDaysInMonth(selectedMonth);

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersData, recordsData, schedulesData] = await Promise.all([
        API.getUsers(),
        API.getAttendanceRecords(undefined, selectedMonth),
        API.getSchedules()
      ]);
      // Filter out non-workers and DISMISSED workers
      const activeWorkers = (usersData || []).filter(u => u.role === 'worker' && u.status !== 'dismissed');
      setUsers(activeWorkers);
      setRecords(recordsData || []);
      setSchedules(schedulesData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete) {
      try {
        await API.deleteAttendanceRecord(recordToDelete.id);
        setDeleteModalOpen(false);
        setRecordToDelete(null);
        loadData(); // Refresh table
      } catch (e) {
        alert("Failed to delete record");
      }
    }
  };

  const getRecord = (user: User, date: Date) => {
    return records.find(r => r.userId === user.id && r.date === format(date, 'yyyy-MM-dd'));
  };

  const getCellClass = (user: User, date: Date) => {
    const record = getRecord(user, date);
    if (!record) return 'bg-white hover:bg-gray-50';
    
    if (record.type === 'absence') {
        // Light background based on absence type
        switch (record.absenceType) {
            case 'sick': return 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200';
            case 'vacation': return 'bg-blue-50 hover:bg-blue-100 border-blue-200';
            case 'unpaid': return 'bg-blue-50 hover:bg-blue-100 border-blue-200'; // Blue as requested
            case 'truancy': return 'bg-red-50 hover:bg-red-100 border-red-200';
            default: return 'bg-red-50 hover:bg-red-100 border-red-200';
        }
    }

    const status = PayrollService.getStatusColor(record, user, schedules);
    if (status === 'red') return 'bg-red-50 hover:bg-red-100 border-red-200';
    if (status === 'yellow') return 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200';
    return 'bg-green-50 hover:bg-green-100 border-green-200';
  };

  const renderAbsenceBadge = (type?: string) => {
      switch(type) {
          case 'sick': 
            return <span className="font-bold text-yellow-800 bg-yellow-100 px-1.5 py-0.5 rounded text-[10px] shadow-sm border border-yellow-200" title="Лікарняний">Л</span>;
          case 'vacation': 
            return <span className="font-bold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded text-[10px] shadow-sm border border-blue-200" title="Відпустка">В</span>;
          case 'unpaid': 
            return <span className="font-bold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded text-[10px] shadow-sm border border-blue-200" title="За свій рахунок">З</span>; // Letter "З"
          case 'truancy': 
            return <span className="font-bold text-red-800 bg-red-100 px-1.5 py-0.5 rounded text-[10px] shadow-sm border border-red-200" title="Прогул">X</span>;
          default: 
            return <span className="font-bold text-red-500 text-[10px]">?</span>;
      }
  };

  const handleCellClick = (user: User, date: Date) => {
    setSelectedUserId(user.id);
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setModalOpen(true);
  };

  // --- ANALYTICS HELPERS ---

  // Enhanced Stats Calculator
  const getMonthlyStats = (user: User) => {
    const userRecords = records.filter(r => r.userId === user.id && isSameMonth(new Date(r.date), selectedMonth)); 
    
    let totalHours = 0;
    let totalOvertime = 0;
    let totalSalary = 0;
    let totalTransport = 0;
    let totalAdditionalExpenses = 0;
    let absenceDays = 0;
    let baseSalary = 0;

    userRecords.forEach(r => {
      if (r.type === 'absence') {
        absenceDays++;
        return;
      }

      const workDuration = PayrollService.calculateWorkDuration(r);
      const { overtimeHours, baseHours } = PayrollService.calculateOvertime(r, user, schedules);
      const salary = PayrollService.calculateDailySalary(r, user, schedules);
      const transport = PayrollService.calculateTransportCost(r);
      const additional = PayrollService.calculateAdditionalExpensesCost(r);
      
      const { hourlyRate } = PayrollService.getRates(user, new Date(r.date));

      totalHours += workDuration;
      totalOvertime += overtimeHours;
      totalSalary += salary;
      baseSalary += (baseHours * hourlyRate);
      totalTransport += transport;
      totalAdditionalExpenses += additional;
    });

    // Ensure no NaNs propagate to UI
    return {
      hours: isNaN(totalHours) ? 0 : totalHours,
      overtime: isNaN(totalOvertime) ? 0 : totalOvertime,
      salary: isNaN(totalSalary) ? 0 : Math.round(totalSalary),
      baseSalary: isNaN(baseSalary) ? 0 : Math.round(baseSalary),
      transport: isNaN(totalTransport) ? 0 : Math.round(totalTransport),
      additionalExpenses: isNaN(totalAdditionalExpenses) ? 0 : Math.round(totalAdditionalExpenses),
      total: isNaN(totalSalary + totalTransport + totalAdditionalExpenses) ? 0 : Math.round(totalSalary + totalTransport + totalAdditionalExpenses),
      absenceDays,
      recordsCount: userRecords.length
    };
  };

  // Filter Logic
  const filteredUsers = selectedEmployeeIds.length > 0 
    ? users.filter(u => selectedEmployeeIds.includes(u.id))
    : users;

  // Global Aggregation
  const globalStats = filteredUsers.reduce((acc, user) => {
    const stats = getMonthlyStats(user);
    return {
      totalPayout: acc.totalPayout + stats.total,
      totalHours: acc.totalHours + stats.hours,
      totalTransport: acc.totalTransport + stats.transport,
      totalAdditionalExpenses: acc.totalAdditionalExpenses + stats.additionalExpenses,
      totalOvertime: acc.totalOvertime + stats.overtime
    };
  }, { totalPayout: 0, totalHours: 0, totalTransport: 0, totalAdditionalExpenses: 0, totalOvertime: 0 });

  // UI Handlers
  const toggleUserExpansion = (userId: string) => {
    const newSet = new Set(expandedUserIds);
    if (newSet.has(userId)) newSet.delete(userId);
    else newSet.add(userId);
    setExpandedUserIds(newSet);
  };

  const toggleUserTable = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(showTableUserIds);
    if (newSet.has(userId)) newSet.delete(userId);
    else newSet.add(userId);
    setShowTableUserIds(newSet);
  };

  // Helper function to format numbers for Excel (European/Ukrainian format uses comma)
  const formatNumberForExcel = (num: number) => {
      // Ensure we have a string with fixed decimals then replace dot with comma
      return num.toFixed(1).replace('.', ',');
  };

  const handleExportExcel = () => {
    // Generate CSV Content
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "\uFEFF"; // BOM for Excel

    // Headers (Semicolon separated)
    csvContent += "Працівник;Дата;Тип;Початок;Кінець;Години;Понаднормові;Транспорт (грн);Дод. витрати (грн);Зарплата (грн);Загалом (грн)\n";

    filteredUsers.forEach(user => {
      const userRecords = records.filter(r => r.userId === user.id && isSameMonth(new Date(r.date), selectedMonth));
      userRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      userRecords.forEach(r => {
        const userName = `${user.firstName} ${user.lastName}`;
        // Ensure Date is string to prevent auto-conversion
        const dateStr = format(new Date(r.date), 'dd.MM.yyyy');
        
        if (r.type === 'absence') {
           // Absence row
           csvContent += `${userName};${dateStr};${r.absenceType || 'Відсутність'};-;-;-;-;-;-;-;-\n`;
        } else {
           const duration = PayrollService.calculateWorkDuration(r);
           const { overtimeHours } = PayrollService.calculateOvertime(r, user, schedules);
           const salary = PayrollService.calculateDailySalary(r, user, schedules);
           const transport = PayrollService.calculateTransportCost(r);
           const additional = PayrollService.calculateAdditionalExpensesCost(r);
           const total = salary + transport + additional;
           
           // Work row - Format numbers with commas to prevent date conversion in Excel
           csvContent += `${userName};${dateStr};Робота;${r.startTime || ''};${r.endTime || ''};${formatNumberForExcel(duration)};${formatNumberForExcel(overtimeHours)};${transport};${additional};${salary};${total}\n`;
        }
      });
    });

    // Empty row before summary
    csvContent += "\n";

    // Summary Row aligned to columns
    csvContent += `ЗАГАЛЬНИЙ ПІДСУМОК;;;;;${formatNumberForExcel(globalStats.totalHours)};${formatNumberForExcel(globalStats.totalOvertime)};${globalStats.totalTransport};${globalStats.totalAdditionalExpenses};;${globalStats.totalPayout}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payroll_report_${format(selectedMonth, 'yyyy_MM')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader className="animate-spin text-blue-600"/></div>;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Табель відвідуваності</h1>
          
          <div className="flex items-center mt-2 space-x-2">
            <button 
              onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
              className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm active:scale-95"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="flex items-center justify-center bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm min-w-[200px]">
              <Calendar size={18} className="mr-2 text-gray-400"/>
              <span className="text-lg font-bold text-gray-800 capitalize select-none">
                {format(selectedMonth, 'LLLL yyyy', { locale: uk })}
              </span>
            </div>

            <button 
              onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
              className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm active:scale-95"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Timesheet Table (Horizontally Compact) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] md:text-xs border-collapse table-fixed min-w-[1200px]">
            <thead>
              <tr>
                <th className="p-2 text-left border-b border-r bg-gray-50 w-40 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  <div className="font-bold text-gray-600 uppercase tracking-wider">Працівник</div>
                </th>
                {daysInMonth.map(day => (
                  <th key={day.toString()} className="h-10 border-b border-r bg-gray-50 text-center w-10">
                    <div className="font-bold text-gray-500">{format(day, 'd')}</div>
                    <div className="text-[9px] text-gray-400 font-normal">{format(day, 'EEEEEE', { locale: uk })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="group border-b last:border-b-0 border-gray-100">
                  <td className="p-2 border-r bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-blue-50/30 transition-colors">
                    <div className="font-bold text-gray-900 truncate">{user.lastName} {user.firstName.charAt(0)}.</div>
                    <div className="text-[10px] text-gray-400 truncate">{user.position}</div>
                  </td>
                  {daysInMonth.map(day => {
                    const record = getRecord(user, day);
                    const { overtimeHours } = record ? PayrollService.calculateOvertime(record, user, schedules) : { overtimeHours: 0 };
                    const dailyPay = record ? PayrollService.calculateDailySalary(record, user, schedules) : 0;
                    const duration = record ? PayrollService.calculateWorkDuration(record) : 0;
                    const statusClass = getCellClass(user, day);

                    return (
                      <td 
                        key={day.toString()} 
                        onClick={() => handleCellClick(user, day)}
                        className={`border-r cursor-pointer transition-all h-14 p-0.5 align-middle text-center relative group/cell ${statusClass}`}
                      >
                        {record && record.type === 'work' && (
                          <div className="flex flex-col items-center justify-center h-full w-full space-y-0.5">
                            <span className="font-bold text-gray-800 text-[10px] leading-none">{isNaN(duration) ? 0 : duration}г</span>
                            <span className="text-[9px] text-gray-500 leading-none">{isNaN(dailyPay) ? 0 : Math.round(dailyPay)}₴</span>
                            {overtimeHours > 0 && (
                              <div className={`w-1.5 h-1.5 rounded-full ${record.overtimeApproved ? 'bg-green-500' : 'bg-yellow-500'}`} title={`Overtime: +${overtimeHours}h`}></div>
                            )}
                          </div>
                        )}
                        {record && record.type === 'absence' && (
                          <div className="flex items-center justify-center h-full">
                            {renderAbsenceBadge(record.absenceType)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODULE C: ADVANCED PAYROLL ANALYTICS --- */}
      <div className="space-y-6 pt-6 border-t border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <DollarSign size={24} className="mr-2 text-green-600"/>
            Зведена відомість (Payroll)
          </h2>
          
          <div className="flex gap-3 w-full md:w-auto">
             {/* Export Button */}
             <button 
               onClick={handleExportExcel}
               className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium text-sm"
             >
               <Download size={16} className="mr-2" />
               Експорт Excel
             </button>
          </div>
        </div>
        
        {/* 1. FILTER PANEL */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
           <div className="flex items-center text-gray-500">
              <Filter size={18} className="mr-2" />
              <span className="text-sm font-bold uppercase tracking-wider">Фільтри:</span>
           </div>
           
           <div className="flex-1 w-full md:w-auto">
             <div className="relative">
               <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
               <select 
                 className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                 onChange={(e) => {
                   const val = e.target.value;
                   if (val === 'all') setSelectedEmployeeIds([]);
                   else setSelectedEmployeeIds([val]); // Simple single select logic for now, or could handle multiple
                 }}
                 value={selectedEmployeeIds.length === 1 ? selectedEmployeeIds[0] : 'all'}
               >
                 <option value="all">Усі працівники</option>
                 {users.map(u => (
                   <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                 ))}
               </select>
             </div>
           </div>

           <div className="px-4 py-2 bg-blue-50 text-blue-800 rounded-lg text-sm font-bold border border-blue-100">
              Період: {format(selectedMonth, 'MMMM yyyy', { locale: uk })}
           </div>
        </div>

        {/* 2. GLOBAL SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           {/* Total Payout */}
           <div className="bg-slate-900 text-white p-5 rounded-xl shadow-lg flex flex-col justify-between relative overflow-hidden">
              <div className="absolute right-0 top-0 p-4 opacity-10">
                 <DollarSign size={64} />
              </div>
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Загальна виплата</div>
              <div className="text-3xl font-bold">{globalStats.totalPayout.toLocaleString()} ₴</div>
              <div className="mt-2 text-xs text-slate-400 flex items-center">
                 <span className="bg-slate-800 px-2 py-0.5 rounded text-white mr-2">{filteredUsers.length}</span> працівників
              </div>
           </div>

           {/* Total Hours */}
           <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Загальні години</div>
              <div className="flex items-baseline">
                 <span className="text-3xl font-bold text-gray-900">{globalStats.totalHours.toFixed(1)}</span>
                 <span className="ml-1 text-sm text-gray-500">год</span>
              </div>
              <div className="mt-2 text-xs text-orange-600 font-medium">
                 {globalStats.totalOvertime > 0 ? `+${globalStats.totalOvertime.toFixed(1)} год понаднормових` : 'Без перепрацювань'}
              </div>
           </div>

           {/* Transport */}
           <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Витрати на проїзд</div>
              <div className="text-3xl font-bold text-blue-600">{globalStats.totalTransport.toLocaleString()} ₴</div>
              <div className="mt-2 text-xs text-gray-400">Компенсація палива та квитків</div>
           </div>

           {/* Additional Expenses */}
           <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Інші витрати</div>
              <div className="text-3xl font-bold text-indigo-600">{globalStats.totalAdditionalExpenses.toLocaleString()} ₴</div>
              <div className="mt-2 text-xs text-gray-400">Додаткові доручення та покупки</div>
           </div>
        </div>

        {/* 3. PER-EMPLOYEE BREAKDOWN */}
        <div className="space-y-4">
          {filteredUsers.map(user => {
            const stats = getMonthlyStats(user);
            const isExpanded = expandedUserIds.has(user.id);
            const showTable = showTableUserIds.has(user.id);
            const userRecords = records.filter(r => r.userId === user.id && isSameMonth(new Date(r.date), selectedMonth));
            
            // Re-sort records for table
            userRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            return (
              <div key={user.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                {/* Card Header (Clickable) */}
                <div 
                  onClick={() => toggleUserExpansion(user.id)}
                  className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between cursor-pointer bg-white hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center mb-4 md:mb-0">
                    <img 
                      src={user.avatar || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}`} 
                      className="w-12 h-12 rounded-full border border-gray-100 shadow-sm mr-4"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{user.lastName} {user.firstName}</h3>
                      <div className="text-sm text-gray-500 flex items-center">
                         {user.position}
                         <span className="mx-2">•</span>
                         <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{stats.recordsCount} записів</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                     <div className="text-right">
                        <div className="text-xs text-gray-400 uppercase font-bold mb-1">До виплати</div>
                        <div className="text-2xl font-bold text-green-700">{stats.total.toLocaleString()} ₴</div>
                     </div>
                     <div className="text-right hidden sm:block">
                        <div className="text-xs text-gray-400 uppercase font-bold mb-1">Години</div>
                        <div className="text-xl font-bold text-gray-700">{stats.hours.toFixed(1)}</div>
                     </div>
                     <div className="bg-gray-100 p-2 rounded-full text-gray-500">
                        {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                     </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                   <div className="bg-gray-50/50 border-t border-gray-100 p-4 md:p-6 animation-fade-in">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                         <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-400 uppercase mb-1">Зарплата (База)</div>
                            <div className="font-bold text-gray-800">{stats.baseSalary.toLocaleString()} ₴</div>
                         </div>
                         <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-400 uppercase mb-1">Понаднормові</div>
                            <div className="font-bold text-orange-600">
                               {stats.overtime > 0 ? `+${stats.overtime.toFixed(1)} год` : '-'}
                            </div>
                         </div>
                         <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-400 uppercase mb-1">Транспорт</div>
                            <div className="font-bold text-blue-600">{stats.transport.toLocaleString()} ₴</div>
                         </div>
                         <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-400 uppercase mb-1">Інші витрати</div>
                            <div className="font-bold text-indigo-600">{stats.additionalExpenses.toLocaleString()} ₴</div>
                         </div>
                         <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <div className="text-xs text-gray-400 uppercase mb-1">Відсутність</div>
                            <div className="font-bold text-red-500">
                               {stats.absenceDays > 0 ? `${stats.absenceDays} днів` : '-'}
                            </div>
                         </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex justify-between items-center">
                         <button 
                           onClick={(e) => toggleUserTable(user.id, e)}
                           className={`flex items-center text-sm font-bold px-4 py-2 rounded-lg transition-all ${showTable ? 'bg-slate-200 text-slate-800' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                         >
                            <TableIcon size={16} className="mr-2" />
                            {showTable ? 'Приховати таблицю' : 'Показати таблицю'}
                         </button>
                         {/* Placeholder for individual actions like print/pdf */}
                      </div>

                      {/* Detailed Table */}
                      {showTable && (
                         <div className="mt-4 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                               <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                                  <tr>
                                     <th className="p-3 w-32">Дата</th>
                                     <th className="p-3">Тип</th>
                                     <th className="p-3 text-center">Години</th>
                                     <th className="p-3 text-right">Зарплата</th>
                                     <th className="p-3 text-right">Транспорт</th>
                                     <th className="p-3 text-right">Інше</th>
                                     <th className="p-3 text-right">Всього</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-gray-100">
                                  {userRecords.map(r => {
                                     const duration = PayrollService.calculateWorkDuration(r);
                                     const salary = PayrollService.calculateDailySalary(r, user, schedules);
                                     const transport = PayrollService.calculateTransportCost(r);
                                     const additional = PayrollService.calculateAdditionalExpensesCost(r);
                                     return (
                                        <tr key={r.id} className="hover:bg-gray-50">
                                           <td className="p-3 font-mono text-gray-600">{format(new Date(r.date), 'dd.MM')}</td>
                                           <td className="p-3">
                                              {r.type === 'absence' ? (
                                                 <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold uppercase">{r.absenceType}</span>
                                              ) : (
                                                 <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold uppercase">Робота</span>
                                              )}
                                           </td>
                                           <td className="p-3 text-center text-gray-700 font-medium">
                                              {r.type === 'work' ? duration : '-'}
                                           </td>
                                           <td className="p-3 text-right text-gray-600">{salary > 0 ? salary : '-'}</td>
                                           <td className="p-3 text-right text-blue-600">{transport > 0 ? transport : '-'}</td>
                                           <td className="p-3 text-right text-indigo-600">{additional > 0 ? additional : '-'}</td>
                                           <td className="p-3 text-right font-bold text-gray-900">{salary + transport + additional}</td>
                                        </tr>
                                     );
                                  })}
                               </tbody>
                            </table>
                         </div>
                      )}
                   </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modalOpen && (
        <AttendanceModal 
          isOpen={modalOpen}
          date={selectedDate}
          userId={selectedUserId}
          onClose={() => setModalOpen(false)}
          onSave={loadData}
          isAdmin={true}
        />
      )}

      {/* DELETE CONFIRM MODAL */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Видалити запис?"
        message="Ви впевнені? Цю дію не можна скасувати. Це вплине на розрахунок зарплати."
      />
    </div>
  );
};
