import { User, AttendanceRecord, TransportMode } from '../types';

/**
 * Цей сервіс відповідає за логіку "Defaults vs Overrides".
 * Він об'єднує налаштування користувача з конкретним записом дня.
 */
export const AttendanceLogic = {
  
  /**
   * Отримує ефективні дані для дня.
   * Логіка: Якщо в Record є значення (Override) -> беремо його.
   * Якщо немає -> беремо з User.defaults.
   * Якщо немає і там -> беремо 0 або дефолт системи.
   */
  getEffectiveDailyData: (user: User, record?: AttendanceRecord | Partial<AttendanceRecord>) => {
    const defaults = user.defaults || {};
    const overrides = record || {};

    return {
      transportMode: (overrides.transportMode ?? defaults.transportMode) as TransportMode || 'car',
      
      // Car Logic
      distanceTo: overrides.distanceTo ?? defaults.distanceTo ?? 0,
      distanceFrom: overrides.distanceFrom ?? defaults.distanceFrom ?? 0,
      fuelConsumption: overrides.fuelConsumption ?? defaults.fuelConsumption ?? 0,
      fuelPrice: overrides.fuelPrice ?? defaults.fuelPrice ?? 0,

      // Bus Logic
      busPriceTo: overrides.busPriceTo ?? defaults.busPriceTo ?? 0,
      busPriceFrom: overrides.busPriceFrom ?? defaults.busPriceFrom ?? 0,
    };
  }
};