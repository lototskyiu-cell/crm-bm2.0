import React, { useState, useEffect } from 'react';
import { store } from '../services/mockStore';
import { API } from '../services/api';
import { Product, Drawing, SetupMap, Tool, SetupBlock, ProductStock, ProductFolder, DefectItem, SetupComponentRequirement, Task, Order, ProductionReport, User, JobCycle, JobStage } from '../types';
import { SearchableSelect } from '../components/SearchableSelect';
import { uploadFileToCloudinary } from '../services/cloudinary';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Plus, Box, Search, Folder, FileText, Image as ImageIcon, Wrench, ChevronRight, Home, X, Trash2, Pencil, Filter, 
  Package, AlertTriangle, ArrowRight, Minus, Ban, FolderPlus, Download, CheckSquare, Loader, Link, Archive, Save, Activity, Square 
} from 'lucide-react';
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";

type Section = 'root' | 'finished' | 'drawings' | 'setup_maps' | 'warehouse' | 'defects';
type MainTab = 'catalog' | 'wip';

interface WIPItem {
  uniqueId: string; // New composite key for React rendering
  taskId: string;
  orderNumber: string;
  productName: string;
  stageName: string;
  batchCode: string; // New field for grouping
  produced: number;
  used: number;
  balance: number;
  isFinalStage: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

interface ProductsProps {
  currentUser: User;
}

export const Products: React.FC<ProductsProps> = ({ currentUser }) => {
  const { canView, loading: permsLoading } = usePermissions(currentUser);

  // 🔒 STRICT SUPER ADMIN CHECK
  const isSuperAdmin = currentUser?.login === 'Admin';
  const hasAccess = isSuperAdmin || canView('products_catalog') || canView('products_wip');

  // --- STATE DEFINITIONS ---
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('catalog');
  const [currentSection, setCurrentSection] = useState<Section>('root');
  
  // Catalog Data
  const [products, setProducts] = useState<Product[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [setupMaps, setSetupMaps] = useState<SetupMap[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [isToolsLoading, setIsToolsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [productFolders, setProductFolders] = useState<ProductFolder[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [currentWarehouseFolderId, setCurrentWarehouseFolderId] = useState<string | null>(null);
  
  const [defectItems, setDefectItems] = useState<DefectItem[]>([]);
  const [defectHistory, setDefectHistory] = useState<any[]>([]);

  // WIP Data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<ProductionReport[]>([]);
  const [wipSearchTerm, setWipSearchTerm] = useState('');
  
  // WIP Modal State
  const [isWipModalOpen, setIsWipModalOpen] = useState(false);
  const [wipModalMode, setWipModalMode] = useState<'add' | 'deduct'>('add');
  const [wipSelectedTask, setWipSelectedTask] = useState<Task | null>(null);
  const [wipManualQty, setWipManualQty] = useState<number | string>('');
  const [wipBatchCode, setWipBatchCode] = useState('');
  const [wipDeductType, setWipDeductType] = useState<'adjustment' | 'defect'>('adjustment');
  const [wipNote, setWipNote] = useState('');
  const [wipIsSubmitting, setWipIsSubmitting] = useState(false);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Modals & Forms (Catalog)
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [newMapName, setNewMapName] = useState('');
  const [newMapMachine, setNewMapMachine] = useState('');
  const [newMapProductId, setNewMapProductId] = useState('');
  const [newMapDrawingId, setNewMapDrawingId] = useState('');
  const [newMapPhoto, setNewMapPhoto] = useState('');
  const [newMapPhotoFile, setNewMapPhotoFile] = useState<File | null>(null);
  const [newMapProcessType, setNewMapProcessType] = useState<'manufacturing' | 'assembly'>('assembly');
  const [newMapComponents, setNewMapComponents] = useState<SetupComponentRequirement[]>([]);
  const [newMapBlocks, setNewMapBlocks] = useState<{tempId: string, toolNumber: string, toolName: string, toolId?: string, settings: string}[]>([]);
  
  const [currentCycleStages, setCurrentCycleStages] = useState<JobStage[]>([]);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodPhoto, setProdPhoto] = useState('');
  const [prodPhotoFile, setProdPhotoFile] = useState<File | null>(null);
  const [prodColor, setProdColor] = useState('#3b82f6');
  const [prodDrawingId, setProdDrawingId] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [newDrawingName, setNewDrawingName] = useState('');
  const [newDrawingFile, setNewDrawingFile] = useState<File | null>(null);
  const [drawingPreview, setDrawingPreview] = useState('');

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockOpType, setStockOpType] = useState<'add' | 'move'>('add');
  const [stockItem, setStockItem] = useState<ProductStock | null>(null);
  const [stockQty, setStockQty] = useState<number | string>('');
  const [stockNote, setStockNote] = useState('');
  const [moveTarget, setMoveTarget] = useState<'sell' | 'defect'>('sell');

  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newStockQty, setNewStockQty] = useState<number | string>(1);
  const [newStockCritical, setNewStockCritical] = useState<number | string>(5);

  const [isWriteOffModalOpen, setIsWriteOffModalOpen] = useState(false);
  const [selectedDefectIds, setSelectedDefectIds] = useState<Set<string>>(new Set());
  const [writeOffQtyMap, setWriteOffQtyMap] = useState<Record<string, number>>({});

  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, type: 'product' | 'setupMap' | 'drawing', id: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!permsLoading && currentUser && !isSuperAdmin) {
        if (activeMainTab === 'catalog' && !canView('products_catalog')) {
            if (canView('products_wip')) setActiveMainTab('wip');
        } else if (activeMainTab === 'wip' && !canView('products_wip')) {
            if (canView('products_catalog')) setActiveMainTab('catalog');
        }
    }
  }, [permsLoading, currentUser, activeMainTab, isSuperAdmin]);

  useEffect(() => {
    let unsubscribeProducts: () => void;
    let unsubscribeStocks: () => void;
    let unsubscribeDefects: () => void;
    let unsubscribeHistory: () => void;
    let unsubscribeMaps: () => void;
    let unsubscribeDrawings: () => void;
    let unsubscribeTools: () => void;
    
    setIsLoading(true);
    
    unsubscribeProducts = API.subscribeToProducts((data) => {
      setProducts(data || []);
      setIsLoading(false);
    });

    unsubscribeDrawings = API.subscribeToDrawings((data) => {
        setDrawings(data || []);
    });

    unsubscribeStocks = API.subscribeToWarehouseStock((data) => {
        setProductStocks(data || []);
    });

    unsubscribeDefects = API.subscribeToDefects((data) => {
        setDefectItems(data || []);
    });

    unsubscribeHistory = API.subscribeToDefectHistory((data) => {
        setDefectHistory(data || []);
    });

    unsubscribeMaps = API.subscribeToSetupMaps((data) => {
        const sortedData = (data || []).map(map => ({
            ...map,
            blocks: map.blocks.sort((a, b) => parseInt(a.toolNumber || '0') - parseInt(b.toolNumber || '0'))
        }));
        setSetupMaps(sortedData);
    });

    unsubscribeTools = API.subscribeToTools((data) => {
        setTools(data || []);
    });

    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeStocks) unsubscribeStocks();
      if (unsubscribeDefects) unsubscribeDefects();
      if (unsubscribeHistory) unsubscribeHistory();
      if (unsubscribeMaps) unsubscribeMaps();
      if (unsubscribeDrawings) unsubscribeDrawings();
      if (unsubscribeTools) unsubscribeTools();
    };
  }, []);

  useEffect(() => {
      if (activeMainTab === 'wip') {
          const fetchWip = async () => {
              const [tasksData, ordersData] = await Promise.all([
                  API.getTasks(),
                  API.getOrders()
              ]);
              setTasks(tasksData);
              setOrders(ordersData);
          };
          fetchWip();
          
          const unsubReports = API.subscribeToReports((data) => {
              setReports(data);
          });
          return () => unsubReports();
      }
  }, [activeMainTab]);

  useEffect(() => {
    if (isMapModalOpen) {
      const fetchTools = async () => {
        setIsToolsLoading(true);
        try {
          const toolsData = await API.getTools();
          setTools(toolsData);
        } catch (e) {
          console.error("Failed to fetch tools", e);
        } finally {
          setIsToolsLoading(false);
        }
      };
      fetchTools();
    }
  }, [isMapModalOpen]);

  useEffect(() => {
    const fetchCycleStages = async () => {
        if (!newMapProductId) {
            setCurrentCycleStages([]);
            return;
        }

        let targetCycle: JobCycle | null = null;
        const product = products.find(p => p.id === newMapProductId);
        if (product && product.jobCycleId) {
            try {
                const item = await API.getWorkStorageItem(product.jobCycleId);
                if (item && 'stages' in item) targetCycle = item as JobCycle;
            } catch (e) { console.error(e); }
        }

        if (!targetCycle) {
            try {
                const linkedCycles = await API.getJobCyclesByProduct(newMapProductId);
                if (linkedCycles.length > 0) targetCycle = linkedCycles[0];
            } catch (e) { console.error(e); }
        }

        if (targetCycle && targetCycle.stages) {
            setCurrentCycleStages(targetCycle.stages);
        } else {
            setCurrentCycleStages([]);
        }
    };

    fetchCycleStages();
  }, [newMapProductId, products]);

  useEffect(() => {
    refreshMockData();
    setSearchTerm(''); 
  }, [currentSection, currentWarehouseFolderId]);

  const refreshMockData = () => {
    setProductFolders(store.getProductFolders(currentWarehouseFolderId));
  };

  const getWIPInventory = (): WIPItem[] => {
    const items: WIPItem[] = [];
    const activeTasks = tasks.filter(t => t.type === 'production' && t.status !== 'archived');

    activeTasks.forEach(task => {
        const order = orders.find(o => o.id === task.orderId);
        const product = products.find(p => p.id === order?.productId);
        
        const taskReports = reports.filter(r => r.taskId === task.id && r.status === 'approved');

        if (taskReports.length === 0) {
             items.push({
                uniqueId: task.id,
                taskId: task.id,
                orderNumber: order?.orderNumber || '???',
                productName: product?.name || 'Unknown Product',
                stageName: task.title,
                batchCode: '-', 
                produced: 0,
                used: 0,
                balance: 0,
                isFinalStage: !!task.isFinalStage
             });
        } else {
            const groups: Record<string, ProductionReport[]> = {};
            taskReports.forEach(r => {
                const code = r.batchCode || 'Без партії';
                if (!groups[code]) groups[code] = [];
                groups[code].push(r);
            });

            Object.keys(groups).forEach(code => {
                const batchReports = groups[code];
                const produced = batchReports.reduce((sum, r) => sum + r.quantity, 0);
                const used = batchReports.reduce((sum, r) => sum + (r.usedQuantity || 0), 0);
                
                items.push({
                    uniqueId: `${task.id}-${code}`,
                    taskId: task.id,
                    orderNumber: order?.orderNumber || '???',
                    productName: product?.name || 'Unknown Product',
                    stageName: task.title,
                    batchCode: code,
                    produced,
                    used,
                    balance: produced - used,
                    isFinalStage: !!task.isFinalStage
                });
            });
        }
    });

    return items.filter(item => 
         item.orderNumber.toLowerCase().includes(wipSearchTerm.toLowerCase()) ||
         item.productName.toLowerCase().includes(wipSearchTerm.toLowerCase()) ||
         item.stageName.toLowerCase().includes(wipSearchTerm.toLowerCase()) ||
         item.batchCode.toLowerCase().includes(wipSearchTerm.toLowerCase())
    );
  };

  const renderBreadcrumbs = () => (
    <div className="flex items-center text-sm text-gray-500 mb-6 bg-white px-4 py-2 rounded-lg border w-fit shadow-sm overflow-x-auto whitespace-nowrap max-w-full">
      <button onClick={() => setCurrentSection('root')} className={`hover:text-blue-600 flex items-center ${currentSection === 'root' ? 'font-bold text-gray-900' : ''}`}>
        <Home size={14} className="mr-2"/> Головна
      </button>
      {currentSection !== 'root' && (
        <>
          <ChevronRight size={14} className="mx-2"/>
          <span className="font-bold text-gray-900">
            {currentSection === 'finished' ? 'Готові вироби' : 
             currentSection === 'drawings' ? 'Креслення' : 
             currentSection === 'warehouse' ? 'Склад виробів' :
             currentSection === 'defects' ? 'Брак' :
             'Карти наладки'}
          </span>
        </>
      )}
    </div>
  );

  const handleOpenWipModal = (task: Task, mode: 'add' | 'deduct') => {
      setWipSelectedTask(task);
      setWipModalMode(mode);
      setWipManualQty('');
      setWipDeductType('adjustment'); 
      setWipNote('');
      setWipBatchCode('');
      setIsWipModalOpen(true);
  };

  const handleArchiveTask = async (task: Task) => {
      if (!confirm(`Архівувати завдання "${task.title}"? Воно зникне зі списку складу, але залишиться в історії.`)) return;
      try {
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'archived' } : t));
          await API.updateTaskStatus(task.id, 'archived');
      } catch (e) {
          alert("Помилка архівування");
      }
  };

  const handleSaveWipStock = async () => {
      if (!wipSelectedTask || !wipManualQty) return;
      setWipIsSubmitting(true);
      try {
          const order = orders.find(o => o.id === wipSelectedTask.orderId);
          const product = products.find(p => p.id === order?.productId);
          
          let qty = Number(wipManualQty);
          let finalQty = qty;
          
          if (wipModalMode === 'deduct') {
              finalQty = -Math.abs(qty); 
          } else {
              finalQty = Math.abs(qty); 
          }

          let reportType = 'manual_stock';
          if (wipModalMode === 'deduct') {
              reportType = wipDeductType === 'defect' ? 'manual_defect' : 'manual_adjustment';
          }

          const reportPayload = {
              taskId: wipSelectedTask.id,
              userId: 'admin_manual',
              date: new Date().toISOString().split('T')[0],
              quantity: finalQty,
              scrapQuantity: 0,
              notes: wipNote || (wipModalMode === 'add' ? `Manual Stock Added by Admin` : `Manual Deduction by Admin`),
              status: 'approved',
              type: reportType,
              createdAt: new Date().toISOString(),
              usedQuantity: 0,
              taskTitle: wipSelectedTask.title,
              orderNumber: order?.orderNumber || 'Unknown Order',
              stageName: wipSelectedTask.title,
              productName: product?.name || 'Unknown Product',
              batchCode: wipBatchCode || 'Склад (Admin)'
          };

          await addDoc(collection(db, "reports"), reportPayload);
          const taskRef = doc(db, "tasks", wipSelectedTask.id);
          await updateDoc(taskRef, { factQuantity: increment(finalQty) });

          if (wipModalMode === 'deduct' && wipDeductType === 'defect') {
             await addDoc(collection(db, "defects"), {
                productId: product?.id || 'unknown',
                productName: product?.name || 'Unknown',
                quantity: Math.abs(qty),
                reason: wipNote || "Ручне списання (Брак)",
                workerName: 'Admin',
                stageName: wipSelectedTask.title,
                date: serverTimestamp(),
             });
          }

          setIsWipModalOpen(false);
          const updatedTasks = await API.getTasks();
          setTasks(updatedTasks);
      } catch (e) {
          alert("Помилка оновлення залишку");
      } finally {
          setIsWipModalOpen(false);
          setWipIsSubmitting(false);
      }
  };

  const handleDelete = (type: 'product' | 'setupMap' | 'drawing', id: string) => {
    setDeleteConfirm({ isOpen: true, type, id });
  };

  const confirmDelete = async () => {
      if (!deleteConfirm) return;
      setIsDeleting(true);
      try {
        if (deleteConfirm.type === 'product') {
            await API.deleteProduct(deleteConfirm.id);
        } else if (deleteConfirm.type === 'setupMap') {
            await API.deleteSetupMap(deleteConfirm.id);
        } else if (deleteConfirm.type === 'drawing') {
            await API.deleteDrawing(deleteConfirm.id);
        }
        setDeleteConfirm(null);
      } catch (e: any) {
          const msg = e instanceof Error ? e.message : String(e);
          alert(`Error deleting item: ${msg}`);
      } finally {
          setIsDeleting(false);
      }
  };

  const handleSaveDrawing = async () => {
    if (!newDrawingName) { alert("Вкажіть назву"); return; }
    if (!newDrawingFile && !drawingPreview) { alert("Файл"); return; }
    if (isUploading) return;
    setIsUploading(true);
    try {
        let photoUrl = drawingPreview;
        if (newDrawingFile) photoUrl = await uploadFileToCloudinary(newDrawingFile);
        const drawing: Drawing = { id: `dwg_${Date.now()}`, name: newDrawingName, photo: photoUrl };
        await API.saveDrawing(drawing);
        setIsDrawingModalOpen(false);
        setNewDrawingName(''); setNewDrawingFile(null); setDrawingPreview('');
    } catch(e) { alert("Error"); } finally { setIsUploading(false); }
  };

  const handleDrawingFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
        setNewDrawingFile(file);
        const reader = new FileReader();
        reader.onloadend = () => { if (typeof reader.result === 'string') setDrawingPreview(reader.result); };
        reader.readAsDataURL(file);
    }
  };

  const handleAddItemToWarehouse = async () => {
      if (!selectedProductId) return;
      try {
          await API.addWarehouseItem({
              productId: selectedProductId, folderId: currentWarehouseFolderId, quantity: Number(newStockQty || 0), criticalQuantity: Number(newStockCritical || 0)
          });
          setIsAddItemModalOpen(false); setSelectedProductId(''); setNewStockQty(1); setNewStockCritical(5);
      } catch(e: any) { alert(`Error: ${e.message}`); }
  };

  const handleStockOp = async () => {
      if (!stockItem || !stockQty) return;
      const qty = Number(stockQty);
      try {
          if (stockOpType === 'add') {
              await API.updateWarehouseStock(stockItem.id, stockItem.quantity + qty);
          } else {
              if (stockItem.quantity < qty) { alert("Недостатньо товару"); return; }
              await API.updateWarehouseStock(stockItem.id, stockItem.quantity - qty);
              if (moveTarget === 'defect') await API.addDefect(stockItem.productId, qty);
          }
          setIsStockModalOpen(false); setStockItem(null); setStockQty(''); setStockNote('');
      } catch(e: any) { alert(`Error: ${e.message}`); }
  };

  const openStockModal = (type: 'add' | 'move', item: ProductStock) => {
      setStockOpType(type); setStockItem(item); setStockQty(''); setStockNote(''); setMoveTarget('sell'); setIsStockModalOpen(true);
  };

  const handleWriteOffQtyChange = (id: string, value: string) => {
    setWriteOffQtyMap(prev => ({ ...prev, [id]: Number(value) }));
  };

  const toggleDefectSelection = (id: string) => {
      const newSet = new Set(selectedDefectIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedDefectIds(newSet);
      if (writeOffQtyMap[id] === undefined) {
          const item = defectItems.find(d => d.id === id);
          const initialQty = item ? item.quantity : 0;
          setWriteOffQtyMap(prev => ({ ...prev, [id]: initialQty }));
      }
  };

  const handleWriteOff = async () => {
      if (selectedDefectIds.size === 0) return;
      try {
          const now = new Date();
          const dateStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0') + " " + String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');

          const idsToProcess = Array.from(selectedDefectIds) as string[];
          for (const id of idsToProcess) {
              const qty = writeOffQtyMap[id];
              const item = defectItems.find(d => d.id === id);
              if (item && qty > 0) {
                  if (qty > item.quantity) { alert(`Кількість для списання (${qty}) перевищує наявну (${item.quantity})`); return; }
                  const prod = products.find(p => p.id === item.productId);
                  await API.scrapDefect(id, qty, {
                      productName: prod?.name || 'Unknown', sku: prod?.sku || 'Unknown', userName: 'Admin', date: dateStr, stageName: item.stageName, workerName: item.workerName
                  });
              }
          }
          setIsWriteOffModalOpen(false); setSelectedDefectIds(new Set()); setWriteOffQtyMap({});
      } catch (e: any) { alert(e.message); }
  };

  const handleEditMap = (map: SetupMap) => {
    setEditingMapId(map.id); 
    setNewMapName(map.name); 
    setNewMapMachine(map.machine); 
    setNewMapProductId(map.productCatalogId || ''); 
    setNewMapDrawingId(map.drawingId || '');
    setNewMapPhoto(map.photoUrl || '');
    setNewMapPhotoFile(null);
    setNewMapProcessType(map.processType || 'assembly');
    if (map.inputComponents && map.inputComponents.length > 0) { setNewMapComponents(map.inputComponents); } else { const ratio = map.consumptionRatio || 1; if (ratio > 1) { setNewMapComponents([{ sourceStageIndex: 0, ratio: ratio }]); } else { setNewMapComponents([]); } }
    const tempBlocks = map.blocks.map(b => ({ tempId: b.id || `b_${Date.now()}_${Math.random()}`, toolNumber: b.toolNumber || '', toolName: b.toolName, toolId: b.toolId, settings: b.settings }));
    setNewMapBlocks(tempBlocks); setIsMapModalOpen(true);
  };

  const handleOpenMapModal = () => { 
    setEditingMapId(null); 
    setNewMapName(''); 
    setNewMapMachine(''); 
    setNewMapProductId(''); 
    setNewMapDrawingId(''); 
    setNewMapPhoto('');
    setNewMapPhotoFile(null);
    setNewMapProcessType('assembly');
    setNewMapComponents([]); 
    setNewMapBlocks([]); 
    setIsMapModalOpen(true); 
  };
  
  const addComponentRequirement = () => { 
      setNewMapComponents([...newMapComponents, { sourceStageIndex: 0, ratio: 1, name: '', qty: 1 }]); 
  };

  const removeComponentRequirement = (index: number) => { const updated = [...newMapComponents]; updated.splice(index, 1); setNewMapComponents(updated); };
  
  const updateComponentRequirement = (index: number, field: keyof SetupComponentRequirement, value: any) => { 
      const updated = [...newMapComponents]; 
      updated[index] = { ...updated[index], [field]: value }; 
      setNewMapComponents(updated); 
  };
  
  const handleSaveMap = async () => {
    if (!newMapName) { alert("Вкажіть назву карти"); return; }
    if (isUploading) return;
    setIsUploading(true);
    
    try {
        let finalPhotoUrl = newMapPhoto;
        if (newMapPhotoFile) {
            finalPhotoUrl = await uploadFileToCloudinary(newMapPhotoFile);
        }

        const cleanComponents = newMapComponents.map(comp => ({
            name: comp.name,
            qty: Number(comp.qty || comp.ratio || 0),
            sourceStageIndex: comp.sourceStageIndex || 0,
            ratio: Number(comp.qty || comp.ratio || 0)
        })).filter(c => c.name && c.qty > 0);

        const selectedDrawing = drawings.find(d => d.id === newMapDrawingId);
        const finalBlocks: SetupBlock[] = newMapBlocks.map((b, idx) => ({ toolNumber: b.toolNumber || String(idx + 1), toolName: b.toolName || 'Інструмент', toolId: b.toolId, settings: String(b.settings || '') }));
        
        const mapData: SetupMap = { 
            id: editingMapId || `sm_${Date.now()}`, 
            name: newMapName, 
            productCatalogId: newMapProductId, 
            machine: newMapMachine || 'Універсальний', 
            blocks: finalBlocks, 
            drawingId: newMapDrawingId, 
            drawingUrl: selectedDrawing?.photo, 
            drawingName: selectedDrawing?.name, 
            photoUrl: finalPhotoUrl,
            programNumber: null, 
            inputComponents: cleanComponents,
            processType: newMapProcessType
        };
        
        await API.saveSetupMap(mapData); 
        setIsMapModalOpen(false); 
    } catch(e: any) { alert(`Error: ${e.message}`); } finally { setIsUploading(false); }
  };
  
  const addBlockField = () => { setNewMapBlocks([...newMapBlocks, { tempId: `temp_${Date.now()}`, toolNumber: '', toolName: '', settings: '' }]); };
  const removeBlockField = (index: number) => { const updated = [...newMapBlocks]; updated.splice(index, 1); setNewMapBlocks(updated); };
  
  const updateBlockField = (index: number, field: 'toolName' | 'settings' | 'toolNumber' | 'toolId', value: string) => {
    const updated = [...newMapBlocks];
    if (field === 'toolId') { const tool = tools.find(t => t.id === value); if (tool) { updated[index].toolId = tool.id; updated[index].toolName = tool.name; } } else { updated[index][field] = value; }
    setNewMapBlocks(updated);
  };

  const handleEditProduct = (p: Product) => { setEditingProductId(p.id); setProdName(p.name); setProdSku(p.sku); setProdPhoto(p.photo || ''); setProdPhotoFile(null); setProdColor(p.colorTag || '#3b82f6'); setProdDrawingId(p.drawingId || ''); setIsProductModalOpen(true); };
  const handleOpenProductModal = () => { setEditingProductId(null); setProdName(''); setProdSku(''); setProdPhoto(''); setProdPhotoFile(null); setProdColor('#3b82f6'); setProdDrawingId(''); setIsProductModalOpen(true); };
  
  const handleSaveProduct = async () => {
    if (!prodName || !prodSku) { alert("Заповніть назву"); return; }
    if (isUploading) return;
    setIsUploading(true);
    let finalPhotoUrl = prodPhoto;
    try { if (prodPhotoFile) { finalPhotoUrl = await uploadFileToCloudinary(prodPhotoFile); }
        const prodData: Product = { id: editingProductId || `prod_${Date.now()}`, name: prodName, sku: prodSku, photo: finalPhotoUrl, colorTag: prodColor, drawingId: prodDrawingId || undefined, jobCycleId: editingProductId ? (products.find(p => p.id === editingProductId)?.jobCycleId as string | undefined) : undefined };
        await API.saveProduct(prodData); setIsProductModalOpen(false);
    } catch (e: any) { alert(`Error: ${e.message}`); } finally { setIsUploading(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setProdPhotoFile(file); const reader = new FileReader(); reader.onloadend = () => { if (typeof reader.result === 'string') setProdPhoto(reader.result); }; reader.readAsDataURL(file); } };

  const handleMapFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if (file) { 
        setNewMapPhotoFile(file); 
        const reader = new FileReader(); 
        reader.onloadend = () => { if (typeof reader.result === 'string') setNewMapPhoto(reader.result); }; 
        reader.readAsDataURL(file); 
    } 
  };

  // 2. LOADING STATE
  if (permsLoading && !isSuperAdmin) {
      return (
          <div className="flex justify-center items-center h-screen">
              <Loader className="animate-spin text-blue-600" size={32} />
          </div>
      );
  }

  // 3. ACCESS CHECK
  if (!currentUser || (!isSuperAdmin && !hasAccess)) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
              <Ban size={64} className="text-red-500 mb-4" />
              <h1 className="text-2xl font-bold text-gray-800">Тільки для Адміна</h1>
              <p className="text-gray-500 mt-2">Ваш логін: <span className="font-bold">{currentUser?.login}</span></p>
              <p className="text-xs text-gray-400">Доступ до цього розділу заборонено.</p>
          </div>
      );
  }

  if (isLoading && currentSection === 'root') return <div className="p-8 flex justify-center"><Loader className="animate-spin text-blue-600"/></div>;

  const inventory = getWIPInventory();

  // --- RENDER MAIN LAYOUT ---
  return (
    <div className="p-8 h-full flex flex-col">
        {/* Top Tab Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-fit mb-6 shadow-sm border border-gray-200 overflow-x-auto whitespace-nowrap">
            {(isSuperAdmin || canView('products_catalog')) && (
                <button onClick={() => setActiveMainTab('catalog')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center ${activeMainTab === 'catalog' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Box size={16} className="mr-2"/> Каталог Виробів
                </button>
            )}
            {(isSuperAdmin || canView('products_wip')) && (
                <button onClick={() => setActiveMainTab('wip')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center ${activeMainTab === 'wip' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Activity size={16} className="mr-2"/> Незавершене Виробництво (WIP)
                </button>
            )}
        </div>

        {activeMainTab === 'catalog' && (isSuperAdmin || canView('products_catalog')) ? (
            <>
                {currentSection === 'root' && (
                    <div className="animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        <button onClick={() => setCurrentSection('finished')} className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-left group">
                            <div className="bg-blue-50 w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Box size={32} className="text-blue-600"/></div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Готові вироби (Каталог)</h3>
                            <p className="text-gray-500 text-sm">База готової продукції з артикулами та фото.</p>
                        </button>

                        {(isSuperAdmin || canView('products_warehouse')) && (
                            <button onClick={() => setCurrentSection('warehouse')} className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-green-400 transition-all text-left group">
                                <div className="bg-green-50 w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Package size={32} className="text-green-600"/></div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Склад виробів</h3>
                                <p className="text-gray-500 text-sm">Облік залишків, прихід продукції та відвантаження.</p>
                            </button>
                        )}

                        {(isSuperAdmin || canView('products_defects')) && (
                            <button onClick={() => setCurrentSection('defects')} className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-red-400 transition-all text-left group">
                                <div className="bg-red-50 w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Ban size={32} className="text-red-600"/></div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Брак</h3>
                                <p className="text-gray-500 text-sm">Облік бракованої продукції та списання.</p>
                            </button>
                        )}

                        {(isSuperAdmin || canView('products_drawings')) && (
                            <button onClick={() => setCurrentSection('drawings')} className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-400 transition-all text-left group">
                                <div className="bg-purple-50 w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><ImageIcon size={32} className="text-purple-600"/></div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Креслення</h3>
                                <p className="text-gray-500 text-sm">Технічні креслення (PDF, IMG) для виробництва.</p>
                            </button>
                        )}

                        {(isSuperAdmin || canView('products_maps')) && (
                            <button onClick={() => setCurrentSection('setup_maps')} className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-400 transition-all text-left group">
                                <div className="bg-orange-50 w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Wrench size={32} className="text-orange-600"/></div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Карти наладки</h3>
                                <p className="text-gray-500 text-sm">Інструкції з налаштування верстатів та інструментів.</p>
                            </button>
                        )}
                        </div>
                    </div>
                )}

                {/* Sub-section rendering */}
                {currentSection !== 'root' && (
                    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
                            {renderBreadcrumbs()}
                            {currentSection === 'finished' && (
                                <div className="flex flex-col md:flex-row gap-3 items-center">
                                    {/* COLOR FILTER SECTION */}
                                    <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
                                        <Filter size={16} className="text-gray-400 mr-1"/>
                                        {COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                                                className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-offset-1 ring-slate-900 scale-110' : 'border-transparent'}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                        {selectedColor && (
                                            <button onClick={() => setSelectedColor(null)} className="ml-1 text-xs text-gray-400 hover:text-red-500"><X size={14}/></button>
                                        )}
                                    </div>

                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                        <input 
                                            placeholder="Пошук виробів..." 
                                            className="pl-9 pr-4 py-2 border rounded-lg w-full md:w-64 text-sm" 
                                            value={searchTerm} 
                                            onChange={e => setSearchTerm(e.target.value)} 
                                        />
                                    </div>
                                    <button onClick={handleOpenProductModal} className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center hover:bg-slate-800 transition-colors shadow-lg whitespace-nowrap"><Plus size={18} className="mr-2"/> Додати виріб</button>
                                </div>
                            )}
                            {currentSection === 'drawings' && (
                                <div className="flex gap-3">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                        <input 
                                            placeholder="Пошук креслень..." 
                                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg w-full md:w-64 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                                            value={searchTerm} 
                                            onChange={e => setSearchTerm(e.target.value)} 
                                        />
                                    </div>
                                    <button onClick={() => setIsDrawingModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center hover:bg-slate-800 transition-colors shadow-lg font-bold text-sm whitespace-nowrap">
                                        <Plus size={18} className="mr-2"/> Додати креслення
                                    </button>
                                </div>
                            )}
                            {currentSection === 'setup_maps' && (
                                <button onClick={handleOpenMapModal} className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center hover:bg-slate-800 transition-colors shadow-lg whitespace-nowrap"><Plus size={18} className="mr-2"/> Створити карту</button>
                            )}
                            {currentSection === 'warehouse' && (
                                <div className="flex gap-3">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                        <input 
                                            placeholder="Пошук по складу..." 
                                            className="pl-9 pr-4 py-2 border rounded-lg w-full md:w-64 text-sm" 
                                            value={searchTerm} 
                                            onChange={e => setSearchTerm(e.target.value)} 
                                        />
                                    </div>
                                    <button onClick={() => setIsAddItemModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-green-700 transition-colors shadow-lg whitespace-nowrap"><Plus size={18} className="mr-2"/> Поповнити склад</button>
                                </div>
                            )}
                            {currentSection === 'defects' && (
                                <div className="flex gap-3">
                                    {selectedDefectIds.size > 0 && (
                                        <button onClick={() => setIsWriteOffModalOpen(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-red-700 transition-colors shadow-lg animate-pulse whitespace-nowrap">
                                            <Trash2 size={18} className="mr-2"/> Списати обране ({selectedDefectIds.size})
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* SUB-COMPONENT CONTENT */}
                        {currentSection === 'finished' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto p-1">
                                {products.filter(p => {
                                    const matchesText = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
                                    const matchesColor = !selectedColor || p.colorTag === selectedColor;
                                    return matchesText && matchesColor;
                                }).map(product => (
                                    <div key={product.id} className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-all group relative">
                                        {product.colorTag && (<div className="absolute top-3 right-3 w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: product.colorTag }}></div>)}
                                        <div className="w-full h-40 bg-gray-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden border relative">
                                            {product.photo ? <img src={product.photo} className="w-full h-full object-cover transition-transform group-hover:scale-105 cursor-pointer" onClick={() => setEnlargedImage(product.photo || null)} /> : <Box size={32} className="text-gray-300"/>}
                                        </div>
                                        <div className="mb-2"><h3 className="font-bold text-gray-900 line-clamp-1">{product.name}</h3><div className="text-sm text-gray-500 font-mono">{product.sku}</div></div>
                                        {product.drawingId && (<div className="flex items-center text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded w-fit mb-3"><FileText size={12} className="mr-1"/> Креслення</div>)}
                                        <div className="flex gap-2 mt-2 pt-3 border-t border-gray-50">
                                            <button onClick={() => handleEditProduct(product)} className="flex-1 py-1.5 text-xs font-bold text-gray-600 bg-gray-50 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-center"><Pencil size={12} className="mr-1"/> Редагувати</button>
                                            <button onClick={() => handleDelete('product', product.id)} className="p-1.5 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {currentSection === 'drawings' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 overflow-y-auto p-1">
                                {drawings.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).map(drawing => (
                                    <div key={drawing.id} className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-all group relative">
                                        <div className="aspect-[3/4] bg-gray-100 rounded-lg mb-3 overflow-hidden border relative cursor-pointer" onClick={() => setEnlargedImage(drawing.photo)}>
                                            {drawing.photo ? <img src={drawing.photo} className="w-full h-full object-contain p-2"/> : <FileText className="m-auto text-gray-300"/>}
                                        </div>
                                        <div className="flex justify-between items-center"><h3 className="font-bold text-gray-900 text-sm truncate">{drawing.name}</h3><button onClick={() => handleDelete('drawing', drawing.id)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50"><Trash2 size={14}/></button></div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {currentSection === 'warehouse' && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                                <div className="overflow-x-auto flex-1">
                                    <table className="w-full text-sm text-left min-w-[600px]">
                                        <thead className="bg-gray-50 text-gray-500 font-medium border-b sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-3">Виріб</th>
                                                <th className="px-6 py-3">Артикул</th>
                                                <th className="px-6 py-3 text-right">Наявність</th>
                                                <th className="px-6 py-3 text-right">Мін. залишок</th>
                                                <th className="px-6 py-3 text-right">Дії</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {productStocks.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-gray-400">Склад порожній</td></tr>)}
                                            {productStocks.filter(stock => {
                                                const p = products.find(prod => prod.id === stock.productId);
                                                return p?.name.toLowerCase().includes(searchTerm.toLowerCase()) || p?.sku.toLowerCase().includes(searchTerm.toLowerCase());
                                            }).map(stock => {
                                                const product = products.find(p => p.id === stock.productId);
                                                const isLow = stock.quantity <= stock.criticalQuantity;
                                                return (
                                                    <tr key={stock.id} className="hover:bg-gray-50 transition-colors group">
                                                        <td className="px-6 py-3"><div className="flex items-center"><div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 mr-3">{product?.photo ? <img src={product.photo} className="w-full h-full object-cover"/> : <Box className="m-auto text-gray-400" size={20}/>}</div><span className="font-bold text-gray-900">{product?.name || 'Unknown Product'}</span></div></td>
                                                        <td className="px-6 py-3 font-mono text-gray-600">{product?.sku}</td>
                                                        <td className="px-6 py-3 text-right"><span className={`font-bold text-lg ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{stock.quantity}</span><span className="text-xs text-gray-400 ml-1">шт</span></td>
                                                        <td className="px-6 py-3 text-right text-gray-500 font-mono">{stock.criticalQuantity}</td>
                                                        <td className="px-6 py-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => openStockModal('add', stock)} className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100" title="Додати"><Plus size={16}/></button><button onClick={() => openStockModal('move', stock)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="Перемістити/Списати"><ArrowRight size={16}/></button></div></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        {currentSection === 'defects' && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                                <div className="overflow-x-auto flex-1">
                                    <table className="w-full text-sm text-left min-w-[800px]">
                                        <thead className="bg-gray-50 text-gray-500 font-medium border-b sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 w-10">
                                                    <div className="flex items-center justify-center">
                                                        <CheckSquare size={16} className="text-gray-300"/>
                                                    </div>
                                                </th>
                                                <th className="px-4 py-3">Фото</th>
                                                <th className="px-4 py-3">Виріб</th>
                                                <th className="px-4 py-3">Працівник</th>
                                                <th className="px-4 py-3">Етап</th>
                                                <th className="px-4 py-3 text-right">Кількість</th>
                                                <th className="px-4 py-3">Причина</th>
                                                <th className="px-4 py-3 text-right">Дата</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {defectItems.length === 0 && (<tr><td colSpan={8} className="p-8 text-center text-gray-400">Записів про брак немає</td></tr>)}
                                            {defectItems.map(item => {
                                                const prod = products.find(p => p.id === item.productId);
                                                const isSelected = selectedDefectIds.has(item.id);
                                                return (
                                                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-red-50' : ''}`} onClick={() => toggleDefectSelection(item.id)}>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className={`transition-colors ${isSelected ? 'text-red-600' : 'text-gray-300'}`}>
                                                                {isSelected ? <CheckSquare size={18}/> : <Square size={18}/>}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3"><div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden">{item.imageUrl || prod?.photo ? <img src={item.imageUrl || prod?.photo} className="w-full h-full object-cover"/> : <Box className="m-auto text-gray-400" size={20}/>}</div></td>
                                                        <td className="px-4 py-3 font-bold text-gray-900">{item.productName || prod?.name || 'Unknown'}</td>
                                                        <td className="px-4 py-3 text-gray-700">{item.workerName || '-'}</td>
                                                        <td className="px-4 py-3 text-gray-500">{item.stageName || '-'}</td>
                                                        <td className="px-4 py-3 text-right"><span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">-{item.quantity}</span></td>
                                                        <td className="px-4 py-3 text-gray-600 italic max-w-xs truncate" title={item.reason}>{item.reason}</td>
                                                        <td className="px-4 py-3 text-right font-mono text-gray-500">{item.date ? new Date(item.date.seconds ? item.date.seconds * 1000 : item.date).toLocaleDateString('uk-UA') : '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        {currentSection === 'setup_maps' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto p-1">
                                {setupMaps.map(map => {
                                    const linkedProduct = products.find(p => p.id === map.productCatalogId);
                                    const componentsCount = map.inputComponents?.length || 0;
                                    return (
                                        <div key={map.id} className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow group relative">
                                            <div className="flex justify-between items-start mb-4 border-b pb-4">
                                                <div>
                                                    <h3 className="font-bold text-lg text-gray-900">{map.name}</h3>
                                                    <div className="text-sm text-gray-500 mt-1">
                                                        <span className="flex items-center"><Wrench size={14} className="mr-1"/> Верстат: <span className="font-bold text-gray-800 ml-1">{map.machine}</span></span>
                                                        {linkedProduct && (<span className="flex items-center mt-1"><Box size={14} className="mr-1"/> Виріб: <span className="font-bold text-blue-600 ml-1">{linkedProduct.name}</span></span>)}
                                                        <span className={`flex items-center mt-1 text-[10px] font-black uppercase ${map.processType === 'manufacturing' ? 'text-blue-600' : 'text-gray-400'}`}>
                                                          {map.processType === 'manufacturing' ? 'Виготовлення' : 'Збірка'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className="bg-orange-50 text-orange-700 text-xs font-bold px-2 py-1 rounded">{map.blocks.length} інструментів</span>
                                                    {componentsCount > 0 && (<span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded flex items-center"><Link size={10} className="mr-1"/> {componentsCount} попер. етап(ів)</span>)}
                                                    <div className="flex gap-1 mt-1">
                                                        <button onClick={() => handleEditMap(map)} className="p-2 text-gray-400 hover:text-blue-50 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={16} /></button>
                                                        <button onClick={() => handleDelete('setupMap', map.id)} className="p-2 text-gray-400 hover:text-red-50 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {map.blocks.slice(0, 3).map((block, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                                                        <div className="flex items-center">
                                                            <div className="w-6 h-6 bg-gray-100 rounded text-xs font-bold flex items-center justify-center text-gray-500 mr-2 border shrink-0">{block.toolNumber || idx + 1}</div>
                                                            <div className="font-bold text-gray-700 line-clamp-1">{block.toolName}</div>
                                                        </div>
                                                        <div className="text-xs text-gray-500 font-mono bg-white px-1 rounded border shrink-0 ml-2">{block.settings}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </>
        ) : activeMainTab === 'wip' && (isSuperAdmin || canView('products_wip')) ? (
            <div className="flex-1 flex flex-col animate-fade-in">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex gap-4">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input 
                        placeholder="Пошук по замовленню, виробу або етапу..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        value={wipSearchTerm}
                        onChange={e => setWipSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left min-w-[800px]">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b sticky top-0 z-10">
                                <tr>
                                    <th className="p-4">Замовлення</th>
                                    <th className="p-4">Виріб</th>
                                    <th className="p-4">Етап (Завдання)</th>
                                    <th className="p-4">Партія</th>
                                    <th className="p-4 text-center">Вироблено</th>
                                    <th className="p-4 text-center">Використано</th>
                                    <th className="p-4 text-right">Баланс (Доступно)</th>
                                    <th className="p-4 text-right">Дії</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {inventory.length === 0 && (
                                    <tr><td colSpan={8} className="p-8 text-center text-gray-400">Немає активних виробничих етапів</td></tr>
                                )}
                                {inventory.map(item => (
                                    <tr key={item.uniqueId} className="hover:bg-gray-50 transition-colors group">
                                        <td className="p-4 font-bold text-blue-600">{item.orderNumber}</td>
                                        <td className="p-4 text-gray-700">{item.productName}</td>
                                        <td className="p-4 font-medium">
                                            {item.stageName}
                                            {item.isFinalStage && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">FINAL</span>}
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold">
                                                {item.batchCode || "-"}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-gray-900 font-bold">{item.produced}</td>
                                        <td className="p-4 text-center text-gray-500">{item.used}</td>
                                        <td className="p-4 text-right">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.balance > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                                {item.balance} шт
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button 
                                                    onClick={() => handleOpenWipModal(tasks.find(t => t.id === item.taskId)!, 'add')}
                                                    className="text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 p-2 rounded-lg transition-colors"
                                                    title="Додати залишок (+)"
                                                >
                                                    <Plus size={16}/>
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenWipModal(tasks.find(t => t.id === item.taskId)!, 'deduct')}
                                                    className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                                                    title="Списати / Брак"
                                                >
                                                    <Minus size={16}/>
                                                </button>
                                                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                                                <button 
                                                    onClick={() => handleArchiveTask(tasks.find(t => t.id === item.taskId)!)}
                                                    className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-200 p-2 rounded-lg transition-colors"
                                                    title="Архівувати (Прибрати зі списку)"
                                                >
                                                    <Archive size={16}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        ) : (
            <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-200">
                <div className="text-center text-gray-400">
                    <Ban size={48} className="mx-auto mb-2 opacity-20"/>
                    <p className="font-bold">Доступ обмежено</p>
                    <p className="text-sm">У вас немає прав для перегляду цього розділу.</p>
                </div>
            </div>
        )}

      {/* --- ALL MODALS --- */}
      
      {/* WIP MANUAL STOCK MODAL */}
      {isWipModalOpen && wipSelectedTask && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-[95%] md:w-full md:max-w-sm p-6 m-4 md:m-0">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">
                          {wipModalMode === 'add' ? 'Додати залишок' : 'Списати / Брак'}
                      </h3>
                      <button onClick={() => setIsWipModalOpen(false)}><X size={20} className="text-gray-400"/></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Номер партії / Зміна</label>
                          <input 
                            type="text" 
                            className="w-full p-3 border rounded-lg"
                            placeholder="Напр. П-1 або Нічна"
                            value={wipBatchCode}
                            onChange={e => setWipBatchCode(e.target.value)}
                          />
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Кількість (шт)</label>
                          <input 
                            type="number" 
                            className="w-full p-3 border rounded-lg font-bold text-lg"
                            autoFocus
                            placeholder="0"
                            value={wipManualQty}
                            onChange={e => setWipManualQty(Number(e.target.value))}
                          />
                      </div>
                      
                      {wipModalMode === 'deduct' && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                            <label className="block text-xs font-bold text-red-800 uppercase mb-2">Тип списання</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setWipDeductType('adjustment')}
                                    className={`flex-1 py-2 text-xs font-bold rounded border transition-colors ${wipDeductType === 'adjustment' ? 'bg-white text-red-600 border-red-200 shadow-sm' : 'bg-transparent text-red-400 border-transparent hover:bg-red-100'}`}
                                >
                                    Коригування
                                </button>
                                <button 
                                    onClick={() => setWipDeductType('defect')}
                                    className={`flex-1 py-2 text-xs font-bold rounded border transition-colors ${wipDeductType === 'defect' ? 'bg-white text-red-600 border-red-200 shadow-sm' : 'bg-transparent text-red-400 border-transparent hover:bg-red-100'}`}
                                >
                                    Брак (Defect)
                                </button>
                            </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Коментар / Причина</label>
                        <textarea 
                            className="w-full p-3 border rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder={wipModalMode === 'add' ? "Примітка (опціонально)" : "Вкажіть причину списання..."}
                            value={wipNote}
                            onChange={e => setWipNote(e.target.value)}
                        />
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setIsWipModalOpen(false)} className="flex-1 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Скасувати</button>
                      <button 
                        onClick={handleSaveWipStock} 
                        disabled={wipIsSubmitting || !wipManualQty} 
                        className={`flex-1 py-2 text-white font-bold rounded-lg disabled:opacity-50 flex justify-center items-center ${wipModalMode === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                      >
                          {wipIsSubmitting ? <Loader size={16} className="animate-spin"/> : (wipModalMode === 'add' ? 'Додати' : 'Списати')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* 3. PRODUCT MODAL */}
      {isProductModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-[95%] md:w-full md:max-w-lg overflow-y-auto max-h-[90vh] m-4 md:m-0">
                 <div className="px-6 py-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg">{editingProductId ? 'Редагувати виріб' : 'Новий виріб'}</h3>
                    <button onClick={() => setIsProductModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                 </div>
                 <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden group hover:border-blue-400 transition-colors shrink-0">
                            {prodPhoto ? <img src={prodPhoto} className="w-full h-full object-cover" /> : <div className="text-center p-2"><ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-1" /><span className="text-[9px] text-gray-400 block leading-tight">Завантажити фото</span></div>}
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileSelect} />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Артикул (SKU)</label>
                            <input className="w-full p-2.5 border rounded-lg font-mono font-bold" placeholder="A-001" value={prodSku} onChange={e => setProdSku(e.target.value)}/>
                        </div>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Назва виробу</label>
                       <input className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Напр: Втулка латунна" value={prodName} onChange={e => setProdName(e.target.value)}/>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Креслення (PDF/Image)</label>
                       <SearchableSelect value={prodDrawingId} onChange={setProdDrawingId} options={drawings.map(d => ({ value: d.id, label: d.name, image: d.photo }))} placeholder="Прив'язати креслення..." />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Колірний маркер</label>
                       <div className="flex gap-2">
                          {COLORS.map(c => <button key={c} onClick={() => setProdColor(c)} className={`w-8 h-8 rounded-full border transition-transform hover:scale-110 ${prodColor === c ? 'ring-2 ring-offset-1 ring-slate-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />)}
                       </div>
                    </div>
                 </div>
                 <div className="p-6 border-t flex justify-end bg-gray-50 rounded-b-xl">
                    <button onClick={handleSaveProduct} disabled={isUploading} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors flex items-center disabled:opacity-50">
                       {isUploading && <Loader size={16} className="animate-spin mr-2"/>} Зберегти
                    </button>
                 </div>
              </div>
           </div>
      )}

      {/* 4. DRAWING MODAL */}
      {isDrawingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-[95%] md:w-full md:max-w-sm p-6 m-4 md:m-0">
                        <h3 className="font-bold text-lg mb-4">Нове креслення</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Назва</label>
                                <input className="w-full p-2 border rounded-lg" placeholder="Напр: Вал-200" value={newDrawingName} onChange={e => setNewDrawingName(e.target.value)}/>
                            </div>
                            <div className="w-full h-40 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden group hover:border-blue-400 transition-colors">
                                {drawingPreview ? <img src={drawingPreview} className="w-full h-full object-contain p-2" /> : <div className="text-center p-2"><FileText className="w-8 h-8 text-gray-300 mx-auto mb-1" /><span className="text-[9px] text-gray-400 block leading-tight">Завантажити файл</span></div>}
                                <input type="file" accept="image/*,.pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleDrawingFileSelect} />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setIsDrawingModalOpen(false)} className="px-4 py-2 text-gray-500">Скасувати</button>
                            <button onClick={handleSaveDrawing} disabled={isUploading} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold disabled:opacity-50 flex items-center">
                                {isUploading && <Loader size={16} className="animate-spin mr-2"/>} Зберегти
                            </button>
                        </div>
                    </div>
                </div>
      )}

      {/* 5. ADD TO STOCK MODAL */}
      {isAddItemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-[95%] md:w-full md:max-w-md p-6 m-4 md:m-0">
                  <h3 className="font-bold text-lg mb-4">Додати позицію на склад</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Виберіть виріб</label>
                          <SearchableSelect 
                              options={products.map(p => ({ value: p.id, label: p.name, subLabel: p.sku, image: p.photo }))}
                              value={selectedProductId}
                              onChange={setSelectedProductId}
                              placeholder="Оберіть виріб..."
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Фактична кількість</label>
                              <input 
                                type="number" 
                                className="w-full p-2 border rounded-lg font-bold"
                                value={newStockQty}
                                onChange={e => setNewStockQty(Number(e.target.value))}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-red-500 uppercase mb-1">Критична кількість</label>
                              <input 
                                type="number" 
                                className="w-full p-2 border rounded-lg border-red-200 bg-red-50 font-bold text-red-700"
                                value={newStockCritical}
                                onChange={e => setNewStockCritical(Number(e.target.value))}
                              />
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setIsAddItemModalOpen(false)} className="px-4 py-2 text-gray-500">Скасувати</button>
                      <button onClick={handleAddItemToWarehouse} disabled={!selectedProductId} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold disabled:opacity-50">Додати</button>
                  </div>
              </div>
          </div>
      )}

      {/* 6. STOCK OPERATION MODAL */}
      {isStockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-[95%] md:w-full md:max-sm p-6 m-4 md:m-0">
                  <h3 className="font-bold text-lg mb-4">{stockOpType === 'add' ? 'Прихід товару' : 'Переміщення / Списання'}</h3>
                  <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Кількість</label>
                        <input type="number" className="w-full p-2 border rounded-lg font-bold text-lg" value={stockQty} onChange={e => setStockQty(Number(e.target.value))} autoFocus />
                      </div>
                      {stockOpType === 'move' && (
                          <>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Дія</label>
                            <div className="flex gap-2">
                                <button onClick={() => setMoveTarget('sell')} className={`flex-1 py-2 text-sm border rounded ${moveTarget === 'sell' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white'}`}>Продаж / Відвантаження</button>
                                <button onClick={() => setMoveTarget('defect')} className={`flex-1 py-2 text-sm border rounded ${moveTarget === 'defect' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white'}`}>У Брак</button>
                            </div>
                          </>
                      )}
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setIsStockModalOpen(false)} className="px-4 py-2 text-gray-500">Скасувати</button>
                      <button onClick={handleStockOp} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold">Підтвердити</button>
                  </div>
              </div>
          </div>
      )}

      {/* 7. WRITE OFF MODAL */}
      {isWriteOffModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-[95%] md:w-full md:max-w-lg p-6 max-h-[80vh] overflow-y-auto m-4 md:m-0">
                  <h3 className="font-bold text-lg mb-4">Списання браку</h3>
                  <div className="space-y-2 mb-4">
                      {Array.from(selectedDefectIds).map((id: string) => {
                          const item = defectItems.find(d => d.id === id);
                          if (!item) return null;
                          const prod = products.find(p => p.id === item.productId);
                          const qty = writeOffQtyMap[id] || 0;
                          return (
                              <div key={id} className="flex justify-between items-center p-2 border rounded bg-gray-50">
                                  <div>
                                      <div className="font-bold text-sm">{prod?.name || item.productName}</div>
                                      <div className="text-xs text-gray-500">Доступно: {item.quantity}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <span className="text-xs">Списати:</span>
                                      <input 
                                        type="number" 
                                        className="w-16 p-1 border rounded text-center font-bold" 
                                        value={qty} 
                                        onChange={e => handleWriteOffQtyChange(id, e.target.value)}
                                      />
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setIsWriteOffModalOpen(false)} className="px-4 py-2 text-gray-500">Скасувати</button>
                      <button onClick={handleWriteOff} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">Списати обране</button>
                  </div>
              </div>
          </div>
      )}

      {/* 8. SETUP MAP MODAL */}
      {isMapModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-[95%] md:w-full md:max-w-2xl p-6 max-h-[90vh] overflow-y-auto m-4 md:m-0">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">{editingMapId ? 'Редагувати карту' : 'Створити карту наладки'}</h3>
                      <button onClick={() => setIsMapModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="flex gap-4">
                          <div 
                              className="w-32 h-32 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden group hover:border-blue-400 transition-all cursor-pointer shrink-0"
                              onClick={() => document.getElementById('map-photo-upload')?.click()}
                          >
                              {newMapPhoto ? (
                                  <img src={newMapPhoto} className="w-full h-full object-cover" alt="Setup Map" />
                              ) : (
                                  <div className="text-center p-2">
                                      <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Фото наладки</span>
                                  </div>
                              )}
                              <input id="map-photo-upload" type="file" accept="image/*" className="hidden" onChange={handleMapFileSelect} />
                              {newMapPhoto && (
                                  <button 
                                      onClick={(e) => { e.stopPropagation(); setNewMapPhoto(''); setNewMapPhotoFile(null); }} 
                                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                      <X size={12}/>
                                  </button>
                              )}
                          </div>
                          <div className="flex-1 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Назва карти</label>
                                      <input className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold" value={newMapName} onChange={e => setNewMapName(e.target.value)} placeholder="Напр: ОП-10"/>
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Верстат</label>
                                      <input className="w-full p-2.5 border rounded-lg font-bold" value={newMapMachine} onChange={e => setNewMapMachine(e.target.value)} placeholder="Напр: Haas ST-10"/>
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Прив'язка до виробу</label>
                                      <SearchableSelect 
                                          options={products.map(p => ({ value: p.id, label: p.name, image: p.photo }))}
                                          value={newMapProductId}
                                          onChange={setNewMapProductId}
                                          placeholder="Оберіть виріб..."
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Креслення деталі</label>
                                      <SearchableSelect 
                                          options={drawings.map(d => ({ value: d.id, label: d.name, image: d.photo }))}
                                          value={newMapDrawingId}
                                          onChange={setNewMapDrawingId}
                                          placeholder="Оберіть креслення..."
                                      />
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Тип процесу</label>
                          <div className="flex gap-4">
                              <label className="flex items-center cursor-pointer">
                                  <input type="radio" name="processType" className="w-4 h-4 text-blue-600" checked={newMapProcessType === 'manufacturing'} onChange={() => setNewMapProcessType('manufacturing')} />
                                  <span className="ml-2 text-sm font-medium">Виготовлення (Перший етап)</span>
                              </label>
                              <label className="flex items-center cursor-pointer">
                                  <input type="radio" name="processType" className="w-4 h-4 text-blue-600" checked={newMapProcessType === 'assembly'} onChange={() => setNewMapProcessType('assembly')} />
                                  <span className="ml-2 text-sm font-medium">Збірка (Вимагає компоненти)</span>
                              </label>
                          </div>
                      </div>

                      {/* Components Requirements */}
                      <div className="border-t pt-4">
                          <div className="flex justify-between items-center mb-2">
                              <label className="block text-xs font-bold text-blue-600 uppercase">Вхідні компоненти (Збірка)</label>
                              <button onClick={addComponentRequirement} className="text-xs text-blue-600 font-bold hover:underline">+ Додати</button>
                          </div>
                          <div className="space-y-2 bg-gray-50 p-2 rounded border border-gray-100">
                            {newMapComponents.length === 0 && (
                                <div className="text-center text-xs text-gray-400 py-2 italic">Немає вхідних компонентів</div>
                            )}
                            {newMapComponents.map((comp, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <div className="flex-1">
                                        <select 
                                            className="w-full p-1 border rounded text-xs bg-white outline-none focus:border-blue-500" 
                                            value={comp.name || ''} 
                                            onChange={e => updateComponentRequirement(idx, 'name', e.target.value)}
                                            disabled={!newMapProductId || currentCycleStages.length === 0}
                                        >
                                            <option value="">{newMapProductId ? (currentCycleStages.length > 0 ? "-- Оберіть етап-джерело --" : "-- Цикл робіт порожній/відсутній --") : "-- Спочатку оберіть виріб --"}</option>
                                            {currentCycleStages.map((stage, sIdx) => (
                                                <option key={stage.id} value={stage.name}>
                                                    {sIdx + 1}. {stage.name} ({stage.machine})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-20">
                                        <input 
                                            type="number" 
                                            className="w-full p-1 border rounded text-center text-xs font-bold" 
                                            placeholder="К-сть"
                                            value={comp.qty || comp.ratio} 
                                            onChange={e => updateComponentRequirement(idx, 'qty', Number(e.target.value))}
                                            step="1"
                                        />
                                    </div>
                                    <span className="text-xs text-gray-400 w-8">шт</span>
                                    <button onClick={() => removeComponentRequirement(idx)} className="text-red-500 hover:text-red-700 ml-auto p-1"><Trash2 size={14}/></button>
                                </div>
                            ))}
                          </div>
                      </div>

                      {/* Tool Blocks */}
                      <div className="border-t pt-4">
                          <div className="flex justify-between items-center mb-2">
                              <label className="block text-xs font-bold text-orange-600 uppercase">Інструментальні блоки</label>
                              <button onClick={addBlockField} className="text-xs text-orange-600 font-bold hover:underline">+ Додати інструмент</button>
                          </div>
                          <div className="space-y-2">
                              {newMapBlocks.map((block, idx) => (
                                  <div key={block.tempId} className="flex gap-2 items-start bg-gray-50 p-2 rounded border border-gray-100">
                                      <input 
                                        className="w-12 p-1 border rounded text-center text-sm font-bold" 
                                        placeholder="#" 
                                        value={block.toolNumber} 
                                        onChange={e => updateBlockField(idx, 'toolNumber', e.target.value)}
                                      />
                                      <div className="flex-1">
                                          <SearchableSelect 
                                              options={tools.map(t => ({ value: t.id, label: t.name, image: t.photo }))}
                                              value={block.toolId || ''}
                                              onChange={(val) => updateBlockField(idx, 'toolId', val)}
                                              placeholder="Оберіть інструмент..."
                                              className="mb-1"
                                          />
                                          <input 
                                            className="w-full p-1 border rounded text-xs" 
                                            placeholder="Налаштування / Коментар" 
                                            value={block.settings} 
                                            onChange={e => updateBlockField(idx, 'settings', e.target.value)}
                                          />
                                      </div>
                                      <button onClick={() => removeBlockField(idx)} className="p-1 text-gray-400 hover:text-red-500 mt-1"><X size={16}/></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                      <button onClick={() => setIsMapModalOpen(false)} className="px-4 py-2 text-gray-500">Скасувати</button>
                      <button onClick={handleSaveMap} disabled={isUploading} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold flex items-center disabled:opacity-50">
                          {isUploading && <Loader size={14} className="animate-spin mr-2"/>} Зберегти
                      </button>
                  </div>
              </div>
          </div>
      )}

      {enlargedImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setEnlargedImage(null)}>
            <button onClick={() => setEnlargedImage(null)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors">
                <X size={24}/>
            </button>
            <img 
                src={enlargedImage} 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-white/10" 
                onClick={e => e.stopPropagation()} 
            />
        </div>
      )}

      {deleteConfirm && (
        <DeleteConfirmModal 
            isOpen={deleteConfirm.isOpen}
            onClose={() => setDeleteConfirm(null)}
            onConfirm={confirmDelete}
            isDeleting={isDeleting}
            title={deleteConfirm.type === 'product' ? 'Видалити виріб?' : deleteConfirm.type === 'setupMap' ? 'Видалити карту?' : 'Видалити креслення?'}
            message={`Ви впевнені? Елемент буде видалено. Цю дію не можна скасувати.`}
        />
      )}
    </div>
  );
};