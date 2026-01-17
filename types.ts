
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
  password?: string; // Optional for auth (handled by Firebase Auth mostly or custom doc)
  role: Role;
  isActive?: boolean; // Added for filtering
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
  displayName?: string; // For syncing with DB schema
}

// --- RBAC / PERMISSIONS ---
export interface ModulePermission {
  view: boolean;
  edit: boolean;
}

export interface RoleConfig {
  id: string; // 'admin', 'worker', etc.
  name: string;
  permissions: Record<string, ModulePermission>; // Keyed by module ID (e.g., 'tasks', 'inventory')
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
}

// --- PRODUCTION SYSTEM TYPES ---

export interface JobFolder {
  id: string;
  name: string;
  parentId: string | null;
  colorTag?: string; // Added colorTag
  deletedAt?: string;
}

// 1. PRODUCTS & RESOURCES
export interface Product {
  id: string;
  name: string;
  sku: string; // Articul
  photo?: string;
  colorTag?: string; // Color marker for filtering
  jobCycleId?: string; // Link to the tech process
  description?: string;
  drawingId?: string; // Link to a Drawing
  deletedAt?: string;
}

export interface Drawing {
  id: string;
  name: string;
  photo: string;
  deletedAt?: string;
}

// --- PRODUCT WAREHOUSE & DEFECTS ---

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
  stageName?: string; // Added stageName for better tracking
  date?: any; // Firestore Timestamp or specific type
  imageUrl?: string; // Specific drawing/photo for the defect
}

export type ProductTransactionType = 'produce' | 'sell' | 'to_defect' | 'defect_off';

export interface ProductTransaction {
  id: string;
  date: string;
  type: ProductTransactionType;
  productId: string;
  quantity: number;
  userId: string; // Who performed action
  userName: string;
  note?: string;
}

// --- TOOLS MODULE TYPES ---

export type UnitOfMeasure = 'pcs' | 'kg' | 'l' | 'pack' | 'meter';

export interface ToolFolder {
  id: string;
  name: string;
  parentId: string | null;
  type: 'catalog' | 'warehouse' | 'production';
  colorTag?: string; // Added colorTag
}

export interface Tool {
  id: string;
  name: string;
  photo: string;
  description?: string;
  unit: UnitOfMeasure;
  folderId: string | null; // For Catalog Structure
  colorTag?: string; // Added colorTag
  deletedAt?: string;
}

export interface WarehouseItem {
  id: string;
  toolId: string;
  folderId: string | null; // For Warehouse Structure
  quantity: number;
  criticalQuantity: number;
  deletedAt?: string;
}

export interface ProductionItem {
  id: string;
  toolId: string;
  folderId?: string | null; // Added folder support for Production
  quantity: number;
  criticalQuantity: number; // For admin alerts on production floor
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
  target?: string; // e.g., "Machine 1", "Production Floor"
  balanceSnapshot: number; // Qty after transaction
}

export interface SetupBlock {
  id?: string; // Optional for UI keys
  toolNumber: string; // Manual numbering (e.g. "1", "12", "T5")
  toolName: string; // Was toolNumber/toolId
  toolId?: string; // Link to Tool Catalog
  settings: string; // Was description
}

export interface SetupComponentRequirement {
  sourceStageIndex?: number; // 0-based index (Legacy)
  name?: string; // Component Name to match
  qty?: number; // Quantity needed
  ratio?: number; // Legacy alias for qty
}

export interface SetupMap {
  id: string;
  name: string;
  productCatalogId?: string; // Link to Product
  machine: string;
  blocks: SetupBlock[];
  deletedAt?: string;
  // New Fields for Technical Docs
  photoUrl?: string; // Setup photo
  drawingId?: string; // Link to Drawing ID
  drawingUrl?: string; // Part drawing for this setup
  drawingName?: string; // Name of the drawing
  programNumber?: string;
  
  // Consumption Logic (Legacy: consumptionRatio)
  consumptionRatio?: number; 
  // Multi-Component Logic
  inputComponents?: SetupComponentRequirement[]; 
}

export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'canceled' | 'new' | 'done';

export interface Order {
  id: string;
  orderNumber: string;
  productId: string; // Maps to productCatalogId in DB
  quantity: number; // Maps to targetQuantity in DB
  deadline: string;
  status: OrderStatus;
  progress: number; // Calculated or derived
  customerName?: string;
  createdAt: string;
  deletedAt?: string;
  workCycleId?: string;
  workCycleName?: string;
}

export interface JobCycle {
  id: string;
  folderId: string | null;
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
  responsible: string[]; // Default responsible roles/names (text)
  count: number; // Default count per batch usually
  machine: string;
  notes: string;
  setupMapId?: string;
}

// TASKS
export type TaskType = 'simple' | 'production';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived'; // Added 'archived'
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[]; // Who is doing this
  
  // Simple Task Fields
  description?: string;
  photo?: string;
  
  // Production Task Fields
  orderId?: string;
  stageId?: string; // Links to JobStage
  plannedQuantity?: number; // Maps to planQuantity in DB
  completedQuantity?: number; // Maps to factQuantity in DB
  pendingQuantity?: number; // Sum of PENDING reports (visualize separately)
  isFinalStage?: boolean; // New: Marks if this task represents the final assembly
  
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

// --- REPORTS ---
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
  
  // Manual Stock
  type?: 'production' | 'manual_stock' | 'manual_deduction' | 'manual_adjustment' | 'manual_defect';

  // Assembly / Consumption Tracking
  sourceBatchIds?: string[]; // IDs of reports from the previous stage used here
  usedQuantity?: number; // Amount of *this* report that has been consumed by the next stage

  // Data Snapshot (For History integrity if task is deleted)
  taskTitle?: string;
  orderNumber?: string;
  stageName?: string;
  productName?: string;
  
  // NEW: Batch Tracking
  batchCode?: string; // Specific batch code (e.g., "Shift-1", "A-123")
}

// --- NOTIFICATIONS ---
export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: any; // Firestore Timestamp
  type: string;
  // Enhanced Fields
  title?: string;
  target?: 'admin' | 'user' | 'global';
  linkId?: string;
}
