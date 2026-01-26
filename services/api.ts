
import { db } from "./firebase";
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  setDoc, 
  query, 
  where, 
  deleteDoc,
  addDoc,
  onSnapshot,
  increment,
  orderBy,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
  limit
} from "firebase/firestore";
import { User, AttendanceRecord, WorkSchedule, Order, Task, Product, ProductStock, DefectItem, SetupMap, Drawing, Tool, JobFolder, JobCycle, Notification, ProductionReport, RoleConfig, ToolFolder, WarehouseItem, ProductionItem, ToolTransaction, JobStage } from "../types";
import { PayrollService } from "./payroll";

const USERS_COLLECTION = "users";
const SCHEDULES_COLLECTION = "workSchedules";
const ATTENDANCE_COLLECTION = "attendance";
const ORDERS_COLLECTION = "orders";
const TASKS_COLLECTION = "tasks";
const CATALOGS_COLLECTION = "catalogs";
const TOOL_CATALOG_COLLECTION = "toolCatalog";
const DRAWINGS_COLLECTION = "drawings";
const WAREHOUSE_PRODUCTS_COLLECTION = "warehouseProducts";
const DEFECTS_COLLECTION = "defects";
const DEFECT_HISTORY_COLLECTION = "defectHistory";
const SETUP_MAPS_COLLECTION = "setup_cards";
const WORK_STORAGE_COLLECTION = "workStorage";
const NOTIFICATIONS_COLLECTION = "notifications";
const REPORTS_COLLECTION = "reports";
const TOOL_FOLDERS_COLLECTION = "toolFolders";

const handleFirestoreError = (error: any, context: string) => {
  console.error(`Firestore Error (${context}):`, error);
  if (error.code === 'permission-denied') console.warn("⚠️ PERMISSION DENIED");
  if (error.code === 'failed-precondition' && error.message.includes('requires an index')) console.warn(`Developer Action Required: Create Firestore Index for '${context}'.`);
  if (error.code === 'unavailable') console.warn("⚠️ Firestore service is unavailable (Offline)");
  return null; 
};

/**
 * Ensures objects sent to Firestore contain no 'undefined' values.
 * Firestore throws errors on undefined; it expects null or a value.
 */
const sanitizeForFirestore = (obj: any) => {
  return JSON.parse(JSON.stringify(obj, (key, value) => 
    value === undefined ? null : value
  ));
};

