import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, TaskType, Order, User, JobCycle, SetupMap, TaskStatus, Tool, Drawing, JobStage } from '../types';
import { API } from '../services/api';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Plus, MoreHorizontal, Calendar, Box, Settings, CheckCircle, Clock, FileText, Wrench, X, 
  Image as ImageIcon, Pencil, Trash2, Loader, AlertTriangle, ChevronDown, Check, Archive, 
  RotateCcw, Lock, Link, User as UserIcon, Users
} from 'lucide-react';
import { doc, updateDoc, collection, query, where, getDocs, onSnapshot, orderBy, getDoc, addDoc } from "firebase/firestore";
import { db } from "../services/firebase";

interface TaskBoardProps {
  currentUser: User;
}

// Helper component for User Avatar with Initials Fallback
const UserAvatar: React.FC<{ user: User; size?: string }> = ({ user, size = "w-8 h-8" }) => {
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || '?';
  
  if (user.avatar) {
    return <img src={user.avatar} className={`${size} rounded-full object-cover border border-white shadow-sm shrink-0`} alt={user.lastName}/>;
  }
  
  return (
    <div className={`${size} rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-[10px] font-black text-slate-500 shadow-sm shrink-0`}>
      {initials}
    </div>
  );
};

// Custom Multi-select with Avatars for Production Stages
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
        className="w-full p-2 text-sm border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-all outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 flex justify-between items-center text-left"
      >
        <div className="flex items-center flex-1 truncate">
            <div className="flex -space-x-1.5 overflow-hidden mr-2 shrink-0">
               {selectedIds.slice(0, 3).map(id => {
                   const u = users.find(user => user.id === id);
                   if (!u) return null;
                   return <UserAvatar key={id} user={u} size="w-5 h-5" />;
               })}
               {selectedIds.length > 3 && <span className="w-5 h-5 flex items-center justify-center bg-slate-900 text-white text-[9px] rounded-full border border-white font-black">+{selectedIds.length - 3}</span>}
            </div>
            <span className={`truncate text-xs ${selectedCount === 0 ? "text-gray-400" : "text-gray-900 font-bold"}`}>
              {selectedCount === 0 ? "Оберіть виконавців" : `${selectedCount} виконавців`}
            </span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-56 overflow-y-auto animate-fade-in-up origin-top p-1">
          {users.map(u => {
            const isSelected = selectedIds.includes(u.id);
            return (
              <div 
                key={u.id} 
                onClick={() => toggleUser(u.id)}
                className={`p-2 flex items-center cursor-pointer hover:bg-gray-50 rounded-xl text-sm transition-all mb-0.5 border ${isSelected ? 'bg-blue-50 border-blue-200' : 'border-transparent'}`}
              >
                <div className={`w-5 h-5 border-2 rounded-lg mr-3 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200 bg-white'}`}>
                  {isSelected && <Check size={12} strokeWidth={4} className="text-white"/>}
                </div>
                <UserAvatar user={u} size="w-8 h-8" />
                <div className="flex flex-col ml-3">
                    <span className={`font-bold ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>{u.firstName} {u.lastName}</span>
                    <span className="text-[10px] text-gray-400 uppercase font-black">{u.position || 'Працівник'}</span>
                </div>
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<TaskType>('simple');
  
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  const selectedTask = useMemo(() => 
    tasks.find(t => t.id === selectedTaskId) || null
  , [tasks, selectedTaskId]);

  const archivedTasks = useMemo(() => tasks.filter(t => t.status === 'archived'), [tasks]);
  
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

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [techDocs, setTechDocs] = useState<{setupMap: SetupMap | null, productDrawingUrl: string | null}>({ setupMap: null, productDrawingUrl: null });
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeTasks: () => void;
    let unsubscribeOrders: () => void;

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
          taskQuery = query(tasksRef, where('assignedUserIds', 'array-contains', currentUser.id));
        }

        unsubscribeTasks = onSnapshot(taskQuery, (snapshot) => {
          const tasksData = snapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            return { id: docSnapshot.id, ...data, assigneeIds: data.assignedUserIds || [], plannedQuantity: data.planQuantity || 0, completedQuantity: data.factQuantity || 0, deadline: data.dueDate || data.deadline } as Task;
          });
          setTasks(tasksData.filter((t: any) => !t.deleted));
          setIsLoading(false);
        });

        unsubscribeOrders = API.subscribeToOrders((data) => setOrders(data));

      } catch (e) {
        console.error(e);
        setIsLoading(false);
      }
    };

    initData();
    return () => { if (unsubscribeTasks) unsubscribeTasks(); if (unsubscribeOrders) unsubscribeOrders(); };
  }, [currentUser.id, currentUser.role]);

  useEffect(() => {
    const fetchDocs = async () => {
      if (!selectedTask) { setTechDocs({ setupMap: null, productDrawingUrl: null }); return; }
      try {
        const order = orders.find(o => o.id === selectedTask.orderId);
        const productId = order?.productId;
        
        let matchedMap: SetupMap | null = null;
        let prodDrawing: string | null = null;

        // 1. Direct fetch via Stage Link (MOST ACCURATE)
        if (selectedTask.stageId && order?.workCycleId) {
            const cycleSnap = await getDoc(doc(db, "workStorage", order.workCycleId));
            if (cycleSnap.exists()) {
                const cycleData = cycleSnap.data() as JobCycle;
                const stage = cycleData.stages?.find(s => s.id === selectedTask.stageId);
                if (stage?.setupMapId) {
                    const mapSnap = await getDoc(doc(db, "setup_cards", stage.setupMapId));
                    if (mapSnap.exists()) {
                        matchedMap = { id: mapSnap.id, ...mapSnap.data() } as SetupMap;
                    }
                }
            }
        }

        // 2. Fallback search by Product ID & Title Match
        if (!matchedMap && productId) {
            const qDirect = query(collection(db, 'setup_cards'), where('productCatalogId', '==', productId));
            const directSnap = await getDocs(qDirect);
            const allProductMaps = directSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SetupMap));
            
            const taskTitleBase = selectedTask.title.includes(' - ') 
                ? selectedTask.title.split(' - ').slice(1).join(' - ').trim().toLowerCase() 
                : selectedTask.title.trim().toLowerCase();
            
            matchedMap = allProductMaps.find(map => 
                map.name.toLowerCase().includes(taskTitleBase) || 
                taskTitleBase.includes(map.name.toLowerCase())
            ) || (allProductMaps.length > 0 ? allProductMaps[0] : null);
        }

        // 3. Drawing Fetch
        if (productId) {
            const productSnap = await getDoc(doc(db, "catalogs", productId));
            if (productSnap.exists()) {
                const productData = productSnap.data();
                if (productData.drawingId) {
                    const dwgSnap = await getDoc(doc(db, "drawings", productData.drawingId));
                    if (dwgSnap.exists()) prodDrawing = dwgSnap.data().photoUrl;
                }
            }
        }

        setTechDocs({ setupMap: matchedMap, productDrawingUrl: prodDrawing });
      } catch (error) { console.error("Error fetching technical documentation:", error); }
    };
    fetchDocs();
  }, [selectedTask, orders]);

  const handleOrderChange = async (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orders.find(o => o.id === orderId);
    setSelectedOrder(order);
    setStageAssignments({});
    setStageQuantities({});
    if (order && order.workCycleId) {
        try {
            const cycleSnap = await getDoc(doc(db, "workStorage", order.workCycleId));
            if (cycleSnap.exists()) {
                const cycle = { ...cycleSnap.data(), id: cycleSnap.id } as JobCycle;
                setSelectedCycle(cycle);
                const initQty: Record<string, number> = {};
                cycle.stages.forEach(s => { initQty[s.id] = order.quantity; });
                setStageQuantities(initQty);
            }
        } catch(e) { setSelectedCycle(undefined); }
    } else { setSelectedCycle(undefined); }
    setSelectedStageId('');
  };

  const handleCreateTask = async () => {
    if (!isEditor || isSubmitting) return;
    setIsSubmitting(true);
    try {
        if (taskType === 'production' && !editingTaskId && selectedCycle) {
            const stages = selectedCycle.stages || [];
            for (let i = 0; i < stages.length; i++) {
                const stage = stages[i];
                const assignedUserIds = stageAssignments[stage.id] || [];
                if (assignedUserIds.length === 0) continue;
                const plannedQty = stageQuantities[stage.id] || selectedOrder?.quantity || 0;
                const newTask: any = { type: 'production', title: `${selectedOrder?.orderNumber} - ${stage.name}`, description: `Етап: ${stage.name}. ${stage.notes || ''}\nМашина: ${stage.machine}`, status: 'todo', priority: priority, assignedUserIds, createdAt: new Date().toISOString(), orderId: selectedOrderId, stageId: stage.id, planQuantity: plannedQty, factQuantity: 0, pendingQuantity: 0, dueDate: deadline || selectedOrder?.deadline, isFinalStage: i === stages.length - 1, deleted: false };
                await addDoc(collection(db, "tasks"), newTask);
                for (const uid of assignedUserIds) { await API.sendNotification(uid, `Нове виробниче завдання: ${newTask.title}`, 'task_assigned'); }
            }
        } else {
            const newTask: Task = { id: editingTaskId || "", type: taskType, title, description, status: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.status! : 'todo', priority, assigneeIds, createdAt: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.createdAt! : new Date().toISOString(), orderId: taskType === 'production' ? selectedOrderId : undefined, stageId: taskType === 'production' ? selectedStageId : undefined, plannedQuantity: taskType === 'production' ? selectedOrder?.quantity : undefined, completedQuantity: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.completedQuantity! : 0, pendingQuantity: editingTaskId ? tasks.find(t => t.id === editingTaskId)?.pendingQuantity! : 0, deadline: deadline || undefined };
            await API.saveTask(newTask);
        }
        setIsModalOpen(false); resetForm();
    } catch (e) { alert("Помилка збереження"); } finally { setIsSubmitting(false); }
  };

  const resetForm = () => { setEditingTaskId(null); setTaskType('simple'); setTitle(''); setDescription(''); setAssigneeIds([]); setDeadline(''); setPriority('medium'); setSelectedOrderId(''); setSelectedOrder(undefined); setSelectedCycle(undefined); setSelectedStageId(''); setStageAssignments({}); setStageQuantities({}); };
  const toggleAssignee = (userId: string) => { setAssigneeIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]); };
  const handleStageQuantityChange = (stageId: string, value: number) => { setStageQuantities(prev => ({ ...prev, [stageId]: value })); };
  const handleStageAssignment = (stageId: string, ids: string[]) => { setStageAssignments(prev => ({ ...prev, [stageId]: ids })); };

  const handleEdit = (e: React.MouseEvent, task: Task) => { e.stopPropagation(); if (!isEditor) return; setEditingTaskId(task.id); setTaskType(task.type); setTitle(task.title); setDescription(task.description || ''); setAssigneeIds(task.assigneeIds); setPriority(task.priority); setDeadline(task.deadline || ''); if (task.type === 'production' && task.orderId) { const order = orders.find(o => o.id === task.orderId); setSelectedOrder(order); if (task.stageId) setSelectedStageId(task.stageId); } setIsModalOpen(true); };
  const handleDelete = (e: React.MouseEvent, id: string) => { e.stopPropagation(); if (!isEditor) return; setDeleteConfirmId(id); };
  const confirmDelete = async () => { if (!deleteConfirmId) return; setIsDeleting(true); try { await API.deleteTask(deleteConfirmId); setDeleteConfirmId(null); } catch(err) { alert("Error deleting task"); } finally { setIsDeleting(false); } };

  const handleDragStart = (e: React.DragEvent, taskId: string) => { if (isEditor) setDraggedTaskId(taskId); };
  const handleDragOver = (e: React.DragEvent) => { if (isEditor) e.preventDefault(); };
  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => { e.preventDefault(); if (!isEditor || !draggedTaskId) return; const task = tasks.find(t => t.id === draggedTaskId); if (task && task.status !== newStatus) { setTasks(prev => prev.map(t => t.id === draggedTaskId ? { ...t, status: newStatus } : t)); await API.updateTaskStatus(draggedTaskId, newStatus); } setDraggedTaskId(null); };

  const renderCard = (task: Task, isArchiveView: boolean = false) => {
    const assignedUsers = users.filter(u => task.assigneeIds.includes(u.id));
    const factPercent = ((task.completedQuantity || 0) / (task.plannedQuantity || 1)) * 100;
    const pendPercent = ((task.pendingQuantity || 0) / (task.plannedQuantity || 1)) * 100;

    return (
      <div key={task.id} draggable={isEditor && !isArchiveView} onDragStart={(e) => handleDragStart(e, task.id)} onClick={() => setSelectedTaskId(task.id)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition-all cursor-pointer mb-3 group relative overflow-hidden hover:shadow-md animate-fade-in">
        {task.type === 'production' && <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full flex"><div className="h-full bg-green-500" style={{width: `${Math.min(100, factPercent)}%`}}/><div className="h-full bg-orange-400 opacity-50" style={{width: `${Math.min(100 - factPercent, pendPercent)}%` , backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem'}}/></div>}
        <div className="flex justify-between items-start mb-2"><div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${task.priority === 'high' ? 'bg-red-100 text-red-600' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-600'}`}>{task.priority === 'high' ? 'Високий' : task.priority === 'medium' ? 'Середній' : 'Низький'}</div>{isEditor && !isArchiveView && <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => handleEdit(e, task)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={12}/></button><button onClick={(e) => handleDelete(e, task.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={12}/></button></div>}</div>
        <h4 className="font-bold text-gray-900 mb-1 leading-tight">{task.title}</h4>
        {task.deadline && <div className="flex items-center text-xs text-orange-600 font-medium mb-2"><AlertTriangle size={12} className="mr-1"/>До: {task.deadline}</div>}
        {task.type === 'production' && <div className="text-[10px] font-bold text-gray-700">{task.completedQuantity} <span className="text-gray-400 font-normal">/ {task.plannedQuantity} шт</span></div>}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50"><div className="flex -space-x-2">{assignedUsers.slice(0, 4).map(u => <UserAvatar key={u.id} user={u} size="w-6 h-6" />)}</div><div className="text-[10px] text-gray-300 font-mono">{task.createdAt?.slice(0, 10)}</div></div>
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
             <div className="space-y-4"><h3 className="text-sm font-bold text-gray-900 uppercase">Виконавці</h3><div className="flex flex-wrap gap-2">{selectedTask.assigneeIds.map(uid => { const u = users.find(user => user.id === uid); return u ? (<div key={uid} className="flex items-center bg-white border px-3 py-1.5 rounded-full shadow-sm"><UserAvatar user={u} size="w-6 h-6" /><span className="text-sm font-medium ml-2">{u.firstName} {u.lastName}</span></div>) : null; })}</div></div>
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
             ) : ( <div className="h-full flex items-center justify-center text-gray-400 flex-col"><FileText size={48} className="mb-4 opacity-30"/><p className="font-medium">Технічна документація відсутня</p></div> )}
          </div>
        </div>
        {enlargedImage && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 animate-fade-in" onClick={() => setEnlargedImage(null)}><X size={24} className="absolute top-4 right-4 text-white cursor-pointer"/><img src={enlargedImage} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} /></div>}
      </div>
    );
  };

  if (isLoading) return <div className="p-8 flex justify-center h-full items-center"><Loader className="animate-spin text-blue-600" size={40}/></div>;

  return (
    <div className="p-8 h-full flex flex-col bg-slate-50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div><h1 className="text-3xl font-black text-slate-900 tracking-tight">Дошка завдань</h1><p className="text-slate-500 font-medium">Контроль виробничого процесу</p></div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 w-full sm:w-auto">
                <button onClick={() => setCurrentTab('active')} className={`flex-1 sm:flex-none px-6 py-2 text-sm font-bold rounded-xl transition-all ${currentTab === 'active' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Активні</button>
                <button onClick={() => setCurrentTab('archive')} className={`flex-1 sm:flex-none px-6 py-2 text-sm font-bold rounded-xl transition-all ${currentTab === 'archive' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Архів</button>
            </div>
            {isEditor && <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-blue-600 text-white px-6 py-2 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center justify-center w-full sm:w-auto active:scale-95"><Plus size={22} strokeWidth={3} className="mr-2" />Створити</button>}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        {currentTab === 'active' ? (
            <div className="flex flex-col md:flex-row md:space-x-6 min-w-[300px] md:min-w-[1000px] h-full gap-6">
            {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((status) => (
                <div key={status} className="flex-1 bg-slate-200/40 rounded-[2rem] p-5 flex flex-col min-h-[300px] border border-slate-200/50" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                    <div className="flex items-center justify-between mb-5 px-3">
                        <h3 className={`font-black uppercase text-[11px] tracking-[0.1em] ${status === 'todo' ? 'text-slate-500' : status === 'in_progress' ? 'text-blue-600' : 'text-emerald-600'}`}>
                            {status === 'todo' ? 'До виконання' : status === 'in_progress' ? 'В процесі' : 'Виконано'}
                        </h3>
                        <span className="bg-white text-slate-900 px-2.5 py-1 rounded-lg text-[10px] font-black border border-slate-200 shadow-sm">{tasks.filter(t => t.status === status).length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">{tasks.filter(t => t.status === status).map(t => renderCard(t))}</div>
                </div>
            ))}
            </div>
        ) : (
            <div className="bg-slate-100/50 rounded-3xl p-8 h-full overflow-y-auto border-2 border-dashed border-slate-200"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">{archivedTasks.map(t => renderCard(t, true))}</div></div>
        )}
      </div>

      {/* CREATE / EDIT TASK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-up">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
               <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {editingTaskId ? 'Редагувати завдання' : 'Створити нове завдання'}
                  </h2>
                  <p className="text-slate-400 text-sm font-medium mt-1">Заповніть деталі виробничого процесу</p>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="bg-slate-100 p-3 rounded-2xl text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-all active:scale-90"><X size={24}/></button>
            </div>

            <div className="p-10 overflow-y-auto flex-1 custom-scrollbar space-y-8">
              {!editingTaskId && (
                <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                   <button onClick={() => setTaskType('simple')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center ${taskType === 'simple' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-slate-700'}`}><Box size={18} className="mr-2"/> Просте</button>
                   <button onClick={() => setTaskType('production')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center ${taskType === 'production' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-slate-700'}`}><Settings size={18} className="mr-2"/> Виробниче</button>
                </div>
              )}

              {taskType === 'simple' ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="group">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Назва завдання</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white transition-all" placeholder="Напр: Прибирання робочого місця..."/>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Опис (Деталі)</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-32 font-medium text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white transition-all resize-none" placeholder="Що саме потрібно зробити..."/>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Виконавці</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-[2rem] border border-slate-100">
                      {users.map(user => {
                        const isSelected = assigneeIds.includes(user.id);
                        return (
                          <button 
                            key={user.id} 
                            onClick={() => toggleAssignee(user.id)} 
                            className={`flex items-center p-3 rounded-2xl transition-all border shadow-sm ${isSelected ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}
                          >
                            <UserAvatar user={user} size="w-9 h-9" />
                            <div className="text-left overflow-hidden ml-3 flex-1">
                                <div className="text-xs font-bold truncate leading-tight">{user.firstName} {user.lastName}</div>
                                <div className="text-[9px] uppercase font-black tracking-tighter text-slate-400">{user.position || 'Worker'}</div>
                            </div>
                            {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                    <Check size={12} className="text-white" strokeWidth={4}/>
                                </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-fade-in">
                  <div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Оберіть замовлення</label>
                    <select className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl font-black text-blue-900 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all appearance-none cursor-pointer" value={selectedOrderId} onChange={e => handleOrderChange(e.target.value)}>
                      <option value="">-- Оберіть замовлення зі списку --</option>
                      {orders.filter(o => o.status !== 'completed').map(o => <option key={o.id} value={o.id}>{o.orderNumber} ({o.productId})</option>)}
                    </select>
                  </div>

                  {selectedOrder && selectedCycle ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6 space-y-6">
                      <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center text-slate-900"><Settings size={20} className="mr-2 text-blue-600"/><span className="font-black uppercase text-xs tracking-wider">Етапи техпроцесу: {selectedCycle.name}</span></div>
                        <span className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-blue-100">{selectedCycle.stages.length} етапів</span>
                      </div>
                      <div className="space-y-3">
                        {selectedCycle.stages.map((stage, idx) => (
                          <div key={stage.id} className="flex flex-col md:flex-row items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-sm gap-4 transition-all hover:shadow-md">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center"><span className="w-6 h-6 rounded-lg bg-slate-900 text-white text-[10px] font-black flex items-center justify-center mr-3 shrink-0">{idx + 1}</span><h5 className="text-sm font-black text-slate-900 truncate">{stage.name}</h5></div>
                              <div className="text-[10px] text-slate-400 font-bold ml-9 mt-1 flex items-center"><Wrench size={10} className="mr-1"/> {stage.machine}</div>
                            </div>
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="relative w-24">
                                    <input type="number" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-black text-slate-900 outline-none focus:border-blue-400" value={stageQuantities[stage.id] || 0} onChange={(e) => handleStageQuantityChange(stage.id, Number(e.target.value))}/>
                                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-1 text-[8px] font-black text-slate-400 uppercase">Шт</span>
                                </div>
                                <div className="flex-1 md:w-44">
                                    <MultiSelectUsers users={users} selectedIds={stageAssignments[stage.id] || []} onChange={(ids) => handleStageAssignment(stage.id, ids)}/>
                                </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : selectedOrder ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center bg-orange-50 border border-orange-100 rounded-[2rem] p-8">
                       <AlertTriangle className="text-orange-500 mb-4" size={48}/>
                       <h4 className="font-black text-orange-900 uppercase text-sm mb-2">Немає техпроцесу</h4>
                       <p className="text-orange-700 text-xs max-w-xs leading-relaxed font-medium">Для цього виробу не призначено циклу робіт. Перейдіть до "Сховища робіт", щоб налаштувати техпроцес.</p>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                <div className="group">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Пріоритет виконання</label>
                  <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all appearance-none cursor-pointer" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                    <option value="low">Низький</option>
                    <option value="medium">Середній (Normal)</option>
                    <option value="high">🔥 Високий</option>
                  </select>
                </div>
                <div className="group">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Крайній термін (Дедлайн)</label>
                  <input type="date" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all" value={deadline} onChange={(e) => setDeadline(e.target.value)}/>
                </div>
              </div>
            </div>

            <div className="px-10 py-8 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-500 font-black uppercase text-xs tracking-widest hover:text-slate-900 transition-colors">Скасувати</button>
                <button onClick={handleCreateTask} disabled={isSubmitting || (taskType === 'production' && !selectedCycle)} className="flex-[2] bg-slate-900 text-white py-4 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center disabled:opacity-30 disabled:grayscale">
                  {isSubmitting ? <Loader size={20} className="animate-spin"/> : (editingTaskId ? 'Зберегти зміни' : 'Створити завдання')}
                </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && renderDetailModal()}
      {deleteConfirmId && <DeleteConfirmModal isOpen={!!deleteConfirmId} title="Видалити завдання?" message="Ви впевнені? Це видалить завдання назавжди." onClose={() => setDeleteConfirmId(null)} onConfirm={confirmDelete} isDeleting={isDeleting} />}
    </div>
  );
};