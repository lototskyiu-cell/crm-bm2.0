
import React, { useState, useEffect } from 'react';
import { 
  doc, 
  getDoc, 
  getDocs, 
  collection, 
  setDoc, 
  writeBatch, 
  increment, 
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc
} from "firebase/firestore";
import { db } from "../services/firebase";
import { API } from '../services/api'; 
import { Tool, ToolFolder, ToolTransaction, User, UnitOfMeasure } from '../types';
import { SearchableSelect } from '../components/SearchableSelect';
import { uploadFileToCloudinary } from '../services/cloudinary';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { 
  Folder, FolderPlus, Wrench, Package, Clipboard, Plus, 
  ArrowRight, ClipboardCopy, Scissors, Download, TrendingUp, 
  AlertTriangle, CornerDownRight, Image as ImageIcon, Search, Filter, X, Pencil, Trash2, Loader
} from 'lucide-react';

interface ToolsProps {
  currentUser: User;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export const Tools: React.FC<ToolsProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'warehouse' | 'production' | 'analytics'>('production');
  
  const [currentCatalogFolderId, setCurrentCatalogFolderId] = useState<string | null>(null);
  const [currentWarehouseFolderId, setCurrentWarehouseFolderId] = useState<string | null>(null);
  const [currentProductionFolderId, setCurrentProductionFolderId] = useState<string | null>(null);