const ApiService = {
  async verifyAdmin(loginInput: string, passwordInput: string): Promise<boolean> {
    try {
      const docRef = doc(db, 'settings', 'global');
      // If offline, getDoc might fail if not in cache. 
      // We try to fetch with a timeout-like behavior or handle the exception.
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.adminLogin === loginInput && data.adminPassword === passwordInput;
      } else {
        return loginInput === 'Admin' && passwordInput === 'Admin';
      }
    } catch (error: any) {
      handleFirestoreError(error, 'verifyAdmin');
      // Fallback for first-run or dev mode if offline
      if (loginInput === 'Admin' && passwordInput === 'Admin') return true;
      return false;
    }
  },

  async getAdminSettings() {
    try {
      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      handleFirestoreError(error, 'getAdminSettings');
      return null;
    }
  },

  async saveAdminSettings(login: string, password: string) {
    try {
      const docRef = doc(db, 'settings', 'global');
      await setDoc(docRef, { adminLogin: login, adminPassword: password }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, 'saveAdminSettings');
      throw error;
    }
  },

  async saveGlobalBackground(url: string): Promise<void> {
    try {
      const docRef = doc(db, 'settings', 'global');
      await setDoc(docRef, { backgroundImageUrl: url }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, 'saveGlobalBackground');
      throw error;
    }
  },

  async getPermissions(): Promise<RoleConfig[]> {
    try {
        const docRef = doc(db, 'settings', 'permissions');
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data().roles || []) : [];
    } catch (error) {
        handleFirestoreError(error, 'getPermissions');
        return [];
    }
  },

  async savePermissions(roles: RoleConfig[]): Promise<void> {
    try {
        const docRef = doc(db, 'settings', 'permissions');
        await setDoc(docRef, { roles }, { merge: true });
    } catch (error) {
        handleFirestoreError(error, 'savePermissions');
        throw error;
    }
  },

  async getUsers(onlyActive: boolean = false): Promise<User[]> {
    try {
      let q = query(collection(db, USERS_COLLECTION));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        let firstName = data.firstName;
        let lastName = data.lastName;
        if (!firstName && data.displayName) {
            const parts = data.displayName.split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
        }
        return { ...data, id: doc.id, firstName: firstName || 'User', lastName: lastName || doc.id.substring(0, 4) } as User;
      });
    } catch (error) {
      handleFirestoreError(error, 'getUsers');
      return []; 
    }
  },

  async getUser(id: string): Promise<User | null> {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { ...docSnap.data(), id: docSnap.id } as User : null;
    } catch (error) {
      handleFirestoreError(error, 'getUser');
      return null;
    }
  },

  async saveUser(user: User): Promise<void> {
    try {
      const userRef = doc(db, USERS_COLLECTION, user.id);
      await setDoc(userRef, sanitizeForFirestore(user), { merge: true });
    } catch (error) {
      handleFirestoreError(error, 'saveUser');
      throw error;
    }
  },

  async login(login: string, password: string): Promise<User> {
    try {
      const q = query(collection(db, USERS_COLLECTION), where("login", "==", login));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) throw new Error("Користувача з таким логіном не знайдено");
      const userDoc = querySnapshot.docs[0];
      const data = userDoc.data();
      if (String(data.password || '').trim() !== String(password || '').trim()) throw new Error("Невірний пароль! Спробуйте ще раз.");
      return { ...data, id: userDoc.id } as User;
    } catch (error: any) {
      if (error.message.includes("Користувача") || error.message.includes("пароль")) throw error;
      handleFirestoreError(error, 'login');
      throw new Error("Помилка при вході в систему (перевірте інтернет)");
    }
  },

  async getAttendanceRecords(userId?: string, date?: Date | string): Promise<AttendanceRecord[]> {
    try {
      let q = query(collection(db, ATTENDANCE_COLLECTION));
      if (userId) q = query(q, where("userId", "==", userId));
      if (typeof date === 'string') q = query(q, where("date", "==", date));
      const snapshot = await getDocs(q);
      let records = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AttendanceRecord));
      if (date instanceof Date) {
          const targetMonth = date.getMonth();
          const targetYear = date.getFullYear();
          records = records.filter(r => {
              const rDate = new Date(r.date);
              return rDate.getMonth() === targetMonth && rDate.getFullYear() === targetYear;
          });
      }
      return records;
    } catch (e) {
      handleFirestoreError(e, 'getAttendanceRecords');
      return [];
    }
  },

  async saveAttendanceRecord(record: AttendanceRecord, user: User, schedules: WorkSchedule[]): Promise<void> {
    try {
        const data = sanitizeForFirestore(record);
        if (record.id && !record.id.startsWith('rec_temp')) await setDoc(doc(db, ATTENDANCE_COLLECTION, record.id), data, { merge: true });
        else await addDoc(collection(db, ATTENDANCE_COLLECTION), data);
    } catch (e) {
        handleFirestoreError(e, 'saveAttendanceRecord');
        throw e;
    }
  },

  async deleteAttendanceRecord(id: string): Promise<void> {
      try { await deleteDoc(doc(db, ATTENDANCE_COLLECTION, id)); } catch (e) { handleFirestoreError(e, 'deleteAttendanceRecord'); throw e; }
  },

  async getSchedules(): Promise<WorkSchedule[]> {
      try {
          const snap = await getDocs(collection(db, SCHEDULES_COLLECTION));
          return snap.docs.map(d => ({...d.data(), id: d.id} as WorkSchedule));
      } catch (e) {
          handleFirestoreError(e, 'getSchedules');
          return [];
      }
  },

  async saveSchedule(schedule: WorkSchedule): Promise<void> {
      try {
          const data = sanitizeForFirestore(schedule);
          if (schedule.id && !schedule.id.startsWith('sch_')) await setDoc(doc(db, SCHEDULES_COLLECTION, schedule.id), data, { merge: true });
          else await addDoc(collection(db, SCHEDULES_COLLECTION), data);
      } catch (e) {
          handleFirestoreError(e, 'saveSchedule');
          throw e;
      }
  },

  async deleteSchedule(id: string): Promise<void> {
      try { await deleteDoc(doc(db, SCHEDULES_COLLECTION, id)); } catch (e) { handleFirestoreError(e, 'deleteSchedule'); throw e; }
  },

  subscribeToNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void {
    const q = query(collection(db, NOTIFICATIONS_COLLECTION), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notification)));
    }, (error) => handleFirestoreError(error, 'subscribeToNotifications'));
  },

  async sendNotification(userId: string, message: string, type: string = 'info', linkId?: string, target?: 'admin' | 'user' | 'global', title?: string): Promise<void> {
    try {
      const payload: any = { userId, message, type, read: false, createdAt: serverTimestamp() };
      if (linkId) payload.linkId = linkId;
      if (target) payload.target = target;
      if (title) payload.title = title;
      await addDoc(collection(db, NOTIFICATIONS_COLLECTION), sanitizeForFirestore(payload));
    } catch (error) {
      handleFirestoreError(error, 'sendNotification');
    }
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), { read: true });
    } catch (error) {
      handleFirestoreError(error, 'markNotificationRead');
    }
  },

  async getOrders(): Promise<Order[]> {
    try {
      const q = query(collection(db, ORDERS_COLLECTION));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          orderNumber: data.orderNumber,
          productId: data.productCatalogId,
          quantity: data.targetQuantity,
          deadline: data.deadline,
          status: data.status,
          progress: data.progress || 0,
          customerName: data.customerName || '',
          createdAt: data.createdAt,
          workCycleId: data.workCycleId,
          workCycleName: data.workCycleName,
          deleted: data.deleted,
          id: doc.id
        } as Order & { deleted?: boolean };
      }).filter(o => !o.deleted);
    } catch (error) {
      handleFirestoreError(error, 'getOrders');
      return [];
    }
  },

  subscribeToOrders(callback: (orders: Order[]) => void): () => void {
    const q = query(collection(db, ORDERS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          orderNumber: data.orderNumber,
          productId: data.productCatalogId,
          quantity: data.targetQuantity,
          deadline: data.deadline,
          status: data.status,
          progress: data.progress || 0,
          customerName: data.customerName || '',
          createdAt: data.createdAt,
          workCycleId: data.workCycleId,
          workCycleName: data.workCycleName,
          deleted: data.deleted,
          id: doc.id
        } as Order & { deleted?: boolean };
      }).filter(o => !o.deleted));
    }, (error) => handleFirestoreError(error, 'subscribeToOrders'));
  },

  async saveOrder(order: Order): Promise<void> {
    try {
      const dbOrder = {
        orderNumber: order.orderNumber,
        productCatalogId: order.productId,
        targetQuantity: order.quantity,
        deadline: order.deadline,
        status: order.status,
        customerName: order.customerName || '',
        createdAt: order.createdAt || new Date().toISOString(),
        progress: order.progress || 0,
        workCycleId: order.workCycleId || null,
        workCycleName: order.workCycleName || null,
        deleted: false
      };
      if (order.id && !order.id.startsWith('ord_temp')) await setDoc(doc(db, ORDERS_COLLECTION, order.id), sanitizeForFirestore(dbOrder), { merge: true });
      else await addDoc(collection(db, ORDERS_COLLECTION), sanitizeForFirestore(dbOrder));
    } catch (error) {
      handleFirestoreError(error, 'saveOrder');
      throw error;
    }
  },

  async deleteOrder(id: string): Promise<void> {
    try { await updateDoc(doc(db, ORDERS_COLLECTION, id), { deleted: true, deletedAt: new Date().toISOString() }); } catch(error) { handleFirestoreError(error, 'deleteOrder'); throw error; }
  },

  async getTasks(): Promise<Task[]> {
    try {
      const querySnapshot = await getDocs(collection(db, TASKS_COLLECTION));
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task)).filter((t: any) => !t.deleted);
    } catch (error) {
      handleFirestoreError(error, 'getTasks');
      return [];
    }
  },

  subscribeToTasks(callback: (tasks: Task[]) => void): () => void {
    const q = query(collection(db, TASKS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => {
          const data = doc.data();
          let assignees: string[] = data.assignedUserIds || [];
          if (data.assigneeId && !assignees.includes(data.assigneeId)) assignees.push(data.assigneeId);
          let deadline = data.dueDate || data.deadline;
          if (deadline && typeof deadline === 'object' && 'seconds' in deadline) deadline = new Date(deadline.seconds * 1000).toISOString().split('T')[0];
          return { ...data, id: doc.id, assigneeIds: assignees, plannedQuantity: data.planQuantity || 0, completedQuantity: data.factQuantity || 0, deadline } as Task;
      }).filter((t: any) => !t.deleted));
    }, (error) => handleFirestoreError(error, 'subscribeToTasks'));
  },

  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    try { await updateDoc(doc(db, TASKS_COLLECTION, taskId), { status }); } catch (error) { handleFirestoreError(error, 'updateTaskStatus'); throw error; }
  },

  async saveTask(task: Task): Promise<void> {
    try {
      const dbTask = {
        type: task.type,
        title: task.title,
        status: task.status,
        priority: task.priority || 'medium',
        assignedUserIds: task.assigneeIds,
        orderId: task.orderId || null,
        planQuantity: task.plannedQuantity || 0,
        factQuantity: task.completedQuantity || 0,
        description: task.description || '',
        createdAt: task.createdAt || new Date().toISOString(),
        stageId: task.stageId || null,
        pendingQuantity: task.pendingQuantity || 0,
        isFinalStage: task.isFinalStage || false,
        dueDate: task.deadline || null,
        deleted: false
      };
      if (task.id && !task.id.startsWith('task_temp')) await setDoc(doc(db, TASKS_COLLECTION, task.id), sanitizeForFirestore(dbTask), { merge: true });
      else await addDoc(collection(db, TASKS_COLLECTION), sanitizeForFirestore(dbTask));
    } catch (error) {
      handleFirestoreError(error, 'saveTask');
      throw error;
    }
  },

  async deleteTask(id: string): Promise<void> {
    try { await updateDoc(doc(db, TASKS_COLLECTION, id), { deleted: true, deletedAt: new Date().toISOString() }); } catch(error) { handleFirestoreError(error, 'deleteTask'); throw error; }
  },

  async getProducts(): Promise<Product[]> {
      try {
          const q = query(collection(db, CATALOGS_COLLECTION), where("type", "==", "product"));
          const querySnapshot = await getDocs(q);
          return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)).filter(p => !p.deleted);
      } catch (error) {
          handleFirestoreError(error, 'getProducts');
          return [];
      }
  },

  subscribeToProducts(callback: (products: Product[]) => void): () => void {
    const q = query(collection(db, CATALOGS_COLLECTION), where("type", "==", "product"));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)).filter(p => !p.deleted));
    }, (error) => handleFirestoreError(error, 'subscribeToProducts'));
  },

  async getProduct(id: string): Promise<Product | null> {
      try {
          const docRef = doc(db, CATALOGS_COLLECTION, id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && !docSnap.data().deleted) return { ...docSnap.data(), id: docSnap.id } as Product;
          return null;
      } catch (error) {
          handleFirestoreError(error, 'getProduct');
          return null;
      }
  },

  async saveProduct(product: Product): Promise<void> {
    try {
      const dbProduct = { name: product.name, sku: product.sku, type: 'product', photoUrl: product.photo || '', colorTag: product.colorTag || '#3b82f6', description: product.description || '', jobCycleId: product.jobCycleId || null, drawingId: product.drawingId || null, deleted: false };
      if (product.id && !product.id.startsWith('prod_temp')) await setDoc(doc(db, CATALOGS_COLLECTION, product.id), sanitizeForFirestore(dbProduct), { merge: true });
      else await addDoc(collection(db, CATALOGS_COLLECTION), sanitizeForFirestore(dbProduct));
    } catch (error) {
      handleFirestoreError(error, 'saveProduct');
      throw error;
    }
  },

  async deleteProduct(id: string): Promise<void> {
      try { await updateDoc(doc(db, CATALOGS_COLLECTION, id), { deleted: true, deletedAt: new Date().toISOString() }); } catch (error) { handleFirestoreError(error, 'deleteProduct'); throw error; }
  },

  async getTools(): Promise<Tool[]> {
    try {
        const q = query(collection(db, TOOL_CATALOG_COLLECTION), where("type", "==", "tool"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, photo: doc.data().photoUrl } as Tool));
    } catch (error) {
        handleFirestoreError(error, 'getTools');
        return [];
    }
  },

  subscribeToTools(callback: (tools: Tool[]) => void): () => void {
    const q = query(collection(db, TOOL_CATALOG_COLLECTION), where("type", "==", "tool"));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, photo: doc.data().photoUrl } as Tool)));
    }, (error) => handleFirestoreError(error, 'subscribeToTools'));
  },

  async saveTool(tool: Tool): Promise<void> {
    try {
      const dbTool = { name: tool.name, type: 'tool', unit: tool.unit, photoUrl: tool.photo || '', description: tool.description || '', folderId: tool.folderId || null, colorTag: tool.colorTag };
      if (tool.id && !tool.id.startsWith('t_')) await setDoc(doc(db, TOOL_CATALOG_COLLECTION, tool.id), sanitizeForFirestore(dbTool), { merge: true });
      else await addDoc(collection(db, TOOL_CATALOG_COLLECTION), sanitizeForFirestore(dbTool));
    } catch (error) {
      handleFirestoreError(error, 'saveTool');
      throw error;
    }
  },

  subscribeToToolFolders(type: 'catalog' | 'warehouse' | 'production', callback: (folders: ToolFolder[]) => void): () => void {
    const q = query(collection(db, TOOL_FOLDERS_COLLECTION), where("type", "==", type));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ToolFolder)));
    }, (error) => handleFirestoreError(error, 'subscribeToToolFolders'));
  },

  async saveToolFolder(folder: ToolFolder): Promise<void> {
    try { await setDoc(doc(db, TOOL_FOLDERS_COLLECTION, folder.id), sanitizeForFirestore(folder), { merge: true }); } catch (error) { handleFirestoreError(error, 'saveToolFolder'); throw error; }
  },

  async deleteTool(id: string): Promise<void> {
      try { await deleteDoc(doc(db, TOOL_CATALOG_COLLECTION, id)); } catch (error) { handleFirestoreError(error, 'deleteTool'); throw error; }
  },

  async deleteToolFolder(id: string): Promise<void> {
      try { await deleteDoc(doc(db, TOOL_FOLDERS_COLLECTION, id)); } catch (error) { handleFirestoreError(error, 'deleteToolFolder'); throw error; }
  },

  subscribeToDrawings(callback: (drawings: Drawing[]) => void): () => void {
    return onSnapshot(collection(db, DRAWINGS_COLLECTION), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name, photo: doc.data().photoUrl } as Drawing)));
    }, (error) => handleFirestoreError(error, 'subscribeToDrawings'));
  },

  async saveDrawing(drawing: Drawing): Promise<void> {
    try {
      const data = { name: drawing.name, photoUrl: drawing.photo };
      if (drawing.id && !drawing.id.startsWith('dwg_temp')) await setDoc(doc(db, DRAWINGS_COLLECTION, drawing.id), sanitizeForFirestore(data), { merge: true });
      else await addDoc(collection(db, DRAWINGS_COLLECTION), sanitizeForFirestore(data));
    } catch (error) {
      handleFirestoreError(error, 'saveDrawing');
      throw error;
    }
  },

  async deleteDrawing(id: string): Promise<void> {
    try { await deleteDoc(doc(db, DRAWINGS_COLLECTION, id)); } catch (error) { handleFirestoreError(error, 'deleteDrawing'); throw error; }
  },

  subscribeToWarehouseStock(callback: (items: ProductStock[]) => void): () => void {
    return onSnapshot(collection(db, WAREHOUSE_PRODUCTS_COLLECTION), (snapshot) => {
        callback(snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, productId: data.catalogId, folderId: data.folder, quantity: data.quantity, criticalQuantity: data.minQuantity || 0 } as ProductStock;
        }));
    }, (error) => handleFirestoreError(error, 'subscribeToWarehouseStock'));
  },

  async addWarehouseItem(item: Partial<ProductStock>): Promise<void> {
    try {
        const data = { catalogId: item.productId, quantity: item.quantity, minQuantity: item.criticalQuantity, folder: item.folderId || null };
        await addDoc(collection(db, WAREHOUSE_PRODUCTS_COLLECTION), sanitizeForFirestore(data));
    } catch (error) { handleFirestoreError(error, 'addWarehouseItem'); throw error; }
  },

  async updateWarehouseStock(id: string, newQuantity: number): Promise<void> {
    try { await updateDoc(doc(db, WAREHOUSE_PRODUCTS_COLLECTION, id), { quantity: newQuantity }); } catch (error) { handleFirestoreError(error, 'updateWarehouseStock'); throw error; }
  },

  subscribeToDefects(callback: (items: DefectItem[]) => void): () => void {
    const q = query(collection(db, DEFECTS_COLLECTION), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any)));
    }, (error) => handleFirestoreError(error, 'subscribeToDefects'));
  },

  subscribeToDefectHistory(callback: (history: any[]) => void): () => void {
    const q = query(collection(db, DEFECT_HISTORY_COLLECTION), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (error) => handleFirestoreError(error, 'subscribeToDefectHistory'));
  },

  async addDefect(productId: string, quantity: number): Promise<void> {
      try { await addDoc(collection(db, DEFECTS_COLLECTION), sanitizeForFirestore({ productId, quantity, date: serverTimestamp(), reason: "Manual Addition" })); } catch (error) { handleFirestoreError(error, 'addDefect'); throw error; }
  },

  async scrapDefect(id: string, quantity: number, historyData?: any): Promise<void> {
      try {
          await updateDoc(doc(db, DEFECTS_COLLECTION, id), { quantity: increment(-quantity) });
          if (historyData) await addDoc(collection(db, DEFECT_HISTORY_COLLECTION), sanitizeForFirestore(historyData));
      } catch (error) { handleFirestoreError(error, 'scrapDefect'); throw error; }
  },

  subscribeToReports(callback: (reports: ProductionReport[]) => void): () => void {
    const q = query(collection(db, REPORTS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductionReport)));
    }, (error) => handleFirestoreError(error, 'subscribeToReports'));
  },

  async updateReport(id: string, data: Partial<ProductionReport>): Promise<void> {
      try { await updateDoc(doc(db, REPORTS_COLLECTION, id), sanitizeForFirestore(data)); } catch(e) { throw e; }
  },

  async approveReport(id: string, report: ProductionReport): Promise<void> {
      try {
          const batch = writeBatch(db);

          batch.update(doc(db, REPORTS_COLLECTION, id), { status: 'approved' });
          
          const taskRef = doc(db, TASKS_COLLECTION, report.taskId);
          const taskSnap = await getDoc(taskRef);
          
          if (taskSnap.exists()) {
            const taskData = taskSnap.data();
            const newFact = (taskData.factQuantity || 0) + report.quantity;
            const plan = taskData.planQuantity || 0;
            
            batch.update(taskRef, {
                factQuantity: increment(report.quantity),
                pendingQuantity: increment(-report.quantity),
                status: (newFact >= plan && plan > 0) ? 'done' : 'in_progress',
                updatedAt: serverTimestamp()
            });

            if (report.sourceConsumption) {
                Object.entries(report.sourceConsumption).forEach(([sourceBatchId, qty]) => {
                    batch.update(doc(db, REPORTS_COLLECTION, sourceBatchId), {
                        usedQuantity: increment(qty)
                    });
                });
            }

            if (taskData.isFinalStage && taskData.orderId) {
                const orderSnap = await getDoc(doc(db, ORDERS_COLLECTION, taskData.orderId));
                if (orderSnap.exists()) {
                    const productId = orderSnap.data().productCatalogId;
                    
                    const whQuery = query(collection(db, WAREHOUSE_PRODUCTS_COLLECTION), where("catalogId", "==", productId));
                    const whSnap = await getDocs(whQuery);
                    
                    if (!whSnap.empty) {
                        batch.update(whSnap.docs[0].ref, { quantity: increment(report.quantity) });
                    } else {
                        const newWhRef = doc(collection(db, WAREHOUSE_PRODUCTS_COLLECTION));
                        batch.set(newWhRef, sanitizeForFirestore({
                            catalogId: productId,
                            quantity: report.quantity,
                            minQuantity: 0,
                            folder: null
                        }));
                    }
                }
            }

            if (report.scrapQuantity > 0) {
                const newDefectRef = doc(collection(db, DEFECTS_COLLECTION));
                batch.set(newDefectRef, sanitizeForFirestore({
                    productId: report.productName || 'unknown',
                    quantity: report.scrapQuantity,
                    reason: report.notes || "Виявлено під час виробництва",
                    date: serverTimestamp(),
                    stageName: report.stageName || taskData.title,
                }));
            }
          }
          
          await batch.commit();
      } catch(e) { 
        console.error("Error in approveReport:", e);
        throw e; 
      }
  },

  async rejectReport(id: string, report: ProductionReport): Promise<void> {
      try {
          await updateDoc(doc(db, REPORTS_COLLECTION, id), { status: 'rejected' });
          await updateDoc(doc(db, TASKS_COLLECTION, report.taskId), {
              pendingQuantity: increment(-report.quantity),
              updatedAt: serverTimestamp()
          });
      } catch(e) { throw e; }
  },

  subscribeToWorkStorage(parentId: string | null, callback: (items: (JobFolder | JobCycle)[]) => void): () => void {
      let q = (!parentId || parentId === 'root') ? query(collection(db, WORK_STORAGE_COLLECTION), where("parentId", "in", ['root', null])) : query(collection(db, WORK_STORAGE_COLLECTION), where("parentId", "==", parentId));
      return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(d => ({...d.data(), id: d.id} as any))), (e) => handleFirestoreError(e, 'subscribeToWorkStorage'));
  },

  async getWorkStorageItem(id: string): Promise<JobFolder | JobCycle | null> {
      const d = await getDoc(doc(db, WORK_STORAGE_COLLECTION, id));
      return d.exists() ? ({...d.data(), id: d.id} as any) : null;
  },

  async saveWorkStorageItem(item: JobFolder | JobCycle): Promise<void> {
      const data = sanitizeForFirestore(item);
      if (item.id) await setDoc(doc(db, WORK_STORAGE_COLLECTION, item.id), data, { merge: true });
      else await addDoc(collection(db, WORK_STORAGE_COLLECTION), data);
  },

  async updateWorkStorageItem(id: string, item: Partial<JobFolder | JobCycle>): Promise<void> {
      await updateDoc(doc(db, WORK_STORAGE_COLLECTION, id), sanitizeForFirestore(item));
  },

  async deleteWorkStorageItem(id: string): Promise<void> {
      await updateDoc(doc(db, WORK_STORAGE_COLLECTION, id), { deletedAt: new Date().toISOString() });
  },

  async getJobCyclesByProduct(productId: string): Promise<JobCycle[]> {
      const q = query(collection(db, WORK_STORAGE_COLLECTION), where("productId", "==", productId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({...d.data(), id: d.id} as JobCycle));
  },

  async getSetupMaps(): Promise<SetupMap[]> {
      const snap = await getDocs(collection(db, SETUP_MAPS_COLLECTION));
      return snap.docs.map(d => ({...d.data(), id: d.id} as any)).filter(m => !m.deleted);
  },

  subscribeToSetupMaps(callback: (maps: SetupMap[]) => void): () => void {
      return onSnapshot(collection(db, SETUP_MAPS_COLLECTION), (snap) => callback(snap.docs.map(d => ({...d.data(), id: d.id} as any)).filter(m => !m.deleted)));
  },

  async getSetupMap(id: string): Promise<SetupMap | null> {
      const d = await getDoc(doc(db, SETUP_MAPS_COLLECTION, id));
      return d.exists() && !d.data().deleted ? {...d.data(), id: d.id} as SetupMap : null;
  },

  async saveSetupMap(map: SetupMap): Promise<void> {
      const data = sanitizeForFirestore(map);
      if (map.id && !map.id.startsWith('sm_')) await setDoc(doc(db, SETUP_MAPS_COLLECTION, map.id), data, { merge: true });
      else await addDoc(collection(db, SETUP_MAPS_COLLECTION), data);
  },

  async deleteSetupMap(id: string): Promise<void> {
      await updateDoc(doc(db, SETUP_MAPS_COLLECTION, id), { deleted: true, deletedAt: new Date().toISOString() }); 
  },

  async getTrashItems(type: string): Promise<any[]> {
      let colName = type === 'task' ? TASKS_COLLECTION : type === 'order' ? ORDERS_COLLECTION : type === 'product' ? CATALOGS_COLLECTION : type === 'cycle' ? WORK_STORAGE_COLLECTION : type === 'setupMap' ? SETUP_MAPS_COLLECTION : '';
      if (!colName) return [];
      let q = type === 'cycle' ? query(collection(db, colName), where("deletedAt", "!=", null)) : query(collection(db, colName), where("deleted", "==", true));
      const snap = await getDocs(q); 
      return snap.docs.map(d => ({...d.data(), id: d.id, type})); 
  },

  async restoreItem(type: string, id: string): Promise<void> {
      let colName = type === 'task' ? TASKS_COLLECTION : type === 'order' ? ORDERS_COLLECTION : type === 'product' ? CATALOGS_COLLECTION : type === 'cycle' ? WORK_STORAGE_COLLECTION : type === 'setupMap' ? SETUP_MAPS_COLLECTION : '';
      if (colName) await updateDoc(doc(db, colName, id), { deleted: false, deletedAt: null });
  },

  async permanentlyDeleteItem(type: string, id: string): Promise<void> {
      let colName = type === 'task' ? TASKS_COLLECTION : type === 'order' ? ORDERS_COLLECTION : type === 'product' ? CATALOGS_COLLECTION : type === 'cycle' ? WORK_STORAGE_COLLECTION : type === 'setupMap' ? SETUP_MAPS_COLLECTION : '';
      if (colName) await deleteDoc(doc(db, colName, id));
  }
};

export const API = ApiService;
