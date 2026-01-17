import { 
  User, WorkSchedule, Order, Task, JobCycle, JobFolder, 
  Product, Drawing, SetupMap, Tool, ToolFolder, 
  WarehouseItem, ProductionItem, ToolTransaction, ProductionReport,
  Role, JobStage, SetupBlock, Break, ProductStock, DefectItem, ProductTransaction, ProductFolder, ProductTransactionType
} from '../types';

export const DEFAULT_BREAKS: Break[] = [
  { id: 'b1', name: 'Обід', durationMinutes: 60, isPaid: false },
  { id: 'b2', name: 'Перерва 1', durationMinutes: 15, isPaid: true },
  { id: 'b3', name: 'Перерва 2', durationMinutes: 15, isPaid: true },
];

// Mock Data
const MOCK_USERS: User[] = [
  { id: 'u1', firstName: 'Іван', lastName: 'Петренко', login: 'ivan', role: 'worker', position: 'Токар', monthlyRate: 15000 },
  { id: 'u2', firstName: 'Адмін', lastName: 'Головний', login: 'admin', role: 'admin', position: 'Керівник' },
];

class MockStoreService {
  users: User[] = [...MOCK_USERS];
  schedules: WorkSchedule[] = [];
  orders: Order[] = [];
  tasks: Task[] = [];
  
  // Production System
  cycles: JobCycle[] = [];
  folders: JobFolder[] = [];
  products: Product[] = [];
  drawings: Drawing[] = [];
  setupMaps: SetupMap[] = [];
  
  // Product Warehouse & Defects
  productFolders: ProductFolder[] = [];
  productStocks: ProductStock[] = [];
  defectItems: DefectItem[] = [];
  productTransactions: ProductTransaction[] = [];

  // Tools System
  tools: Tool[] = [];
  toolFolders: ToolFolder[] = [];
  warehouse: WarehouseItem[] = [];
  productionItems: ProductionItem[] = [];
  transactions: ToolTransaction[] = [];
  
  reports: ProductionReport[] = [];
  trash: any[] = [];

  constructor() {
    // Initial dummy data for demo
    this.toolFolders = [
        { id: 'tf1', name: 'Свердла', parentId: null, type: 'catalog' },
        { id: 'tf2', name: 'Пластини', parentId: null, type: 'catalog' },
    ];
    this.tools = [
        { id: 't1', name: 'Свердло 5мм', unit: 'pcs', photo: '', folderId: 'tf1' },
        { id: 't2', name: 'WNMG 080408', unit: 'pack', photo: '', folderId: 'tf2' },
    ];
    this.warehouse = [
        { id: 'wh1', toolId: 't1', folderId: null, quantity: 10, criticalQuantity: 2 }
    ];
    // Dummy Setup Map
    this.setupMaps = [
        {
            id: 'sm1',
            name: 'Demo Map',
            machine: 'CNC-1',
            blocks: [
                { id: 'b1', toolNumber: '1', toolName: 'Drill 5mm', settings: 'S=1000' }
            ]
        }
    ];
  }

  // --- USERS ---
  getUsers() { return this.users; }
  saveUser(user: User) {
      const idx = this.users.findIndex(u => u.id === user.id);
      if (idx >= 0) this.users[idx] = user;
      else this.users.push(user);
  }

  // --- ORDERS ---
  getOrders() { return this.orders; }
  getOrder(id: string) { return this.orders.find(o => o.id === id); }
  saveOrder(order: Order) {
      const idx = this.orders.findIndex(o => o.id === order.id);
      if (idx >= 0) this.orders[idx] = order;
      else this.orders.push(order);
  }

  // --- TASKS ---
  getTasks() { return this.tasks; }
  saveTask(task: Task) {
      const idx = this.tasks.findIndex(t => t.id === task.id);
      if (idx >= 0) this.tasks[idx] = task;
      else this.tasks.push(task);
  }

  // --- PRODUCTS & DRAWINGS ---
  getProducts() { return this.products; }
  getProduct(id: string) { return this.products.find(p => p.id === id); }
  saveProduct(product: Product) {
      const idx = this.products.findIndex(p => p.id === product.id);
      if (idx >= 0) this.products[idx] = product;
      else this.products.push(product);
  }
  
  getDrawings() { return this.drawings; }
  saveDrawing(drawing: Drawing) {
      const idx = this.drawings.findIndex(d => d.id === drawing.id);
      if (idx >= 0) this.drawings[idx] = drawing;
      else this.drawings.push(drawing);
  }

