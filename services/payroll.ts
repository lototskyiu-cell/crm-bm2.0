
import { User, AttendanceRecord, Break, WorkSchedule } from '../types';
import { eachDayOfInterval, startOfMonth, endOfMonth, isSaturday, isSunday, isWeekend, getDaysInMonth, getDay } from 'date-fns';

export const PayrollService = {
  // 1. Calculate Working Days in a Month (Mon-Fri)
  getWorkingDaysInMonth: (date: Date): number => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const days = eachDayOfInterval({ start, end });
    return days.filter(d => !isWeekend(d)).length;
  },

  // 2. Rates
  getRates: (user: User, date: Date) => {
    const workingDays = PayrollService.getWorkingDaysInMonth(date);
    const monthlyRate = user.monthlyRate || 0;
    const shiftDuration = user.shiftDurationHours || 8; // Default 8 if not set

    const dailyRate = workingDays > 0 ? monthlyRate / workingDays : 0;
    const hourlyRate = shiftDuration > 0 ? dailyRate / shiftDuration : 0;

    const safeDaily = isNaN(dailyRate) ? 0 : parseFloat(dailyRate.toFixed(2));
    const safeHourly = isNaN(hourlyRate) ? 0 : parseFloat(hourlyRate.toFixed(2));

    return { 
      dailyRate: safeDaily, 
      hourlyRate: safeHourly, 
      workingDays 
    };
  },

  // 3. Transport Cost
  calculateTransportCost: (record: AttendanceRecord): number => {
    let cost = 0;
    if (record.transportMode === 'car') {
      let dist = (record.distanceTo || 0) + (record.distanceFrom || 0);
      
      // Add extra distance from additional expenses
      if (record.additionalExpenses) {
        dist += record.additionalExpenses.reduce((sum, e) => sum + (e.extraDistance || 0), 0);
      }

      const consumption = record.fuelConsumption || 0;
      const price = record.fuelPrice || 0;
      // Formula: ((distanceTo + distanceFrom + extraDistance) / 100) * fuelConsumption * fuelPrice
      cost = (dist / 100) * consumption * price;
    } 
    
    if (record.transportMode === 'bus') {
      // Formula: priceTo + priceFrom
      cost = (record.busPriceTo || 0) + (record.busPriceFrom || 0);
    }

    return isNaN(cost) ? 0 : Math.round(cost); // Integer rounding for money
  },

  // 3b. Additional Expenses Cost (Direct Money)
  calculateAdditionalExpensesCost: (record: AttendanceRecord): number => {
    if (!record.additionalExpenses) return 0;
    const total = record.additionalExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    return isNaN(total) ? 0 : Math.round(total);
  },

  // 4. Work Duration
  calculateWorkDuration: (record: AttendanceRecord): number => {
    if (!record.startTime || !record.endTime) return 0;

    const [startH, startM] = record.startTime.split(':').map(Number);
    const [endH, endM] = record.endTime.split(':').map(Number);
    
    // Check for invalid parsing
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;

    const startTotalMins = startH * 60 + startM;
    const endTotalMins = endH * 60 + endM;
    
    let diffMins = endTotalMins - startTotalMins;

    // Subtract ONLY Unpaid breaks
    const unpaidBreaksDuration = (record.breaks || [])
      .filter(b => !b.isPaid)
      .reduce((acc, b) => acc + (b.durationMinutes || 0), 0);

    diffMins -= unpaidBreaksDuration;

    // Return rounded to 1 decimal place (e.g. 8.5)
    const hours = Math.max(0, diffMins / 60);
    return isNaN(hours) ? 0 : parseFloat(hours.toFixed(1)); 
  },

  // 5. Overtime Logic with Threshold
  calculateOvertime: (record: AttendanceRecord, user: User, schedules: WorkSchedule[] = []) => {
    const workDuration = PayrollService.calculateWorkDuration(record);
    if (!workDuration) return { baseHours: 0, overtimeHours: 0 };

    const dateObj = new Date(record.date);
    
    // Constants
    const DEFAULT_SHIFT_START = "08:00";
    const DEFAULT_SHIFT_END = "17:00";
    const OVERTIME_THRESHOLD = 30; // minutes

    // 1. Determine Schedule & Shift Times
    let schedule: WorkSchedule | undefined;
    if (record.workScheduleId) {
      schedule = schedules.find(s => s.id === record.workScheduleId);
    } else if (user.workScheduleId) {
      schedule = schedules.find(s => s.id === user.workScheduleId);
    }

    // 2. Check if working day
    let isWorkingDay = true;
    let shiftStartStr = DEFAULT_SHIFT_START;
    let shiftEndStr = DEFAULT_SHIFT_END;

    if (schedule) {
      // Find config for this day of week (0=Mon in our App vs 0=Sun in date-fns)
      // date-fns getDay(): 0=Sun, 1=Mon. Our App: 0=Mon, 6=Sun.
      // Conversion: (dateFnsDay + 6) % 7
      const dayIndex = (getDay(dateObj) + 6) % 7;
      const dayConfig = schedule.days?.find(d => d.dayOfWeek === dayIndex);
      
      if (dayConfig) {
        isWorkingDay = dayConfig.isWorking;
      }
      
      if (schedule.startTime) shiftStartStr = schedule.startTime;
      if (schedule.endTime) shiftEndStr = schedule.endTime;
    } else {
      // Default: Mon-Fri are working days
      isWorkingDay = !isWeekend(dateObj);
    }

    // 3. Logic Branching
    let overtimeHours = 0;
    
    if (!isWorkingDay) {
        // Non-working day (Weekend/Holiday) -> ALL time is overtime
        overtimeHours = workDuration;
    } else {
        // Working Day -> Check Deviations
        if (record.startTime && record.endTime) {
            const timeToMin = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            const actualStartMin = timeToMin(record.startTime);
            const actualEndMin = timeToMin(record.endTime);
            const shiftStartMin = timeToMin(shiftStartStr);
            const shiftEndMin = timeToMin(shiftEndStr);

            // Deviation Calculation
            const earlyMinutes = Math.max(0, shiftStartMin - actualStartMin);
            const lateMinutes = Math.max(0, actualEndMin - shiftEndMin);
            const totalDeviation = earlyMinutes + lateMinutes;

            // Apply Threshold
            if (totalDeviation >= OVERTIME_THRESHOLD) {
                overtimeHours = totalDeviation / 60;
            } else {
                overtimeHours = 0;
            }
        } else {
            // Fallback if timestamps missing (should not happen in valid record)
            overtimeHours = 0;
        }
    }

    // 4. Rounding & Base Hours
    // Overtime cannot exceed total work duration
    overtimeHours = Math.min(overtimeHours, workDuration);
    
    const baseHours = workDuration - overtimeHours;

    return { 
      baseHours: parseFloat(baseHours.toFixed(1)), 
      overtimeHours: parseFloat(overtimeHours.toFixed(1)) 
    };
  },

  // 6. Daily Salary Calculation
  calculateDailySalary: (record: AttendanceRecord, user: User, schedules: WorkSchedule[] = []) => {
    if (record.type === 'absence') return 0;

    const { hourlyRate } = PayrollService.getRates(user, new Date(record.date));
    const { baseHours, overtimeHours } = PayrollService.calculateOvertime(record, user, schedules);

    // Basic pay
    let totalPay = baseHours * hourlyRate;

    // Overtime pay (Only if approved)
    if (overtimeHours > 0) {
      if (record.overtimeApproved) {
         totalPay += overtimeHours * hourlyRate;
      }
    }

    return isNaN(totalPay) ? 0 : Math.round(totalPay); // Round money to integer
  },

  // Helper to check status color
  getStatusColor: (record: AttendanceRecord, user: User, schedules: WorkSchedule[] = []) => {
    if (record.type === 'absence') return 'red';
    
    const { overtimeHours } = PayrollService.calculateOvertime(record, user, schedules);
    
    if (!record.verifiedByAdmin) return 'yellow';
    if (overtimeHours > 0 && !record.overtimeApproved) return 'yellow';
    
    return 'green';
  }
};
