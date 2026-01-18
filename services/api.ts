
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
  updateDoc
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
const SETUP_MAPS_COLLECTION = "setupMaps";
const WORK_STORAGE_COLLECTION = "workStorage";
const NOTIFICATIONS_COLLECTION = "notifications";
const REPORTS_COLLECTION = "reports";

// Helper to handle permission errors gracefully
const handleFirestoreError = (error: any, context: string) => {
  console.error(`Firestore Error (${context}):`, error);
  
  if (error.code === 'permission-denied') {
    console.warn("⚠️ PERMISSION DENIED: Please check your Firestore Security Rules.");
  }
  
  // Specific handler for Index Requirement error
  if (error.code === 'failed-precondition' && error.message.includes('requires an index')) {
      const msg = `Developer Action Required: Create Firestore Index for '${context}'. Check console for link!`;
      console.warn(msg);
      // alert(msg); // Suppress alert to not spam user
  }
  return null; 
};

// Helper to sanitize objects for Firestore (removes undefined values)
const sanitizeForFirestore = (obj: any) => {
  return JSON.parse(JSON.stringify(obj));
};

const ApiService = {
  // --- ADMIN AUTH & SETTINGS ---
  
  async verifyAdmin(loginInput: string, passwordInput: string): Promise<boolean> {
    try {
      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.adminLogin === loginInput && data.adminPassword === passwordInput;
      } else {
        return loginInput === 'Admin' && passwordInput === 'Admin';
      }
    } catch (error) {
      handleFirestoreError(error, 'verifyAdmin');
      return false;
    }
  },

  async getAdminSettings() {
    try {
      const docRef = doc(db, 'settings', 'global');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
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

  // --- ROLE CONFIG / PERMISSIONS ---

  async getPermissions(): Promise<RoleConfig[]> {
    try {
        const docRef = doc(db, 'settings', 'permissions');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.roles || [];
        }
        return [];
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

  // --- USERS ---
  
  async getUsers(onlyActive: boolean = false): Promise<User[]> {
    try {
      let q = query(collection(db, USERS_COLLECTION));
      
      if (onlyActive) {
        q = query(collection(db, USERS_COLLECTION), where("isActive", "==", true));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Map displayName to firstName/lastName if necessary for UI compatibility
        let firstName = data.firstName;
        let lastName = data.lastName;
        
        if (!firstName && data.displayName) {
            const parts = data.displayName.split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
        }

        return {
          id: doc.id,
          ...data,
          firstName: firstName || 'User',
          lastName: lastName || doc.id.substring(0, 4)
        } as User;
      });
    } catch (error) {
      handleFirestoreError(error, 'getUsers');
      return []; 
    }
  },

  async getAdmins(): Promise<User[]> {
    try {
      const q = query(collection(db, USERS_COLLECTION), where("role", "==", "admin"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (error) {
      handleFirestoreError(error, 'getAdmins');
      return [];
    }
  },

  async getUser(id: string): Promise<User | null> {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        let firstName = data.firstName;
        let lastName = data.lastName;
        if (!firstName && data.displayName) {
            const parts = data.displayName.split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
        }
        return { 
            id: docSnap.id, 
            ...data,
            firstName: firstName || 'User',
            lastName: lastName || ''
        } as User;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, 'getUser');
      return null;
    }
  },

  async saveUser(user: User): Promise<void> {
    try {
      const userRef = doc(db, USERS_COLLECTION, user.id);
      const userData = { ...user };
      
      // Ensure displayName is synced
      if (!userData.displayName && userData.firstName) {
          userData.displayName = `${userData.firstName} ${userData.lastName}`.trim();
      }

      // Cleanup undefined
      const cleanData = sanitizeForFirestore(userData);
      
      await setDoc(userRef, cleanData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, 'saveUser');
      throw error;
    }
  },

  async deleteUser(userId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, USERS_COLLECTION, userId));
    } catch (error) {
      handleFirestoreError(error, 'deleteUser');
      throw error;
    }
  },

  async login(login: string, password: string): Promise<User> {
    try {
      // 1. Find User by Login
      const q = query(collection(db, USERS_COLLECTION), where("login", "==", login));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error("Користувача з таким логіном не знайдено");
      }
      
      const userDoc = querySnapshot.docs[0];
      const data = userDoc.data();
      
      // 2. STRICT PASSWORD CHECK
      // Ensure we compare strings and trim them to avoid whitespace issues
      const storedPassword = String(data.password || '').trim();
      const inputPassword = String(password || '').trim();
      
      if (storedPassword !== inputPassword) {
        throw new Error("Невірний пароль! Спробуйте ще раз.");
      }

      // 3. Return User Data if password matches
      return { 
          id: userDoc.id, 
          ...data,
          firstName: data.firstName || (data.displayName ? data.displayName.split(' ')[0] : 'User'),
          lastName: data.lastName || (data.displayName ? data.displayName.split(' ').slice(1).join(' ') : '')
      } as User;

    } catch (error: any) {
      // If it's our custom error, rethrow it for UI to display
      if (error.message === "Користувача з таким логіном не знайдено" || error.message === "Невірний пароль! Спробуйте ще раз.") {
        throw error;
      }
      handleFirestoreError(error, 'login');
      throw new Error("Помилка при вході в систему");
    }
  },

  // --- ATTENDANCE ---

  async getAttendanceRecords(userId?: string, date?: Date | string): Promise<AttendanceRecord[]> {
    try {
      let q = query(collection(db, ATTENDANCE_COLLECTION));
      if (userId) {
        q = query(q, where("userId", "==", userId));
      }
      
      // If date is string YYYY-MM-DD
      if (typeof date === 'string') {
         q = query(q, where("date", "==", date));
      }
      
      const snapshot = await getDocs(q);
      let records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      
      // If date is Date object (Month filter), filter client side to avoid complex index
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
        if (record.id && !record.id.startsWith('rec_temp')) {
            await setDoc(doc(db, ATTENDANCE_COLLECTION, record.id), data, { merge: true });
        } else {
            await addDoc(collection(db, ATTENDANCE_COLLECTION), data);
        }
    } catch (e) {
        handleFirestoreError(e, 'saveAttendanceRecord');
        throw e;
    }
  },

  async deleteAttendanceRecord(id: string): Promise<void> {
      try {
          await deleteDoc(doc(db, ATTENDANCE_COLLECTION, id));
      } catch (e) {
          handleFirestoreError(e, 'deleteAttendanceRecord');
          throw e;
      }
  },

  // --- WORK SCHEDULES ---

  async getSchedules(): Promise<WorkSchedule[]> {
      try {
          const snap = await getDocs(collection(db, SCHEDULES_COLLECTION));
          return snap.docs.map(d => ({id: d.id, ...d.data()} as WorkSchedule));
      } catch (e) {
          handleFirestoreError(e, 'getSchedules');
          return [];
      }
  },

  async saveSchedule(schedule: WorkSchedule): Promise<void> {
      try {
          const data = sanitizeForFirestore(schedule);
          if (schedule.id && !schedule.id.startsWith('sch_')) {
              await setDoc(doc(db, SCHEDULES_COLLECTION, schedule.id), data, { merge: true });
          } else {
              await addDoc(collection(db, SCHEDULES_COLLECTION), data);
          }
      } catch (e) {
          handleFirestoreError(e, 'saveSchedule');
          throw e;
      }
  },

  async deleteSchedule(id: string): Promise<void> {
      try {
          await deleteDoc(doc(db, SCHEDULES_COLLECTION, id));
      } catch (e) {
          handleFirestoreError(e, 'deleteSchedule');
          throw e;
      }
  },

  // --- NOTIFICATIONS ---

  subscribeToNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void {
    // Note: We avoid 'where' clauses here to prevent index errors and allow client-side filtering 
    // for complex logic (like "Target Admin OR My ID")
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION), 
      orderBy('createdAt', 'desc'),
      // limit(50) // Optional limit if needed
    );
    
    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));

      callback(notifications);
    }, (error) => handleFirestoreError(error, 'subscribeToNotifications'));
  },

  async sendNotification(userId: string, message: string, type: string = 'info', linkId?: string, target?: 'admin' | 'user' | 'global', title?: string): Promise<void> {
    try {
      const payload: any = {
        userId,
        message,
        type,
        read: false,
        createdAt: serverTimestamp(),
      };
      if (linkId) payload.linkId = linkId;
      if (target) payload.target = target;
      if (title) payload.title = title;

      await addDoc(collection(db, NOTIFICATIONS_COLLECTION), payload);
    } catch (error) {
      handleFirestoreError(error, 'sendNotification');
    }
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
        read: true
      });
    } catch (error) {
      handleFirestoreError(error, 'markNotificationRead');
    }
  },

  // --- ORDERS (Real-time & Promise) ---

  async getOrders(): Promise<Order[]> {
    try {
      // Client-side filter for deleted
      const querySnapshot = await getDocs(collection(db, ORDERS_COLLECTION));
      return querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Order))
        .filter((o: any) => !o.deleted);
    } catch (error) {
      handleFirestoreError(error, 'getOrders');
      return [];
    }
  },

  subscribeToOrders(callback: (orders: Order[]) => void): () => void {
    const q = query(collection(db, ORDERS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs
        .map(doc => {
            const data = doc.data();
            return {
            id: doc.id,
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
            deleted: data.deleted
            } as Order & { deleted?: boolean };
        })
        .filter(o => !o.deleted); // Filter soft deleted
      callback(orders);
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
        deleted: false // Ensure new/saved items are not deleted
      };
      
      const cleanData = sanitizeForFirestore(dbOrder);

      if (order.id && !order.id.startsWith('ord_temp')) {
         await setDoc(doc(db, ORDERS_COLLECTION, order.id), cleanData, { merge: true });
      } else {
         await addDoc(collection(db, ORDERS_COLLECTION), cleanData);
      }
    } catch (error) {
      handleFirestoreError(error, 'saveOrder');
      throw error;
    }
  },

  async deleteOrder(id: string): Promise<void> {
    try {
        // SOFT DELETE
        await updateDoc(doc(db, ORDERS_COLLECTION, id), {
            deleted: true,
            deletedAt: new Date().toISOString()
        });
    } catch(error) {
        handleFirestoreError(error, 'deleteOrder');
        throw error;
    }
  },

  // --- TASKS (Real-time & Promise) ---

  async getTasks(): Promise<Task[]> {
    try {
      const querySnapshot = await getDocs(collection(db, TASKS_COLLECTION));
      return querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Task))
        .filter((t: any) => !t.deleted);
    } catch (error) {
      handleFirestoreError(error, 'getTasks');
      return [];
    }
  },

  subscribeToTasks(callback: (tasks: Task[]) => void): () => void {
    const q = query(collection(db, TASKS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs
        .map(doc => {
            const data = doc.data();
            
            // Handle Assignee Mapping (Schema `assigneeId` vs Type `assigneeIds`)
            let assignees: string[] = [];
            if (data.assigneeId) assignees.push(data.assigneeId);
            if (data.assignedUserIds && Array.isArray(data.assignedUserIds)) {
                assignees = [...new Set([...assignees, ...data.assignedUserIds])];
            }

            // Handle Due Date Mapping
            let deadline = data.dueDate;
            if (data.dueDate && typeof data.dueDate === 'object' && 'seconds' in data.dueDate) {
                // Convert Timestamp to YYYY-MM-DD
                deadline = new Date(data.dueDate.seconds * 1000).toISOString().split('T')[0];
            }

            return {
            id: doc.id,
            type: data.type || 'simple',
            title: data.title,
            status: data.status,
            assigneeIds: assignees,
            orderId: data.orderId,
            plannedQuantity: data.planQuantity,
            completedQuantity: data.factQuantity || 0,
            description: data.description || '',
            priority: data.priority || 'medium',
            createdAt: data.createdAt,
            stageId: data.stageId,
            pendingQuantity: data.pendingQuantity || 0,
            deadline: deadline,
            isFinalStage: data.isFinalStage, // Map final stage flag
            deleted: data.deleted
            } as Task & { deleted?: boolean };
        })
        .filter(t => !t.deleted);
      callback(tasks);
    }, (error) => handleFirestoreError(error, 'subscribeToTasks'));
  },

  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    try {
      await updateDoc(doc(db, TASKS_COLLECTION, taskId), {
        status: status
      });
    } catch (error) {
      handleFirestoreError(error, 'updateTaskStatus');
      throw error;
    }
  },

  async saveTask(task: Task): Promise<void> {
    try {
      // Fetch users to populate display fields (names/photos)
      const usersQuery = query(collection(db, USERS_COLLECTION));
      const usersSnap = await getDocs(usersQuery);
      const allUsers = usersSnap.docs.map(d => ({id: d.id, ...d.data()} as User));
      
      const assignedUsers = allUsers.filter(u => task.assigneeIds.includes(u.id));
      const assigneeNames = assignedUsers.map(u => `${u.firstName} ${u.lastName}`);
      const assigneePhotos = assignedUsers.map(u => u.avatar || '');

      const dbTask = {
        type: task.type,
        title: task.title,
        status: task.status,
        priority: task.priority || 'medium',
        
        // Schema requirements
        assigneeId: task.assigneeIds.length > 0 ? task.assigneeIds[0] : null,
        assignedUserIds: task.assigneeIds, // Array of Strings
        assigneeNames: assigneeNames, // Array of Strings
        assigneePhotos: assigneePhotos, // Array of Strings
        
        orderId: task.orderId || null,
        planQuantity: task.plannedQuantity || 0,
        factQuantity: task.completedQuantity || 0,
        description: task.description || '',
        createdAt: task.createdAt || new Date().toISOString(),
        stageId: task.stageId || null,
        pendingQuantity: task.pendingQuantity || 0,
        isFinalStage: task.isFinalStage || false,
        
        dueDate: task.deadline || null, // Map FE deadline to DB dueDate
        deleted: false
      };

      const cleanData = sanitizeForFirestore(dbTask);

      if (task.id && !task.id.startsWith('task_temp') && !task.id.includes('now')) {
         await setDoc(doc(db, TASKS_COLLECTION, task.id), cleanData, { merge: true });
      } else {
         await addDoc(collection(db, TASKS_COLLECTION), cleanData);
      }
    } catch (error) {
      handleFirestoreError(error, 'saveTask');
      throw error;
    }
  },

  async deleteTask(id: string): Promise<void> {
    try {
        // SOFT DELETE
        await updateDoc(doc(db, TASKS_COLLECTION, id), {
            deleted: true,
            deletedAt: new Date().toISOString()
        });
    } catch(error) {
        handleFirestoreError(error, 'deleteTask');
        throw error;
    }
  },

  // --- PRODUCTS / CATALOGS (Real-time & Promise) ---

  async getProducts(): Promise<Product[]> {
      try {
          const q = query(collection(db, CATALOGS_COLLECTION), where("type", "==", "product"));
          const querySnapshot = await getDocs(q);
          return querySnapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name,
                    sku: data.sku,
                    photo: data.photoUrl,
                    colorTag: data.colorTag,
                    unit: data.unit,
                    description: data.description,
                    deleted: data.deleted,
                    jobCycleId: data.jobCycleId,
                    drawingId: data.drawingId
                } as Product & { deleted?: boolean };
            })
            .filter(p => !p.deleted);
      } catch (error) {
          handleFirestoreError(error, 'getProducts');
          return [];
      }
  },

  async getProduct(id: string): Promise<Product | null> {
      try {
          const docRef = doc(db, CATALOGS_COLLECTION, id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.deleted) return null;
              return {
                  id: docSnap.id,
                  name: data.name,
                  sku: data.sku,
                  photo: data.photoUrl,
                  colorTag: data.colorTag,
                  unit: data.unit,
                  description: data.description,
                  jobCycleId: data.jobCycleId,
                  drawingId: data.drawingId
              } as Product;
          }
          return null;
      } catch (error) {
          handleFirestoreError(error, 'getProduct');
          return null;
      }
  },

  subscribeToProducts(callback: (products: Product[]) => void): () => void {
    const q = query(collection(db, CATALOGS_COLLECTION), where("type", "==", "product"));
    return onSnapshot(q, (snapshot) => {
      const products = snapshot.docs
        .map(doc => {
            const data = doc.data();
            return {
            id: doc.id,
            name: data.name,
            sku: data.sku,
            photo: data.photoUrl,
            colorTag: data.colorTag,
            unit: data.unit,
            description: data.description,
            deleted: data.deleted,
            jobCycleId: data.jobCycleId,
            drawingId: data.drawingId
            } as Product & { deleted?: boolean };
        })
        .filter(p => !p.deleted);
      callback(products);
    }, (error) => handleFirestoreError(error, 'subscribeToProducts'));
  },

  async saveProduct(product: Product): Promise<void> {
    try {
      const dbProduct = {
        name: product.name,
        sku: product.sku,
        type: 'product',
        unit: 'pcs',
        photoUrl: product.photo || '',
        colorTag: product.colorTag || '#3b82f6',
        description: product.description || '',
        jobCycleId: product.jobCycleId || null,
        drawingId: product.drawingId || null,
        deleted: false
      };

      const cleanData = sanitizeForFirestore(dbProduct);

      if (product.id && !product.id.startsWith('prod_temp') && !product.id.includes('now')) {
         await setDoc(doc(db, CATALOGS_COLLECTION, product.id), cleanData, { merge: true });
      } else {
         await addDoc(collection(db, CATALOGS_COLLECTION), cleanData);
      }
    } catch (error) {
      handleFirestoreError(error, 'saveProduct');
      throw error;
    }
  },

  async deleteProduct(id: string): Promise<void> {
      try {
          // SOFT DELETE
          await updateDoc(doc(db, CATALOGS_COLLECTION, id), {
              deleted: true,
              deletedAt: new Date().toISOString()
          });
      } catch (error) {
          handleFirestoreError(error, 'deleteProduct');
          throw error;
      }
  },

  // --- TOOL CATALOG (Real-time & Promise) ---

  async getTools(): Promise<Tool[]> {
    try {
        const q = query(collection(db, TOOL_CATALOG_COLLECTION), where("type", "==", "tool"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                photo: data.photoUrl,
                unit: data.unit || 'pcs',
                description: data.description,
                folderId: data.folderId || null,
                colorTag: data.colorTag
            } as Tool;
        });
    } catch (error) {
        handleFirestoreError(error, 'getTools');
        return [];
    }
  },

  subscribeToTools(callback: (tools: Tool[]) => void): () => void {
    const q = query(collection(db, TOOL_CATALOG_COLLECTION), where("type", "==", "tool"));
    return onSnapshot(q, (snapshot) => {
      const tools = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          photo: data.photoUrl,
          unit: data.unit || 'pcs',
          description: data.description,
          folderId: data.folderId || null,
          colorTag: data.colorTag
        } as Tool;
      });
      callback(tools);
    }, (error) => handleFirestoreError(error, 'subscribeToTools'));
  },

  async saveTool(tool: Tool): Promise<void> {
    try {
      const dbTool = {
        name: tool.name,
        type: 'tool',
        unit: tool.unit,
        photoUrl: tool.photo || '',
        description: tool.description || '',
        folderId: tool.folderId || null,
        colorTag: tool.colorTag
      };

      const cleanData = sanitizeForFirestore(dbTool);

      if (tool.id && !tool.id.startsWith('t_')) {
         await setDoc(doc(db, TOOL_CATALOG_COLLECTION, tool.id), cleanData, { merge: true });
      } else {
         await addDoc(collection(db, TOOL_CATALOG_COLLECTION), cleanData);
      }
    } catch (error) {
      handleFirestoreError(error, 'saveTool');
      throw error;
    }
  },

  async deleteTool(id: string): Promise<void> {
      try {
          await deleteDoc(doc(db, TOOL_CATALOG_COLLECTION, id));
      } catch (error) {
          handleFirestoreError(error, 'deleteTool');
          throw error;
      }
  },

  async deleteToolFolder(id: string): Promise<void> {
      try {
          await deleteDoc(doc(db, TOOL_CATALOG_COLLECTION, id));
      } catch (error) {
          handleFirestoreError(error, 'deleteToolFolder');
          throw error;
      }
  },

  // --- DRAWINGS (Real-time & Promise) ---

  subscribeToDrawings(callback: (drawings: Drawing[]) => void): () => void {
    const q = query(collection(db, DRAWINGS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      const drawings = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        photo: doc.data().photoUrl
      } as Drawing));
      callback(drawings);
    }, (error) => handleFirestoreError(error, 'subscribeToDrawings'));
  },

  async saveDrawing(drawing: Drawing): Promise<void> {
    try {
      if (drawing.id && !drawing.id.startsWith('dwg_temp')) {
        await setDoc(doc(db, DRAWINGS_COLLECTION, drawing.id), {
          name: drawing.name,
          photoUrl: drawing.photo
        }, { merge: true });
      } else {
        await addDoc(collection(db, DRAWINGS_COLLECTION), {
          name: drawing.name,
          photoUrl: drawing.photo
        });
      }
    } catch (error) {
      handleFirestoreError(error, 'saveDrawing');
      throw error;
    }
  },

  async deleteDrawing(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, DRAWINGS_COLLECTION, id));
    } catch (error) {
      handleFirestoreError(error, 'deleteDrawing');
      throw error;
    }
  },

  // --- WAREHOUSE PRODUCTS (Real-time & Promise) ---

  subscribeToWarehouseStock(callback: (items: ProductStock[]) => void): () => void {
    const q = query(collection(db, WAREHOUSE_PRODUCTS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                productId: data.catalogId,
                folderId: data.folder,
                quantity: data.quantity,
                criticalQuantity: data.minQuantity || 0
            } as ProductStock;
        });
        callback(items);
    }, (error) => handleFirestoreError(error, 'subscribeToWarehouseStock'));
  },

  async addWarehouseItem(item: Partial<ProductStock>): Promise<void> {
    try {
        const data = {
            catalogId: item.productId,
            quantity: item.quantity,
            minQuantity: item.criticalQuantity,
            folder: item.folderId || null
        };
        await addDoc(collection(db, WAREHOUSE_PRODUCTS_COLLECTION), sanitizeForFirestore(data));
    } catch (error) {
        handleFirestoreError(error, 'addWarehouseItem');
        throw error;
    }
  },

  async updateWarehouseStock(id: string, newQuantity: number): Promise<void> {
    try {
        const ref = doc(db, WAREHOUSE_PRODUCTS_COLLECTION, id);
        await setDoc(ref, { quantity: newQuantity }, { merge: true });
    } catch (error) {
        handleFirestoreError(error, 'updateWarehouseStock');
        throw error;
    }
  },

  // --- DEFECTS ---

  subscribeToDefects(callback: (items: DefectItem[]) => void): () => void {
    const q = query(collection(db, DEFECTS_COLLECTION), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                productId: data.productId || data.catalogId, 
                quantity: data.quantity,
                // Mapped extended fields
                productName: data.productName,
                reason: data.reason,
                workerName: data.workerName,
                stageName: data.stageName, // Map stageName
                date: data.date,
                imageUrl: data.imageUrl // Specific drawing/photo for the defect
            } as DefectItem;
        });
        callback(items);
    }, (error) => handleFirestoreError(error, 'subscribeToDefects'));
  },

  subscribeToDefectHistory(callback: (history: any[]) => void): () => void {
    const q = query(collection(db, DEFECT_HISTORY_COLLECTION), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(history);
    }, (error) => handleFirestoreError(error, 'subscribeToDefectHistory'));
  },

  async addDefect(productId: string, quantity: number): Promise<void> {
      try {
          await addDoc(collection(db, DEFECTS_COLLECTION), {
              productId: productId,
              quantity: quantity,
              date: serverTimestamp(),
              reason: "Manual Addition"
          });
      } catch (error) {
          handleFirestoreError(error, 'addDefect');
          throw error;
      }
  },

  async scrapDefect(id: string, quantity: number, historyData?: { productName: string, sku: string, userName: string, date: string, stageName?: string, workerName?: string }): Promise<void> {
      try {
          const docRef = doc(db, DEFECTS_COLLECTION, id);
          await setDoc(docRef, { quantity: increment(-quantity) }, { merge: true });

          if (historyData) {
              await addDoc(collection(db, DEFECT_HISTORY_COLLECTION), {
                  date: historyData.date,
                  productName: historyData.productName,
                  sku: historyData.sku,
                  amount: quantity,
                  action: "scrapped", 
                  adminId: historyData.userName,
                  stageName: historyData.stageName || '',
                  workerName: historyData.workerName || ''
              });
          }
      } catch (error) {
          handleFirestoreError(error, 'scrapDefect');
          throw error;
      }
  },

  // --- REPORTS ---

  subscribeToReports(callback: (reports: ProductionReport[]) => void): () => void {
    const q = query(collection(db, REPORTS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          taskId: data.taskId,
          userId: data.userId,
          date: data.date,
          quantity: data.quantity,
          scrapQuantity: data.scrapQuantity || 0,
          notes: data.notes || '',
          status: data.status,
          type: data.type || 'production',
          createdAt: data.createdAt,
          usedQuantity: data.usedQuantity || 0,
          batchCode: data.batchCode || null,
          sourceBatchIds: data.sourceBatchIds || [],
          taskTitle: data.taskTitle,
          orderNumber: data.orderNumber,
          stageName: data.stageName,
          productName: data.productName
        } as ProductionReport;
      });
      callback(reports);
    }, (error) => handleFirestoreError(error, 'subscribeToReports'));
  },

  async createReport(report: ProductionReport): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, REPORTS_COLLECTION), {
        taskId: report.taskId,
        userId: report.userId,
        date: report.date,
        quantity: report.quantity,
        scrapQuantity: report.scrapQuantity,
        notes: report.notes,
        status: report.status || 'pending',
        type: report.type || 'production',
        createdAt: report.createdAt || new Date().toISOString(),
        usedQuantity: 0,
        batchCode: report.batchCode || null,
        sourceBatchIds: report.sourceBatchIds || []
      });

      // Increment Pending on Task if normal production
      if (report.status === 'pending') {
          const taskRef = doc(db, TASKS_COLLECTION, report.taskId);
          await updateDoc(taskRef, {
            pendingQuantity: increment(report.quantity)
          });
      }

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, 'createReport');
      throw error;
    }
  },

  async addManualStock(taskId: string, quantity: number, adminName: string): Promise<void> {
      try {
          const report: ProductionReport = {
              id: '',
              taskId,
              userId: 'admin_manual',
              date: new Date().toISOString().split('T')[0],
              quantity,
              scrapQuantity: 0,
              notes: `Manual Stock added by ${adminName}`,
              status: 'approved',
              type: 'manual_stock',
              createdAt: new Date().toISOString(),
              usedQuantity: 0
          };
          
          await addDoc(collection(db, REPORTS_COLLECTION), {
              ...report,
              status: 'approved', 
              type: 'manual_stock'
          });

          const taskRef = doc(db, TASKS_COLLECTION, taskId);
          await updateDoc(taskRef, {
              factQuantity: increment(quantity)
          });

      } catch (error) {
          handleFirestoreError(error, 'addManualStock');
          throw error;
      }
  },

  async updateReport(id: string, data: Partial<ProductionReport>): Promise<void> {
      try {
          await updateDoc(doc(db, REPORTS_COLLECTION, id), data);
      } catch(e) { throw e; }
  },

  async approveReport(id: string, report: ProductionReport): Promise<void> {
      try {
          await updateDoc(doc(db, REPORTS_COLLECTION, id), { status: 'approved' });
          const taskRef = doc(db, TASKS_COLLECTION, report.taskId);
          await updateDoc(taskRef, {
              completedQuantity: increment(report.quantity),
              pendingQuantity: increment(-report.quantity)
          });
      } catch(e) { throw e; }
  },

  async rejectReport(id: string, report: ProductionReport): Promise<void> {
      try {
          await updateDoc(doc(db, REPORTS_COLLECTION, id), { status: 'rejected' });
          const taskRef = doc(db, TASKS_COLLECTION, report.taskId);
          await updateDoc(taskRef, {
              pendingQuantity: increment(-report.quantity)
          });
      } catch(e) { throw e; }
  },

  // --- WORK STORAGE / CYCLES ---

  subscribeToWorkStorage(parentId: string | null, callback: (items: (JobFolder | JobCycle)[]) => void): () => void {
      let q;
      // Handle 'root' view: fetch items explicitly marked 'root' OR items with no parent (null)
      if (!parentId || parentId === 'root') {
          q = query(collection(db, WORK_STORAGE_COLLECTION), where("parentId", "in", ['root', null]));
      } else {
          // Handle specific folder view
          q = query(collection(db, WORK_STORAGE_COLLECTION), where("parentId", "==", parentId));
      }
      
      return onSnapshot(q, (snapshot) => {
          // FIX: Spread data first, then overwrite ID with doc.id to ensure valid ID
          const items = snapshot.docs.map(d => ({...d.data(), id: d.id} as (JobFolder | JobCycle)));
          callback(items);
      }, (e) => handleFirestoreError(e, 'subscribeToWorkStorage'));
  },

  async getWorkStorageItem(id: string): Promise<JobFolder | JobCycle | null> {
      try {
          const d = await getDoc(doc(db, WORK_STORAGE_COLLECTION, id));
          // FIX: Spread data first, then overwrite ID with doc.id
          return d.exists() ? ({...d.data(), id: d.id} as JobFolder | JobCycle) : null;
      } catch(e) { return null; }
  },

  async saveWorkStorageItem(item: JobFolder | JobCycle): Promise<void> {
      try {
          const data = sanitizeForFirestore(item);
          if (item.id) {
              await setDoc(doc(db, WORK_STORAGE_COLLECTION, item.id), data, { merge: true });
          } else {
              await addDoc(collection(db, WORK_STORAGE_COLLECTION), data);
          }
      } catch(e) { throw e; }
  },

  async updateWorkStorageItem(id: string, item: Partial<JobFolder | JobCycle>): Promise<void> {
      try {
          await updateDoc(doc(db, WORK_STORAGE_COLLECTION, id), item);
      } catch(e) { throw e; }
  },

  async deleteWorkStorageItem(id: string): Promise<void> {
      try {
          await updateDoc(doc(db, WORK_STORAGE_COLLECTION, id), { deletedAt: new Date().toISOString() });
      } catch(e) { throw e; }
  },

  async getJobCyclesByProduct(productId: string): Promise<JobCycle[]> {
      try {
          const q = query(collection(db, WORK_STORAGE_COLLECTION), where("productId", "==", productId));
          const snap = await getDocs(q);
          // FIX: Spread data first, then overwrite ID with doc.id
          return snap.docs.map(d => ({...d.data(), id: d.id} as JobCycle));
      } catch(e) { return []; }
  },

  // --- SETUP MAPS ---

  async getSetupMaps(): Promise<SetupMap[]> {
      try {
          const snap = await getDocs(collection(db, SETUP_MAPS_COLLECTION));
          return snap.docs.map(d => ({id: d.id, ...d.data()} as SetupMap));
      } catch(e) { return []; }
  },

  subscribeToSetupMaps(callback: (maps: SetupMap[]) => void): () => void {
      return onSnapshot(collection(db, SETUP_MAPS_COLLECTION), (snap) => {
          callback(snap.docs.map(d => ({id: d.id, ...d.data()} as SetupMap)));
      });
  },

  async getSetupMap(id: string): Promise<SetupMap | null> {
      try {
          const d = await getDoc(doc(db, SETUP_MAPS_COLLECTION, id));
          return d.exists() ? ({id: d.id, ...d.data()} as SetupMap) : null;
      } catch(e) { return null; }
  },

  async saveSetupMap(map: SetupMap): Promise<void> {
      try {
          const data = sanitizeForFirestore(map);
          if (map.id && !map.id.startsWith('sm_')) {
              await setDoc(doc(db, SETUP_MAPS_COLLECTION, map.id), data, { merge: true });
          } else {
              await addDoc(collection(db, SETUP_MAPS_COLLECTION), data);
          }
      } catch(e) { throw e; }
  },

  async deleteSetupMap(id: string): Promise<void> {
      try {
          await deleteDoc(doc(db, SETUP_MAPS_COLLECTION, id));
      } catch(e) { throw e; }
  },

  // --- TRASH & RESTORE ---

  async getTrashItems(type: string): Promise<any[]> {
      let colName = '';
      switch(type) {
          case 'task': colName = TASKS_COLLECTION; break;
          case 'order': colName = ORDERS_COLLECTION; break;
          case 'product': colName = CATALOGS_COLLECTION; break;
          case 'cycle': colName = WORK_STORAGE_COLLECTION; break;
          case 'setupMap': colName = SETUP_MAPS_COLLECTION; break;
          default: return [];
      }
      
      let q;
      if (type === 'cycle') {
          // WorkStorage uses deletedAt
          q = query(collection(db, colName), where("deletedAt", "!=", null));
      } else {
          // Others use deleted bool
          q = query(collection(db, colName), where("deleted", "==", true));
      }

      try {
          const snap = await getDocs(q);
          return snap.docs.map(d => ({id: d.id, ...d.data(), type}));
      } catch (e) {
          // Fallback if index missing or field undefined
          return [];
      }
  },

  async restoreItem(type: string, id: string): Promise<void> {
      let colName = '';
      switch(type) {
          case 'task': colName = TASKS_COLLECTION; break;
          case 'order': colName = ORDERS_COLLECTION; break;
          case 'product': colName = CATALOGS_COLLECTION; break;
          case 'cycle': colName = WORK_STORAGE_COLLECTION; break;
          case 'setupMap': colName = SETUP_MAPS_COLLECTION; break;
      }
      if(colName) {
          const updates: any = { deleted: false };
          if (type === 'cycle') updates.deletedAt = null;
          else updates.deletedAt = null; // Clean up just in case
          await updateDoc(doc(db, colName, id), updates);
      }
  },

  async permanentlyDeleteItem(type: string, id: string): Promise<void> {
      let colName = '';
      switch(type) {
          case 'task': colName = TASKS_COLLECTION; break;
          case 'order': colName = ORDERS_COLLECTION; break;
          case 'product': colName = CATALOGS_COLLECTION; break;
          case 'cycle': colName = WORK_STORAGE_COLLECTION; break;
          case 'setupMap': colName = SETUP_MAPS_COLLECTION; break;
      }
      if(colName) await deleteDoc(doc(db, colName, id));
  }

};

export const API = ApiService;