  // --- REPOSITORY (FOLDERS & CYCLES) ---
  getFolders(parentId: string | null) { return this.folders.filter(f => f.parentId === parentId && !f.deletedAt); }
  saveFolder(folder: JobFolder) {
      const idx = this.folders.findIndex(f => f.id === folder.id);
      if (idx >= 0) this.folders[idx] = folder;
      else this.folders.push(folder);
  }
  
  getCycles(folderId: string | null) { return this.cycles.filter(c => c.folderId === folderId && !c.deletedAt); }
  getCycle(id: string) { return this.cycles.find(c => c.id === id); }
  saveCycle(cycle: JobCycle) {
      const idx = this.cycles.findIndex(c => c.id === cycle.id);
      if (idx >= 0) this.cycles[idx] = cycle;
      else this.cycles.push(cycle);
  }

  // --- SETUP MAPS ---
  getSetupMaps() { return this.setupMaps.filter(m => !m.deletedAt); }
  getSetupMap(id: string) { return this.setupMaps.find(m => m.id === id); }
  saveSetupMap(map: SetupMap) {
      const idx = this.setupMaps.findIndex(m => m.id === map.id);
      if (idx >= 0) this.setupMaps[idx] = map;
      else this.setupMaps.push(map);
  }

  // --- PRODUCT WAREHOUSE & DEFECTS ---
  getProductFolders(parentId: string | null) { 
    return this.productFolders.filter(f => f.parentId === parentId); 
  }
  saveProductFolder(folder: ProductFolder) {
    const idx = this.productFolders.findIndex(f => f.id === folder.id);
    if (idx >= 0) this.productFolders[idx] = folder;
    else this.productFolders.push(folder);
  }

  getProductStock(folderId: string | null) {
    return this.productStocks.filter(s => s.folderId === folderId);
  }
  
  addProductStock(productId: string, folderId: string | null, quantity: number, criticalQuantity: number, user?: User) {
    let stock = this.productStocks.find(s => s.productId === productId && s.folderId === folderId);
    if (stock) {
      stock.quantity += quantity;
      stock.criticalQuantity = criticalQuantity; // Update config
    } else {
      stock = {
        id: `ps_${Date.now()}`,
        productId,
        folderId,
        quantity,
        criticalQuantity
      };
      this.productStocks.push(stock);
    }
    this.logProductTransaction('produce', productId, quantity, user);
  }

  moveProductStock(stockId: string, quantity: number, type: 'sell' | 'to_defect', user?: User, note?: string) {
    const stock = this.productStocks.find(s => s.id === stockId);
    if (!stock) return;
    if (stock.quantity < quantity) throw new Error('Not enough stock');

    stock.quantity -= quantity;

    if (type === 'to_defect') {
      this.addDefectItem(stock.productId, quantity, user, note);
    } else {
      this.logProductTransaction('sell', stock.productId, quantity, user, note);
    }
  }

  getDefectItems() { return this.defectItems; }

  addDefectItem(productId: string, quantity: number, user?: User, note?: string) {
    let item = this.defectItems.find(d => d.productId === productId);
    if (item) {
      item.quantity += quantity;
    } else {
      item = {
        id: `def_${Date.now()}`,
        productId,
        quantity
      };
      this.defectItems.push(item);
    }
    this.logProductTransaction('to_defect', productId, quantity, user, note);
  }

  writeOffDefect(id: string, quantity: number, user?: User, note?: string) {
    const item = this.defectItems.find(d => d.id === id);
    if (!item) return;
    if (item.quantity < quantity) throw new Error('Not enough defect stock');

    item.quantity -= quantity;
    this.logProductTransaction('defect_off', item.productId, quantity, user, note);
    
    // Cleanup if 0
    // if (item.quantity <= 0) this.defectItems = this.defectItems.filter(d => d.id !== id);
  }

  getProductTransactions() {
    return this.productTransactions.sort((a,b) => b.date.localeCompare(a.date));
  }

  logProductTransaction(type: ProductTransactionType, productId: string, quantity: number, user?: User, note?: string) {
    this.productTransactions.unshift({
      id: `ptr_${Date.now()}`,
      date: new Date().toISOString(),
      type,
      productId,
      quantity,
      userId: user ? user.id : 'system',
      userName: user ? `${user.firstName} ${user.lastName}` : 'System',
      note
    });
  }


