
import React, { useState, useEffect } from 'react';
import { store } from '../services/mockStore';
import { API } from '../services/api'; 
import { Tool, ToolFolder, WarehouseItem, ProductionItem, ToolTransaction, User, UnitOfMeasure } from '../types';
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

  const [tools, setTools] = useState<Tool[]>([]);
  const [catalogFolders, setCatalogFolders] = useState<ToolFolder[]>([]);
  const [warehouseFolders, setWarehouseFolders] = useState<ToolFolder[]>([]);
  const [productionFolders, setProductionFolders] = useState<ToolFolder[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
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

  const [clipboard, setClipboard] = useState<{ type: 'tool' | 'folder' | 'warehouseItem' | 'productionItem', id: string, op: 'cut' | 'copy' } | null>(null);

  const [isAddToWarehouseOpen, setIsAddToWarehouseOpen] = useState(false);
  const [isAddToProductionOpen, setIsAddToProductionOpen] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState('');
  const [addStockQty, setAddStockQty] = useState<number>(1);
  const [addStockCritical, setAddStockCritical] = useState<number>(5);

  const [draggedItem, setDraggedItem] = useState<{ type: 'tool' | 'folder' | 'warehouseItem' | 'productionItem', id: string } | null>(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    refreshData();
  }, [currentCatalogFolderId, currentWarehouseFolderId, currentProductionFolderId, activeTab]);

  useEffect(() => {
    const unsubscribe = API.subscribeToTools((data) => {
        setTools(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setSearchTerm('');
    setSelectedColor(null);
  }, [activeTab]);

  const refreshData = () => {
    setCatalogFolders([...store.getToolFolders('catalog', currentCatalogFolderId)]);
    setWarehouseFolders([...store.getToolFolders('warehouse', currentWarehouseFolderId)]);
    setProductionFolders([...store.getToolFolders('production', currentProductionFolderId)]);
    setWarehouseItems([...store.getWarehouseItems(currentWarehouseFolderId)]);
    setProductionItems([...store.getProductionItems(currentProductionFolderId)]);
    setTransactions([...store.getTransactions()]);
  };

  const getBreadcrumbName = (id: string | null, type: 'catalog' | 'warehouse' | 'production') => {
      if (!id) {
          if (type === 'catalog') return 'Root';
          if (type === 'warehouse') return 'Головний склад';
          return 'Виробництво (Цех)';
      }
      const folder = store.toolFolders.find(f => f.id === id);
      return folder ? folder.name : '...';
  };

  const openNewFolderModal = () => {
      setFolderForm({ id: null, name: '', color: '#3b82f6' });
      setIsFolderModalOpen(true);
  };

  const handleEditFolder = (e: React.MouseEvent, folder: ToolFolder) => {
      e.stopPropagation();
      setFolderForm({ id: folder.id, name: folder.name, color: folder.colorTag || '#3b82f6' });
      setIsFolderModalOpen(true);
  };

  const handleSaveFolder = () => {
      if (!folderForm.name) return;
      
      let type: 'catalog' | 'warehouse' | 'production' = 'catalog';
      let parentId: string | null = null;

      if (!folderForm.id) {
          if (activeTab === 'warehouse') {
              type = 'warehouse';
              parentId = currentWarehouseFolderId;
          } else if (activeTab === 'production') {
              type = 'production';
              parentId = currentProductionFolderId;
          } else {
              type = 'catalog';
              parentId = currentCatalogFolderId;
          }
      } else {
          const existing = store.toolFolders.find(f => f.id === folderForm.id);
          if (existing) {
              type = existing.type;
              parentId = existing.parentId;
          }
      }
      
      const folder: ToolFolder = {
          id: folderForm.id || `tf_${Date.now()}`,
          name: folderForm.name,
          parentId,
          type,
          colorTag: folderForm.color,
      };
      store.saveToolFolder(folder);
      setIsFolderModalOpen(false);
      refreshData();
  };

  const handleEditTool = (e: React.MouseEvent, tool: Tool) => {
      e.stopPropagation();
      setEditingId(tool.id);
      setNewTool({
          name: tool.name,
          unit: tool.unit,
          description: tool.description,
          photo: tool.photo,
          colorTag: tool.colorTag || '#3b82f6'
      });
      setIsToolModalOpen(true);
  };

  const handleCreateTool = async () => {
      if (!newTool.name) return;
      if (isUploading) return;
      
      setIsUploading(true);
      let finalPhotoUrl = newTool.photo || '';

      try {
          if (toolPhotoFile) {
              finalPhotoUrl = await uploadFileToCloudinary(toolPhotoFile);
          }

          const tool: Tool = {
              id: editingId || '',
              name: newTool.name,
              unit: newTool.unit || 'pcs',
              photo: finalPhotoUrl,
              description: newTool.description || '',
              folderId: currentCatalogFolderId,
              colorTag: newTool.colorTag
          };
          
          await API.saveTool(tool);
          
          setIsToolModalOpen(false);
          setNewTool({ unit: 'pcs', colorTag: '#3b82f6' });
          setToolPhotoFile(null);
          setEditingId(null);
          
          if (isAddToWarehouseOpen) setSelectedToolId(tool.id); 
          if (isAddToProductionOpen) setSelectedToolId(tool.id);
          
      } catch (e) {
          alert('Upload failed');
      } finally {
          setIsUploading(false);
      }
  };

  const handleDeleteTool = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleteConfirm({ isOpen: true, id });
  }

  const confirmDelete = async () => {
      if (!deleteConfirm) return;
      setIsDeleting(true);
      try {
          await API.deleteTool(deleteConfirm.id);
          setDeleteConfirm(null);
      } catch(e) {
          alert('Error deleting tool');
      } finally {
          setIsDeleting(false);
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setToolPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTool({ ...newTool, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClipboard = (type: 'tool' | 'folder' | 'warehouseItem' | 'productionItem', id: string, op: 'cut' | 'copy', e: React.MouseEvent) => {
      e.stopPropagation();
      setClipboard({ type, id, op });
  };

  const handlePaste = () => {
      if (!clipboard) return;
      
      if (clipboard.type === 'tool') {
          const t = tools.find(x => x.id === clipboard.id);
          if (t) {
              if (clipboard.op === 'cut') {
                  const updated = { ...t, folderId: currentCatalogFolderId };
                  API.saveTool(updated);
                  setClipboard(null);
              } else {
                  const newT = { ...t, id: '', name: `${t.name} (Copy)`, folderId: currentCatalogFolderId };
                  API.saveTool(newT);
              }
          }
      } else if (clipboard.type === 'warehouseItem') {
          const item = store.warehouse.find(w => w.id === clipboard.id);
          if (item) {
              if (clipboard.op === 'cut') {
                  store.moveWarehouseItem(item.id, currentWarehouseFolderId);
                  setClipboard(null);
              } else {
                  store.addWarehouseStock(item.toolId, currentWarehouseFolderId, item.quantity, currentUser, item.criticalQuantity);
              }
          }
      } else if (clipboard.type === 'productionItem') {
          const item = store.productionItems.find(p => p.id === clipboard.id);
          if (item) {
              if (clipboard.op === 'cut') {
                  store.moveProductionItem(item.id, currentProductionFolderId);
                  setClipboard(null);
              }
          }
      } else if (clipboard.type === 'folder') {
          const folder = store.toolFolders.find(f => f.id === clipboard.id);
          if (folder) {
              let targetParent = currentCatalogFolderId;
              if (activeTab === 'warehouse') targetParent = currentWarehouseFolderId;
              if (activeTab === 'production') targetParent = currentProductionFolderId;

              if (clipboard.op === 'cut') {
                  if (targetParent !== folder.id) { 
                      store.moveToolFolder(folder.id, targetParent);
                      setClipboard(null);
                  }
              } else {
                  const newFolder: ToolFolder = {
                      ...folder,
                      id: `tf_${Date.now()}`,
                      name: `${folder.name} (Copy)`,
                      parentId: targetParent,
                      type: activeTab
                  };
                  store.saveToolFolder(newFolder);
              }
          }
      }
      
      refreshData();
  };

  const handleDragStart = (e: React.DragEvent, type: 'tool' | 'folder' | 'warehouseItem' | 'productionItem', id: string) => {
      e.dataTransfer.setData('type', type);
      e.dataTransfer.setData('id', id);
      setDraggedItem({ type, id });
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); 
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('type') as 'tool' | 'folder' | 'warehouseItem' | 'productionItem';
      const id = e.dataTransfer.getData('id');

      if (!type || !id) return;
      if (type === 'folder' && id === targetFolderId) return; 

      if (activeTab === 'catalog') {
          if (type === 'tool') {
              const t = tools.find(x => x.id === id);
              if (t) { API.saveTool({ ...t, folderId: targetFolderId }); }
          } else if (type === 'folder') {
              store.moveToolFolder(id, targetFolderId);
          }
      } else if (activeTab === 'warehouse') {
          if (type === 'warehouseItem') {
              store.moveWarehouseItem(id, targetFolderId);
          } else if (type === 'folder') {
              store.moveToolFolder(id, targetFolderId);
          }
      } else if (activeTab === 'production') {
          if (type === 'productionItem') {
              store.moveProductionItem(id, targetFolderId);
          } else if (type === 'folder') {
              store.moveToolFolder(id, targetFolderId);
          }
      }
      setDraggedItem(null);
      refreshData();
  };

  const getStockStatus = (item: WarehouseItem) => {
      if (item.quantity <= item.criticalQuantity) return 'red';
      if (item.quantity <= item.criticalQuantity * 1.5) return 'yellow';
      return 'green';
  };
  
  const getProdStatus = (item: ProductionItem) => {
      if (item.quantity <= item.criticalQuantity) return 'red';
      return 'green';
  };

  const handleAddToWarehouse = () => {
      if (!selectedToolId) return;
      store.addWarehouseStock(
          selectedToolId, 
          currentWarehouseFolderId, 
          Number(addStockQty), 
          currentUser, 
          Number(addStockCritical)
      );
      setIsAddToWarehouseOpen(false);
      setSelectedToolId('');
      setAddStockQty(1);
      setAddStockCritical(5);
      refreshData();
  };

  const handleAddToProduction = () => {
      if (!selectedToolId) return;
      store.addProductionStock(
          selectedToolId, 
          currentProductionFolderId, 
          Number(addStockQty), 
          currentUser, 
          Number(addStockCritical)
      );
      setIsAddToProductionOpen(false);
      setSelectedToolId('');
      setAddStockQty(1);
      setAddStockCritical(5);
      refreshData();
  };

  const executeStockOp = () => {
      if (stockOp.type === 'add') {
          const wItem = warehouseItems.find(w => w.id === stockOp.itemId);
          if (wItem) {
              store.addWarehouseStock(wItem.toolId, wItem.folderId, stockOp.qty, currentUser);
          }
      } else {
          try {
             store.moveStockToProduction(stockOp.itemId, stockOp.qty, currentUser, stockOp.target);
          } catch(e) {
             alert(e instanceof Error ? e.message : String(e));
          }
      }
      setIsStockModalOpen(false);
      refreshData();
  };

  const executeUsageOp = () => {
      try {
          store.consumeProductionTool(usageOp.itemId, usageOp.qty, currentUser, usageOp.note);
          setIsUsageModalOpen(false);
          refreshData();
      } catch(e) {
          alert(e instanceof Error ? e.message : String(e));
      }
  };

  const handleExport = () => {
      let csv = "Date;User;Type;Tool;Amount;Target;Balance\n";
      transactions.forEach(tr => {
         const t = store.getTool(tr.toolId);
         csv += `${new Date(tr.date).toLocaleString()};${tr.userName};${tr.type};${t?.name};${tr.amount};${tr.target || ''};${tr.balanceSnapshot}\n`;
      });
      const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "tools_report.csv");
      document.body.appendChild(link);
      link.click();
  };

  const filterTools = (toolsList: Tool[]) => {
      return toolsList.filter(t => {
          const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesColor = selectedColor ? t.colorTag === selectedColor : true;
          return matchesSearch && matchesColor;
      });
  };

  const filterFolders = (foldersList: ToolFolder[]) => {
      return foldersList.filter(f => {
          const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesColor = selectedColor ? f.colorTag === selectedColor : true;
          return matchesSearch && matchesColor;
      });
  };

  const filterItems = (items: (WarehouseItem | ProductionItem)[]) => {
      return items.filter(item => {
          const t = tools.find(tool => tool.id === item.toolId);
          if (!t) return false;
          const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesColor = selectedColor ? t.colorTag === selectedColor : true;
          return matchesSearch && matchesColor;
      });
  };

  const SearchBar = () => (
    <div className="bg-white p-3 rounded-xl border mb-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center flex-1 bg-gray-50 rounded-lg px-3 border border-gray-100">
            <Search size={18} className="text-gray-400 mr-3"/>
            <input 
                placeholder="Пошук інструменту..." 
                className="flex-1 bg-transparent py-2 outline-none text-sm" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
            <Filter size={16} className="text-gray-400 mr-1"/>
            <div className="flex gap-1.5">
                {COLORS.map(color => (
                    <button
                        key={color}
                        onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                        className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-offset-1 ring-slate-900 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        title="Фільтр за кольором"
                    />
                ))}
            </div>
            {selectedColor && (
                <button onClick={() => setSelectedColor(null)} className="ml-2 text-xs text-gray-400 hover:text-red-500">
                    <X size={14}/>
                </button>
            )}
        </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 h-screen flex flex-col bg-slate-50">
      {/* Header and Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 shrink-0">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Витратні інструменти</h1>
           <p className="text-gray-500 text-sm">Управління складом та видачею</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 mt-4 md:mt-0">
           {currentUser.role === 'admin' && (
               <>
                <button onClick={() => setActiveTab('catalog')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${activeTab === 'catalog' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                    <Wrench size={16} className="mr-2"/> Каталог
                </button>
                <button onClick={() => setActiveTab('warehouse')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${activeTab === 'warehouse' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                    <Package size={16} className="mr-2"/> Склад
                </button>
               </>
           )}
           <button onClick={() => setActiveTab('production')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${activeTab === 'production' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
               <Clipboard size={16} className="mr-2"/> Виробництво
           </button>
           {currentUser.role === 'admin' && (
                <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${activeTab === 'analytics' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                    <TrendingUp size={16} className="mr-2"/> Аналітика
                </button>
           )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm relative">
         {/* CATALOG TAB */}
         {activeTab === 'catalog' && (
             <div className="h-full flex flex-col">
                 <div 
                    className={`p-4 border-b border-gray-100 flex justify-between items-center ${draggedItem ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, null)}
                 >
                     <div className="flex items-center text-sm font-medium">
                        <button onClick={() => setCurrentCatalogFolderId(null)} className="hover:text-blue-600 flex items-center"><Folder size={16} className="mr-1"/> Root</button>
                        {currentCatalogFolderId && <><ArrowRight size={14} className="mx-2 text-gray-400"/> {getBreadcrumbName(currentCatalogFolderId, 'catalog')}</>}
                     </div>
                     <div className="flex gap-2">
                        {clipboard && (
                            <button onClick={handlePaste} className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center border border-orange-200 animate-pulse">
                                <Clipboard size={16} className="mr-1"/> Paste ({clipboard.op})
                            </button>
                        )}
                        <button onClick={openNewFolderModal} className="bg-white border hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center">
                            <FolderPlus size={16} className="mr-1"/> Папка
                        </button>
                        <button onClick={() => { setEditingId(null); setNewTool({ unit: 'pcs', colorTag: '#3b82f6' }); setIsToolModalOpen(true); }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-blue-700">
                            <Plus size={16} className="mr-1"/> Інструмент
                        </button>
                     </div>
                 </div>
                 
                 <div className="p-4 bg-gray-50">
                    <SearchBar />
                 </div>

                 <div className="p-6 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 align-start content-start">
                     {filterFolders(catalogFolders).map(f => (
                         <div key={f.id} 
                              onClick={() => setCurrentCatalogFolderId(f.id)}
                              draggable
                              onDragStart={(e) => handleDragStart(e, 'folder', f.id)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, f.id)}
                              className="group p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all flex flex-col items-center relative"
                         >
                             <div className="relative mb-2">
                                <Folder size={48} className="text-blue-200 group-hover:text-blue-400 transition-colors" style={{ color: f.colorTag ? `${f.colorTag}40` : undefined }} />
                                {f.colorTag && <Folder size={48} className="absolute inset-0 text-blue-200 group-hover:text-blue-500 transition-colors opacity-50" style={{ color: f.colorTag }} />}
                             </div>
                             <span className="text-sm font-bold text-gray-700 text-center">{f.name}</span>
                             <div className="absolute top-2 right-2 flex gap-1">
                                <button onClick={(e) => handleEditFolder(e, f)} className="p-1 bg-white shadow rounded hover:text-blue-600 border border-gray-100"><Pencil size={12}/></button>
                                <button onClick={(e) => handleClipboard('folder', f.id, 'copy', e)} className="p-1 bg-white shadow rounded hover:text-blue-600 border border-gray-100"><ClipboardCopy size={12}/></button>
                                <button onClick={(e) => handleClipboard('folder', f.id, 'cut', e)} className="p-1 bg-white shadow rounded hover:text-orange-600 border border-gray-100"><Scissors size={12}/></button>
                             </div>
                         </div>
                     ))}
                     
                     {filterTools(tools.filter(t => t.folderId === currentCatalogFolderId)).map(t => (
                         <div key={t.id} 
                              draggable
                              onDragStart={(e) => handleDragStart(e, 'tool', t.id)}
                              className="group relative p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all flex flex-col items-center"
                         >
                             {t.colorTag && (
                                <div className="absolute top-2 left-2 w-3 h-3 rounded-full" style={{ backgroundColor: t.colorTag }} />
                             )}
                             <div className="w-16 h-16 bg-gray-100 rounded-lg mb-2 overflow-hidden border border-gray-100">
                                 {t.photo && <img src={t.photo} className="w-full h-full object-cover"/>}
                             </div>
                             <span className="text-xs font-bold text-gray-800 text-center line-clamp-2">{t.name}</span>
                             <span className="text-[10px] text-gray-400 mt-1 uppercase font-bold">{t.unit}</span>
                             
                             <div className="absolute top-2 right-2 flex gap-1">
                                <button onClick={(e) => handleEditTool(e, t)} className="p-1 bg-white shadow rounded hover:text-blue-600 border border-gray-100"><Pencil size={12}/></button>
                                <button onClick={(e) => handleClipboard('tool', t.id, 'copy', e)} className="p-1 bg-white shadow rounded hover:text-blue-600 border border-gray-100"><ClipboardCopy size={12}/></button>
                                <button onClick={(e) => handleClipboard('tool', t.id, 'cut', e)} className="p-1 bg-white shadow rounded hover:text-orange-600 border border-gray-100"><Scissors size={12}/></button>
                                <button onClick={(e) => handleDeleteTool(e, t.id)} className="p-1 bg-white shadow rounded hover:text-red-600 border border-gray-100"><Trash2 size={12}/></button>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
         )}

         {/* WAREHOUSE TAB */}
         {activeTab === 'warehouse' && (
             <div className="h-full flex flex-col">
                 <div 
                    className={`p-4 border-b border-gray-100 flex justify-between items-center ${draggedItem ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, null)}
                 >
                     <div className="flex items-center text-sm font-medium">
                        <button onClick={() => setCurrentWarehouseFolderId(null)} className="hover:text-blue-600 flex items-center"><Folder size={16} className="mr-1"/> Головний склад</button>
                        {currentWarehouseFolderId && <><ArrowRight size={14} className="mx-2 text-gray-400"/> {getBreadcrumbName(currentWarehouseFolderId, 'warehouse')}</>}
                     </div>
                     <div className="flex gap-2">
                        {clipboard && (
                            <button onClick={handlePaste} className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center border border-orange-200 animate-pulse">
                                <Clipboard size={16} className="mr-1"/> Paste ({clipboard.op})
                            </button>
                        )}
                        <button onClick={openNewFolderModal} className="bg-white border hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center">
                            <FolderPlus size={16} className="mr-1"/> Папка
                        </button>
                        <button onClick={() => setIsAddToWarehouseOpen(true)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-slate-800">
                            <Plus size={16} className="mr-1"/> Додати позицію
                        </button>
                     </div>
                 </div>

                 <div className="p-4 bg-gray-50">
                    <SearchBar />
                 </div>

                 <div className="p-6 overflow-y-auto">
                     {warehouseFolders.length > 0 && (
                         <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
                             {filterFolders(warehouseFolders).map(f => (
                                 <div 
                                    key={f.id} 
                                    onClick={() => setCurrentWarehouseFolderId(f.id)}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'folder', f.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, f.id)}
                                    className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-400 cursor-pointer flex flex-col items-center group relative hover:shadow-md transition-all"
                                >
                                     <div className="relative mb-2">
                                        <Folder size={32} className="text-gray-400 group-hover:text-blue-400 transition-colors" style={{ color: f.colorTag ? `${f.colorTag}40` : undefined }} />
                                        {f.colorTag && <Folder size={32} className="absolute inset-0 text-gray-400 group-hover:text-blue-500 transition-colors opacity-50" style={{ color: f.colorTag }} />}
                                     </div>
                                     <span className="text-xs font-bold">{f.name}</span>
                                     <div className="absolute top-2 right-2 flex gap-1">
                                        <button onClick={(e) => handleEditFolder(e, f)} className="p-1 bg-white rounded shadow hover:text-blue-600 border border-gray-100"><Pencil size={12}/></button>
                                        <button onClick={(e) => handleClipboard('folder', f.id, 'copy', e)} className="p-1 bg-white rounded shadow hover:text-blue-600 border border-gray-100"><ClipboardCopy size={12}/></button>
                                        <button onClick={(e) => handleClipboard('folder', f.id, 'cut', e)} className="p-1 bg-white rounded shadow hover:text-orange-600 border border-gray-100"><Scissors size={12}/></button>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     )}

                     <div className="space-y-2">
                        {warehouseItems.length === 0 && warehouseFolders.length === 0 && (
                            <div className="text-center py-10 text-gray-400">
                                <Package size={48} className="mx-auto mb-2 opacity-20"/>
                                <p className="text-sm">Ця папка порожня</p>
                            </div>
                        )}
                        {filterItems(warehouseItems).map((item) => {
                            const wItem = item as WarehouseItem;
                            const tool = tools.find(t => t.id === wItem.toolId);
                            const status = getStockStatus(wItem);
                            return (
                                <div 
                                    key={wItem.id} 
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'warehouseItem', wItem.id)}
                                    className={`flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-all group ${status === 'red' ? 'border-red-300 bg-red-50/50' : status === 'yellow' ? 'border-yellow-300 bg-yellow-50/50' : 'border-gray-200'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        {tool?.colorTag && (
                                            <div className="w-2 h-10 rounded-full" style={{ backgroundColor: tool.colorTag }} />
                                        )}
                                        <div className="w-10 h-10 bg-gray-100 rounded border overflow-hidden">
                                            {tool?.photo && <img src={tool.photo} className="w-full h-full object-cover"/>}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-900">{tool?.name}</div>
                                            <div className="text-xs text-gray-500">Мін: {wItem.criticalQuantity} {tool?.unit}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className={`text-lg font-bold ${status === 'red' ? 'text-red-600' : status === 'yellow' ? 'text-yellow-600' : 'text-gray-800'}`}>
                                                {wItem.quantity} <span className="text-xs font-normal text-gray-500">{tool?.unit}</span>
                                            </div>
                                            {status !== 'green' && <div className="text-[10px] font-bold text-red-500 uppercase flex items-center justify-end"><AlertTriangle size={10} className="mr-1"/> Мало</div>}
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={(e) => handleClipboard('warehouseItem', wItem.id, 'copy', e)} className="p-1.5 rounded bg-gray-100 hover:text-blue-600" title="Копіювати"><ClipboardCopy size={14}/></button>
                                            <button onClick={(e) => handleClipboard('warehouseItem', wItem.id, 'cut', e)} className="p-1.5 rounded bg-gray-100 hover:text-orange-600" title="Вирізати"><Scissors size={14}/></button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setStockOp({ type: 'add', itemId: wItem.id, qty: 0, target: '' }); setIsStockModalOpen(true); }} className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center hover:bg-green-200">
                                                <Plus size={16}/>
                                            </button>
                                            <button onClick={() => { setStockOp({ type: 'move', itemId: wItem.id, qty: 0, target: 'Production' }); setIsStockModalOpen(true); }} className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center hover:bg-blue-200">
                                                <ArrowRight size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                     </div>
                 </div>
             </div>
         )}

         {/* PRODUCTION TAB */}
         {activeTab === 'production' && (
             <div className="h-full flex flex-col">
                 <div 
                    className={`p-4 border-b border-gray-100 flex justify-between items-center ${draggedItem ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, null)}
                 >
                     <div className="flex items-center text-sm font-medium">
                        <button onClick={() => setCurrentProductionFolderId(null)} className="hover:text-blue-600 flex items-center"><Folder size={16} className="mr-1"/> Виробництво</button>
                        {currentProductionFolderId && <><ArrowRight size={14} className="mx-2 text-gray-400"/> {getBreadcrumbName(currentProductionFolderId, 'production')}</>}
                     </div>
                     <div className="flex gap-2">
                        {clipboard && (
                            <button onClick={handlePaste} className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center border border-orange-200 animate-pulse">
                                <Clipboard size={16} className="mr-1"/> Paste ({clipboard.op})
                            </button>
                        )}
                        <button onClick={openNewFolderModal} className="bg-white border hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center">
                            <FolderPlus size={16} className="mr-1"/> Папка
                        </button>
                        <button onClick={() => setIsAddToProductionOpen(true)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-slate-800">
                            <Plus size={16} className="mr-1"/> Додати інструмент
                        </button>
                     </div>
                 </div>

                 <div className="p-4 bg-gray-50">
                    <SearchBar />
                 </div>

                 <div className="p-6 overflow-y-auto">
                     {productionFolders.length > 0 && (
                         <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
                             {filterFolders(productionFolders).map(f => (
                                 <div 
                                    key={f.id} 
                                    onClick={() => setCurrentProductionFolderId(f.id)}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'folder', f.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, f.id)}
                                    className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-400 cursor-pointer flex flex-col items-center group relative hover:shadow-md transition-all"
                                >
                                     <div className="relative mb-2">
                                        <Folder size={32} className="text-gray-400 group-hover:text-blue-400 transition-colors" style={{ color: f.colorTag ? `${f.colorTag}40` : undefined }} />
                                        {f.colorTag && <Folder size={32} className="absolute inset-0 text-gray-400 group-hover:text-blue-500 transition-colors opacity-50" style={{ color: f.colorTag }} />}
                                     </div>
                                     <span className="text-xs font-bold">{f.name}</span>
                                     <div className="absolute top-2 right-2 flex gap-1">
                                        <button onClick={(e) => handleEditFolder(e, f)} className="p-1 bg-white rounded shadow hover:text-blue-600 border border-gray-100"><Pencil size={12}/></button>
                                        <button onClick={(e) => handleClipboard('folder', f.id, 'copy', e)} className="p-1 bg-white rounded shadow hover:text-blue-600 border border-gray-100"><ClipboardCopy size={12}/></button>
                                        <button onClick={(e) => handleClipboard('folder', f.id, 'cut', e)} className="p-1 bg-white rounded shadow hover:text-orange-600 border border-gray-100"><Scissors size={12}/></button>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     )}

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         {productionItems.length === 0 && productionFolders.length === 0 && (
                            <div className="col-span-3 text-center py-10 text-gray-400">
                                <Package size={48} className="mx-auto mb-2 opacity-20"/>
                                <p className="text-sm">Тут порожньо</p>
                            </div>
                         )}
                         {filterItems(productionItems).map(item => {
                             const pItem = item as ProductionItem;
                             const tool = tools.find(t => t.id === pItem.toolId);
                             const status = getProdStatus(pItem);
                             return (
                                 <div 
                                    key={pItem.id} 
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'productionItem', pItem.id)}
                                    className={`bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-all group relative ${status === 'red' ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'}`}
                                 >
                                     {tool?.colorTag && (
                                        <div className="absolute top-3 right-3 w-3 h-3 rounded-full" style={{ backgroundColor: tool.colorTag }} />
                                     )}
                                     <div className="flex justify-between items-start mb-4">
                                         <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border">
                                             {tool?.photo && <img src={tool.photo} className="w-full h-full object-cover"/>}
                                         </div>
                                         <div className={`text-xl font-bold ${status === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
                                             {pItem.quantity} <span className="text-sm text-gray-400 font-normal">{tool?.unit}</span>
                                         </div>
                                     </div>
                                     <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{tool?.name}</h3>
                                     <p className="text-xs text-gray-500 mb-4">{tool?.description || 'Без опису'}</p>
                                     
                                     <button 
                                        onClick={() => { setUsageOp({ itemId: pItem.id, qty: 1, note: '' }); setIsUsageModalOpen(true); }}
                                        className="w-full py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 active:scale-95 transition-all"
                                     >
                                         Взяти інструмент
                                     </button>

                                     <div className="absolute top-2 right-2 flex gap-1">
                                        <button onClick={(e) => handleClipboard('productionItem', pItem.id, 'cut', e)} className="p-1 bg-white shadow rounded hover:text-orange-600 border border-gray-100"><Scissors size={12}/></button>
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 </div>
             </div>
         )}

         {/* ANALYTICS TAB */}
         {activeTab === 'analytics' && (
             <div className="h-full flex flex-col">
                 <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-end">
                     <button onClick={handleExport} className="flex items-center text-sm font-bold text-green-700 bg-green-100 px-4 py-2 rounded-lg hover:bg-green-200">
                         <Download size={16} className="mr-2"/> Експорт Excel
                     </button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-0">
                     <table className="w-full text-sm text-left">
                         <thead className="bg-gray-50 text-gray-500 font-medium border-b sticky top-0">
                             <tr>
                                 <th className="p-4">Дата</th>
                                 <th className="p-4">Працівник</th>
                                 <th className="p-4">Тип операції</th>
                                 <th className="p-4">Інструмент</th>
                                 <th className="p-4 text-right">Кількість</th>
                                 <th className="p-4">Ціль / Нотатка</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                             {transactions.map(tr => {
                                 const tool = tools.find(t => t.id === tr.toolId);
                                 return (
                                     <tr key={tr.id} className="hover:bg-gray-50">
                                         <td className="p-4 text-gray-500">{new Date(tr.date).toLocaleString('uk-UA')}</td>
                                         <td className="p-4 font-bold text-gray-700">{tr.userName}</td>
                                         <td className="p-4">
                                             <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                 tr.type === 'import' ? 'bg-green-100 text-green-700' :
                                                 tr.type === 'usage' ? 'bg-orange-100 text-orange-700' :
                                                 'bg-blue-100 text-blue-700'
                                             }`}>
                                                 {tr.type === 'import' ? 'Прихід' : tr.type === 'usage' ? 'Використання' : 'Переміщення'}
                                             </span>
                                         </td>
                                         <td className="p-4 text-gray-900">{tool?.name}</td>
                                         <td className="p-4 text-right font-mono font-bold">{tr.amount}</td>
                                         <td className="p-4 text-gray-500 text-xs">{tr.target}</td>
                                     </tr>
                                 );
                             })}
                         </tbody>
                     </table>
                 </div>
             </div>
         )}
      </div>

      {isFolderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                  <h3 className="font-bold text-lg mb-2">{folderForm.id ? 'Редагувати папку' : 'Нова папка'}</h3>
                  <div className="text-xs text-gray-500 mb-4 flex items-center bg-gray-50 p-2 rounded">
                      <CornerDownRight size={12} className="mr-1"/> 
                      {folderForm.id ? 'Розташування' : 'Створення у'}: 
                      <strong className="ml-1 text-gray-800">
                          {activeTab === 'catalog' ? getBreadcrumbName(currentCatalogFolderId, 'catalog') : 
                           activeTab === 'warehouse' ? getBreadcrumbName(currentWarehouseFolderId, 'warehouse') :
                           getBreadcrumbName(currentProductionFolderId, 'production')}
                      </strong>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Назва</label>
                          <input 
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="Назва папки" 
                            value={folderForm.name} 
                            onChange={e => setFolderForm({...folderForm, name: e.target.value})} 
                            autoFocus 
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Колір</label>
                          <div className="flex gap-2">
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setFolderForm({...folderForm, color: c})}
                                    className={`w-6 h-6 rounded-full border transition-transform ${folderForm.color === c ? 'ring-2 ring-offset-1 ring-slate-900 scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                          </div>
                      </div>
                  </div>

                  <div className="flex justify-end gap-2">
                      <button onClick={() => setIsFolderModalOpen(false)} className="px-4 py-2 text-gray-500">Скасувати</button>
                      <button onClick={handleSaveFolder} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold">{folderForm.id ? 'Зберегти' : 'Створити'}</button>
                  </div>
              </div>
          </div>
      )}

      {isToolModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                  <h3 className="font-bold text-lg mb-4">{editingId ? 'Редагувати інструмент' : 'Новий інструмент'}</h3>
                  <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Назва</label>
                        <input className="w-full p-2 border rounded-lg" placeholder="Напр: Свердло 5мм" value={newTool.name || ''} onChange={e => setNewTool({...newTool, name: e.target.value})} />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Фото інструменту</label>
                        <div className="flex items-start gap-4">
                            <div className="w-24 h-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden group hover:border-blue-400 transition-colors shrink-0">
                                {newTool.photo ? (
                                    <img src={newTool.photo} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center p-2">
                                        <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                                        <span className="text-[9px] text-gray-400 block leading-tight">Завантажити фото</span>
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleFileSelect}
                                />
                            </div>
                            <div className="flex-1">
                                <input 
                                    className="w-full p-2 border rounded-lg text-sm mb-2" 
                                    placeholder="Або вставте пряме посилання (URL)" 
                                    value={newTool.photo || ''} 
                                    onChange={e => setNewTool({...newTool, photo: e.target.value})} 
                                />
                            </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Одиниця виміру</label>
                            <select className="w-full p-2 border rounded-lg bg-white" value={newTool.unit} onChange={e => setNewTool({...newTool, unit: e.target.value as UnitOfMeasure})}>
                                <option value="pcs">Штуки (pcs)</option>
                                <option value="kg">Кілограми (kg)</option>
                                <option value="l">Літри (l)</option>
                                <option value="pack">Упаковки (pack)</option>
                                <option value="meter">Метри (m)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Колірний маркер</label>
                            <div className="flex gap-1.5 mt-1">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setNewTool({ ...newTool, colorTag: c })}
                                        className={`w-6 h-6 rounded-full border transition-transform ${newTool.colorTag === c ? 'ring-2 ring-offset-1 ring-slate-900 scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Опис</label>
                        <textarea className="w-full p-2 border rounded-lg h-20 resize-none" placeholder="Характеристики..." value={newTool.description || ''} onChange={e => setNewTool({...newTool, description: e.target.value})} />
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setIsToolModalOpen(false)} className="px-4 py-2 text-gray-500">Скасувати</button>
                      <button onClick={handleCreateTool} disabled={isUploading} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold disabled:opacity-50 flex items-center">
                          {isUploading && <Loader size={16} className="animate-spin mr-2"/>}
                          {editingId ? 'Зберегти' : 'Створити'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {isAddToWarehouseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                  <h3 className="font-bold text-lg mb-1">Додати позицію з каталогу</h3>
                  <div className="text-xs text-gray-500 mb-4 flex items-center bg-gray-50 p-2 rounded">
                      <CornerDownRight size={12} className="mr-1"/> 
                      Додавання у: <strong className="ml-1 text-gray-800">{getBreadcrumbName(currentWarehouseFolderId, 'warehouse')}</strong>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Виберіть інструмент</label>
                          <SearchableSelect 
                              options={tools.map(t => ({ value: t.id, label: t.name, image: t.photo }))}
                              value={selectedToolId}
                              onChange={setSelectedToolId}
                              placeholder="Оберіть інструмент..."
                          />
                          <button 
                            onClick={() => setIsToolModalOpen(true)}
                            className="text-xs text-blue-600 font-bold mt-2 hover:underline flex items-center"
                          >
                            <Plus size={12} className="mr-1"/> Створити новий інструмент
                          </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Фактична кількість</label>
                              <input 
                                type="number" 
                                className="w-full p-2 border rounded-lg font-bold"
                                value={addStockQty}
                                onChange={e => setAddStockQty(Number(e.target.value))}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-red-500 uppercase mb-1">Критична кількість</label>
                              <input 
                                type="number" 
                                className="w-full p-2 border rounded-lg border-red-200 bg-red-50 font-bold text-red-700"
                                value={addStockCritical}
                                onChange={e => setAddStockCritical(Number(e.target.value))}
                              />
                          </div>
                      </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setIsAddToWarehouseOpen(false)} className="px-4 py-2 text-gray-500">Скасувати</button>
                      <button onClick={handleAddToWarehouse} disabled={!selectedToolId} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold disabled:opacity-50">Додати</button>
                  </div>
              </div>
          </div>
      )}
      
      {isAddToProductionOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                  <h3 className="font-bold text-lg mb-1">Додати інструмент у виробництво</h3>
                  <div className="text-xs text-gray-500 mb-4 flex items-center bg-gray-50 p-2 rounded">
                      <CornerDownRight size={12} className="mr-1"/> 
                      Додавання у: <strong className="ml-1 text-gray-800">{getBreadcrumbName(currentProductionFolderId, 'production')}</strong>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Виберіть інструмент</label>
                          <SearchableSelect 
                              options={tools.map(t => ({ value: t.id, label: t.name, image: t.photo }))}
                              value={selectedToolId}
                              onChange={setSelectedToolId}
                              placeholder="Оберіть інструмент..."
                          />
                          <button 
                            onClick={() => setIsToolModalOpen(true)}
                            className="text-xs text-blue-600 font-bold mt-2 hover:underline flex items-center"
                          >
                            <Plus size={12} className="mr-1"/> Створити новий інструмент
                          </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Фактична кількість</label>
                              <input 
                                type="number" 
                                className="w-full p-2 border rounded-lg font-bold"
                                value={addStockQty}
                                onChange={e => setAddStockQty(Number(e.target.value))}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-red-500 uppercase mb-1">Критична кількість</label>
                              <input 
                                type="number" 
                                className="w-full p-2 border rounded-lg border-red-200 bg-red-50 font-bold text-red-700"
                                value={addStockCritical}
                                onChange={e => setAddStockCritical(Number(e.target.value))}
                              />
                          </div>
                      </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setIsAddToProductionOpen(false)} className="px-4 py-2 text-gray-500">Скасувати</button>
                      <button onClick={handleAddToProduction} disabled={!selectedToolId} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold disabled:opacity-50">Додати</button>
                  </div>
              </div>
          </div>
      )}

      {isStockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                  <h3 className="font-bold text-lg mb-4">{stockOp.type === 'add' ? 'Поповнення складу' : 'Переміщення на виробництво'}</h3>
                  <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Кількість</label>
                        <input type="number" className="w-full p-2 border rounded-lg font-bold text-lg" value={stockOp.qty} onChange={e => setStockOp({...stockOp, qty: Number(e.target.value)})} autoFocus />
                      </div>
                      {stockOp.type === 'move' && (
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Куди / Коментар</label>
                            <input className="w-full p-2 border rounded-lg" placeholder="Напр: Верстат 1" value={stockOp.target} onChange={e => setStockOp({...stockOp, target: e.target.value})} />
                          </div>
                      )}
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setIsStockModalOpen(false)} className="px-4 py-2 text-gray-500">Скасувати</button>
                      <button onClick={executeStockOp} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold">Підтвердити</button>
                  </div>
              </div>
          </div>
      )}

      {isUsageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                  <h3 className="font-bold text-lg mb-4">Взяти інструмент</h3>
                  <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Кількість</label>
                        <input type="number" className="w-full p-2 border rounded-lg font-bold text-lg" value={usageOp.qty} onChange={e => setUsageOp({...usageOp, qty: Number(e.target.value)})} autoFocus />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Для чого / Примітка</label>
                        <input className="w-full p-2 border rounded-lg" placeholder="Напр: Зламав фрезу" value={usageOp.note} onChange={e => setUsageOp({...usageOp, note: e.target.value})} />
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setIsUsageModalOpen(false)} className="px-4 py-2 text-gray-500">Скасувати</button>
                      <button onClick={executeUsageOp} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold">Підтвердити</button>
                  </div>
              </div>
          </div>
      )}

      {deleteConfirm && (
        <DeleteConfirmModal 
            isOpen={!!deleteConfirm}
            title="Видалити інструмент?"
            message="Ви впевнені? Це незворотня дія."
            onClose={() => setDeleteConfirm(null)}
            onConfirm={confirmDelete}
            isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
