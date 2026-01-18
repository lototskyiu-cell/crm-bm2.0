
import React, { useState, useEffect } from 'react';
import { JobFolder, JobCycle, Product } from '../types';
import { API } from '../services/api';
import { SearchableSelect } from '../components/SearchableSelect';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { Folder, FileText, ChevronRight, Home, Plus, X, FolderPlus, FilePlus, Box, Pencil, Trash2, Filter, Loader } from 'lucide-react';

interface JobRepositoryProps {
  onSelectCycle: (cycleId: string) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export const JobRepository: React.FC<JobRepositoryProps> = ({ onSelectCycle }) => {
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  
  const [items, setItems] = useState<(JobFolder | JobCycle)[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [breadcrumbs, setBreadcrumbs] = useState<{id: string, name: string}[]>([{ id: 'root', name: 'Головна' }]);
  const [selectedColorFilter, setSelectedColorFilter] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createType, setCreateType] = useState<'folder' | 'cycle'>('folder');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, type: 'folder' | 'cycle', id: string, name: string } | null>(null);
  
  const [newItemName, setNewItemName] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  useEffect(() => {
    const fetchProducts = async () => {
      const prods = await API.getProducts();
      setProducts(prods);
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = API.subscribeToWorkStorage(currentFolderId, (data) => {
        setItems(data);
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentFolderId]);

  const handleNavigate = (folderId: string, folderName: string) => {
      setCurrentFolderId(folderId);
      setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
  };

  const handleBreadcrumbClick = (id: string, index: number) => {
      setCurrentFolderId(id);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleCreate = async () => {
    if (!newItemName) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
        if (createType === 'folder') {
            const newFolder: JobFolder = {
                id: editingId || '',
                name: newItemName,
                parentId: currentFolderId,
                colorTag: selectedColor
            };
            await API.saveWorkStorageItem(newFolder);
        } else {
            const product = products.find(p => p.id === selectedProductId);
            
            let existingStages: any[] = [];
            if (editingId) {
                const item = items.find(i => i.id === editingId) as JobCycle;
                if (item) existingStages = item.stages;
            }

            const newCycle: JobCycle = {
                id: editingId || '',
                parentId: currentFolderId, 
                name: newItemName,
                productId: selectedProductId,
                productPhoto: product?.photo,
                colorTag: selectedColor,
                stages: existingStages
            };
            await API.saveWorkStorageItem(newCycle);
        }
        closeModal();
    } catch (e) {
        alert("Error saving item");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEdit = (e: React.MouseEvent, type: 'folder' | 'cycle', item: JobFolder | JobCycle) => {
    e.stopPropagation();
    setEditingId(item.id);
    setCreateType(type);
    setNewItemName(item.name);
    
    if (type === 'cycle') {
        const c = item as JobCycle;
        setSelectedProductId(c.productId || '');
        setSelectedColor(c.colorTag || '#3b82f6');
    } else {
        const f = item as JobFolder;
        setSelectedColor(f.colorTag || '#3b82f6');
    }
    
    setIsModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, type: 'folder' | 'cycle', id: string, name: string) => {
    e.stopPropagation();
    setDeleteConfirmation({ isOpen: true, type, id, name });
  };

  const performDelete = async () => {
    if (!deleteConfirmation) return;
    
    setIsDeleting(true);
    
    try {
        await API.deleteWorkStorageItem(deleteConfirmation.id);
        setDeleteConfirmation(null);
    } catch (e) {
        console.error(e);
        alert("Error deleting item");
    } finally {
        setIsDeleting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNewItemName('');
    setSelectedProductId('');
    setCreateType('folder');
    setSelectedColor('#3b82f6');
  };

  const openModal = (type: 'folder' | 'cycle') => {
    setCreateType(type);
    setSelectedColor('#3b82f6');
    setIsModalOpen(true);
  };

  const visibleItems = items.filter(i => !i.deletedAt);

  const filteredItems = selectedColorFilter 
    ? visibleItems.filter(i => i.colorTag === selectedColorFilter)
    : visibleItems;

  const folders = filteredItems.filter(i => !('stages' in i));
  const cycles = filteredItems.filter(i => 'stages' in i);

  if (isLoading) return <div className="p-8 flex justify-center"><Loader className="animate-spin text-blue-600"/></div>;

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Сховище робіт</h1>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200 w-full md:w-fit shadow-sm overflow-x-auto whitespace-nowrap">
                {breadcrumbs.map((crumb, idx, arr) => (
                   <React.Fragment key={crumb.id}>
                     <button 
                       onClick={() => handleBreadcrumbClick(crumb.id, idx)}
                       className={`hover:text-blue-600 flex items-center ${idx === arr.length - 1 ? 'font-bold text-gray-900' : ''}`}
                     >
                       {idx === 0 && <Home size={14} className="mr-2" />}
                       {crumb.name}
                     </button>
                     {idx < arr.length - 1 && <ChevronRight size={14} className="mx-2" />}
                   </React.Fragment>
                ))}
              </div>
              
              <div className="bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
                 <Filter size={16} className="text-gray-400 mr-1"/>
                 {COLORS.map(color => (
                    <button
                        key={color}
                        onClick={() => setSelectedColorFilter(selectedColorFilter === color ? null : color)}
                        className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${selectedColorFilter === color ? 'ring-2 ring-offset-1 ring-slate-900 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                    />
                 ))}
                 {selectedColorFilter && (
                    <button onClick={() => setSelectedColorFilter(null)} className="ml-1 text-xs text-gray-400 hover:text-red-500"><X size={14}/></button>
                 )}
              </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => openModal('folder')}
            className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-lg flex items-center hover:bg-gray-50 transition-colors font-medium shadow-sm"
          >
            <FolderPlus size={18} className="mr-2 text-gray-500"/> <span className="hidden sm:inline">Папка</span>
          </button>
          <button 
            onClick={() => openModal('cycle')}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center shadow-lg hover:bg-slate-800 transition-colors font-bold"
          >
            <FilePlus size={18} className="mr-2"/> <span className="hidden sm:inline">Створити цикл</span><span className="sm:hidden">Цикл</span>
          </button>
        </div>
      </div>

      <div className="flex-1">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {folders.map(folder => (
            <div key={folder.id} className="group relative">
                <div 
                    onClick={() => handleNavigate(folder.id, folder.name)}
                    className="w-full flex flex-col items-center p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer animate-fade-in z-0 relative overflow-hidden"
                >
                    <div className="relative mb-3">
                        <Folder size={48} className="text-blue-100 group-hover:text-blue-200 transition-colors" style={{ color: folder.colorTag ? `${folder.colorTag}40` : undefined }} />
                        <Folder size={48} className="absolute inset-0 text-blue-200 group-hover:text-blue-500 transition-colors opacity-50" style={{ color: folder.colorTag }} />
                    </div>
                    <span className="font-medium text-gray-700 text-center">{folder.name}</span>
                </div>
                <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => handleEdit(e, 'folder', folder)} className="p-1 bg-white rounded shadow hover:text-blue-600 border border-gray-100"><Pencil size={14}/></button>
                    <button onClick={(e) => handleDeleteClick(e, 'folder', folder.id, folder.name)} className="p-1 bg-white rounded shadow hover:text-red-600 border border-gray-100"><Trash2 size={14}/></button>
                </div>
            </div>
          ))}

          {cycles.map(cycleItem => {
            const cycle = cycleItem as JobCycle;
            return (
                <div key={cycle.id} className="group relative">
                    <div 
                        onClick={() => onSelectCycle(cycle.id)}
                        className="w-full flex flex-col items-center p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all relative overflow-hidden animate-fade-in cursor-pointer z-0"
                        role="button"
                        tabIndex={0}
                    >
                        {cycle.colorTag && (
                            <div className="absolute top-0 right-0 w-3 h-3 m-2 rounded-full" style={{ backgroundColor: cycle.colorTag }} />
                        )}
                        <div className="w-16 h-16 bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                            {cycle.productPhoto ? (
                            <img src={cycle.productPhoto} alt="" className="w-full h-full object-cover" />
                            ) : (
                            <FileText size={32} className="text-gray-400" />
                            )}
                        </div>
                        <span className="font-medium text-gray-700 text-center text-sm line-clamp-2">{cycle.name}</span>
                    </div>
                    
                    <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleEdit(e, 'cycle', cycle)} className="p-1 bg-white rounded shadow hover:text-blue-600 border border-gray-100"><Pencil size={14}/></button>
                        <button onClick={(e) => handleDeleteClick(e, 'cycle', cycle.id, cycle.name)} className="p-1 bg-white rounded shadow hover:text-red-600 border border-gray-100"><Trash2 size={14}/></button>
                    </div>
                </div>
            )
          })}
        </div>
        
        {folders.length === 0 && cycles.length === 0 && (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 mt-4">
            <Box size={48} className="mb-4 opacity-20" />
            <p className="mb-4 font-medium">Тут порожньо</p>
            {currentFolderId === 'root' && (
                <button 
                onClick={() => openModal('cycle')}
                className="text-blue-600 font-bold hover:underline flex items-center"
                >
                <Plus size={16} className="mr-1"/> Створити перший цикл
                </button>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-[95%] md:w-full md:max-w-md overflow-visible m-4 md:m-0">
              <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                 <h3 className="font-bold text-gray-800">
                    {editingId ? 'Редагування' : (createType === 'folder' ? 'Нова папка' : 'Новий цикл робіт')}
                 </h3>
                 <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
              </div>
              
              <div className="p-6 space-y-6">
                 {!editingId && (
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button 
                        onClick={() => setCreateType('folder')}
                        className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center transition-all ${createType === 'folder' ? 'bg-white shadow text-slate-900' : 'text-gray-500'}`}
                        >
                        <FolderPlus size={16} className="mr-2"/> Папка
                        </button>
                        <button 
                        onClick={() => setCreateType('cycle')}
                        className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center transition-all ${createType === 'cycle' ? 'bg-white shadow text-slate-900' : 'text-gray-500'}`}
                        >
                        <FilePlus size={16} className="mr-2"/> Цикл робіт
                        </button>
                    </div>
                 )}

                 <div className="space-y-4">
                    <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Назва {createType === 'folder' ? 'папки' : 'циклу'}</label>
                       <input 
                         className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                         placeholder={createType === 'folder' ? 'Напр: Серійні вироби' : 'Напр: Техпроцес Втулка-100'}
                         value={newItemName}
                         onChange={e => setNewItemName(e.target.value)}
                         autoFocus
                       />
                    </div>

                    {createType === 'cycle' && (
                       <div className="animate-fade-in space-y-4">
                          <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Прив'язка до виробу (опціонально)</label>
                             <SearchableSelect
                                value={selectedProductId}
                                onChange={setSelectedProductId}
                                options={products.map(p => ({
                                    value: p.id,
                                    label: p.name,
                                    subLabel: p.sku,
                                    image: p.photo
                                }))}
                                placeholder="Без прив'язки..."
                             />
                             {selectedProductId && <p className="text-[10px] text-green-600 mt-1">Фото виробу буде використано як обкладинку</p>}
                          </div>
                       </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Колірний маркер</label>
                        <div className="flex gap-2">
                        {COLORS.map(color => (
                            <button 
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${selectedColor === color ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                        </div>
                    </div>
                 </div>
              </div>

              <div className="p-6 border-t bg-gray-50 flex justify-end">
                 <button 
                    onClick={handleCreate} 
                    disabled={isSubmitting}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                 >
                    {isSubmitting && <Loader size={16} className="animate-spin mr-2"/>}
                    {editingId ? 'Зберегти зміни' : (createType === 'folder' ? 'Створити Папку' : 'Створити Цикл')}
                 </button>
              </div>
           </div>
        </div>
      )}

      {deleteConfirmation && (
        <DeleteConfirmModal 
            isOpen={deleteConfirmation.isOpen}
            title={deleteConfirmation.type === 'folder' ? 'Видалити папку?' : 'Видалення циклу'}
            message={`Ви впевнені, що хочете видалити "${deleteConfirmation.name}"? Цю дію не можна скасувати.`}
            onClose={() => setDeleteConfirmation(null)}
            onConfirm={performDelete}
            isDeleting={isDeleting}
            confirmText={isDeleting ? "Видалення..." : "Видалити"}
        />
      )}
    </div>
  );
};
