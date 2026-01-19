
import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { store } from '../services/mockStore'; 
import { Task, ProductionReport, User, Order } from '../types';
import { CheckCircle, AlertCircle, FileText, Plus, Search, X, Download, ArrowRight, CheckSquare, Square, Pencil, Loader, Save, Link, Package, ClipboardCheck } from 'lucide-react';
import { collection, query, where, getDocs, writeBatch, doc, increment, serverTimestamp, getDoc, updateDoc, addDoc } from "firebase/firestore";
import { db } from "../services/firebase";

interface ReportsProps {
  currentUser?: User; 
}

interface ConsumptionGroup {
    name: string;
    qty: number;
    totalNeeded: number;
    availableBatches: ProductionReport[];
    selectedBatchIds: Set<string>;
    selectedTotal: number;
}

export const Reports: React.FC<ReportsProps> = ({ currentUser }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<ProductionReport[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); 
  
  // Worker Logic State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [qty, setQty] = useState('');
  const [scrap, setScrap] = useState('');
  const [note, setNote] = useState('');
  const [batchCode, setBatchCode] = useState(''); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived State for Task Type
  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const isSimpleTask = selectedTask?.type === 'simple';

  // Consumption Logic State
  const [consumptionGroups, setConsumptionGroups] = useState<ConsumptionGroup[]>([]);

  // Admin Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ProductionReport | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editScrap, setEditScrap] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editLockedTotal, setEditLockedTotal] = useState(0); 

  // Admin History Filter State
  const [historySearch, setHistorySearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Row Selection State
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribeReports = API.subscribeToReports((data) => {
        setReports(data);
    });
    const unsubscribeTasks = API.subscribeToTasks((data) => {
        setTasks(data);
    });
    const unsubscribeOrders = API.subscribeToOrders((data) => {
        setOrders(data);
    });

    API.getUsers().then(users => setAllUsers(users));

    return () => {
        if (unsubscribeReports) unsubscribeReports();
        if (unsubscribeTasks) unsubscribeTasks();
        if (unsubscribeOrders) unsubscribeOrders();
    };
  }, []);

  // --- LOGIC TO FETCH FROM setup_cards ---
  useEffect(() => {
      if (isSimpleTask) {
          setConsumptionGroups([]);
          return;
      }

      const calculateConsumption = async () => {
          setConsumptionGroups([]); 

          const task = tasks.find(t => t.id === selectedTaskId);
          const order = orders.find(o => o.id === task?.orderId);
          const selectedProduct = order ? { id: order.productId } : undefined;

          if (!selectedProduct) return;

          try {
              const q = query(collection(db, 'setup_cards'), where('productId', '==', selectedProduct.id));
              let snapshot = await getDocs(q);

              if (snapshot.empty) {
                 const q2 = query(collection(db, 'setup_cards'), where('productCatalogId', '==', selectedProduct.id));
                 snapshot = await getDocs(q2);
              }

              if (!snapshot.empty) {
                  const cardData = snapshot.docs[0].data();
                  const d = cardData as any;
                  const components = d.inputComponents || [];

                  if (components.length > 0) {
                      const groups: ConsumptionGroup[] = [];
                      const reportQty = Number(qty) || 0;

                      for (const comp of components) {
                          const requiredQty = Number(comp.qty || comp.ratio || 0);
                          const compName = comp.name || `Stage ${comp.sourceStageIndex !== undefined ? comp.sourceStageIndex + 1 : '?'}`;
                          
                          const available = reports.filter(r => 
                              r.status === 'approved' &&
                              (r.quantity - (r.usedQuantity || 0)) > 0 &&
                              (r.orderNumber === order?.orderNumber) &&
                              (
                                (r.stageName && r.stageName.trim() === compName.trim()) ||
                                (r.taskTitle && r.taskTitle.trim() === compName.trim())
                              )
                          );

                          groups.push({
                              name: compName,
                              qty: requiredQty,
                              totalNeeded: reportQty * requiredQty,
                              availableBatches: available,
                              selectedBatchIds: new Set(),
                              selectedTotal: 0
                          });
                      }
                      setConsumptionGroups(groups);
                  }
              }
          } catch (error) {
              console.error("Consumption Calc Error:", error);
          }
      };
      
      calculateConsumption();
  }, [selectedTaskId, qty, tasks, orders, reports, isSimpleTask]);

  const toggleBatchSelection = (groupIndex: number, batchId: string) => {
      const newGroups = [...consumptionGroups];
      const group = newGroups[groupIndex];
      const newSet = new Set(group.selectedBatchIds);
      
      if (newSet.has(batchId)) {
          newSet.delete(batchId);
      } else {
          newSet.add(batchId);
      }
      
      group.selectedBatchIds = newSet;
      
      group.selectedTotal = group.availableBatches
        .filter(b => newSet.has(b.id))
        .reduce((sum, b) => sum + (b.quantity - (b.usedQuantity || 0)), 0);

      setConsumptionGroups(newGroups);
  };

  const handleSubmit = async () => {
    if (!selectedTaskId) {
        alert("Оберіть завдання!");
        return;
    }

    const currentTask = tasks.find(t => t.id === selectedTaskId);
    const currentOrder = currentTask?.orderId ? orders.find(o => o.id === currentTask.orderId) : null;
    
    // Validate Quantity only for production tasks
    if (!isSimpleTask && !qty) {
        alert("Введіть кількість для виробничого завдання!");
        return;
    }

    // Validate Consumption
    for (const group of consumptionGroups) {
        if (group.selectedTotal < group.totalNeeded) {
            alert(`Недостатньо матеріалів: "${group.name}"!\nПотрібно: ${group.totalNeeded}\nОбрано: ${group.selectedTotal}\n\nБудь ласка, виберіть необхідну кількість партій.`);
            return;
        }
    }

    setIsSubmitting(true);

    try {
        const qtyNumber = isSimpleTask ? 0 : Number(qty);
        const scrapNumber = isSimpleTask ? 0 : (Number(scrap) || 0);

        // Collect consumed IDs
        const allSourceBatchIds: string[] = [];
        consumptionGroups.forEach(g => {
            g.selectedBatchIds.forEach(id => allSourceBatchIds.push(id));
        });

        // --- 1. CREATE REPORT DOCUMENT ---
        const newReportPayload: any = {
            taskId: selectedTaskId,
            userId: currentUser?.id || 'unknown',
            date: new Date().toISOString().split('T')[0],
            quantity: qtyNumber,
            scrapQuantity: scrapNumber,
            notes: note,
            status: 'pending',
            type: isSimpleTask ? 'simple_report' : 'production',
            createdAt: new Date().toISOString(),
            sourceBatchIds: allSourceBatchIds,
            usedQuantity: 0,
            taskTitle: currentTask?.title || 'Unknown Task',
            orderNumber: currentOrder?.orderNumber || 'Simple Task',
            stageName: isSimpleTask ? 'Загальне' : currentTask?.title,
            batchCode: isSimpleTask ? '-' : (batchCode || 'Без маркування')
        };

        const reportRef = await addDoc(collection(db, "reports"), newReportPayload);

        // --- 2. UPDATE PROGRESS (Only for production) ---
        if (!isSimpleTask && selectedTaskId) {
            const taskRef = doc(db, 'tasks', selectedTaskId);
            try {
                const taskSnap = await getDoc(taskRef);
                if (taskSnap.exists()) {
                    await updateDoc(taskRef, {
                        pendingQuantity: increment(qtyNumber),
                        updatedAt: serverTimestamp()
                    });
                }
            } catch (e) {
                console.error("Error updating task progress:", e);
            }
        }

        // --- 3. CONSUME MATERIALS ---
        if (!isSimpleTask && consumptionGroups.length > 0) {
            const batchWrite = writeBatch(db);
            for (const group of consumptionGroups) {
                let remainingToConsume = group.totalNeeded;
                for (const batchId of Array.from(group.selectedBatchIds)) {
                    if (remainingToConsume <= 0) break;
                    const sourceRef = doc(db, "reports", batchId);
                    const sourceBatch = group.availableBatches.find(r => r.id === batchId);
                    if (sourceBatch) {
                        const available = sourceBatch.quantity - (sourceBatch.usedQuantity || 0);
                        const take = Math.min(available, remainingToConsume);
                        batchWrite.update(sourceRef, { usedQuantity: increment(take) });
                        remainingToConsume -= take;
                    }
                }
            }
            await batchWrite.commit();
        }

        // --- 4. NOTIFICATION ---
        const workerName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Працівник';
        const msg = isSimpleTask 
            ? `Звіт по завданню: ${currentTask?.title} від ${workerName}`
            : `Новий звіт: ${currentTask?.title} (+${qtyNumber} шт) від ${workerName}`;
            
        await API.sendNotification(
            'admin',
            msg,
            'info',
            reportRef.id,
            'admin',
            'Новий звіт'
        );

        alert(isSimpleTask ? "Звіт відправлено на перевірку!" : `Звіт збережено!\nПрогрес завдання: +${qtyNumber} (Очікує підтвердження).`);

        // Reset Form
        setIsFormOpen(false);
        setSelectedTaskId('');
        setQty('');
        setScrap('');
        setNote('');
        setBatchCode('');
        setConsumptionGroups([]);

    } catch (e: any) {
        alert(`Помилка: ${e.message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  const myActiveTasks = currentUser 
    ? tasks.filter(t => {
        const isAssigned = t.assigneeIds && Array.isArray(t.assigneeIds) ? t.assigneeIds.includes(currentUser.id) : false;
        const isActiveStatus = ['todo', 'in_progress'].includes(t.status);
        return isAssigned && isActiveStatus;
    })
    : [];
  
  const pendingReports = reports.filter(r => r.status === 'pending');

  const getFilteredHistory = () => {
    return reports.filter(r => {
      let matchesSearch = true;
      if (historySearch) {
        const term = historySearch.toLowerCase();
        const tTitle = r.taskTitle || tasks.find(t => t.id === r.taskId)?.title || '';
        const oNum = r.orderNumber || (tasks.find(t => t.id === r.taskId)?.orderId ? orders.find(o => o.id === tasks.find(t => t.id === r.taskId)?.orderId)?.orderNumber : '') || '';
        const user = allUsers.find(u => u.id === r.userId);
        matchesSearch = 
          (tTitle.toLowerCase().includes(term)) ||
          (user?.firstName?.toLowerCase().includes(term) || false) ||
          (user?.lastName?.toLowerCase().includes(term) || false) ||
          (oNum.toLowerCase().includes(term)) ||
          (r.batchCode?.toLowerCase().includes(term) || false);
      }
      let matchesDate = true;
      if (dateFrom) matchesDate = matchesDate && r.date >= dateFrom;
      if (dateTo) matchesDate = matchesDate && r.date <= dateTo;
      return matchesSearch && matchesDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const filteredHistory = getFilteredHistory();
  const isAllSelected = filteredHistory.length > 0 && selectedReportIds.size === filteredHistory.length;

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedReportIds(new Set());
    else setSelectedReportIds(new Set(filteredHistory.map(r => r.id)));
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedReportIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedReportIds(newSet);
  };

  const handleEditReport = (e: React.MouseEvent, report: ProductionReport) => {
    e.stopPropagation();
    setEditingReport(report);
    setEditQty(report.quantity.toString());
    setEditScrap(report.scrapQuantity.toString());
    setEditNote(report.notes || '');
    setEditLockedTotal(report.quantity + report.scrapQuantity);
    setIsEditModalOpen(true);
  };

  const handleEditScrapChange = (value: string) => {
    const newScrap = Number(value);
    if (newScrap < 0) return;
    setEditScrap(value);
    let newQty = editLockedTotal - newScrap;
    if (newQty < 0) newQty = 0;
    setEditQty(newQty.toString());
  };

  const handleEditQtyChange = (value: string) => {
    const newQty = Number(value);
    if (newQty < 0) return;
    setEditQty(value);
    setEditLockedTotal(newQty + Number(editScrap));
  };

  const handleSaveEditedReport = async () => {
    if (!editingReport) return;
    setIsSubmitting(true);
    try {
      await API.updateReport(editingReport.id, {
        quantity: Number(editQty),
        scrapQuantity: Number(editScrap),
        notes: editNote
      });
      setIsEditModalOpen(false);
      setEditingReport(null);
    } catch (e) {
      alert("Error updating report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (report: ProductionReport) => {
    try {
      await API.approveReport(report.id, report);
    } catch (e) {
      alert("Error approving report");
    }
  };

  const handleReject = async (report: ProductionReport) => {
    try {
      await API.rejectReport(report.id, report);
    } catch (e) {
      alert("Error rejecting report");
    }
  };

  const handleExportExcel = () => {
    const itemsToExport = selectedReportIds.size > 0 
        ? reports.filter(r => selectedReportIds.has(r.id))
        : filteredHistory;

    const headers = "Дата;Працівник;Завдання;Замовлення;Партія;Кількість;Брак;Статус;Нотатки\n";

    const rows = itemsToExport.map(r => {
        const taskTitle = r.taskTitle || tasks.find(t => t.id === r.taskId)?.title || 'Видалене завдання';
        const orderNum = r.orderNumber || (tasks.find(t => t.id === r.taskId)?.orderId ? orders.find(o => o.id === tasks.find(t => t.id === r.taskId)?.orderId)?.orderNumber : '') || '';
        const user = allUsers.find(u => u.id === r.userId);
        const workerName = user ? `${user.firstName} ${user.lastName}` : (r.userId === 'admin_manual' ? 'System' : 'Невідомо');

        let dateStr = "";
        try {
            const dateObj = new Date(r.createdAt);
            dateStr = dateObj.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
        } catch (e) { dateStr = "Invalid Date"; }

        const safeWorker = workerName.replace(/;/g, " ");
        const safeTask = taskTitle.replace(/;/g, " ");
        const safeOrder = orderNum.replace(/;/g, " ");
        const safeBatch = (r.batchCode || "").replace(/;/g, " ");
        const safeNotes = (r.notes || "").replace(/;/g, " ").replace(/\n/g, " ");

        let statusUA = r.status;
        if (r.status === 'approved') statusUA = "Прийнято";
        if (r.status === 'rejected') statusUA = "Відхилено";
        if (r.status === 'pending') statusUA = "Очікує";

        return `${dateStr};${safeWorker};${safeTask};${safeOrder};${safeBatch};${r.quantity};${r.scrapQuantity};${statusUA};${safeNotes}`;
    }).join("\n");

    const csvContent = headers + rows;
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zvit_full_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (currentUser && currentUser.role === 'worker') {
    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
             <h1 className="text-2xl font-bold text-gray-900">Щоденні звіти</h1>
             <p className="text-gray-500">Подати звіт про виконану роботу</p>
          </div>
          <button onClick={() => setIsFormOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center shadow-lg hover:bg-slate-800">
            <Plus size={20} className="mr-2"/> Сформувати звіт
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
           <div className="bg-gray-50 px-6 py-4 border-b font-bold text-gray-700">Моя історія звітів</div>
           <div className="divide-y divide-gray-100">
             {reports.filter(r => r.userId === currentUser.id).map(report => {
               const taskTitle = report.taskTitle || tasks.find(t => t.id === report.taskId)?.title || 'Deleted Task';
               const orderNum = report.orderNumber || (tasks.find(t => t.id === report.taskId)?.orderId ? orders.find(o => o.id === tasks.find(t => t.id === report.taskId)?.orderId)?.orderNumber : null);
               return (
                 <div key={report.id} className="p-4 flex items-center justify-between">
                    <div>
                       {report.batchCode && report.batchCode !== '-' ? <div className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded w-fit mb-1">{report.batchCode}</div> : orderNum && report.orderNumber !== 'Simple Task' && <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit mb-1">{orderNum}</div>}
                       <div className="font-bold text-gray-900">{taskTitle}</div>
                       <div className="text-sm text-gray-500">{new Date(report.createdAt).toLocaleString('uk-UA')}</div>
                       {report.notes && <div className="text-xs text-gray-400 mt-1 italic">"{report.notes}"</div>}
                    </div>
                    <div className="text-right flex items-center gap-4">
                       {report.type !== 'simple_report' ? (
                          <div><span className="block font-bold text-lg text-gray-800">{report.quantity} шт</span>{report.scrapQuantity > 0 && <span className="text-xs text-red-500 font-bold">{report.scrapQuantity} брак</span>}</div>
                       ) : (
                          <div className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">Просте завд.</div>
                       )}
                       <div>
                          {report.status === 'approved' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold uppercase">Прийнято</span>}
                          {report.status === 'rejected' && <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold uppercase">Відхилено</span>}
                          {report.status === 'pending' && <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold uppercase">Очікує</span>}
                       </div>
                    </div>
                 </div>
               );
             })}
           </div>
        </div>

        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 my-auto">
                <h2 className="text-xl font-bold mb-6">Новий звіт</h2>
                <div className="space-y-4">
                   <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Оберіть завдання</label>
                      <select 
                        className="w-full p-3 border rounded-lg bg-gray-50"
                        value={selectedTaskId}
                        onChange={e => setSelectedTaskId(e.target.value)}
                      >
                        <option value="">-- Активні завдання --</option>
                        {myActiveTasks.map(t => (
                          <option key={t.id} value={t.id}>
                             [{t.type === 'simple' ? 'ПРОСТЕ' : 'ВИРОБН.'}] {t.title} 
                             {t.type === 'production' && ` (Залишилось: ${(t.plannedQuantity || 0) - (t.completedQuantity || 0)})`}
                          </option>
                        ))}
                      </select>
                   </div>

                   {selectedTaskId && !isSimpleTask && (
                      <div className="animate-fade-in space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Номер партії / Зміна</label>
                            <input 
                                type="text" 
                                className="w-full p-3 border rounded-lg bg-white"
                                value={batchCode}
                                onChange={e => setBatchCode(e.target.value)}
                                placeholder="Напр. П-1 або Нічна"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Вироблено (шт)</label>
                                <input 
                                type="number" 
                                className="w-full p-3 border rounded-lg"
                                value={qty}
                                onChange={e => setQty(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-red-600 mb-1">Брак (шт)</label>
                                <input 
                                type="number" 
                                className="w-full p-3 border rounded-lg border-red-100 bg-red-50"
                                value={scrap}
                                onChange={e => setScrap(e.target.value)}
                                />
                            </div>
                        </div>

                        {consumptionGroups.length > 0 && Number(qty) > 0 && (
                            <div className="space-y-3 animate-fade-in">
                                {consumptionGroups.map((group, gIdx) => (
                                    <div key={gIdx} className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs font-bold text-blue-800 uppercase flex items-center">
                                                <Package size={12} className="mr-1"/> Збірка: {group.name}
                                            </label>
                                            <span className={`text-xs font-bold ${group.selectedTotal >= group.totalNeeded ? 'text-green-600' : 'text-red-500'}`}>
                                                Обрано: {group.selectedTotal} / {group.totalNeeded}
                                            </span>
                                        </div>
                                        
                                        <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                            {group.availableBatches.length === 0 ? (
                                                <div className="text-xs text-red-500 italic">Немає доступних партій!</div>
                                            ) : (
                                                group.availableBatches.map(batch => {
                                                    const available = batch.quantity - (batch.usedQuantity || 0);
                                                    const isSelected = group.selectedBatchIds.has(batch.id);
                                                    const user = allUsers.find(u => u.id === batch.userId);
                                                    
                                                    return (
                                                        <div 
                                                            key={batch.id} 
                                                            onClick={() => toggleBatchSelection(gIdx, batch.id)}
                                                            className={`p-2 rounded border text-xs cursor-pointer flex justify-between items-center transition-colors ${isSelected ? 'bg-blue-200 border-blue-300' : 'bg-white border-gray-200 hover:bg-blue-50'}`}
                                                        >
                                                            <div className="flex items-center">
                                                                <div className={`w-3 h-3 rounded border mr-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                                                    {isSelected && <CheckSquare size={8} className="text-white"/>}
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-gray-700">
                                                                        {batch.type === 'manual_stock' ? 'Склад (Admin)' : user?.lastName || 'Unknown'}
                                                                    </span>
                                                                    <span className="text-gray-400 ml-1">
                                                                        {new Date(batch.createdAt).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className="font-mono font-bold">{available} шт</span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                      </div>
                   )}

                   {isSimpleTask && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start animate-fade-in">
                          <ClipboardCheck className="text-blue-600 mr-3 shrink-0" size={24}/>
                          <div>
                              <p className="text-sm font-bold text-blue-900">Просте завдання</p>
                              <p className="text-xs text-blue-700 mt-1">Це завдання не потребує введення кількості. Ви можете просто залишити коментар про виконання.</p>
                          </div>
                      </div>
                   )}

                   <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Нотатка / Коментар {isSimpleTask ? '(обов\'язково для пояснення)' : '(опціонально)'}</label>
                      <textarea 
                        className="w-full p-3 border rounded-lg h-24 resize-none outline-none focus:ring-2 focus:ring-slate-500"
                        placeholder="Опишіть що було зроблено..."
                        value={note}
                        onChange={e => setNote(e.target.value)}
                      />
                   </div>
                </div>
                <div className="flex gap-3 mt-6">
                   <button onClick={() => setIsFormOpen(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors">Скасувати</button>
                   <button 
                     onClick={handleSubmit} 
                     disabled={isSubmitting || !selectedTaskId}
                     className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex justify-center items-center transition-all shadow-lg"
                   >
                     {isSubmitting ? <Loader size={16} className="animate-spin"/> : 'Відправити звіт'}
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Керування звітами</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
           <h2 className="font-bold text-gray-500 uppercase text-xs tracking-wider flex items-center mb-4">
             <AlertCircle size={16} className="mr-2 text-yellow-500"/> Очікують підтвердження ({pendingReports.length})
           </h2>
           {pendingReports.length === 0 && (
             <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
               <CheckCircle size={48} className="text-gray-200 mx-auto mb-2"/>
               <div className="text-gray-400 text-sm font-medium">Всі звіти перевірено</div>
             </div>
           )}
           {pendingReports.map(report => {
              const taskTitle = report.taskTitle || tasks.find(t => t.id === report.taskId)?.title || 'Deleted Task';
              const orderNum = report.orderNumber || (tasks.find(t => t.id === report.taskId)?.orderId ? orders.find(o => o.id === tasks.find(t => t.id === report.taskId)?.orderId)?.orderNumber : null);
              const user = allUsers.find(u => u.id === report.userId) || store.getUsers().find(u => u.id === report.userId);
              return (
                <div key={report.id} className="bg-white p-4 rounded-xl border border-yellow-200 shadow-sm relative overflow-visible transition-all hover:shadow-md group">
                   <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400 rounded-l-xl"></div>
                   <div className="flex justify-between items-start mb-2 pl-2">
                      <div>
                         {report.batchCode && report.batchCode !== '-' ? (<div className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded w-fit mb-1">{report.batchCode}</div>) : (orderNum && report.orderNumber !== 'Simple Task' && <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit mb-1">{orderNum}</div>)}
                         <h3 className="font-bold text-gray-900">{taskTitle}</h3>
                         <div className="text-xs text-gray-500 flex items-center mt-1"><span className="font-bold text-gray-700 mr-2">{user?.firstName} {user?.lastName}</span><span>{new Date(report.createdAt).toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'})}</span></div>
                      </div>
                      <div className="text-right pr-2"> 
                         {report.type !== 'simple_report' ? (
                            <>
                                <div className="text-2xl font-bold text-gray-800">{report.quantity} <span className="text-sm font-normal text-gray-400">шт</span></div>
                                {report.scrapQuantity > 0 && <div className="text-xs font-bold text-red-500">{report.scrapQuantity} брак</div>}
                            </>
                         ) : (
                            <div className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded">Просте завдання</div>
                         )}
                         <button onClick={(e) => handleEditReport(e, report)} className="text-xs text-blue-600 hover:underline mt-1 flex items-center justify-end"><Pencil size={10} className="mr-1"/> Редагувати</button>
                      </div>
                   </div>
                   {report.notes && <div className="bg-gray-50 p-2 rounded text-sm text-gray-600 mb-3 ml-2 italic border border-gray-100">"{report.notes}"</div>}
                   
                   {report.sourceBatchIds && report.sourceBatchIds.length > 0 && (
                       <div className="mb-3 ml-2">
                           <div className="text-[10px] text-gray-400 uppercase font-bold mb-1 flex items-center"><Link size={10} className="mr-1"/> Збірка з партій:</div>
                           <div className="flex flex-wrap gap-1">
                               {report.sourceBatchIds.map(sid => (
                                   <span key={sid} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 rounded border border-blue-100">#{sid.slice(-4)}</span>
                               ))}
                           </div>
                       </div>
                   )}

                   <div className="flex gap-2 ml-2 mt-2">
                      <button onClick={() => handleApprove(report)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-bold transition-colors shadow-sm">Затвердити</button>
                      <button onClick={() => handleReject(report)} className="flex-1 bg-white border border-red-100 text-red-500 hover:bg-red-50 py-2 rounded-lg text-sm font-bold transition-colors">Відхилити</button>
                   </div>
                </div>
              );
           })}
        </div>

        <div className="flex flex-col h-[calc(100vh-150px)]">
           <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex items-center">
                  <button onClick={toggleSelectAll} className={`mr-3 transition-colors ${isAllSelected ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title={isAllSelected ? "Зняти вибір" : "Обрати всі"}>
                     {isAllSelected ? <CheckSquare size={20}/> : <Square size={20}/>}
                  </button>
                  <h2 className="font-bold text-gray-500 uppercase text-xs tracking-wider flex items-center"><FileText size={16} className="mr-2"/> Історія</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleExportExcel} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center transition-colors shadow-sm ${selectedReportIds.size > 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-green-600 text-white hover:bg-green-700'}`} title="Завантажити в Excel">
                    <Download size={14} className="mr-1"/> {selectedReportIds.size > 0 ? `Експорт (${selectedReportIds.size})` : 'Експорт'}
                </button>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">{filteredHistory.length}</span>
              </div>
           </div>

           <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm mb-4 shrink-0 space-y-3">
              <div className="relative">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                 <input 
                   placeholder="Пошук (Замовлення, Працівник, Партія...)" 
                   className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-gray-50 focus:bg-white transition-colors"
                   value={historySearch}
                   onChange={e => setHistorySearch(e.target.value)}
                 />
                 {historySearch && (<button onClick={() => setHistorySearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14}/></button>)}
              </div>
              <div className="flex items-center gap-2">
                 <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold uppercase">З</span>
                    <input type="date" className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-gray-50 focus:bg-white text-gray-600 font-medium" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/>
                 </div>
                 <ArrowRight size={14} className="text-gray-300"/>
                 <div className="relative flex-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold uppercase">По</span>
                    <input type="date" className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-gray-50 focus:bg-white text-gray-600 font-medium" value={dateTo} onChange={e => setDateTo(e.target.value)}/>
                 </div>
                 {(dateFrom || dateTo) && (<button onClick={() => { setDateFrom(''); setDateTo(''); }} className="ml-1 text-gray-400 hover:text-red-500"><X size={16}/></button>)}
              </div>
           </div>

           <div className="bg-white rounded-xl border border-gray-200 overflow-y-auto flex-1 shadow-sm custom-scrollbar">
              {filteredHistory.length === 0 ? (<div className="p-8 text-center text-gray-400 text-sm italic">Записів не знайдено</div>) : (
                 filteredHistory.map(report => {
                    const taskTitle = report.taskTitle || tasks.find(t => t.id === report.taskId)?.title || 'Deleted Task';
                    const orderNum = report.orderNumber || (tasks.find(t => t.id === report.taskId)?.orderId ? orders.find(o => o.id === tasks.find(t => t.id === report.taskId)?.orderId)?.orderNumber : null);
                    const user = allUsers.find(u => u.id === report.userId) || store.getUsers().find(u => u.id === report.userId);
                    const isSelected = selectedReportIds.has(report.id);

                    return (
                      <div key={report.id} className={`p-4 border-b border-gray-50 last:border-0 transition-colors group flex items-start gap-3 relative ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`} onClick={() => toggleSelect(report.id)}>
                         <div className={`mt-1 cursor-pointer transition-colors ${isSelected ? 'text-blue-600' : 'text-gray-300 group-hover:text-gray-400'}`}>{isSelected ? <CheckSquare size={18}/> : <Square size={18}/>}</div>
                         <div className="flex-1">
                             <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-1">
                                   <div className="text-sm font-bold text-gray-900">{taskTitle}</div>
                                   {orderNum && report.orderNumber !== 'Simple Task' && (<div className="text-xs text-gray-800"><span className="font-bold text-gray-500">Замовлення:</span> {orderNum}</div>)}
                                   {report.batchCode && report.batchCode !== '-' && (<div className="text-xs text-gray-800"><span className="font-bold text-gray-500">Партія:</span> {report.batchCode}</div>)}
                                   <div className="text-xs text-gray-500 mt-1 flex items-center">{report.type === 'manual_stock' ? (<span className="text-orange-700 font-bold mr-1">Склад (Manual)</span>) : (<span className="font-medium text-gray-700 mr-1">{user?.firstName} {user?.lastName}</span>)}<span>• {new Date(report.createdAt).toLocaleString('uk-UA')}</span></div>
                                </div>
                                <div className="text-right pl-2 shrink-0">
                                   {report.type !== 'simple_report' ? (
                                      <>
                                          <div className="font-bold text-gray-900 text-lg">{report.quantity} шт</div>
                                          {report.scrapQuantity > 0 && (<div className="text-xs text-red-600 font-bold mt-1">Брак: {report.scrapQuantity}</div>)}
                                      </>
                                   ) : (
                                      <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Просте</div>
                                   )}
                                   <div className={`text-[10px] uppercase font-bold ${report.status === 'approved' ? 'text-green-600' : report.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>{report.status === 'approved' ? 'Прийнято' : report.status === 'rejected' ? 'Відхилено' : 'Очікує'}</div>
                                </div>
                             </div>
                             {report.notes && (<div className="mt-2 text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2 line-clamp-2">"{report.notes}"</div>)}
                         </div>
                      </div>
                    );
                 })
              )}
           </div>
        </div>
      </div>

      {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">Редагувати звіт</h3>
                    <button onClick={() => setIsEditModalOpen(false)}><X size={20} className="text-gray-400"/></button>
                </div>
                <div className="space-y-4">
                   {editingReport?.type !== 'simple_report' && (
                      <>
                        <div className="bg-blue-50 text-xs text-blue-800 p-2 rounded border border-blue-100 flex justify-between items-center"><span>Всього виготовлено (Good + Scrap):</span><span className="font-bold text-lg">{editLockedTotal}</span></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Придатні (шт)</label><input type="number" className="w-full p-2 border rounded-lg font-bold text-gray-800" value={editQty} onChange={e => handleEditQtyChange(e.target.value)}/></div>
                            <div><label className="block text-sm font-bold text-red-600 mb-1">Брак (шт)</label><input type="number" className="w-full p-2 border rounded-lg border-red-200 bg-red-50 font-bold text-red-700" value={editScrap} onChange={e => handleEditScrapChange(e.target.value)}/></div>
                        </div>
                      </>
                   )}
                   <div><label className="block text-sm font-bold text-gray-700 mb-1">Нотатка</label><textarea className="w-full p-2 border rounded-lg h-20 resize-none" value={editNote} onChange={e => setEditNote(e.target.value)}/></div>
                </div>
                <div className="flex gap-2 mt-6">
                   <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors">Скасувати</button>
                   <button onClick={handleSaveEditedReport} disabled={isSubmitting} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center transition-all">{isSubmitting ? <Loader size={16} className="animate-spin mr-2"/> : <><Save size={16} className="mr-2"/> Зберегти</>}</button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};