  // --- TOOLS SYSTEM ---
  getTools() { return this.tools.filter(t => !t.deletedAt); }
  getTool(id: string) { return this.tools.find(t => t.id === id); }
  saveTool(tool: Tool) {
      const idx = this.tools.findIndex(t => t.id === tool.id);
      if (idx >= 0) this.tools[idx] = tool;
      else this.tools.push(tool);
  }

  getToolFolders(type: 'catalog' | 'warehouse' | 'production', parentId: string | null) {
      return this.toolFolders.filter(f => f.type === type && f.parentId === parentId);
  }
  saveToolFolder(folder: ToolFolder) {
      const idx = this.toolFolders.findIndex(f => f.id === folder.id);
      if (idx >= 0) this.toolFolders[idx] = folder;
      else this.toolFolders.push(folder);
  }
  moveToolFolder(id: string, newParentId: string | null) {
      const f = this.toolFolders.find(fol => fol.id === id);
      if (f) f.parentId = newParentId;
  }

  getWarehouseItems(folderId: string | null) { return this.warehouse.filter(w => w.folderId === folderId && !w.deletedAt); }
  getProductionItems(folderId: string | null) { return this.productionItems.filter(p => p.folderId === folderId && !p.deletedAt); }
  getTransactions() { return this.transactions; }

  addWarehouseStock(toolId: string, folderId: string | null, quantity: number, user: User, criticalQty?: number) {
     let item = this.warehouse.find(w => w.toolId === toolId && w.folderId === folderId);
     if (item) {
         item.quantity += quantity;
         if (criticalQty !== undefined) item.criticalQuantity = criticalQty;
     } else {
         item = {
             id: `wh_${Date.now()}`,
             toolId,
             folderId,
             quantity,
             criticalQuantity: criticalQty || 5
         };
         this.warehouse.push(item);
     }
     this.logTransaction(toolId, user, 'import', quantity, 'Warehouse', item.quantity);
  }

  addProductionStock(toolId: string, folderId: string | null, quantity: number, user: User, criticalQty?: number) {
     let item = this.productionItems.find(p => p.toolId === toolId && p.folderId === folderId);
     if (item) {
         item.quantity += quantity;
         if (criticalQty !== undefined) item.criticalQuantity = criticalQty;
     } else {
         item = {
             id: `pi_${Date.now()}`,
             toolId,
             folderId,
             quantity,
             criticalQuantity: criticalQty || 5
         };
         this.productionItems.push(item);
     }
     this.logTransaction(toolId, user, 'import', quantity, 'Production Direct', item.quantity);
  }

  moveStockToProduction(warehouseItemId: string, quantity: number, user: User, targetNote: string = 'Production Floor') {
      const wItem = this.warehouse.find(w => w.id === warehouseItemId);
      if (!wItem) throw new Error("Item not found");
      if (wItem.quantity < quantity) throw new Error("Not enough stock");

      wItem.quantity -= quantity;
      
      let pItem = this.productionItems.find(p => p.toolId === wItem.toolId && p.folderId === null);
      if (pItem) {
          pItem.quantity += quantity;
      } else {
          pItem = {
              id: `pi_${Date.now()}`,
              toolId: wItem.toolId,
              folderId: null,
              quantity,
              criticalQuantity: wItem.criticalQuantity
          };
          this.productionItems.push(pItem);
      }

      this.logTransaction(wItem.toolId, user, 'move_to_prod', quantity, targetNote, pItem.quantity);
  }
  
  moveWarehouseItem(id: string, folderId: string | null) {
      const item = this.warehouse.find(i => i.id === id);
      if(item) item.folderId = folderId;
  }

  moveProductionItem(id: string, folderId: string | null) {
      const item = this.productionItems.find(i => i.id === id);
      if(item) item.folderId = folderId;
  }

  consumeProductionTool(productionItemId: string, quantity: number, user: User, note: string = '') {
      const pItem = this.productionItems.find(p => p.id === productionItemId);
      if (!pItem) throw new Error("Item not found");
      pItem.quantity -= quantity;
      this.logTransaction(pItem.toolId, user, 'usage', quantity, note, pItem.quantity);
  }

  logTransaction(toolId: string, user: User | null, type: 'import' | 'move_to_prod' | 'usage' | 'return', amount: number, target: string, balanceSnapshot: number) {
      this.transactions.unshift({
          id: `tx_${Date.now()}`,
          date: new Date().toISOString(),
          toolId,
          userId: user ? user.id : 'system',
          userName: user ? `${user.firstName} ${user.lastName}` : 'System',
          type,
          amount,
          target,
          balanceSnapshot
      });
  }

