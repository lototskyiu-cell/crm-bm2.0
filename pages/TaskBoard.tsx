
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, TaskType, Order, User, JobCycle, SetupMap, TaskStatus, Tool, Drawing } from '../types';
import { API } from '../services/api';
import { store } from '../services/mockStore';
import { NotificationBell } from '../components/NotificationBell';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { usePermissions } from '../hooks/usePermissions';
import { Plus, MoreHorizontal, Calendar, Box, Settings, CheckCircle, Clock, FileText, Wrench, X, Image as ImageIcon, Pencil, Trash2, Loader, AlertTriangle, ChevronDown, Check, Archive, RotateCcw, Lock } from 'lucide-react';
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";

interface TaskBoardProps {
  currentUser: User;
}

const MultiSelectUsers = ({ users, selectedIds, onChange }: { users: User[], selectedIds: string[], onChange: (ids: string[]) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const toggleUser = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter(id => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  const selectedCount = selectedIds.length;
  
  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 text-sm border rounded bg-gray-50 outline-none focus:border-blue-400 flex justify-between items-center text-left"
      >
        <div className="flex -space-x-1 overflow-hidden mr-2">
           {selectedIds.slice(0, 3).map(id => {
               const u = users.find(user => user.id === id);
               if (!u) return null;
               return (
                   <img key={id} src={u.avatar || `https://ui-avatars.com/api/?name=${u.firstName}+${u.lastName}`} className="w-5 h-5 rounded-full border border-white" title={u.lastName}/>
               )
           })}
           {selectedIds.length > 3 && <span className="w-5 h-5 flex items-center justify-center bg-gray-200 text-[9px] rounded-full border border-white font-bold">+{selectedIds.length - 3}</span>}
        </div>
        <span className={`flex-1 truncate ${selectedCount === 0 ? "text-gray-400" : "text-gray-800 font-medium"}`}>
          {selectedCount === 0 ? "-- Не призначено --" : `${selectedCount} виконавців`}
        </span>
        <ChevronDown size={14} className="text-gray-400 shrink-0"/>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-xl border border-gray-200 max-h-48 overflow-y-auto">
          {users.map(u => {
            const isSelected = selectedIds.includes(u.id);
            return (
              <div 
                key={u.id} 
                onClick={() => toggleUser(u.id)}
                className={`p-2 flex items-center cursor-pointer hover:bg-gray-50 text-sm ${isSelected ? 'bg-blue-50' : ''}`}
              >
                <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {isSelected && <Check size={10} className="text-white"/>}
                </div>
                <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.firstName}+${u.lastName}`} className="w-6 h-6 rounded-full mr-2 border"/>
                <span>{u.firstName} {u.lastName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const TaskBoard: React.FC<TaskBoardProps> = ({ currentUser }) => {
  const { canEdit } = usePermissions(currentUser);
  const isEditor = canEdit('tasks');

  const [currentTab, setCurrentTab] = useState<'active' | 'archive'>('active');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<TaskType>('simple');
  
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  const selectedTask = useMemo(() => 
    tasks.find(t => t.id === selectedTaskId) || null
  , [tasks, selectedTaskId]);
  
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | undefined>(undefined);
  const [selectedCycle, setSelectedCycle] = useState<JobCycle | undefined>(undefined);
  const [selectedStageId, setSelectedStageId] = useState<string>(''); 
  
  const [stageAssignments, setStageAssignments] = useState<Record<string, string[]>>({});
  const [stageQuantities, setStageQuantities] = useState<Record<string, number>>({});

  const [title, setTitle] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const [techDocs, setTechDocs] = useState<{setupMap: SetupMap | null, productDrawingUrl: string | null}>({ setupMap: null, productDrawingUrl: null });
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeTasks: () => void;
    let unsubscribeOrders: () => void;
    let unsubscribeDrawings: () => void;

    const initData = async () => {
      try {
        const [usersData, toolsData] = await Promise.all([
            API.getUsers(),
            API.getTools()
        ]);
        setUsers(usersData);
        setTools(toolsData);

        unsubscribeTasks = API.subscribeToTasks((data) => {
          setTasks(data);
          setIsLoading(false);
        });

        unsubscribeOrders = API.subscribeToOrders((data) => {
          setOrders(data);
        });

        unsubscribeDrawings = API.subscribeToDrawings((data) => {
            setDrawings(data);
        });

      } catch (e) {
        console.error("Failed to load task board data", e);
        setIsLoading(false);
      }
    };

    initData();

    return () => {
      if (unsubscribeTasks) unsubscribeTasks();
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeDrawings) unsubscribeDrawings();
    };
  }, []);

  // --- SMART MATCH DOCUMENTATION FETCH ---
  useEffect(() => {
    const fetchDocs = async () => {
      if (!selectedTask) {
        setTechDocs({ setupMap: null, productDrawingUrl: null });
        return;
      }

      try {
        // Визначаємо ID виробу через замовлення
        const order = orders.find(o => o.id === selectedTask.orderId);
        const productId = order?.productId;

        if (!productId) {
          console.log("📄 Пошук доків: Просте завдання або відсутній productId.");
          setTechDocs({ setupMap: null, productDrawingUrl: null });
          return;
        }

        console.log("🔍 Шукаю доки для етапу:", selectedTask.title, "| Виріб ID:", productId);

        // 1. Шукаємо всі карти наладки для цього ВИРОБУ у Firestore
        const qCharts = query(
          collection(db, 'setupMaps'), 
          where('productCatalogId', '==', productId)
        );
        const chartsSnap = await getDocs(qCharts);
        const allProductMaps = chartsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SetupMap));

        console.log(`📊 Шукаю доки для етапу: ${selectedTask.title} | Знайдено карт: ${allProductMaps.length}`);

        // 2. Фільтруємо (Smart Match)
        // Витягуємо чисту назву етапу, якщо заголовок формату "254-Б - Токарка"
        const taskTitleBase = selectedTask.title.includes(' - ') 
            ? selectedTask.title.split(' - ').slice(1).join(' - ').trim().toLowerCase()
            : selectedTask.title.trim().toLowerCase();

        const matchedMap = allProductMaps.find(map => {
            const mapName = map.name.toLowerCase();
            // Перевіряємо точний збіг або входження назви
            return mapName === taskTitleBase || 
                   mapName.includes(taskTitleBase) || 
                   taskTitleBase.includes(mapName);
        });

        // 3. Шукаємо креслення виробу (Product Drawing)
        let prodDrawing: string | null = null;
        const product = await API.getProduct(productId);
        if (product && product.drawingId) {
            const dwg = drawings.find(d => d.id === product.drawingId);
            if (dwg) prodDrawing = dwg.photo;
        }

        if (matchedMap) console.log("✅ Смарт-пошук успішний:", matchedMap.name);
        else console.log("❌ Смарт-пошук не знайшов відповідної карти для тексту:", taskTitleBase);

        setTechDocs({ 
            setupMap: matchedMap || null, 
            productDrawingUrl: prodDrawing 
        });

      } catch (error) {
        console.error("🔥 Помилка завантаження документів:", error);
      }
    };

    fetchDocs();
  }, [selectedTask, orders, drawings]);

  const activeTasks = tasks.filter(t => t.status !== 'archived');
  const archivedTasks = tasks.filter(t => t.status === 'archived');

  const todoTasks = activeTasks.filter(t => t.status === 'todo');
  const inProgressTasks = activeTasks.filter(t => t.status === 'in_progress');
  const doneTasks = activeTasks.filter(t => t.status === 'done');

  const handleOrderChange = async (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orders.find(o => o.id === orderId);
    setSelectedOrder(order);
    setStageAssignments({});
    setStageQuantities({});
    
    if (order) {
       if (order.workCycleId) {
           try {
               const cycle = await API.getWorkStorageItem(order.workCycleId) as JobCycle;
               setSelectedCycle(cycle);
               const initQty: Record<string, number> = {};
               cycle.stages.forEach(s => {
                   initQty[s.id] = order.quantity;
               });
               setStageQuantities(initQty);
           } catch(e) {
               console.error("Failed to fetch cycle", e);
               setSelectedCycle(undefined);
           }
       } else {
           const product = store.getProduct(order.productId);
           if (product && product.jobCycleId) {
              const cycle = store.getCycle(product.jobCycleId);
              setSelectedCycle(cycle);
              if (cycle) {
                  const initQty: Record<string, number> = {};
                  cycle.stages.forEach(s => {
                      initQty[s.id] = order.quantity;
                  });
                  setStageQuantities(initQty);
              }
           } else {
              setSelectedCycle(undefined);
           }
       }
    } else {
      setSelectedCycle(undefined);
    }
    setSelectedStageId('');
  };

  const handleCreateTask = async () => {
    if (!isEditor) {
        alert("У вас немає прав на створення завдань");
        return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
        if (taskType === 'production' && !editingTaskId && selectedCycle) {
            const stages = selectedCycle.stages || [];
            
            for (let i = 0; i < stages.length; i++) {
                const stage = stages[i];
                const isFinal = i === stages.length - 1; 
                
                const assignedUserIds = stageAssignments[stage.id] || [];
                if (assignedUserIds.length === 0) continue;

                const plannedQty = stageQuantities[stage.id] || selectedOrder?.quantity || 0;

                const newTaskTitle = `${selectedOrder?.orderNumber} - ${stage.name}`;
                const newTask: Task = {
                    id: `task_${Date.now()}_${stage.id}`,
                    type: 'production',
                    title: newTaskTitle,
                    description: `Етап: ${stage.name}. ${stage.notes || ''}\nМашина: ${stage.machine}`,
                    status: 'todo',
                    priority: priority,
                    assigneeIds: assignedUserIds,
                    createdAt: new Date().toISOString().split('T')[0],
                    orderId: selectedOrderId,
                    stageId: stage.id,
                    plannedQuantity: plannedQty, 
                    completedQuantity: 0,
                    pendingQuantity: 0,
                    deadline: deadline || selectedOrder?.deadline,
                    isFinalStage: isFinal 
                };
                
                await API.saveTask(newTask);

                for (const uid of assignedUserIds) {
                    await API.sendNotification(
                        uid, 
                        `Нове завдання: ${newTaskTitle} (Етап: ${stage.name}, План: ${plannedQty})`, 
                        'task_assigned'
                    );
                }
            }
            
            await API.sendNotification(
                'admin',
                `Створено виробничу партію: ${selectedOrder?.orderNumber}`,
                'info',
                undefined,
                'admin',
                'Нова партія'
            );

        } 
        else {
            let finalTitle = title;
            let finalDesc = description;

            const newTask: Task = {
              id: editingTaskId || `task_temp_${Date.now()}`,
              type: taskType,
              title: finalTitle,
              description: finalDesc,
              status: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.status! : 'todo',
              priority: priority,
              assigneeIds: assigneeIds,
              createdAt: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.createdAt! : new Date().toISOString().split('T')[0],
              
              orderId: taskType === 'production' ? selectedOrderId : undefined,
              stageId: taskType === 'production' ? selectedStageId : undefined,
              plannedQuantity: taskType === 'production' ? selectedOrder?.quantity : undefined,
              completedQuantity: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.completedQuantity! : 0,
              pendingQuantity: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.pendingQuantity! : 0,
              deadline: deadline || undefined,
            };
            
            await API.saveTask(newTask);

            if (!editingTaskId) {
                for (const uid of assigneeIds) {
                    await API.sendNotification(
                        uid, 
                        `Нове завдання: ${finalTitle}`, 
                        'task_assigned'
                    );
                }
                await API.sendNotification(
                    'admin',
                    `Нове завдання: ${finalTitle}`,
                    'info',
                    undefined,
                    'admin',
                    'Нове завдання'
                );
            }
        }

        setIsModalOpen(false);
        resetForm();
    } catch (e) {
        alert("Error saving task");
    } finally {
        setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingTaskId(null);
    setTaskType('simple');
    setTitle('');
    setDescription('');
    setAssigneeIds([]);
    setDeadline('');
    setPriority('medium');
    setSelectedOrderId('');
    setSelectedOrder(undefined);
    setSelectedCycle(undefined);
    setSelectedStageId('');
    setStageAssignments({});
    setStageQuantities({});
  };

  const handleEdit = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!isEditor) {
        alert("У вас немає прав на редагування");
        return;
    }

    setEditingTaskId(task.id);
    setTaskType(task.type);
    setTitle(task.title);
    setDescription(task.description || '');
    setAssigneeIds(task.assigneeIds);
    setPriority(task.priority);
    setDeadline(task.deadline || '');

    if (task.type === 'production' && task.orderId) {
        const order = orders.find(o => o.id === task.orderId);
        setSelectedOrder(order);
        if (task.stageId) setSelectedStageId(task.stageId);
    }

    setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (!isEditor) return;
      setDeleteConfirmId(id);
  };

  const handleArchiveClick = (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (!isEditor) return;
      setArchiveConfirmId(taskId);
  };

  const confirmArchive = async () => {
      if (!archiveConfirmId) return;
      if (!isEditor) {
          alert("Access Denied");
          return;
      }
      setIsArchiving(true);
      
      try {
          const taskRef = doc(db, "tasks", archiveConfirmId);
          await updateDoc(taskRef, { 
              status: 'archived' 
          });
          setArchiveConfirmId(null);
      } catch (err: any) {
          console.error("Archive error:", err);
          alert("Помилка: " + (err as any).message);
      } finally {
          setIsArchiving(false);
      }
  };

  const handleArchiveFromModal = async () => {
      if (editingTaskId && isEditor) {
          setArchiveConfirmId(editingTaskId);
          setIsModalOpen(false); 
      }
  };

  const handleRestore = async (e: React.MouseEvent, task: Task) => {
      e.stopPropagation();
      e.preventDefault();
      if (!isEditor) return;

      const newStatus = (task.completedQuantity || 0) >= (task.plannedQuantity || 0) && (task.plannedQuantity || 0) > 0 ? 'done' : 'todo';
      
      try {
          const taskRef = doc(db, "tasks", task.id);
          await updateDoc(taskRef, { 
              status: newStatus 
          });
      } catch (e) {
          console.error("Error restoring task:", e);
          alert("Помилка при відновленні");
      }
  };

  const confirmDelete = async () => {
      if (!deleteConfirmId) return;
      if (!isEditor) return;
      setIsDeleting(true);
      try {
          await API.deleteTask(deleteConfirmId);
          setDeleteConfirmId(null);
      } catch(err) {
          alert("Error deleting task");
      } finally {
          setIsDeleting(false);
      }
  };

  const toggleAssignee = (id: string) => {
    if (assigneeIds.includes(id)) {
      setAssigneeIds(assigneeIds.filter(a => a !== id));
    } else {
      setAssigneeIds([...assigneeIds, id]);
    }
  };

  const handleStageAssignment = (stageId: string, userIds: string[]) => {
      setStageAssignments(prev => ({
          ...prev,
          [stageId]: userIds
      }));
  };

  const handleStageQuantityChange = (stageId: string, qty: number) => {
      setStageQuantities(prev => ({
          ...prev,
          [stageId]: qty
      }));
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    if (!isEditor) return; 
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditor) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    if (!isEditor || !draggedTaskId) return;

    const task = tasks.find(t => t.id === draggedTaskId);
    if (task && task.status !== newStatus) {
      setTasks(prevTasks => prevTasks.map(t => t.id === draggedTaskId ? { ...t, status: newStatus } : t));
      try {
        await API.updateTaskStatus(draggedTaskId, newStatus);
        
        const statusNames: Record<string, string> = {
          'todo': 'ЗРОБИТИ',
          'in_progress': 'В РОБОТІ',
          'done': 'ГОТОВО',
          'archived': 'АРХІВ'
        };

        await API.sendNotification(
            'admin',
            `Статус змінено: ${task.title} → ${statusNames[newStatus] || newStatus}`,
            'warning',
            undefined,
            'admin',
            'Оновлення статусу'
        );

      } catch (err) {
        console.error("Failed to update status", err);
      }
    }
    setDraggedTaskId(null);
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader className="animate-spin text-blue-600"/></div>;

  const renderCard = (task: Task, isArchiveView: boolean = false, onArchive?: (id: string) => void) => {
    const assignedUsers = users.filter(u => task.assigneeIds.includes(u.id));
    const factQty = task.completedQuantity || 0;
    const pendQty = task.pendingQuantity || 0;
    const planQty = task.plannedQuantity || 1;
    const factPercent = (factQty / planQty) * 100;
    const pendPercent = (pendQty / planQty) * 100;

    return (
      <div 
        key={task.id} 
        draggable={isEditor && !isArchiveView}
        onDragStart={(e) => handleDragStart(e, task.id)}
        onClick={() => setSelectedTaskId(task.id)}
        className={`task-card bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition-all cursor-pointer mb-3 group relative overflow-hidden animate-fade-in ${!isEditor && !isArchiveView ? 'hover:shadow-sm' : 'hover:shadow-md'}`}
      >
        {task.type === 'production' && (
          <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full flex">
            <div 
              className="h-full bg-green-500 transition-all duration-500" 
              style={{width: `${Math.min(100, factPercent)}%`}}
            />
            <div 
              className="h-full bg-orange-400 opacity-50 transition-all duration-500" 
              style={{
                  width: `${Math.min(100 - factPercent, pendPercent)}%`,
                  backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)',
                  backgroundSize: '1rem 1rem'
              }}
            />
          </div>
        )}

        <div className="flex justify-between items-start mb-2">
           <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
             task.priority === 'high' ? 'bg-red-100 text-red-600' : 
             task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 
             'bg-blue-100 text-blue-600'
           }`}>
             {task.priority === 'high' ? 'Високий' : task.priority === 'medium' ? 'Середній' : 'Низький'}
           </div>
           
           {isEditor && (
               <div className="flex items-center gap-1 relative z-10">
                  {!isArchiveView && (
                      <>
                        <div style={{ isolation: 'isolate', position: 'relative', zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => handleEdit(e, task)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Редагувати"><Pencil size={12}/></button>
                        </div>
                        <div style={{ isolation: 'isolate', position: 'relative', zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
                            <button title="В архів" className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" onClick={(e) => handleArchiveClick(e, task.id)}><Archive size={12}/></button>
                        </div>
                      </>
                  )}
                  {isArchiveView && (
                      <div style={{ isolation: 'isolate', position: 'relative', zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => handleRestore(e, task)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Відновити"><RotateCcw size={12}/></button>
                      </div>
                  )}
                  <div style={{ isolation: 'isolate', position: 'relative', zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => handleDelete(e, task.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Видалити назавжди"><Trash2 size={12}/></button>
                  </div>
               </div>
           )}
        </div>

        <h4 className="font-bold text-gray-900 mb-1 leading-tight">{task.title}</h4>
        
        {task.deadline && (
            <div className="flex items-center text-xs text-orange-600 font-medium mb-2">
                <AlertTriangle size={12} className="mr-1"/>
                До: {task.deadline}
            </div>
        )}

        {task.type === 'production' && (
           <div className="mb-2">
             <div className="flex justify-between text-[10px] mt-1">
                <span className="font-bold text-gray-700">{factQty} <span className="text-gray-400 font-normal">/ {planQty} шт</span></span>
                {pendQty > 0 ? <span className="text-orange-500 font-bold">+{pendQty} очікує</span> : null}
             </div>
           </div>
        )}

        {task.type === 'simple' && task.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{task.description}</p>
        )}
        
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
           <div className="flex -space-x-2">
              {assignedUsers.slice(0, 4).map(u => (
                <img key={u.id} src={u.avatar || `https://ui-avatars.com/api/?name=${u.firstName}+${u.lastName}`} className="w-6 h-6 rounded-full border-2 border-white" title={`${u.firstName} ${u.lastName}`}/>
              ))}
              {assignedUsers.length > 4 && <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-500">+{assignedUsers.length - 4}</div>}
           </div>
           <div className="text-xs text-gray-300 font-mono">{task.createdAt.slice(0, 10)}</div>
        </div>
      </div>
    );
  };

  const renderDetailModal = () => {
    if (!selectedTask) return null;
    const { setupMap, productDrawingUrl } = techDocs;
    const showSetupPhoto = !!setupMap?.photoUrl;
    const showDrawing = !!(setupMap?.drawingUrl || productDrawingUrl);
    const gridCols = (showSetupPhoto && showDrawing) ? 'grid-cols-2' : 'grid-cols-1';

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-white w-[98%] md:w-full md:max-w-5xl h-[90vh] rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-2xl animate-scale-up m-4 md:m-0">
          
          <div className="w-full md:w-1/3 bg-gray-50 border-r border-gray-200 p-6 flex flex-col overflow-y-auto">
             <div className="mt-2">
               <div className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded w-fit mb-2 uppercase">{selectedTask.type === 'production' ? 'Виробниче завдання' : 'Просте завдання'}</div>
               <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedTask.title}</h2>
               {selectedTask.deadline && <div className="text-sm font-bold text-orange-600 mb-4 flex items-center"><Calendar size={16} className="mr-2"/> Дедлайн: {selectedTask.deadline}</div>}
               <p className="text-gray-600 text-sm mb-6 whitespace-pre-wrap">{selectedTask.description || 'Опис відсутній'}</p>

               {selectedTask.type === 'production' && (
                 <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4 mb-6">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Прогрес виконання</h3>
                    <div className="flex items-center justify-between"><span className="text-3xl font-bold text-green-600">{selectedTask.completedQuantity}</span><span className="text-xl text-gray-400 font-medium">/ {selectedTask.plannedQuantity} шт</span></div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex"><div className="bg-green-500 h-full transition-all duration-500" style={{width: `${Math.min(100, ((selectedTask.completedQuantity || 0) / (selectedTask.plannedQuantity || 1)) * 100)}%`}}/>{(selectedTask.pendingQuantity || 0) > 0 && <div className="bg-orange-400 h-full transition-all duration-500" style={{width: `${Math.min(100, ((selectedTask.pendingQuantity || 0) / (selectedTask.plannedQuantity || 1)) * 100)}%` , backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem'}}/>}</div>
                    {(selectedTask.pendingQuantity || 0) > 0 && <div className="flex items-center text-xs text-orange-600 bg-orange-50 p-2 rounded"><Clock size={14} className="mr-2"/><span>+{selectedTask.pendingQuantity} шт на перевірці у адміна</span></div>}
                 </div>
               )}

               <div className="space-y-4">
                 <h3 className="text-sm font-bold text-gray-900 uppercase">Виконавці</h3>
                 <div className="flex flex-wrap gap-2">
                   {selectedTask.assigneeIds.map(uid => {
                     const u = users.find(user => user.id === uid);
                     return u ? (<div key={uid} className="flex items-center bg-white border px-3 py-1.5 rounded-full shadow-sm"><img src={u.avatar || `https://ui-avatars.com/api/?name=${u.firstName}+${u.lastName}`} className="w-6 h-6 rounded-full mr-2"/><span className="text-sm font-medium">{u.firstName} {u.lastName}</span></div>) : null;
                   })}
                 </div>
               </div>
             </div>
          </div>

          <div className="w-full md:w-2/3 p-6 overflow-y-auto bg-slate-50 relative">
             <div className="flex justify-end mb-4 absolute top-6 right-6 z-10"><button onClick={() => setSelectedTaskId(null)} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-900 shadow-md"><X size={24}/></button></div>
             {setupMap ? (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center"><div><div className="text-xs text-gray-500 font-bold uppercase mb-1">Карта наладки</div><h3 className="text-xl font-bold text-gray-900">{setupMap.name}</h3></div><div className="text-right"><div className="text-sm text-gray-600"><span className="font-bold">Верстат:</span> {setupMap.machine}</div></div></div>
                    <div className={`grid grid-cols-1 md:${gridCols} gap-6`}>
                        {showSetupPhoto && (<div><div className="text-sm font-bold text-gray-700 mb-2 flex items-center"><ImageIcon size={16} className="mr-2"/> Наладка</div><div className="bg-gray-200 rounded-lg overflow-hidden border border-gray-300 aspect-[4/3] relative group cursor-pointer hover:shadow-lg transition-all" onClick={() => setupMap.photoUrl && setEnlargedImage(setupMap.photoUrl)}><img src={setupMap.photoUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" /></div></div>)}
                        {showDrawing && (<div><div className="text-sm font-bold text-gray-700 mb-2 flex items-center"><FileText size={16} className="mr-2"/> Креслення</div><div className="bg-white rounded-lg overflow-hidden border border-gray-300 aspect-[4/3] relative group cursor-pointer hover:shadow-lg transition-all" onClick={() => (setupMap.drawingUrl || productDrawingUrl) && setEnlargedImage(setupMap.drawingUrl || productDrawingUrl || '')}><img src={setupMap.drawingUrl || productDrawingUrl || ''} className="w-full h-full object-contain p-2 transition-transform group-hover:scale-105" /></div></div>)}
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">Список інструментів</h4>
                        <div className="space-y-2">
                            {setupMap.blocks.map((block, idx) => {
                                const tool = tools.find(t => t.id === block.toolId);
                                return (<div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between"><div className="flex items-center flex-1"><div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-600 border mr-3 shrink-0">{block.toolNumber || idx + 1}</div>{tool?.photo ? <img src={tool.photo} className="w-10 h-10 rounded object-cover border border-gray-200 mr-3 shadow-sm bg-white" /> : <div className="w-10 h-10 rounded border border-gray-200 mr-3 flex items-center justify-center bg-gray-50"><Settings size={16} className="text-gray-400"/></div>}<div className="text-sm font-bold text-gray-900 line-clamp-1">{block.toolName}</div></div><div className="bg-yellow-50 px-2 py-1 rounded text-xs font-mono text-gray-700 border border-yellow-100">{block.settings}</div></div>);
                            })}
                        </div>
                    </div>
                </div>
             ) : (
               <div className="h-full flex items-center justify-center text-gray-400 flex-col"><FileText size={48} className="mb-4 opacity-30"/><p className="font-medium">Технічна документація відсутня</p></div>
             )}
          </div>
        </div>

        {enlargedImage && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 animate-fade-in" onClick={() => setEnlargedImage(null)}>
                <button onClick={() => setEnlargedImage(null)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"><X size={24}/></button>
                <img src={enlargedImage} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-white/10" onClick={e => e.stopPropagation()} />
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Дошка завдань</h1><p className="text-gray-500">Моніторинг виробничого процесу</p></div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto"><div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto"><button onClick={() => setCurrentTab('active')} className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all ${currentTab === 'active' ? 'bg-white shadow text-slate-900' : 'text-gray-500'}`}>Активні</button><button onClick={() => setCurrentTab('archive')} className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all ${currentTab === 'archive' ? 'bg-white shadow text-slate-900' : 'text-gray-500'}`}>Архів</button></div>{isEditor && <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg w-full sm:w-auto"><Plus size={20} className="mr-2" />Нове завдання</button>}</div>
      </div>

      <div className="flex-1 overflow-x-auto">
        {currentTab === 'active' ? (
            <div className="flex flex-col md:flex-row md:space-x-6 min-w-[300px] md:min-w-[1000px] h-full gap-4 md:gap-0">
            {['todo', 'in_progress', 'done'].map((status) => (
                <div key={status} className="flex-1 bg-gray-100/50 rounded-2xl p-4 flex flex-col transition-colors min-h-[200px]" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status as TaskStatus)}>
                    <div className="flex items-center justify-between mb-4 px-2"><h3 className={`font-bold uppercase text-xs tracking-wider ${status === 'todo' ? 'text-gray-700' : status === 'in_progress' ? 'text-blue-700' : 'text-green-700'}`}>{status === 'todo' ? 'Зробити' : status === 'in_progress' ? 'В роботі' : 'Готово'}</h3><span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">{tasks.filter(t => t.status === status && t.status !== 'archived').length}</span></div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                        {tasks.filter(t => t.status === status).map(t => renderCard(t))}
                        {isEditor && status === 'todo' && <button onClick={() => { resetForm(); setIsModalOpen(true); setTaskType('simple'); }} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-all flex items-center justify-center text-sm font-medium"><Plus size={16} className="mr-2"/> Додати</button>}
                    </div>
                </div>
            ))}
            </div>
        ) : (
            <div className="bg-gray-50 rounded-2xl p-6 h-full overflow-y-auto">
                {archivedTasks.length === 0 && <div className="h-full flex flex-col items-center justify-center text-gray-400"><Archive size={48} className="mb-4 opacity-20"/><p>Архів порожній</p></div>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{archivedTasks.map(t => renderCard(t, true))}</div>
            </div>
        )}
      </div>

      {isModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"><div className="bg-white rounded-2xl shadow-2xl w-[95%] md:w-full md:max-w-2xl max-h-[90vh] overflow-y-auto m-4 md:m-0"><div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10"><h2 className="text-xl font-bold text-gray-900">{editingTaskId ? 'Редагувати завдання' : 'Створити завдання'}</h2><button onClick={() => setIsModalOpen(false)} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200"><X size={20} className="text-gray-500"/></button></div><div className="p-6 space-y-6">{!editingTaskId && <div className="flex bg-gray-100 p-1 rounded-xl"><button onClick={() => setTaskType('simple')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${taskType === 'simple' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}>Просте завдання</button><button onClick={() => setTaskType('production')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${taskType === 'production' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}>Виробниче (Партія)</button></div>}{taskType === 'simple' ? <div className="space-y-4 animate-fade-in"><div><label className="block text-sm font-bold text-gray-700 mb-1">Назва завдання</label><input value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Напр: Прибрати цех"/></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Опис</label><textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 border rounded-lg h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none"/></div><div className="pt-2"><label className="block text-sm font-bold text-gray-700 mb-2">Виконавці</label><div className="flex flex-wrap gap-2">{users.map(user => <button key={user.id} onClick={() => toggleAssignee(user.id)} className={`flex items-center px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${assigneeIds.includes(user.id) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}><img src={user.avatar || `https://ui-avatars.com/api/?name=${user.firstName}`} className="w-5 h-5 rounded-full mr-2 border border-white"/>{user.firstName} {user.lastName}</button>)}</div></div></div> : <div className="space-y-4 animate-fade-in"><div><label className="block text-sm font-bold text-gray-700 mb-1">Оберіть замовлення</label><select className="w-full p-3 border border-blue-200 rounded-lg bg-blue-50 text-gray-800 font-medium" value={selectedOrderId} onChange={e => handleOrderChange(e.target.value)} disabled={!!editingTaskId}><option value="">-- Список активних замовлень --</option>{orders.filter(o => o.status !== 'completed').map(o => <option key={o.id} value={o.id}>{o.orderNumber} ({o.quantity} шт)</option>)}</select></div>{selectedOrder && selectedCycle && !editingTaskId && <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4"><div className="flex items-center text-sm text-gray-500 pb-2 border-b border-gray-200"><Settings size={14} className="mr-2"/>Техпроцес: <strong className="ml-1 text-gray-900">{selectedCycle.name}</strong></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Розподіл етапів</label><div className="space-y-2">{selectedCycle.stages.map((stage, idx) => <div key={stage.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 bg-white rounded-lg border border-gray-200 gap-3 md:gap-0"><div className="flex-1 w-full md:w-auto"><div className="text-sm font-bold flex items-center"><span className="bg-slate-100 text-slate-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2">{idx + 1}</span>{stage.name}</div><div className="text-xs text-gray-400 pl-7">{stage.machine}</div></div><div className="w-full md:w-24 flex items-center md:block justify-between"><label className="text-[9px] uppercase font-bold text-gray-400 mb-0.5 block md:mb-1 mr-2 md:mr-0">План (шт)</label><input type="number" className="w-20 md:w-full p-1 border rounded text-center text-sm font-bold" value={stageQuantities[stage.id] || 0} onChange={(e) => handleStageQuantityChange(stage.id, Number(e.target.value))}/></div><div className="w-full md:w-1/3"><MultiSelectUsers users={users} selectedIds={stageAssignments[stage.id] || []} onChange={(ids) => handleStageAssignment(stage.id, ids)}/></div></div>)}</div></div></div>}</div>}<div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-2">Пріоритет</label><select className="w-full p-2.5 border rounded-lg bg-white" value={priority} onChange={(e) => setPriority(e.target.value as any)}><option value="low">Низький</option><option value="medium">Середній</option><option value="high">Високий</option></select></div><div><label className="block text-sm font-bold text-gray-700 mb-2">Дедлайн</label><input type="date" className="w-full p-2.5 border rounded-lg" value={deadline} onChange={(e) => setDeadline(e.target.value)}/></div></div></div><div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center"><div>{editingTaskId && isEditor && <button onClick={handleArchiveFromModal} className="flex items-center text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-lg font-bold transition-colors"><Archive size={16} className="mr-2"/> Архівувати</button>}</div><button onClick={handleCreateTask} disabled={isSubmitting} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center">{isSubmitting && <Loader size={16} className="animate-spin mr-2"/>}{editingTaskId ? 'Зберегти зміни' : (taskType === 'production' && selectedCycle ? 'Створити партію' : 'Створити завдання')}</button></div></div></div>
      )}

      {selectedTask && renderDetailModal()}

      {deleteConfirmId && (
        <DeleteConfirmModal isOpen={!!deleteConfirmId} title="Видалити завдання?" message="Ви впевнені? Це незворотня дія." onClose={() => setDeleteConfirmId(null)} onConfirm={confirmDelete} isDeleting={isDeleting} />
      )}

      {archiveConfirmId && (
        <DeleteConfirmModal isOpen={!!archiveConfirmId} title="Архівувати завдання?" message="Ви впевнені? Завдання буде переміщено в архів." onClose={() => setArchiveConfirmId(null)} onConfirm={confirmArchive} isDeleting={isArchiving} confirmText="Архівувати" cancelText="Скасувати" confirmButtonClass="bg-orange-500 hover:bg-orange-600 shadow-orange-200 text-white" />
      )}
    </div>
  );
};