  const [items, setItems] = useState<any[]>([]); 
  const [allFolders, setAllFolders] = useState<ToolFolder[]>([]);
  const [transactions, setTransactions] = useState<ToolTransaction[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderForm, setFolderForm] = useState<{ id: string | null, name: string, color: string }>({ id: null, name: '', color: '#3b82f6' });
  
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [newTool, setNewTool] = useState<Partial<Tool>>({ unit: 'pcs', colorTag: '#3b82f6' });
  const [toolPhotoFile, setToolPhotoFile] = useState<File | null>(null); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockOp, setStockOp] = useState<{ type: 'add' | 'move', itemId: string, qty: number, target: string }>({ type: 'add', itemId: '', qty: 0, target: '' });

  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [usageOp, setUsageOp] = useState<{ itemId: string, qty: number, note: string }>({ itemId: '', qty: 1, note: '' });

  const [isItemEditModalOpen, setIsItemEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, type: 'tool' | 'folder', id: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // --- HELPER: NOTIFICATIONS ---
  const createNotification = async (title: string, message: string, type: 'warning' | 'info' = 'info') => {
    try {
      await addDoc(collection(db, 'notifications'), {
        title,
        message,
        type,
        target: 'admin',
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Помилка створення сповіщення:", e);
    }
  };

  // --- 1. SMART STATUS CLASS HELPER ---
  const getItemStatusClass = (item: any) => {
    const limit = item.criticalQuantity || 0;
    if (limit <= 0) return 'bg-white';

    let isCrit = false;
    if (activeTab === 'warehouse') {
      isCrit = (item.quantity || 0) <= limit;
    } else if (activeTab === 'production') {
      isCrit = (item.productionQuantity || 0) <= limit;
    } else {
      isCrit = (item.quantity || 0) <= limit;
    }

    return isCrit 
      ? 'bg-red-50 border-l-4 border-red-500' 
      : 'bg-white';
  };

  // --- 2. ADVANCED EXPORT LOGIC ---
  const handleExport = () => {
    if (!items || items.length === 0) {
      alert("Немає даних для експорту");
      return;
    }

    const headers = ["Назва", "Опис", "Залишок СКЛАД", "Залишок ВИРОБНИЦТВО", "Ліміт"];
    
    const rows = items.map(item => {
      const clean = (text: any) => (text || "").toString().replace(/;/g, " ").replace(/\n/g, " ");
      return [
        clean(item.name),
        clean(item.description),
        item.quantity || 0,
        item.productionQuantity || 0,
        item.criticalQuantity || 0
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory_full_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 3. FETCH ITEMS ---
  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const [catSnap, whSnap, prSnap] = await Promise.all([
        getDocs(collection(db, 'toolCatalog')),
        getDocs(collection(db, 'toolWarehouse')),
        getDocs(collection(db, 'toolProduction'))
      ]);

      const whMap = new Map(whSnap.docs.map(d => [d.id, d.data().quantity || 0]));
      const prMap = new Map(prSnap.docs.map(d => [d.id, d.data().quantity || 0]));

      const combinedItems = catSnap.docs.map(doc => {
        const data = doc.data();
        const whQty = whMap.get(doc.id) || 0;
        const critLimit = data.criticalQuantity || 0;
        
        return {
          id: doc.id,
          ...data,
          quantity: whQty,
          productionQuantity: prMap.get(doc.id) || 0,
          photo: data.photoUrl || data.photo || '',
          isCritical: whQty <= critLimit && critLimit > 0
        };
      });

      setItems(combinedItems);
    } catch (error) {
      console.error("Помилка завантаження даних:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    
    const unsubCatFolders = API.subscribeToToolFolders('catalog', (data) => setAllFolders(prev => [...prev.filter(f => f.type !== 'catalog'), ...data]));
    const unsubWhFolders = API.subscribeToToolFolders('warehouse', (data) => setAllFolders(prev => [...prev.filter(f => f.type !== 'warehouse'), ...data]));
    const unsubProdFolders = API.subscribeToToolFolders('production', (data) => setAllFolders(prev => [...prev.filter(f => f.type !== 'production'), ...data]));
    
    const qTx = query(collection(db, 'toolTransactions'), orderBy('date', 'desc'), limit(100));
    const unsubTx = onSnapshot(qTx, (s) => setTransactions(s.docs.map(d => ({id: d.id, ...d.data()} as ToolTransaction))));

    return () => { unsubCatFolders(); unsubWhFolders(); unsubProdFolders(); unsubTx(); };
  }, []);

  const openNewFolderModal = () => {
    setFolderForm({ id: null, name: '', color: '#3b82f6' });
    setIsFolderModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm || isDeleting) return;
    setIsDeleting(true);
    try {
        if (deleteConfirm.type === 'tool') {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'toolCatalog', deleteConfirm.id));
            batch.delete(doc(db, 'toolWarehouse', deleteConfirm.id));
            batch.delete(doc(db, 'toolProduction', deleteConfirm.id));
            await batch.commit();
        } else {
            await API.deleteToolFolder(deleteConfirm.id);
        }
        setDeleteConfirm(null);
        fetchItems();
    } catch (e) {
        alert("Помилка видалення");
    } finally {
        setIsDeleting(false);
    }
  };

  const handleCreateTool = async () => {
      if (!newTool.name || isActionInProgress) return;
      setIsActionInProgress(true);
      try {
          let finalPhotoUrl = newTool.photo || '';
          if (toolPhotoFile) finalPhotoUrl = await uploadFileToCloudinary(toolPhotoFile);
          
          const batch = writeBatch(db);
          const newDocRef = doc(collection(db, 'toolCatalog'));
          const id = newDocRef.id;

          const catalogData = {
              name: newTool.name,
              unit: newTool.unit || 'pcs',
              photoUrl: finalPhotoUrl,
              description: newTool.description || '',
              folderId: currentCatalogFolderId,
              colorTag: newTool.colorTag || '#3b82f6',
              criticalQuantity: newTool.criticalQuantity || 0,
              type: 'tool',
              createdAt: serverTimestamp()
          };

          batch.set(doc(db, 'toolCatalog', id), catalogData);
          batch.set(doc(db, 'toolWarehouse', id), { quantity: 0 });
          batch.set(doc(db, 'toolProduction', id), { quantity: 0 });
          
          await batch.commit();
          
          setIsToolModalOpen(false);
          setNewTool({ unit: 'pcs', colorTag: '#3b82f6' });
          setToolPhotoFile(null);
          setEditingId(null);
          fetchItems();
      } catch (e) {
          alert('Помилка створення інструменту');
      } finally {
          setIsActionInProgress(false);
      }
  };

  const executeStockOp = async () => {
      const item = items.find(i => i.id === stockOp.itemId);
      if (!item || !stockOp.qty || isActionInProgress) return;

      setIsActionInProgress(true);
      try {
          const amount = Number(stockOp.qty);
          const batch = writeBatch(db);

          if (stockOp.type === 'add') {
              const whRef = doc(db, 'toolWarehouse', item.id);
              batch.set(whRef, { quantity: increment(amount) }, { merge: true });

              const txRef = doc(collection(db, 'toolTransactions'));
              batch.set(txRef, {
                  toolId: item.id,
                  userId: currentUser.id,
                  userName: `${currentUser.firstName} ${currentUser.lastName}`,
                  type: 'import',
                  amount: amount,
                  target: 'Головний склад',
                  date: new Date().toISOString()
              });
          } else {
              if (item.quantity < amount) { alert("Недостатньо залишку на складі!"); setIsActionInProgress(false); return; }
              
              const newWhQty = item.quantity - amount;
              
              batch.set(doc(db, 'toolWarehouse', item.id), { quantity: increment(-amount) }, { merge: true });
              batch.set(doc(db, 'toolProduction', item.id), { quantity: increment(amount) }, { merge: true });
              
              const txRef = doc(collection(db, 'toolTransactions'));
              batch.set(txRef, {
                  toolId: item.id,
                  userId: currentUser.id,
                  userName: `${currentUser.firstName} ${currentUser.lastName}`,
                  type: 'move_to_prod',
                  amount: amount,
                  target: stockOp.target || 'Виробництво (Цех)',
                  date: new Date().toISOString()
              });

              if (newWhQty <= (item.criticalQuantity || 0)) {
                  await createNotification(
                      "Критичний залишок (СКЛАД)",
                      `На головному складі закінчується "${item.name}". Залишилось: ${newWhQty} ${item.unit}.`,
                      'warning'
                  );
              }
          }
          
          await batch.commit();
          setIsStockModalOpen(false);
          fetchItems();
      } catch (e) {
          alert("Помилка бази даних");
      } finally {
          setIsActionInProgress(false);
      }
  };

  const handleConsume = async () => {
      const selectedItem = items.find(i => i.id === usageOp.itemId);
      if (!selectedItem || !usageOp.qty || isActionInProgress) return;

      const amount = Number(usageOp.qty);
      const isFromWarehouse = activeTab === 'warehouse';
      const currentStock = isFromWarehouse ? selectedItem.quantity : selectedItem.productionQuantity;

      if (currentStock < amount) { alert("Недостатньо залишку!"); return; }

      setIsActionInProgress(true);
      try {
          const batch = writeBatch(db);
          const targetColl = isFromWarehouse ? 'toolWarehouse' : 'toolProduction';
          
          batch.set(doc(db, targetColl, selectedItem.id), { quantity: increment(-amount) }, { merge: true });
          
          const txRef = doc(collection(db, 'toolTransactions'));
          batch.set(txRef, {
              toolId: selectedItem.id,
              userId: currentUser.id,
              userName: `${currentUser.firstName} ${currentUser.lastName}`,
              type: 'usage',
              amount: amount,
              target: usageOp.note || 'Використання',
              date: new Date().toISOString()
          });

          const limit = selectedItem.criticalQuantity || 0;
          
          if (isFromWarehouse) {
             const newWarehouseQty = (selectedItem.quantity || 0) - amount;
             if (newWarehouseQty <= limit) {
                await createNotification(
                  "Критичний залишок (СКЛАД)", 
                  `На головному складі закінчується "${selectedItem.name}". Залишилось: ${newWarehouseQty}`, 
                  "warning"
                );
             }
          } 
          else if (activeTab === 'production') {
             const newProdQty = (selectedItem.productionQuantity || 0) - amount;
             if (newProdQty <= limit) {
                await createNotification(
                  "Критичний залишок (ЦЕХ)", 
                  `У виробничому цеху закінчується "${selectedItem.name}". Залишилось: ${newProdQty}`, 
                  "warning"
                );
             }
          }

          await batch.commit();
          setIsUsageModalOpen(false);
          fetchItems();
      } catch (e) {
          alert("Помилка списання");
      } finally {
          setIsActionInProgress(false);
      }
  };

  const handleEditItemSave = async () => {
    if (!editingItem || isActionInProgress) return;
    setIsActionInProgress(true);
    try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'toolWarehouse', editingItem.id), { quantity: Number(editingItem.quantity) }, { merge: true });
        batch.set(doc(db, 'toolProduction', editingItem.id), { quantity: Number(editingItem.productionQuantity) }, { merge: true });
        batch.update(doc(db, 'toolCatalog', editingItem.id), { criticalQuantity: Number(editingItem.criticalQuantity) });
        
        await batch.commit();
        setIsItemEditModalOpen(false);
        fetchItems();
    } catch (e) {
        alert("Помилка збереження");
    } finally {
        setIsActionInProgress(false);
    }
  };

  const handleSaveFolder = async () => {
      if (!folderForm.name) return;
      let type: 'catalog' | 'warehouse' | 'production' = 'catalog';
      let parentId: string | null = null;
      if (!folderForm.id) {
          if (activeTab === 'warehouse') { type = 'warehouse'; parentId = currentWarehouseFolderId; }
          else if (activeTab === 'production') { type = 'production'; parentId = currentProductionFolderId; }
          else { type = 'catalog'; parentId = currentCatalogFolderId; }
      } else {
          const existing = allFolders.find(f => f.id === folderForm.id);
          if (existing) { type = existing.type; parentId = existing.parentId; }
      }
      const folder: ToolFolder = { id: folderForm.id || `tf_${Date.now()}`, name: folderForm.name, parentId, type, colorTag: folderForm.color };
      await API.saveToolFolder(folder);
      setIsFolderModalOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setToolPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => { if (typeof reader.result === 'string') setNewTool(prev => ({...prev, photo: reader.result as string})); };
        reader.readAsDataURL(file);
    }
  };

  const filterItems = (list: any[]) => {
      return list.filter(t => (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) && (!selectedColor || t.colorTag === selectedColor));
  };

  const getBreadcrumbNameInner = (id: string | null, type: 'catalog' | 'warehouse' | 'production') => {
      if (!id) return type === 'catalog' ? 'Root' : type === 'warehouse' ? 'Головний склад' : 'Виробництво (Цех)';
      const folder = allFolders.find(f => f.id === id);
      return folder ? folder.name : '...';
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader className="animate-spin text-blue-600" size={32}/></div>;

  return (
    <div className="p-4 md:p-8 h-screen flex flex-col bg-slate-50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 shrink-0">
        <div><h1 className="text-2xl font-bold text-gray-900">Витратні інструменти</h1><p className="text-gray-500 text-sm">Управління залишками та видачею (Fail-Safe)</p></div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto overflow-x-auto whitespace-nowrap">
            {currentUser.role === 'admin' && (
                <><button onClick={() => setActiveTab('catalog')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${activeTab === 'catalog' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}><Wrench size={16} className="mr-2"/> Каталог</button>
                  <button onClick={() => setActiveTab('warehouse')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${activeTab === 'warehouse' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}><Package size={16} className="mr-2"/> Склад</button></>
            )}
            <button onClick={() => setActiveTab('production')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${activeTab === 'production' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}><Clipboard size={16} className="mr-2"/> Виробництво</button>
            {currentUser.role === 'admin' && (<button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${activeTab === 'analytics' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}><TrendingUp size={16} className="mr-2"/> Аналітика</button>)}
          </div>
          {currentUser.role === 'admin' && (
            <button 
              onClick={handleExport} 
              className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors" 
              title="Завантажити звіт у Excel"
            >
              <Download size={18}/>
              <span className="font-medium text-sm">Експорт</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm relative">
         {/* CATALOG VIEW */}
         {activeTab === 'catalog' && (
             <div className="h-full flex flex-col">
                 <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                     <div className="flex items-center text-sm font-medium"><button onClick={() => setCurrentCatalogFolderId(null)} className="hover:text-blue-600 flex items-center"><Folder size={16} className="mr-1"/> Root</button>{currentCatalogFolderId && <><ArrowRight size={14} className="mx-2 text-gray-400"/> {getBreadcrumbNameInner(currentCatalogFolderId, 'catalog')}</>}</div>
                     <div className="flex gap-2">
                        <button onClick={openNewFolderModal} className="bg-white border px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow-sm hover:bg-gray-50 transition-all"><FolderPlus size={16} className="mr-1"/> Папка</button>
                        <button onClick={() => { setEditingId(null); setNewTool({ unit: 'pcs', colorTag: '#3b82f6', criticalQuantity: 5 }); setIsToolModalOpen(true); }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-blue-700 shadow-lg"><Plus size={16} className="mr-1"/> Інструмент</button>
                     </div>
                 </div>
                 <div className="p-4 bg-gray-50">
                    <div className="bg-white p-3 rounded-xl border flex items-center">
                        <Search size={18} className="text-gray-400 mr-3"/><input placeholder="Пошук..." className="flex-1 bg-transparent py-2 outline-none text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                 </div>
                 <div className="p-6 overflow-y-auto grid grid-cols-2 md:grid-cols-6 gap-4">
                     {allFolders.filter(f => f.type === 'catalog' && f.parentId === currentCatalogFolderId).map(f => (
                         <div key={f.id} onClick={() => setCurrentCatalogFolderId(f.id)} className="group p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col items-center relative">
                             <Folder size={48} className="text-blue-200" style={{ color: f.colorTag }} />
                             <span className="text-sm font-bold text-gray-700">{f.name}</span>
                             <button onClick={e => { e.stopPropagation(); setFolderForm({ id: f.id, name: f.name, color: f.colorTag || '#3b82f6' }); setIsFolderModalOpen(true); }} className="absolute top-2 right-2 p-1 bg-white shadow rounded hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={12}/></button>
                         </div>
                     ))}
                     {filterItems(items.filter(i => i.folderId === currentCatalogFolderId)).map(t => (
                         <div key={t.id} className={`group relative p-4 rounded-xl border transition-all flex flex-col items-center border-gray-200 ${getItemStatusClass(t)}`}>
                             <div className="w-16 h-16 bg-gray-100 rounded-lg mb-2 overflow-hidden border">
                                {t.photo && <img src={t.photo} className="w-full h-full object-cover"/>}
                             </div>
                             <span className={`text-xs font-bold text-center line-clamp-2 ${getItemStatusClass(t).includes('red-500') ? 'text-red-700' : 'text-gray-800'}`}>
                                {getItemStatusClass(t).includes('red-500') && <AlertTriangle size={10} className="inline mr-1 text-red-500"/>}
                                {t.name}
                             </span>
                             <div className="absolute top-2 right-2 flex gap-1">
                                <button onClick={e => { e.stopPropagation(); setEditingId(t.id); setNewTool(t); setIsToolModalOpen(true); }} className="p-1 bg-white shadow rounded hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={12}/></button>
                                <button onClick={e => { e.stopPropagation(); setDeleteConfirm({isOpen: true, type: 'tool', id: t.id}); }} className="p-1 bg-white shadow rounded hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
         )}

         {/* WAREHOUSE VIEW */}
         {activeTab === 'warehouse' && (
             <div className="h-full flex flex-col">
                 <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <span className="font-bold text-gray-700 flex items-center"><Package size={18} className="mr-2"/> Головний склад</span>
                    <button onClick={() => setActiveTab('catalog')} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-slate-800 shadow-md"><Plus size={16} className="mr-1"/> Нова позиція (з каталогу)</button>
                 </div>
                 <div className="p-4 bg-gray-50">
                    <div className="bg-white p-3 rounded-xl border flex items-center">
                        <Search size={18} className="text-gray-400 mr-3"/><input placeholder="Пошук на складі..." className="flex-1 bg-transparent py-2 outline-none text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                 </div>
                 <div className="p-6 overflow-y-auto space-y-2">
                    {filterItems(items).map(item => {
                        return (
                            <div key={item.id} className={`flex items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-all group ${getItemStatusClass(item)}`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-100 rounded border overflow-hidden">{item.photo && <img src={item.photo} className="w-full h-full object-cover"/>}</div>
                                    <div>
                                        <div className={`font-bold text-sm ${getItemStatusClass(item).includes('red-500') ? 'text-red-700' : 'text-gray-900'}`}>
                                            {getItemStatusClass(item).includes('red-500') && <AlertTriangle size={14} className="inline mr-1 text-red-500"/>}
                                            {item.name}
                                        </div>
                                        <div className="text-xs text-gray-500">Мін: {item.criticalQuantity || 5} {item.unit}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className={`text-right font-bold text-lg ${getItemStatusClass(item).includes('red-500') ? 'text-red-600' : 'text-gray-800'}`}>{item.quantity || 0}</div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setStockOp({ type: 'add', itemId: item.id, qty: 1, target: '' }); setIsStockModalOpen(true); }} className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center hover:bg-green-200" title="Прихід"><Plus size={16}/></button>
                                        <button onClick={() => { setStockOp({ type: 'move', itemId: item.id, qty: 1, target: 'Виробництво' }); setIsStockModalOpen(true); }} className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center hover:bg-blue-200" title="В цех"><ArrowRight size={16}/></button>
                                        <button onClick={() => { setEditingItem(item); setIsItemEditModalOpen(true); }} className="p-2 text-gray-400 hover:text-blue-600 rounded transition-all"><Pencil size={14}/></button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                 </div>
             </div>
         )}

         {/* PRODUCTION VIEW */}
         {activeTab === 'production' && (
             <div className="h-full flex flex-col">
                 <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                     <span className="font-bold text-gray-700 flex items-center"><Clipboard size={18} className="mr-2"/> Наявність у виробництві (Цех)</span>
                 </div>
                 <div className="p-4 bg-gray-50">
                    <div className="bg-white p-3 rounded-xl border flex items-center">
                        <Search size={18} className="text-gray-400 mr-3"/><input placeholder="Пошук у цеху..." className="flex-1 bg-transparent py-2 outline-none text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                 </div>
                 <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {filterItems(items).filter(i => (i.productionQuantity || 0) > 0 || (i.quantity || 0) > 0).map(item => {
                         return (
                             <div key={item.id} className={`rounded-xl border p-5 shadow-sm hover:shadow-md transition-all relative ${getItemStatusClass(item)}`}>
                                 <div className="flex justify-between items-start mb-4">
                                     <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border">{item.photo && <img src={item.photo} className="w-full h-full object-cover"/>}</div>
                                     <div className="text-xl font-bold text-gray-900">{item.productionQuantity || 0} <span className="text-sm text-gray-400 font-normal">{item.unit}</span></div>
                                 </div>
                                 <h3 className={`font-bold mb-4 line-clamp-1 ${getItemStatusClass(item).includes('red-500') ? 'text-red-700' : 'text-gray-900'}`}>
                                     {getItemStatusClass(item).includes('red-500') && <AlertTriangle size={16} className="inline mr-1 text-red-500"/>}
                                     {item.name}
                                 </h3>
                                 <div className="flex gap-2">
                                    <button onClick={() => { setUsageOp({ itemId: item.id, qty: 1, note: '' }); setIsUsageModalOpen(true); }} className="flex-1 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 shadow-md">Взяти</button>
                                    <button onClick={() => { setEditingItem(item); setIsItemEditModalOpen(true); }} className="p-2 bg-gray-50 border rounded-lg text-gray-400 hover:text-blue-600 transition-all"><Pencil size={16}/></button>
                                 </div>
                             </div>
                         );
                     })}
                 </div>
             </div>
         )}

         {/* ANALYTICS VIEW */}
         {activeTab === 'analytics' && (
             <div className="h-full flex flex-col">
                 <div className="flex-1 overflow-x-auto">
                     <table className="w-full text-sm text-left">
                         <thead className="bg-gray-50 text-gray-500 font-medium border-b sticky top-0"><tr><th className="p-4">Дата</th><th className="p-4">Працівник</th><th className="p-4">Тип</th><th className="p-4">Інструмент</th><th className="p-4 text-right">К-сть</th><th className="p-4">Ціль</th></tr></thead>
                         <tbody className="divide-y divide-gray-100">
                             {transactions.map(tr => (
                                 <tr key={tr.id} className="hover:bg-gray-50">
                                     <td className="p-4 text-gray-500">{new Date(tr.date).toLocaleString('uk-UA')}</td>
                                     <td className="p-4 font-bold">{tr.userName}</td>
                                     <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${tr.type === 'import' ? 'bg-green-100 text-green-700' : tr.type === 'usage' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{tr.type}</span></td>
                                     <td className="p-4">{items.find(i => i.id === tr.toolId)?.name || 'Unknown'}</td>
                                     <td className="p-4 text-right font-bold">{tr.amount}</td>
                                     <td className="p-4 text-gray-500 text-xs">{tr.target}</td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             </div>
         )}
      </div>

      {/* --- MODAL: ITEM EDIT --- */}
      {isItemEditModalOpen && editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-lg text-gray-900">Редагувати за залишки</h3>
                      <button onClick={() => setIsItemEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                  </div>
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">На складі</label>
                              <input type="number" className="w-full p-2.5 border rounded-lg font-bold" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: Number(e.target.value)})} />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-blue-500 uppercase mb-1">У виробництві</label>
                              <input type="number" className="w-full p-2.5 border rounded-lg font-bold" value={editingItem.productionQuantity} onChange={e => setEditingItem({...editingItem, productionQuantity: Number(e.target.value)})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-red-500 uppercase mb-1">Мін. поріг (Склад)</label>
                          <input type="number" className="w-full p-2.5 border border-red-100 bg-red-50 rounded-lg font-bold text-red-700" value={editingItem.criticalQuantity || 5} onChange={e => setEditingItem({...editingItem, criticalQuantity: Number(e.target.value)})} />
                      </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-8">
                      <button onClick={() => setIsItemEditModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-all">Скасувати</button>
                      <button onClick={handleEditItemSave} disabled={isActionInProgress} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 shadow-lg flex items-center transition-all">
                         {isActionInProgress && <Loader size={18} className="animate-spin mr-2"/>} Зберегти
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL: RESTOCK / MOVE --- */}
      {isStockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <h3 className="font-bold text-lg mb-6">{stockOp.type === 'add' ? 'Поповнення складу' : 'Переміщення в цех'}</h3>
                  <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Кількість</label>
                        <input type="number" className="w-full p-3 border rounded-xl font-bold text-2xl text-center bg-gray-50 focus:bg-white transition-all outline-none" value={stockOp.qty || ''} placeholder="0" onChange={e => setStockOp({...stockOp, qty: Number(e.target.value)})} autoFocus />
                      </div>
                      {stockOp.type === 'move' && (
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Куди / Коментар</label>
                            <input className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none" placeholder="Верстат 1" value={stockOp.target} onChange={e => setStockOp({...stockOp, target: e.target.value})} />
                          </div>
                      )}
                  </div>
                  <div className="flex gap-3 mt-8">
                      <button onClick={() => setIsStockModalOpen(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all">Скасувати</button>
                      <button onClick={executeStockOp} disabled={isActionInProgress} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 shadow-xl transition-all">Підтвердити</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL: CONSUME --- */}
      {isUsageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <h3 className="font-bold text-lg mb-6">Взяти інструмент</h3>
                  <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Кількість</label>
                        <input type="number" className="w-full p-3 border rounded-xl font-bold text-2xl text-center bg-gray-50 focus:bg-white transition-all outline-none" value={usageOp.qty || ''} placeholder="0" onChange={e => setUsageOp({...usageOp, qty: Number(e.target.value)})} autoFocus />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Примітка</label>
                        <input className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none" placeholder="Ціль..." value={usageOp.note} onChange={e => setUsageOp({...usageOp, note: e.target.value})} />
                      </div>
                  </div>
                  <div className="flex gap-3 mt-8">
                      <button onClick={() => setIsUsageModalOpen(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all">Скасувати</button>
                      <button onClick={handleConsume} disabled={isActionInProgress} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 shadow-xl transition-all">Видати</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL: NEW TOOL --- */}
      {isToolModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <h3 className="font-bold text-lg mb-6">{editingId ? 'Редагувати в каталозі' : 'Новий інструмент'}</h3>
                  <div className="space-y-4">
                      <input className="w-full p-2.5 border rounded-lg font-bold" placeholder="Назва інструменту" value={newTool.name || ''} onChange={e => setNewTool({...newTool, name: e.target.value})} />
                      <div className="flex gap-4">
                        <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden group hover:border-blue-400 transition-all cursor-pointer shrink-0">
                            {newTool.photo ? <img src={newTool.photo} className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-300" />}
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileSelect} />
                        </div>
                        <div className="flex-1 space-y-4">
                            <select className="w-full p-2.5 border rounded-lg bg-white font-medium" value={newTool.unit} onChange={e => setNewTool({...newTool, unit: e.target.value as UnitOfMeasure})}>
                                <option value="pcs">Штуки (pcs)</option><option value="kg">Кілограми (kg)</option><option value="meter">Метри (m)</option>
                            </select>
                            <div className="flex gap-1.5">
                                {COLORS.map(c => <button key={c} onClick={() => setNewTool({...newTool, colorTag: c})} className={`w-5 h-5 rounded-full border ${newTool.colorTag === c ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`} style={{ backgroundColor: c }} />)}
                            </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Мін. поріг (Склад)</label>
                            <input type="number" className="w-full p-2.5 border rounded-lg" value={newTool.criticalQuantity || 0} onChange={e => setNewTool({...newTool, criticalQuantity: Number(e.target.value)})}/>
                          </div>
                      </div>
                      <textarea className="w-full p-2.5 border rounded-lg h-20 resize-none outline-none focus:ring-2 focus:ring-blue-500" placeholder="Опис / характеристики..." value={newTool.description || ''} onChange={e => setNewTool({...newTool, description: e.target.value})} />
                  </div>
                  <div className="flex justify-end gap-3 mt-8">
                      <button onClick={() => setIsToolModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Скасувати</button>
                      <button onClick={handleCreateTool} disabled={isActionInProgress} className="bg-slate-900 text-white px-8 py-2 rounded-lg font-bold hover:bg-slate-800 shadow-lg transition-all flex items-center">{isActionInProgress && <Loader size={16} className="animate-spin mr-2"/>} Зберегти</button>
                  </div>
              </div>
          </div>
      )}

      {isFolderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-sm p-6">
                  <h3 className="font-bold text-lg mb-4">{folderForm.id ? 'Редагувати папку' : 'Нова папка'}</h3>
                  <div className="space-y-4">
                      <input className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Назва" value={folderForm.name} onChange={e => setFolderForm({...folderForm, name: e.target.value})} />
                      <div className="flex gap-2">
                        {COLORS.map(c => (<button key={c} onClick={() => setFolderForm({...folderForm, color: c})} className={`w-6 h-6 rounded-full border transition-all ${folderForm.color === c ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`} style={{ backgroundColor: c }} />))}
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setIsFolderModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Скасувати</button>
                      <button onClick={handleSaveFolder} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all">Зберегти</button>
                  </div>
              </div>
          </div>
      )}

      {deleteConfirm && (<DeleteConfirmModal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={confirmDelete} isDeleting={isDeleting} />)}
    </div>
  );
};
