
import React, { useState, useEffect } from 'react';
import { JobCycle, JobStage, SetupMap, Product, Tool, ProductionReport, Task, User } from '../types';
import { store } from '../services/mockStore';
import { API } from '../services/api';
import { SearchableSelect } from '../components/SearchableSelect';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { ArrowLeft, Box, Hammer, User as UserIcon, Settings, Image as ImageIcon, Plus, Trash2, X, Save, Loader, Pencil, History, CheckCircle } from 'lucide-react';

interface JobCycleProps {
  cycleId: string;
  onBack: () => void;
  role: 'admin' | 'worker';
}

export const JobCyclePage: React.FC<JobCycleProps> = ({ cycleId, onBack, role }) => {
  const [cycle, setCycle] = useState<JobCycle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Data from API
  const [setupMaps, setSetupMaps] = useState<SetupMap[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [cycleReports, setCycleReports] = useState<ProductionReport[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // UI State
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [deleteStageId, setDeleteStageId] = useState<string | null>(null);

  // New Stage Form
  const [newStage, setNewStage] = useState<Partial<JobStage>>({
    name: '',
    operationType: '', 
    machine: '',
    count: 1,
    responsible: ['Оператор ЧПК'],
    notes: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cycleData, mapsData, productsData, toolsData, reportsData, tasksData, usersData] = await Promise.all([
            API.getWorkStorageItem(cycleId),
            API.getSetupMaps(),
            API.getProducts(),
            API.getTools(),
            new Promise<ProductionReport[]>((resolve) => {
                // Subscribe/Fetch reports. Using promise wrapper for simplicity in Promise.all
                const unsub = API.subscribeToReports((data) => {
                    resolve(data);
                    unsub();
                });
            }),
            API.getTasks(),
            API.getUsers()
        ]);

        if (cycleData && 'stages' in cycleData) {
           setCycle(cycleData as JobCycle);
        } else {
           console.error("Item is not a cycle or not found");
        }
        
        setSetupMaps(mapsData);
        setProducts(productsData);
        setTools(toolsData);
        setCycleReports(reportsData);
        setTasks(tasksData);
        setUsers(usersData);

      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [cycleId]);

  const saveCycleChanges = async (updatedCycle: JobCycle) => {
      setCycle(updatedCycle); // Optimistic UI update
      try {
          // Explicit update to prevent duplication
          await API.updateWorkStorageItem(updatedCycle.id, updatedCycle);
      } catch (e) {
          console.error("Failed to save cycle", e);
          alert("Error saving changes");
      }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader className="animate-spin text-blue-600"/></div>;
  if (!cycle) return <div className="p-8 text-center text-red-500">Cycle not found</div>;

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    const updated = {
        ...cycle,
        productId: product ? product.id : '',
        productPhoto: product ? product.photo : undefined
    };
    saveCycleChanges(updated);
  };

  const handleOpenAddModal = () => {
    setEditingStageId(null);
    setNewStage({
      name: '',
      operationType: '',
      machine: '',
      count: 1,
      responsible: ['Оператор ЧПК'],
      notes: ''
    });
    setIsStageModalOpen(true);
  };

  const handleEditStage = (stage: JobStage, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStageId(stage.id);
    setNewStage({ ...stage });
    setIsStageModalOpen(true);
  };

  const handleSaveStage = async () => {
    if (!newStage.name) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    let updatedStages: JobStage[];

    if (editingStageId) {
        updatedStages = cycle.stages.map(s => s.id === editingStageId ? {
            ...s,
            name: newStage.name!,
            operationType: newStage.operationType!,
            machine: newStage.machine!,
            count: newStage.count!,
            responsible: newStage.responsible!,
            notes: newStage.notes!,
            setupMapId: newStage.setupMapId
        } : s);
    } else {
        const stage: JobStage = {
            id: `st_${Date.now()}`,
            name: newStage.name || 'Новий етап',
            operationType: newStage.operationType || 'Інше',
            machine: newStage.machine || 'Не вказано',
            count: newStage.count || 1,
            responsible: newStage.responsible || ['Робітник'],
            notes: newStage.notes || '',
            setupMapId: newStage.setupMapId
        };
        updatedStages = [...cycle.stages, stage];
    }

    try {
        const updatedCycle = { ...cycle, stages: updatedStages };
        // Explicit update to prevent duplication
        await API.updateWorkStorageItem(updatedCycle.id, updatedCycle);
        setCycle(updatedCycle);
        setIsStageModalOpen(false);
    } catch(e) {
        alert("Error saving stage");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteStage = (stageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteStageId(stageId);
  };

  const confirmDeleteStage = async () => {
      if (!deleteStageId) return;
      setIsDeleting(true);
      try {
          const updatedStages = cycle.stages.filter(s => s.id !== deleteStageId);
          const updatedCycle = { ...cycle, stages: updatedStages };
          // Explicit update to prevent duplication
          await API.updateWorkStorageItem(updatedCycle.id, updatedCycle);
          setCycle(updatedCycle);
          setDeleteStageId(null);
      } catch (e) {
          alert("Error deleting stage");
      } finally {
          setIsDeleting(false);
      }
  };

  const updateName = (name: string) => {
      setCycle({ ...cycle, name });
  };

  const handleNameBlur = () => {
      if (cycle) API.updateWorkStorageItem(cycle.id, cycle);
  };

  const getStagePhoto = (setupMapId?: string) => {
      if (!setupMapId) return null;
      const map = setupMaps.find(m => m.id === setupMapId);
      if (!map || !map.productCatalogId) return null;
      const prod = products.find(p => p.id === map.productCatalogId);
      return prod ? prod.photo : null;
  };

  // Helper to find batches (reports) for a specific stage
  const getStageBatches = (stageId: string) => {
      // Find all tasks related to this stage
      const stageTasks = tasks.filter(t => t.stageId === stageId);
      const stageTaskIds = stageTasks.map(t => t.id);
      
      // Find reports for these tasks
      return cycleReports.filter(r => stageTaskIds.includes(r.taskId) && r.status === 'approved')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col z-10 shadow-lg shrink-0">
        <div className="p-4 border-b border-gray-100 flex items-center">
          <button onClick={onBack} className="mr-3 text-gray-500 hover:text-gray-900">
            <ArrowLeft size={20} />
          </button>
          <span className="font-bold text-gray-700">Паспорт циклу</span>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group">
            {cycle.productPhoto ? (
               <img 
                 src={cycle.productPhoto} 
                 alt="Product" 
                 className="w-full h-full object-cover cursor-pointer" 
                 onClick={() => setEnlargedImage(cycle.productPhoto || null)}
               />
            ) : (
               <ImageIcon className="text-gray-400" size={32} />
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Назва циклу</label>
            <input 
              value={cycle.name}
              onChange={(e) => updateName(e.target.value)}
              onBlur={handleNameBlur}
              className="w-full p-2 border border-gray-200 rounded font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Прив'язка до виробу</label>
             <SearchableSelect
                value={cycle.productId || ''}
                onChange={handleProductChange}
                options={products.map(p => ({
                    value: p.id,
                    label: p.name,
                    subLabel: p.sku,
                    image: p.photo
                }))}
                placeholder="-- Оберіть виріб --"
             />
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Колірний тег</label>
             <div className="flex flex-wrap gap-2">
                {COLORS.map(color => (
                   <button 
                     key={color}
                     onClick={() => saveCycleChanges({...cycle, colorTag: color})}
                     className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${cycle.colorTag === color ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                     style={{ backgroundColor: color }}
                   />
                ))}
             </div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800">
             Зміни зберігаються автоматично.
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-2xl font-bold text-gray-900 flex items-center">
             Етапи виконання
             <span className="ml-3 bg-gray-200 text-gray-600 text-sm px-3 py-1 rounded-full">{cycle.stages.length}</span>
           </h2>
           <button 
             onClick={handleOpenAddModal}
             className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center shadow-lg hover:bg-slate-800 transition-colors"
           >
             <Plus size={20} className="mr-2"/> Додати етап
           </button>
        </div>

        <div className="space-y-4 max-w-4xl pb-20">
          {cycle.stages.map((stage, index) => {
             const setupMap = setupMaps.find(m => m.id === stage.setupMapId);
             const isExpanded = expandedStageId === stage.id;
             const stagePhoto = getStagePhoto(stage.setupMapId);
             const batches = getStageBatches(stage.id);
             const totalProduced = batches.reduce((acc, r) => acc + r.quantity, 0);

             return (
               <div key={stage.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
                 <div 
                    onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 relative group"
                 >
                   <div className="flex items-center space-x-4">
                     <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                       {index + 1}
                     </div>

                     <div 
                        className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 transition-transform hover:scale-105"
                        onClick={(e) => {
                            if (stagePhoto) {
                                e.stopPropagation();
                                setEnlargedImage(stagePhoto);
                            }
                        }}
                     >
                        {stagePhoto ? (
                            <img src={stagePhoto} className="w-full h-full object-cover" />
                        ) : (
                            <Settings size={16} className="text-gray-400" />
                        )}
                     </div>

                     <div>
                       <h3 className="font-bold text-gray-900">{stage.name}</h3>
                       <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
                          <span className="flex items-center"><Hammer size={12} className="mr-1"/> {stage.operationType}</span>
                          <span className="flex items-center"><Settings size={12} className="mr-1"/> {stage.machine}</span>
                       </div>
                     </div>
                   </div>
                   
                   <div className="flex items-center space-x-6">
                      <div className="text-right">
                         <div className="text-xs text-gray-400">Всього виготовлено</div>
                         <div className="font-bold text-gray-900">{totalProduced} шт</div>
                      </div>
                      
                      <div className="flex gap-1 ml-4">
                          <button 
                             onClick={(e) => handleEditStage(stage, e)}
                             className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
                          >
                             <Pencil size={18} />
                          </button>
                          <button 
                             onClick={(e) => handleDeleteStage(stage.id, e)}
                             className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                          >
                             <Trash2 size={18} />
                          </button>
                      </div>
                   </div>
                 </div>

                 {isExpanded && (
                   <div className="border-t border-gray-100 p-6 bg-gray-50 animate-fade-in">
                      <div className="grid grid-cols-1 gap-8">
                        {/* BATCH TRACKING LIST */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b font-bold text-gray-700 text-sm flex items-center">
                                <History size={16} className="mr-2"/> Партії (Всі замовлення)
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                {batches.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-gray-400 italic">Партій ще немає</div>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-xs text-gray-500 font-medium">
                                            <tr>
                                                <th className="p-2">Дата</th>
                                                <th className="p-2">Працівник</th>
                                                <th className="p-2 text-right">К-сть</th>
                                                <th className="p-2 text-right">Брак</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {batches.map(batch => {
                                                const worker = users.find(u => u.id === batch.userId);
                                                return (
                                                    <tr key={batch.id} className="hover:bg-gray-50">
                                                        <td className="p-2 text-gray-500 font-mono text-xs">{new Date(batch.createdAt).toLocaleDateString()}</td>
                                                        <td className="p-2 font-medium text-gray-800 flex items-center">
                                                            <img src={worker?.avatar || `https://ui-avatars.com/api/?name=${worker?.firstName}`} className="w-5 h-5 rounded-full mr-2"/>
                                                            {worker?.lastName || 'Unknown'}
                                                        </td>
                                                        <td className="p-2 text-right font-bold text-green-700">+{batch.quantity}</td>
                                                        <td className="p-2 text-right text-red-500">{batch.scrapQuantity > 0 ? `-${batch.scrapQuantity}` : '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                           <div>
                              <label className="text-sm font-bold text-gray-700 block mb-2">Нотатки</label>
                              <div className="bg-white p-3 rounded border text-sm text-gray-600 min-h-[40px]">
                                {stage.notes || 'Немає нотаток'}
                              </div>
                           </div>

                           <div>
                              <label className="text-sm font-bold text-gray-700 block mb-2">Карта налаштувань</label>
                              <div className="p-2 bg-white border rounded text-gray-900 font-medium flex items-center justify-between">
                                <span>{setupMap?.name ? `${setupMap.name} (${setupMap.machine})` : 'Не призначено'}</span>
                              </div>
                           </div>
                        </div>

                        {setupMap && (
                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">Попередній перегляд: {setupMap.name}</h4>
                            <div className="mb-4 rounded overflow-hidden border border-gray-100">
                               <div className="space-y-2">
                                  {setupMap.blocks.map((block, i) => {
                                      const tool = tools.find(t => t.id === block.toolId);
                                      return (
                                        <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100">
                                            <div className="flex items-center flex-1">
                                                <div className="w-6 h-6 bg-white rounded border flex items-center justify-center text-xs font-bold text-gray-500 mr-2 shrink-0">
                                                    {block.toolNumber || i + 1}
                                                </div>
                                                
                                                {tool?.photo ? (
                                                    <div 
                                                        className="w-10 h-10 rounded border border-gray-200 mr-3 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all shrink-0"
                                                        onClick={() => setEnlargedImage(tool.photo)}
                                                    >
                                                        <img src={tool.photo} className="w-full h-full object-cover" alt={tool.name} />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded border border-gray-200 mr-3 flex items-center justify-center bg-white text-gray-300 shrink-0">
                                                        <Settings size={16}/>
                                                    </div>
                                                )}

                                                <div className="text-sm font-bold text-gray-900 line-clamp-1">{block.toolName}</div>
                                            </div>
                                            <div className="text-xs font-mono bg-white px-1 border rounded">{block.settings}</div>
                                        </div>
                                      );
                                  })}
                               </div>
                            </div>
                          </div>
                        )}
                      </div>
                   </div>
                 )}
               </div>
             );
          })}

          {cycle.stages.length === 0 && (
             <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                <Box size={48} className="mx-auto mb-3 opacity-20"/>
                <p>Етапів немає. Додайте перший етап.</p>
             </div>
          )}
        </div>
      </div>

      {isStageModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-visible">
               <div className="px-6 py-4 border-b flex justify-between items-center">
                  <h3 className="font-bold text-lg">{editingStageId ? 'Редагувати етап' : 'Новий етап виробництва'}</h3>
                  <button onClick={() => setIsStageModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
               </div>
               
               <div className="p-6 space-y-4">
                  <div>
                     <label className="block text-sm font-bold text-gray-700 mb-1">Назва операції</label>
                     <input 
                       className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                       placeholder="Напр: Чорнова обробка"
                       value={newStage.name}
                       onChange={e => setNewStage({...newStage, name: e.target.value})}
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Тип робіт</label>
                        <input
                           className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                           placeholder="Напр: Токарна, Зварювальна"
                           value={newStage.operationType}
                           onChange={e => setNewStage({...newStage, operationType: e.target.value})}
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Верстат/Місце</label>
                        <input 
                          className="w-full p-2 border rounded-lg"
                          placeholder="Напр: Haas ST-10"
                          value={newStage.machine}
                          onChange={e => setNewStage({...newStage, machine: e.target.value})}
                        />
                     </div>
                  </div>

                  <div>
                     <label className="block text-sm font-bold text-gray-700 mb-1">Карта налаштувань (Опціонально)</label>
                     <SearchableSelect
                        value={newStage.setupMapId || ''}
                        onChange={(val) => setNewStage({...newStage, setupMapId: val})}
                        options={setupMaps.map(m => ({
                            value: m.id,
                            label: `${m.name} (${m.machine || 'No Machine'})`,
                            subLabel: m.machine
                        }))}
                        placeholder="-- Без карти --"
                     />
                  </div>

                  <div>
                     <label className="block text-sm font-bold text-gray-700 mb-1">Нотатки</label>
                     <textarea 
                        className="w-full p-2 border rounded-lg h-20 resize-none"
                        placeholder="Особливі вказівки..."
                        value={newStage.notes}
                        onChange={e => setNewStage({...newStage, notes: e.target.value})}
                     />
                  </div>
               </div>

               <div className="p-6 border-t flex justify-end bg-gray-50 rounded-b-xl">
                  <button onClick={handleSaveStage} disabled={isSubmitting} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50">
                     {isSubmitting ? <Loader size={16} className="animate-spin"/> : (editingStageId ? 'Зберегти зміни' : 'Додати етап')}
                  </button>
               </div>
            </div>
         </div>
      )}

      {deleteStageId && (
        <DeleteConfirmModal 
            isOpen={!!deleteStageId}
            title="Видалити етап?"
            message="Ви впевнені? Це незворотня дія."
            onClose={() => setDeleteStageId(null)}
            onConfirm={confirmDeleteStage}
            isDeleting={isDeleting}
        />
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
    </div>
  );
};
