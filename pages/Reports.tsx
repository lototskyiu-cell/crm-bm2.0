import React, { useState, useEffect, useMemo } from 'react';
import { API } from '../services/api';
import { store } from '../services/mockStore'; 
import { Task, ProductionReport, User, Order, SetupMap } from '../types';
import { Check, CheckCircle, AlertCircle, FileText, Plus, Search, X, Download, ArrowRight, CheckSquare, Square, Pencil, Loader, Save, Link, Package, ClipboardCheck } from 'lucide-react';
import { collection, query, where, getDocs, writeBatch, doc, increment, serverTimestamp, getDoc, updateDoc, addDoc } from "firebase/firestore";
import { db } from "../services/firebase";

interface ReportsProps {
  currentUser?: User; 
}

interface ConsumptionGroup {
    name: string;
    qty: number;
    totalNeeded: number;
    // Added availableNow to the intersection type to match calculation results
    availableBatches: (ProductionReport & { availableNow: number })[];
    selectedBatchIds: Set<string>;
    selectedTotal: number;
}

export const Reports: React.FC<ReportsProps> = ({ currentUser }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<ProductionReport[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); 
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [qty, setQty] = useState('');
  const [scrap, setScrap] = useState('');
  const [note, setNote] = useState('');
  const [batchCode, setBatchCode] = useState(''); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTask = useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);
  const isSimpleTask = selectedTask?.type === 'simple';
  const [activeSetupMap, setActiveSetupMap] = useState<SetupMap | null>(null);

  const [consumptionGroups, setConsumptionGroups] = useState<ConsumptionGroup[]>([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ProductionReport | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editScrap, setEditScrap] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editLockedTotal, setEditLockedTotal] = useState(0); 

  const [historySearch, setHistorySearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());

  const isAssembly = activeSetupMap?.processType === 'assembly';
  const isManufacturing = activeSetupMap?.processType === 'manufacturing';

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

  useEffect(() => {
      if (isSimpleTask || !selectedTaskId) {
          setConsumptionGroups([]);
          setActiveSetupMap(null);
          return;
      }

      const calculateConsumption = async () => {
          const task = tasks.find(t => t.id === selectedTaskId);
          const order = orders.find(o => o.id === task?.orderId);
          if (!order) return;

          try {
              const q = query(collection(db, 'setup_cards'), where('productCatalogId', '==', order.productId));
              const snapshot = await getDocs(q);

              if (!snapshot.empty) {
                  const cardData = snapshot.docs[0].data();
                  const d = { id: snapshot.docs[0].id, ...cardData } as SetupMap;
                  setActiveSetupMap(d);

                  if (d.processType === 'assembly' && d.inputComponents?.length) {
                      const groups: ConsumptionGroup[] = [];
                      const reportQty = Number(qty) || 0;

                      for (const comp of d.inputComponents) {
                          const requiredQtyPerUnit = Number(comp.qty || comp.ratio || 0);
                          const compName = comp.name;
                          
                          const available = reports.filter(r => 
                              r.status === 'approved' &&
                              r.orderNumber === order.orderNumber &&
                              (r.stageName?.trim() === compName?.trim() || r.taskTitle?.trim() === compName?.trim())
                          ).map((reportItem: ProductionReport) => {
                              // 🛠 SMART AVAILABLE CALCULATION: 
                              // Subtract both officially approved usedQuantity AND pending consumptions from other reports
                              // FIX: Use explicit string type for the captured variable to avoid 'unknown' index error in closures
                              const targetId: string = String(reportItem.id);
                              const pendingUsed = reports
                                .filter((other: ProductionReport) => {
                                  // FIX: Access sourceConsumption safely by ensuring targetId is valid string key
                                  // Using explicit cast to Record<string, number> for indexing to avoid 'unknown' index type errors
                                  const consumption = other.sourceConsumption as Record<string, number> | undefined;
                                  // Explicitly cast targetId to string to satisfy TypeScript index signature requirements in nested closure
                                  return other.status === 'pending' && !!consumption && (consumption as Record<string, number>)[targetId as string] !== undefined;
                                })
                                .reduce((sum: number, other: ProductionReport) => {
                                  // FIX: Access sourceConsumption safely using verified string key
                                  const consumption = other.sourceConsumption as Record<string, number> | undefined;
                                  // Explicitly cast targetId to string to satisfy TypeScript index signature requirements in nested closure
                                  const val = (consumption && (consumption as Record<string, number>)[targetId as string]) || 0;
                                  return sum + val;
                                }, 0);
                              
                              return {
                                  ...reportItem,
                                  availableNow: reportItem.quantity - (reportItem.usedQuantity || 0) - pendingUsed
                              };
                          }).filter(r => r.availableNow > 0);

                          groups.push({
                              name: compName || 'Компонент',
                              qty: requiredQtyPerUnit,
                              totalNeeded: reportQty * requiredQtyPerUnit,
                              availableBatches: available,
                              selectedBatchIds: new Set(),
                              selectedTotal: 0
                          });
                      }
                      setConsumptionGroups(groups);
                  } else {
                      setConsumptionGroups([]);
                  }
              } else {
                  setActiveSetupMap(null);
                  setConsumptionGroups([]);
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
      
      if (newSet.has(batchId)) newSet.delete(batchId); else newSet.add(batchId);
      
      group.selectedBatchIds = newSet;
      group.selectedTotal = group.availableBatches
        .filter(b => newSet.has(b.id))
        .reduce((sum, b) => sum + (b.availableNow || 0), 0);

      setConsumptionGroups(newGroups);
  };

  const handleSubmit = async () => {
    if (!selectedTaskId) { alert("Оберіть завдання!"); return; }
    if (!isSimpleTask && (!qty || Number(qty) <= 0)) { alert("Введіть кількість виробленої продукції!"); return; }

    setIsSubmitting(true);
    try {
        const currentTask = tasks.find(t => t.id === selectedTaskId);
        const currentOrder = currentTask?.orderId ? orders.find(o => o.id === currentTask.orderId) : null;
        const qtyNumber = isSimpleTask ? 0 : Number(qty);
        const scrapNumber = isSimpleTask ? 0 : (Number(scrap) || 0);

        const consumptionPayload: Record<string, number> = {};
        consumptionGroups.forEach(group => {
            let needed = group.totalNeeded;
            Array.from(group.selectedBatchIds).forEach(bId => {
                if (needed <= 0) return;
                const batch = group.availableBatches.find(b => b.id === bId);
                if (batch) {
                    const take = Math.min(batch.availableNow || 0, needed);
                    consumptionPayload[bId] = take;
                    needed -= take;
                }
            });
        });

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
            sourceBatchIds: Object.keys(consumptionPayload),
            sourceConsumption: consumptionPayload,
            usedQuantity: 0,
            taskTitle: currentTask?.title || 'Unknown Task',
            orderNumber: currentOrder?.orderNumber || 'Simple Task',
            stageName: isSimpleTask ? 'Загальне' : currentTask?.title,
            batchCode: isSimpleTask ? '-' : (batchCode || 'Без маркування')
        };

        const reportRef = await addDoc(collection(db, "reports"), newReportPayload);

        if (!isSimpleTask && selectedTaskId) {
            await updateDoc(doc(db, 'tasks', selectedTaskId), {
                pendingQuantity: increment(qtyNumber),
                updatedAt: serverTimestamp()
            });
        }

        await API.sendNotification('admin', `Новий звіт від ${currentUser?.firstName}`, 'info', reportRef.id, 'admin', 'Новий звіт');

        setIsFormOpen(false);
        setSelectedTaskId(''); setQty(''); setScrap(''); setNote(''); setBatchCode(''); setConsumptionGroups([]); setActiveSetupMap(null);
    } catch (e: any) {
        alert(`Помилка: ${e.message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  const myActiveTasks = currentUser ? tasks.filter(t => t.assigneeIds?.includes(currentUser.id) && ['todo', 'in_progress'].includes(t.status)) : [];
  const pendingReports = reports.filter(r => r.status === 'pending');

  const filteredHistory = reports.filter(r => {
      let matchesSearch = true;
      if (historySearch) {
        const term = historySearch.toLowerCase();
        matchesSearch = (r.taskTitle?.toLowerCase().includes(term) || r.orderNumber?.toLowerCase().includes(term) || r.batchCode?.toLowerCase().includes(term));
      }
      return matchesSearch;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const isAllSelected = filteredHistory.length > 0 && selectedReportIds.size === filteredHistory.length;

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedReportIds(new Set());
    else setSelectedReportIds(new Set(filteredHistory.map(r => r.id)));
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedReportIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
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
    let newQty = Math.max(0, editLockedTotal - newScrap);
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
      await API.updateReport(editingReport.id, { quantity: Number(editQty), scrapQuantity: Number(editScrap), notes: editNote });
      setIsEditModalOpen(false);
      setEditingReport(null);
    } catch (e) { alert("Error updating report"); } finally { setIsSubmitting(false); }
  };

  const handleApprove = async (report: ProductionReport) => {
    try { await API.approveReport(report.id, report); } catch (e) { alert("Error approving report"); }
  };

  const handleReject = async (report: ProductionReport) => {
    try { await API.rejectReport(report.id, report); } catch (e) { alert("Error rejecting report"); }
  };

  const handleExportExcel = () => {
    const itemsToExport = selectedReportIds.size > 0 ? reports.filter(r => selectedReportIds.has(r.id)) : filteredHistory;
    const headers = "Дата;Працівник;Завдання;Замовлення;Партія;Кількість;Брак;Статус;Нотатки\n";
    const rows = itemsToExport.map(r => `${new Date(r.createdAt).toLocaleString()};${r.userId};${r.taskTitle};${r.orderNumber};${r.batchCode};${r.quantity};${r.scrapQuantity};${r.status};${r.notes}`).join("\n");
    const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zvit_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  if (currentUser && currentUser.role === 'worker') {
    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div><h1 className="text-2xl font-bold text-gray-900">Щоденні звіти</h1><p className="text-gray-500">Подати звіт про виконану роботу</p></div>
          <button onClick={() => setIsFormOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center shadow-lg hover:bg-slate-800 transition-transform active:scale-95"><Plus size={20} className="mr-2"/> Сформувати звіт</button>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
           <div className="bg-gray-50 px-6 py-4 border-b font-bold text-gray-700">Моя історія звітів</div>
           <div className="divide-y divide-gray-100">
             {reports.filter(r => r.userId === currentUser.id).slice(0, 15).map(report => (
                 <div key={report.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div>
                       <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit mb-1">{report.orderNumber} {report.batchCode !== '-' && `• ${report.batchCode}`}</div>
                       <div className="font-bold text-gray-900">{report.taskTitle}</div>
                       <div className="text-sm text-gray-500">{new Date(report.createdAt).toLocaleString('uk-UA')}</div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                       <div><span className="block font-bold text-lg text-gray-800">{report.quantity} шт</span>{report.scrapQuantity > 0 && <span className="text-xs text-red-500 font-bold">{report.scrapQuantity} брак</span>}</div>
                       <div><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${report.status === 'approved' ? 'bg-green-100 text-green-700' : report.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{report.status === 'approved' ? 'Прийнято' : report.status === 'rejected' ? 'Відхилено' : 'Очікує'}</span></div>
                    </div>
                 </div>
             ))}
           </div>
        </div>

        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
             <div className="bg-white rounded-xl shadow-2xl w-full max-md p-6 my-auto">
                <h2 className="text-xl font-bold mb-6">Новий звіт</h2>
                <div className="space-y-4">
                   <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Оберіть завдання</label>
                      <select className="w-full p-3 border rounded-lg bg-gray-50 font-bold" value={selectedTaskId} onChange={e => setSelectedTaskId(e.target.value)}>
                        <option value="">-- Активні завдання --</option>
                        {myActiveTasks.map(t => <option key={t.id} value={t.id}>[{t.type === 'simple' ? 'ПРОСТЕ' : 'ВИРОБН.'}] {t.title}</option>)}
                      </select>
                   </div>
                   {selectedTaskId && !isSimpleTask && (
                      <div className="animate-fade-in space-y-4">
                        <div><label className="block text-sm font-bold text-gray-700 mb-1">Номер партії / Зміна</label><input type="text" className="w-full p-3 border rounded-lg bg-white font-bold" value={batchCode} onChange={e => setBatchCode(e.target.value)} placeholder={isManufacturing ? "Введіть номер партії..." : "Напр. П-1 або Нічна"}/></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Вироблено (шт)</label><input type="number" className="w-full p-3 border rounded-lg font-black text-xl" value={qty} onChange={e => setQty(e.target.value)}/></div>
                            <div><label className="block text-sm font-bold text-red-600 mb-1">Брак (шт)</label><input type="number" className="w-full p-3 border rounded-lg border-red-200 bg-red-50 text-red-700 font-bold" value={scrap} onChange={e => setScrap(e.target.value)}/></div>
                        </div>
                        {isAssembly && consumptionGroups.length > 0 && Number(qty) > 0 && (
                            <div className="space-y-3 animate-fade-in">
                                {consumptionGroups.map((group, gIdx) => {
                                    if (group.availableBatches.length === 0) return null;
                                    return (
                                        <div key={gIdx} className="bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-sm">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs font-bold text-blue-800 uppercase flex items-center"><Package size={12} className="mr-1"/> Збірка: {group.name}</label>
                                                <span className={`text-[10px] font-black ${group.selectedTotal >= group.totalNeeded ? 'text-green-600' : 'text-blue-600'}`}>Обрано: {group.selectedTotal} / {group.totalNeeded}</span>
                                            </div>
                                            <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                                {group.availableBatches.map(batch => (
                                                    <div key={batch.id} onClick={() => toggleBatchSelection(gIdx, batch.id)} className={`p-2 rounded border text-[10px] cursor-pointer flex justify-between items-center transition-all ${group.selectedBatchIds.has(batch.id) ? 'bg-blue-600 border-blue-600 text-white font-bold' : 'bg-white border-gray-200 hover:bg-blue-50'}`}>
                                                        <div className="flex items-center truncate"><div className={`w-3 h-3 rounded border mr-2 flex items-center justify-center shrink-0 ${group.selectedBatchIds.has(batch.id) ? 'bg-white' : 'bg-white border-gray-300'}`}>{group.selectedBatchIds.has(batch.id) && <Check size={8} className="text-blue-600"/>}</div><span className="truncate">{batch.batchCode}</span></div>
                                                        <span className="font-mono font-bold ml-2 shrink-0">{batch.availableNow} шт</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                      </div>
                   )}
                   <div><label className="block text-sm font-bold text-gray-700 mb-1">Нотатка / Коментар (опціонально)</label><textarea className="w-full p-3 border rounded-lg h-20 resize-none outline-none focus:ring-2 focus:ring-slate-500" placeholder="Опишіть що було зроблено..." value={note} onChange={e => setNote(e.target.value)}/></div>
                </div>
                <div className="flex gap-3 mt-6">
                   <button onClick={() => setIsFormOpen(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors">Скасувати</button>
                   <button onClick={handleSubmit} disabled={isSubmitting || !selectedTaskId} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex justify-center items-center transition-all shadow-lg active:scale-95">{isSubmitting ? <Loader size={16} className="animate-spin"/> : 'Відправити звіт'}</button>
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
           <h2 className="font-bold text-gray-500 uppercase text-xs tracking-wider flex items-center mb-4"><AlertCircle size={16} className="mr-2 text-yellow-500"/> Очікують підтвердження ({pendingReports.length})</h2>
           {pendingReports.length === 0 && <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl"><CheckCircle size={48} className="text-gray-200 mx-auto mb-2"/><div className="text-gray-400 text-sm font-medium">Всі звіти перевірено</div></div>}
           {pendingReports.map(report => (
                <div key={report.id} className="bg-white p-4 rounded-xl border border-yellow-200 shadow-sm relative overflow-visible transition-all hover:shadow-md group">
                   <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400 rounded-l-xl"></div>
                   <div className="flex justify-between items-start mb-2 pl-2">
                      <div><div className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded w-fit mb-1">{report.batchCode}</div><h3 className="font-bold text-gray-900">{report.taskTitle}</h3><div className="text-xs text-gray-500 mt-1"><span>{new Date(report.createdAt).toLocaleTimeString()}</span></div></div>
                      <div className="text-right pr-2"><div className="text-2xl font-bold text-gray-800">{report.quantity} <span className="text-sm font-normal text-gray-400">шт</span></div><button onClick={(e) => handleEditReport(e, report)} className="text-xs text-blue-600 hover:underline mt-1 flex items-center justify-end"><Pencil size={10} className="mr-1"/> Редагувати</button></div>
                   </div>
                   <div className="flex gap-2 ml-2 mt-2">
                      <button onClick={() => handleApprove(report)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-bold transition-colors shadow-sm">Затвердити</button>
                      <button onClick={() => handleReject(report)} className="flex-1 bg-white border border-red-100 text-red-500 hover:bg-red-50 py-2 rounded-lg text-sm font-bold transition-colors">Відхилити</button>
                   </div>
                </div>
           ))}
        </div>
        <div className="flex flex-col h-[calc(100vh-150px)]">
           <div className="flex justify-between items-center mb-4 shrink-0"><div className="flex items-center"><button onClick={toggleSelectAll} className={`mr-3 ${isAllSelected ? 'text-blue-600' : 'text-gray-400'}`}>{isAllSelected ? <CheckSquare size={20}/> : <Square size={20}/>}</button><h2 className="font-bold text-gray-500 uppercase text-xs tracking-wider">Історія</h2></div><button onClick={handleExportExcel} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center transition-colors"><Download size={14} className="mr-1"/> Експорт</button></div>
           <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm mb-4 shrink-0"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input placeholder="Пошук..." className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg" value={historySearch} onChange={e => setHistorySearch(e.target.value)}/></div></div>
           <div className="bg-white rounded-xl border border-gray-200 overflow-y-auto flex-1 shadow-sm custom-scrollbar">
              {filteredHistory.map(report => (
                <div key={report.id} className={`p-4 border-b group flex items-start gap-3 relative ${selectedReportIds.has(report.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`} onClick={() => toggleSelect(report.id)}>
                   <div className="mt-1">{selectedReportIds.has(report.id) ? <CheckSquare size={18} className="text-blue-600"/> : <Square size={18} className="text-gray-300"/>}</div>
                   <div className="flex-1">
                       <div className="flex justify-between items-start"><div><div className="text-sm font-bold text-gray-900">{report.taskTitle}</div><div className="text-xs text-gray-500">Замовлення: {report.orderNumber} • Партія: {report.batchCode}</div></div><div className="text-right"><div className="font-bold text-gray-900 text-lg">{report.quantity} шт</div><div className={`text-[10px] uppercase font-bold ${report.status === 'approved' ? 'text-green-600' : 'text-yellow-600'}`}>{report.status === 'approved' ? 'Прийнято' : 'Очікує'}</div></div></div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
      {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-sm p-6"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Редагувати звіт</h3><button onClick={() => setIsEditModalOpen(false)}><X size={20} className="text-gray-400"/></button></div><div className="space-y-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">Придатні (шт)</label><input type="number" className="w-full p-2 border rounded-lg font-bold" value={editQty} onChange={e => handleEditQtyChange(e.target.value)}/></div><div><label className="block text-sm font-bold text-red-600 mb-1">Брак (шт)</label><input type="number" className="w-full p-2 border rounded-lg border-red-200 bg-red-50 font-bold text-red-700" value={editScrap} onChange={e => handleEditScrapChange(e.target.value)}/></div><div><label className="block text-sm font-bold text-gray-700 mb-1">Нотатка</label><textarea className="w-full p-2 border rounded-lg h-20 resize-none" value={editNote} onChange={e => setEditNote(e.target.value)}/></div></div><div className="flex gap-2 mt-6"><button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Скасувати</button><button onClick={handleSaveEditedReport} disabled={isSubmitting} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center transition-all">{isSubmitting ? <Loader size={16} className="animate-spin"/> : <Save size={16}/>}</button></div></div></div>
      )}
    </div>
  );
};
