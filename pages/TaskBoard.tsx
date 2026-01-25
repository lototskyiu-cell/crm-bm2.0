import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, TaskType, Order, User, JobCycle, SetupMap, TaskStatus, Tool, Drawing, JobStage } from '../types';
import { API } from '../services/api';
import { store } from '../services/mockStore';
import { NotificationBell } from '../components/NotificationBell';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { usePermissions } from '../hooks/usePermissions';
import { Plus, MoreHorizontal, Calendar, Box, Settings, CheckCircle, Clock, FileText, Wrench, X, Image as ImageIcon, Pencil, Trash2, Loader, AlertTriangle, ChevronDown, Check, Archive, RotateCcw, Lock, Link } from 'lucide-react';
// Added addDoc to imports
import { doc, updateDoc, collection, query, where, getDocs, onSnapshot, orderBy, getDoc, addDoc } from "firebase/firestore";
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
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-200 max-h-48 overflow-y-auto">
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

  // --- DATA LOADING ---
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

        const tasksRef = collection(db, 'tasks');
        let taskQuery;

        if (currentUser.role === 'admin') {
          taskQuery = query(tasksRef, orderBy('createdAt', 'desc'));
        } else {
          taskQuery = query(
            tasksRef, 
            where('assignedUserIds', 'array-contains', currentUser.id)
          );
        }

        unsubscribeTasks = onSnapshot(taskQuery, (snapshot) => {
          const tasksData = snapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            return {
              id: docSnapshot.id,
              ...data,
              assigneeIds: data.assignedUserIds || [],
              plannedQuantity: data.planQuantity || 0,
              completedQuantity: data.factQuantity || 0,
              deadline: data.dueDate || data.deadline,
            } as Task;
          });
          
          setTasks(tasksData.filter((t: any) => !t.deleted));
          setIsLoading(false);
        }, (error) => {
          console.error("Task subscription error:", error);
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
  }, [currentUser.id, currentUser.role]);

  // --- SMART MATCH DOCUMENTATION FETCH (FIXED) ---
  useEffect(() => {
    const fetchDocs = async () => {
      if (!selectedTask) {
        setTechDocs({ setupMap: null, productDrawingUrl: null });
        return;
      }

      try {
        const order = orders.find(o => o.id === selectedTask.orderId);
        const productId = order?.productId;

        if (!productId) {
          setTechDocs({ setupMap: null, productDrawingUrl: null });
          return;
        }

        let matchedMap: SetupMap | null = null;

        // 1. Direct Stage Lookup (Best accuracy)
        if (selectedTask.stageId) {
            console.log("🔍 Checking direct link for stage:", selectedTask.stageId);
            // We can't use store.getCycle because it's not reactive, we check the Job Cycle data if we have it
            // but the most reliable way is to check setup_cards directly filtered by productId
            const qDirect = query(
                collection(db, 'setup_cards'), 
                where('productCatalogId', '==', productId)
            );
            const directSnap = await getDocs(qDirect);
            const allProductMaps = directSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SetupMap));

            // Try to find if this stage has a pre-assigned setupMapId in our JobCycle
            const workCycleId = order?.workCycleId;
            if (workCycleId) {
                const cycleSnap = await getDoc(doc(db, "workStorage", workCycleId));
                if (cycleSnap.exists()) {
                    const cycleData = cycleSnap.data() as JobCycle;
                    const stage = cycleData.stages?.find(s => s.id === selectedTask.stageId);
                    if (stage?.setupMapId) {
                        matchedMap = allProductMaps.find(m => m.id === stage.setupMapId) || null;
                    }
                }
            }

            // 2. Fallback to Name Matching if no direct link found
            if (!matchedMap) {
                console.log("🔍 Falling back to name match for:", selectedTask.title);
                const taskTitleBase = selectedTask.title.includes(' - ') 
                    ? selectedTask.title.split(' - ').slice(1).join(' - ').trim().toLowerCase()
                    : selectedTask.title.trim().toLowerCase();

                matchedMap = allProductMaps.find(map => {
                    const mapName = map.name.toLowerCase();
                    return mapName === taskTitleBase || 
                           mapName.includes(taskTitleBase) || 
                           taskTitleBase.includes(mapName);
                }) || null;
            }
        }

        // 3. Product Drawing Fetch
        let prodDrawing: string | null = null;
        const productSnap = await getDoc(doc(db, "catalogs", productId));
        if (productSnap.exists()) {
            const productData = productSnap.data();
            if (productData.drawingId) {
                const dwgSnap = await getDoc(doc(db, "drawings", productData.drawingId));
                if (dwgSnap.exists()) prodDrawing = dwgSnap.data().photoUrl;
            }
        }

        setTechDocs({ 
            setupMap: matchedMap, 
            productDrawingUrl: prodDrawing 
        });

      } catch (error) {
        console.error("🔥 Помилка завантаження документів:", error);
      }
    };

    fetchDocs();
  }, [selectedTask, orders]);

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
               const cycleSnap = await getDoc(doc(db, "workStorage", order.workCycleId));
               if (cycleSnap.exists()) {
                   const cycle = { ...cycleSnap.data(), id: cycleSnap.id } as JobCycle;
                   setSelectedCycle(cycle);
                   const initQty: Record<string, number> = {};
                   cycle.stages.forEach(s => {
                       initQty[s.id] = order.quantity;
                   });
                   setStageQuantities(initQty);
               }
           } catch(e) {
               console.error("Failed to fetch cycle", e);
               setSelectedCycle(undefined);
           }
       }
    } else {
      setSelectedCycle(undefined);
    }
    setSelectedStageId('');
  };

  const handleCreateTask = async () => {
    if (!isEditor) return;
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
                
                const newTask: any = {
                    type: 'production',
                    title: newTaskTitle,
                    description: `Етап: ${stage.name}. ${stage.notes || ''}\nМашина: ${stage.machine}`,
                    status: 'todo',
                    priority: priority,
                    assignedUserIds: assignedUserIds,
                    createdAt: new Date().toISOString(),
                    orderId: selectedOrderId,
                    stageId: stage.id,
                    planQuantity: plannedQty, 
                    factQuantity: 0,
                    pendingQuantity: 0,
                    dueDate: deadline || selectedOrder?.deadline,
                    isFinalStage: isFinal,
                    deleted: false
                };
                
                await addDoc(collection(db, "tasks"), newTask);

                for (const uid of assignedUserIds) {
                    await API.sendNotification(uid, `Нове завдання: ${newTaskTitle}`, 'task_assigned');
                }
            }
        } 
        else {
            const newTask: Task = {
              id: editingTaskId || "",
              type: taskType,
              title: title,
              description: description,
              status: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.status! : 'todo',
              priority: priority,
              assigneeIds: assigneeIds,
              createdAt: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.createdAt! : new Date().toISOString(),
              orderId: taskType === 'production' ? selectedOrderId : undefined,
              stageId: taskType === 'production' ? selectedStageId : undefined,
              plannedQuantity: taskType === 'production' ? selectedOrder?.quantity : undefined,
              completedQuantity: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.completedQuantity! : 0,
              pendingQuantity: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.pendingQuantity! : 0,
              deadline: deadline || undefined,
            };
            await API.saveTask(newTask);
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

  // Added missing toggleAssignee handler
  const toggleAssignee = (userId: string) => {
    setAssigneeIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Added missing handleStageQuantityChange handler
  const handleStageQuantityChange = (stageId: string, value: number) => {
    setStageQuantities(prev => ({ ...prev, [stageId]: value }));
  };

  // Added missing handleStageAssignment handler
  const handleStageAssignment = (stageId: string, ids: string[]) => {
    setStageAssignments(prev => ({ ...prev, [stageId]: ids }));
  };

  const handleEdit = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (!isEditor) return;
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
      if (!isEditor) return;
      setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
      if (!deleteConfirmId) return;
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

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    if (!isEditor) return; 
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditor) return;
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    if (!isEditor || !draggedTaskId) return;
    const task = tasks.find(t => t.id === draggedTaskId);
    if (task && task.status !== newStatus) {
      setTasks(prev => prev.map(t => t.id === draggedTaskId ? { ...t, status: newStatus } : t));
      await API.updateTaskStatus(draggedTaskId, newStatus);
    }
    setDraggedTaskId(null);
  };

  const renderCard = (task: Task, isArchiveView: boolean = false) => {
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
        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition-all cursor-pointer mb-3 group relative overflow-hidden hover:shadow-md animate-fade-in"
      >
        {task.type === 'production' && (
          <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full flex">
            <div className="h-full bg-green-500 transition-all duration-500" style={{width: `${Math.min(100, factPercent)}%`}}/>
            <div className="h-full bg-orange-400 opacity-50 transition-all duration-500" style={{width: `${Math.min(100 - factPercent, pendPercent)}%` , backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem'}}/>
          </div>
        )}

        <div className="flex justify-between items-start mb-2">
           <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${task.priority === 'high' ? 'bg-red-100 text-red-600' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-600'}`}>{task.priority === 'high' ? 'Високий' : task.priority === 'medium' ? 'Середній' : 'Низький'}</div>
           {isEditor && !isArchiveView && (
               <div className="flex items-center gap-1 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => handleEdit(e, task)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={12}/></button>
                  <button onClick={(e) => handleDelete(e, task.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={12}/></button>
               </div>
           )}
        </div>

        <h4 className="font-bold text-gray-900 mb-1 leading-tight">{task.title}</h4>
        {task.deadline && <div className="flex items-center text-xs text-orange-600 font-medium mb-2"><AlertTriangle size={12} className="mr-1"/>До: {task.deadline}</div>}
        {task.type === 'production' && <div className="text-[10px] font-bold text-gray-700">{factQty} <span className="text-gray-400 font-normal">/ {planQty} шт</span></div>}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
           <div className="flex -space-x-2">
              {assignedUsers.slice(0, 4).map(u => (
                <img key={u.id} src={u.avatar || `https://ui-avatars.com/api/?name=${u.firstName}`} className="w-6 h-6 rounded-full border-2 border-white"/>
              ))}
           </div>
           <div className="text-[10px] text-gray-300 font-mono">{task.createdAt?.slice(0, 10)}</div>
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
        <div className="bg-white w-[98%] md:w-full md:max-w-5xl h-[90vh] rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-2xl animate-scale-up">
          <div className="w-full md:w-1/3 bg-gray-50 border-r border-gray-200 p-6 flex flex-col overflow-y-auto">
             <div className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded w-fit mb-2 uppercase">{selectedTask.type === 'production' ? 'Виробниче завдання' : 'Просте завдання'}</div>
             <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedTask.title}</h2>
             {selectedTask.deadline && <div className="text-sm font-bold text-orange-600 mb-4 flex items-center"><Calendar size={16} className="mr-2"/> Дедлайн: {selectedTask.deadline}</div>}
             <p className="text-gray-600 text-sm mb-6 whitespace-pre-wrap">{selectedTask.description || 'Опис відсутній'}</p>
             {selectedTask.type === 'production' && (
               <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4 mb-6">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Прогрес виконання</h3>
                    <div className="flex items-center justify-between"><span className="text-3xl font-bold text-green-600">{selectedTask.completedQuantity}</span><span className="text-xl text-gray-400 font-medium">/ {selectedTask.plannedQuantity} шт</span></div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex"><div className="bg-green-500 h-full transition-all duration-500" style={{width: `${Math.min(100, ((selectedTask.completedQuantity || 0) / (selectedTask.plannedQuantity || 1)) * 100)}%`}}/>{(selectedTask.pendingQuantity || 0) > 0 && <div className="bg-orange-400 h-full transition-all duration-500" style={{width: `${Math.min(100, ((selectedTask.pendingQuantity || 0) / (selectedTask.plannedQuantity || 1)) * 100)}%` , backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem'}}/>}</div>
                    {(selectedTask.pendingQuantity || 0) > 0 && <div className="flex items-center text-xs text-orange-600 bg-orange-50 p-2 rounded"><Clock size={14} className="mr-2"/><span>+{selectedTask.pendingQuantity} шт на перевірці</span></div>}
               </div>
             )}
             <div className="space-y-4"><h3 className="text-sm font-bold text-gray-900 uppercase">Виконавці</h3><div className="flex flex-wrap gap-2">{selectedTask.assigneeIds.map(uid => { const u = users.find(user => user.id === uid); return u ? (<div key={uid} className="flex items-center bg-white border px-3 py-1.5 rounded-full shadow-sm"><img src={u.avatar || `https://ui-avatars.com/api/?name=${u.firstName}`} className="w-6 h-6 rounded-full mr-2"/><span className="text-sm font-medium">{u.firstName} {u.lastName}</span></div>) : null; })}</div></div>
          </div>
          <div className="w-full md:w-2/3 p-6 overflow-y-auto bg-slate-50 relative">
             <button onClick={() => setSelectedTaskId(null)} className="absolute top-6 right-6 p-2 bg-white rounded-full text-gray-400 hover:text-gray-900 shadow-md z-10"><X size={24}/></button>
             {setupMap || productDrawingUrl ? (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center"><div><div className="text-xs text-gray-500 font-bold uppercase mb-1">Технічна документація</div><h3 className="text-xl font-bold text-gray-900">{setupMap?.name || 'Креслення виробу'}</h3></div><div className="text-right">{setupMap && <div className="text-sm text-gray-600"><span className="font-bold">Верстат:</span> {setupMap.machine}</div>}</div></div>
                    <div className={`grid grid-cols-1 md:${gridCols} gap-6`}>
                        {showSetupPhoto && (<div><div className="text-sm font-bold text-gray-700 mb-2 flex items-center"><ImageIcon size={16} className="mr-2"/> Карта наладки</div><div className="bg-gray-200 rounded-lg overflow-hidden border border-gray-300 aspect-[4/3] relative group cursor-pointer hover:shadow-lg transition-all" onClick={() => setEnlargedImage(setupMap?.photoUrl!)}><img src={setupMap?.photoUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" /></div></div>)}
                        {showDrawing && (<div><div className="text-sm font-bold text-gray-700 mb-2 flex items-center"><FileText size={16} className="mr-2"/> Креслення</div><div className="bg-white rounded-lg overflow-hidden border border-gray-300 aspect-[4/3] relative group cursor-pointer hover:shadow-lg transition-all" onClick={() => setEnlargedImage(setupMap?.drawingUrl || productDrawingUrl || '')}><img src={setupMap?.drawingUrl || productDrawingUrl || ''} className="w-full h-full object-contain p-2 transition-transform group-hover:scale-105" /></div></div>)}
                    </div>
                    {setupMap && (<div><h4 className="font-bold text-gray-800 mb-3 border-b pb-2">Список інструментів</h4><div className="space-y-2">{setupMap.blocks.map((block, idx) => { const tool = tools.find(t => t.id === block.toolId); return (<div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between"><div className="flex items-center flex-1"><div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-600 border mr-3 shrink-0">{block.toolNumber || idx + 1}</div>{tool?.photo ? <img src={tool.photo} className="w-10 h-10 rounded object-cover border border-gray-200 mr-3 shadow-sm bg-white" /> : <div className="w-10 h-10 rounded border border-gray-200 mr-3 flex items-center justify-center bg-gray-50"><Settings size={16} className="text-gray-400"/></div>}<div className="text-sm font-bold text-gray-900 line-clamp-1">{block.toolName}</div></div><div className="bg-yellow-50 px-2 py-1 rounded text-xs font-mono text-gray-700 border border-yellow-100">{block.settings}</div></div>); })}</div></div>)}
                </div>
             ) : (
               <div className="h-full flex items-center justify-center text-gray-400 flex-col"><FileText size={48} className="mb-4 opacity-30"/><p className="font-medium">Технічна документація відсутня</p></div>
             )}
          </div>
        </div>
        {enlargedImage && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 animate-fade-in" onClick={() => setEnlargedImage(null)}><X size={24} className="absolute top-4 right-4 text-white cursor-pointer"/><img src={enlargedImage} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} /></div>}
      </div>
    );
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Дошка завдань</h1><p className="text-gray-500">Виробничий процес</p></div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto"><div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto"><button onClick={() => setCurrentTab('active')} className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all ${currentTab === 'active' ? 'bg-white shadow text-slate-900' : 'text-gray-500'}`}>Активні</button><button onClick={() => setCurrentTab('archive')} className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all ${currentTab === 'archive' ? 'bg-white shadow text-slate-900' : 'text-gray-500'}`}>Архів</button></div>{isEditor && <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg w-full sm:w-auto"><Plus size={20} className="mr-2" />Нове завдання</button>}</div>
      </div>
      <div className="flex-1 overflow-x-auto">
        {currentTab === 'active' ? (
            <div className="flex flex-col md:flex-row md:space-x-6 min-w-[300px] md:min-w-[1000px] h-full gap-4 md:gap-0">
            {['todo', 'in_progress', 'done'].map((status) => (
                <div key={status} className="flex-1 bg-gray-100/50 rounded-2xl p-4 flex flex-col min-h-[200px]" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status as TaskStatus)}>
                    <div className="flex items-center justify-between mb-4 px-2"><h3 className={`font-bold uppercase text-xs tracking-wider ${status === 'todo' ? 'text-gray-700' : status === 'in_progress' ? 'text-blue-700' : 'text-green-700'}`}>{status === 'todo' ? 'Зробити' : status === 'in_progress' ? 'В роботі' : 'Готово'}</h3><span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">{tasks.filter(t => t.status === status).length}</span></div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">{tasks.filter(t => t.status === status).map(t => renderCard(t))}</div>
                </div>
            ))}
            </div>
        ) : (
            <div className="bg-gray-50 rounded-2xl p-6 h-full overflow-y-auto"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{archivedTasks.map(t => renderCard(t, true))}</div></div>
        )}
      </div>
      {isModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"><div className="px-6 py-5 border-b flex justify-between items-center"><h2 className="text-xl font-bold">{editingTaskId ? 'Редагувати завдання' : 'Створити завдання'}</h2><button onClick={() => setIsModalOpen(false)} className="bg-gray-100 p-2 rounded-full"><X size={20}/></button></div><div className="p-6 space-y-6">{!editingTaskId && <div className="flex bg-gray-100 p-1 rounded-xl"><button onClick={() => setTaskType('simple')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${taskType === 'simple' ? 'bg-white shadow text-slate-900' : 'text-gray-500'}`}>Просте</button><button onClick={() => setTaskType('production')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${taskType === 'production' ? 'bg-white shadow text-slate-900' : 'text-gray-500'}`}>Виробниче</button></div>}{taskType === 'simple' ? <div className="space-y-4"><div><label className="block text-sm font-bold mb-1">Назва</label><input value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="Напр: Прибрати цех"/></div><div><label className="block text-sm font-bold mb-1">Опис</label><textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 border rounded-lg h-24"/></div><div className="pt-2"><label className="block text-sm font-bold mb-2">Виконавці</label><div className="flex flex-wrap gap-2">{users.map(user => <button key={user.id} onClick={() => toggleAssignee(user.id)} className={`flex items-center px-3 py-1.5 rounded-full border text-sm ${assigneeIds.includes(user.id) ? 'bg-slate-800 text-white' : 'bg-white text-gray-600'}`}>{user.firstName} {user.lastName}</button>)}</div></div></div> : <div className="space-y-4"><div><label className="block text-sm font-bold mb-1">Замовлення</label><select className="w-full p-3 border rounded-lg bg-blue-50" value={selectedOrderId} onChange={e => handleOrderChange(e.target.value)}><option value="">-- Оберіть --</option>{orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber}</option>)}</select></div>{selectedOrder && selectedCycle && <div className="p-4 bg-gray-50 border rounded-xl space-y-4"><div className="space-y-2">{selectedCycle.stages.map((stage, idx) => <div key={stage.id} className="flex flex-col md:flex-row items-center justify-between p-3 bg-white rounded-lg border gap-3"><div className="flex-1"><div className="text-sm font-bold">{idx + 1}. {stage.name}</div><div className="text-xs text-gray-400">{stage.machine}</div></div><div className="w-24"><input type="number" className="w-full p-1 border rounded text-center text-sm font-bold" value={stageQuantities[stage.id] || 0} onChange={(e) => handleStageQuantityChange(stage.id, Number(e.target.value))}/></div><div className="w-1/3"><MultiSelectUsers users={users} selectedIds={stageAssignments[stage.id] || []} onChange={(ids) => handleStageAssignment(stage.id, ids)}/></div></div>)}</div></div>}</div>}<div className="pt-4 border-t grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold mb-2">Пріоритет</label><select className="w-full p-2.5 border rounded-lg" value={priority} onChange={(e) => setPriority(e.target.value as any)}><option value="low">Низький</option><option value="medium">Середній</option><option value="high">Високий</option></select></div><div><label className="block text-sm font-bold mb-2">Дедлайн</label><input type="date" className="w-full p-2.5 border rounded-lg" value={deadline} onChange={(e) => setDeadline(e.target.value)}/></div></div></div><div className="p-6 border-t flex justify-end"><button onClick={handleCreateTask} disabled={isSubmitting} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center">{isSubmitting && <Loader size={16} className="animate-spin mr-2"/>}{editingTaskId ? 'Зберегти' : 'Створити'}</button></div></div></div>}
      {selectedTask && renderDetailModal()}
      {deleteConfirmId && <DeleteConfirmModal isOpen={!!deleteConfirmId} title="Видалити завдання?" message="Ви впевнені? Це незворотня дія." onClose={() => setDeleteConfirmId(null)} onConfirm={confirmDelete} isDeleting={isDeleting} />}
    </div>
  );
};