  // --- REPORTS ---
  getReports() { return this.reports; }
  addReport(report: ProductionReport) { 
      this.reports.push(report); 
      // Auto move scrap to Defect tab if report is just submitted or auto-approved?
      // Usually scrap is added when report is approved.
      // Let's add simplified logic: When report is APPROVED, if scrap > 0, move to defects.
      // Handled in updateReportStatus below.
  }

  updateReportStatus(id: string, status: 'approved' | 'rejected') {
      const r = this.reports.find(rp => rp.id === id);
      if (r) {
          if (r.status !== 'approved' && status === 'approved') {
              const task = this.tasks.find(t => t.id === r.taskId);
              
              // 1. Task Logic
              if (task) {
                  task.completedQuantity = (task.completedQuantity || 0) + r.quantity;
                  task.pendingQuantity = Math.max(0, (task.pendingQuantity || 0) - r.quantity);
                  if (task.completedQuantity >= (task.plannedQuantity || 0)) {
                      task.status = 'done';
                  }

                  // 2. Add good product to warehouse (Optional automation, user asked for manual "+" button by admin)
                  // So we skip auto-adding good parts to stock for now, based on prompt "Admin clicks plus...".

                  // 3. Add scrap to defects
                  if (r.scrapQuantity > 0) {
                      // Need to find productId from task->order->product
                      // This is complex, so for now we leave it manual or assume scrap management
                      // Actually, let's find the product ID.
                      const order = this.orders.find(o => o.id === task.orderId);
                      if (order) {
                          this.addDefectItem(order.productId, r.scrapQuantity, undefined, `Report ${r.id}`);
                      }
                  }
              }
          } else if (r.status === 'pending' && status === 'rejected') {
              const task = this.tasks.find(t => t.id === r.taskId);
              if (task) {
                  task.pendingQuantity = Math.max(0, (task.pendingQuantity || 0) - r.quantity);
              }
          }
          r.status = status;
      }
  }
  updateReport(report: ProductionReport) {
      const idx = this.reports.findIndex(r => r.id === report.id);
      if (idx >= 0) this.reports[idx] = report;
  }

  // --- TRASH / SOFT DELETE ---
  softDelete(type: string, id: string) {
      let collection: any[] = [];
      if (type === 'task') collection = this.tasks;
      if (type === 'order') collection = this.orders;
      if (type === 'product') collection = this.products;
      if (type === 'folder') collection = this.folders;
      if (type === 'cycle') collection = this.cycles;
      if (type === 'setupMap') collection = this.setupMaps;

      const item = collection.find(i => i.id === id);
      if (item) {
          item.deletedAt = new Date().toISOString();
          this.trash.push({ type, ...item });
      }
  }

  getTrashItems() {
      const allDeleted = [
          ...this.tasks.filter(i => i.deletedAt).map(i => ({ type: 'task', ...i })),
          ...this.orders.filter(i => i.deletedAt).map(i => ({ type: 'order', ...i })),
          ...this.products.filter(i => i.deletedAt).map(i => ({ type: 'product', ...i })),
          ...this.folders.filter(i => i.deletedAt).map(i => ({ type: 'folder', ...i })),
          ...this.cycles.filter(i => i.deletedAt).map(i => ({ type: 'cycle', ...i })),
          ...this.setupMaps.filter(i => i.deletedAt).map(i => ({ type: 'setupMap', ...i })),
      ];
      return allDeleted;
  }

  restoreItem(type: string, id: string) {
      let collection: any[] = [];
      if (type === 'task') collection = this.tasks;
      if (type === 'order') collection = this.orders;
      if (type === 'product') collection = this.products;
      if (type === 'folder') collection = this.folders;
      if (type === 'cycle') collection = this.cycles;
      if (type === 'setupMap') collection = this.setupMaps;

      const item = collection.find(i => i.id === id);
      if (item) {
          item.deletedAt = undefined;
      }
  }

  permanentlyDelete(type: string, id: string) {
      if (type === 'task') this.tasks = this.tasks.filter(i => i.id !== id);
      if (type === 'order') this.orders = this.orders.filter(i => i.id !== id);
      if (type === 'product') this.products = this.products.filter(i => i.id !== id);
      if (type === 'folder') this.folders = this.folders.filter(i => i.id !== id);
      if (type === 'cycle') this.cycles = this.cycles.filter(i => i.id !== id);
      if (type === 'setupMap') this.setupMaps = this.setupMaps.filter(i => i.id !== id);
  }
}

export const store = new MockStoreService();