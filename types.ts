
import React from 'react';

export type Role = 'admin' | 'worker' | string;

export interface UserDefaults {
  transportMode?: TransportMode;
  fuelConsumption?: number;
  fuelPrice?: number;
  distanceTo?: number;
  distanceFrom?: number;
  busPriceTo?: number;
  busPriceFrom?: number;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  login: string;
  password?: string;
  role: Role;
  isActive?: boolean;
  status?: 'active' | 'dismissed';
  avatar?: string;
  phone?: string;
  dob?: string;
  position?: string;
  monthlyRate?: number;
  shiftDurationHours?: number; 
  skills?: string[];
  allowManualLogin?: boolean;
  workScheduleId?: string;
  defaults?: UserDefaults;
  displayName?: string;
}

export interface ModulePermission {
  view: boolean;
  edit: boolean;
}

export interface RoleConfig {
  id: string;
  name: string;
  permissions: Record<string, ModulePermission>;
}

export type AbsenceType = 'sick' | 'vacation' | 'unpaid' | 'truancy';
export type TransportMode = 'car' | 'bus';

export interface Break {
  id: string;
  name: string;
  durationMinutes: number;
  isPaid: boolean;
}

export interface WorkScheduleDay {
  dayOfWeek: number;
  isWorking: boolean;
  isNight: boolean;
}

export type ScheduleType = 'day' | 'night' | 'mixed';

export interface WorkSchedule {
  id: string;
  name: string;
  type: ScheduleType | null; 
  days: WorkScheduleDay[];
  shiftDurationHours?: number;
  startTime?: string;
  endTime?: string;
  breaks: Break[];
}

export interface AdditionalExpense {
  id: string;
  name: string;
  extraDistance: number; 
  amount: number; 
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  type: 'work' | 'absence';
  workScheduleId?: string;
  transportMode?: TransportMode;
  distanceTo?: number; 
  distanceFrom?: number; 
  fuelConsumption?: number; 
  fuelPrice?: number; 
  busPriceTo?: number; 
  busPriceFrom?: number; 
  startTime?: string; 
  endTime?: string; 
  breaks?: Break[];
  additionalExpenses?: AdditionalExpense[];
  absenceType?: AbsenceType;
  comment?: string;
  verifiedByAdmin?: boolean;
  overtimeApproved?: boolean;
  workedMinutes?: number;
  overtimeMinutes?: number;
  transportCost?: number;
  totalExpenses?: number;
  updatedAt?: string;
  requiresAdminApproval?: boolean;
}

export interface JobFolder {
  id: string;
  name: string;
  parentId: string | null;
  colorTag?: string;
  deletedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  photo?: string;
  colorTag?: string;
  jobCycleId?: string;
  description?: string;
  drawingId?: string;
  deletedAt?: string;
}

export interface Drawing {
  id: string;
  name: string;
  photo: string;
  deletedAt?: string;
}

export interface ProductFolder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ProductStock {
  id: string;
  productId: string;
  folderId: string | null;
  quantity: number;
  criticalQuantity: number;
}

export interface DefectItem {
  id: string;
  productId: string;
  quantity: number;
  productName?: string;
  reason?: string;
  workerName?: string;
  stageName?: string;
  date?: any;
  imageUrl?: string;
}

export type ProductTransactionType = 'produce' | 'sell' | 'to_defect' | 'defect_off';

export interface ProductTransaction {
  id: string;
  date: string;
  type: ProductTransactionType;
  productId: string;
  quantity: number;
  userId: string;
  userName: string;
  note?: string;
}

export type UnitOfMeasure = 'pcs' | 'kg' | 'l' | 'pack' | 'meter';

export interface ToolFolder {
  id: string;
  name: string;
  parentId: string | null;
  type: 'catalog' | 'warehouse' | 'production';
  colorTag?: string;
}

export interface Tool {
  id: string;
  name: string;
  photo: string;
  description?: string;
  unit: UnitOfMeasure;
  folderId: string | null;
  colorTag?: string;
  deletedAt?: string;
}

export interface WarehouseItem {
  id: string;
  toolId: string;
  folderId: string | null;
  quantity: number;
  criticalQuantity: number;
  deletedAt?: string;
}

export interface ProductionItem {
  id: string;
  toolId: string;
  folderId?: string | null;
  quantity: number;
  criticalQuantity: number;
  deletedAt?: string;
}

export type TransactionType = 'import' | 'move_to_prod' | 'usage' | 'return';

export interface ToolTransaction {
  id: string;
  date: string;
  toolId: string;
  userId: string;
  userName: string;
  type: TransactionType;
  amount: number;
  target?: string;
  balanceSnapshot: number;
}

export interface SetupBlock {
  id?: string;
  toolNumber: string;
  toolName: string;
  toolId?: string;
  settings: string;
}

export interface SetupComponentRequirement {
  sourceStageIndex?: number;
  name?: string;
  qty?: number;
  ratio?: number;
}

export interface SetupMap {
  id: string;
  name: string;
  productCatalogId?: string;
  machine: string;
  blocks: SetupBlock[];
  deletedAt?: string;
  photoUrl?: string;
  drawingId?: string;
  drawingUrl?: string;
  drawingName?: string;
  programNumber?: string;
  consumptionRatio?: number; 
  inputComponents?: SetupComponentRequirement[]; 
  processType?: 'manufacturing' | 'assembly';
}

export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'canceled' | 'new' | 'done';

export interface Order {
  id: string;
  orderNumber: string;
  productId: string;
  quantity: number;
  deadline: string;
  status: OrderStatus;
  progress: number;
  customerName?: string;
  createdAt: string;
  deletedAt?: string;
  workCycleId?: string;
  workCycleName?: string;
}

export interface JobCycle {
  id: string;
  parentId: string | null;
  name: string;
  productId?: string;
  productPhoto?: string;
  colorTag?: string;
  stages: JobStage[];
  deletedAt?: string;
}

export interface JobStage {
  id: string;
  operationType: string;
  name: string;
  responsible: string[];
  count: number;
  machine: string;
  notes: string;
  setupMapId?: string;
}

export type TaskType = 'simple' | 'production';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[];
  description?: string;
  photo?: string;
  orderId?: string;
  stageId?: string;
  plannedQuantity?: number;
  completedQuantity?: number;
  pendingQuantity?: number;
  isFinalStage?: boolean;
  createdAt: string;
  deadline?: string;
  deletedAt?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  roles: Role[];
  path: string;
}

export interface ProductionReport {
  id: string;
  taskId: string;
  userId: string;
  date: string;
  quantity: number;
  scrapQuantity: number;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  type?: 'production' | 'manual_stock' | 'manual_deduction' | 'manual_adjustment' | 'manual_defect' | 'simple_report';
  sourceBatchIds?: string[]; 
  sourceConsumption?: Record<string, number>; // Maps BatchID -> Quantity used
  usedQuantity?: number; 
  taskTitle?: string;
  orderNumber?: string;
  stageName?: string;
  productName?: string;
  batchCode?: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: any;
  type: string;
  title?: string;
  target?: 'admin' | 'user' | 'global';
  linkId?: string;
}
