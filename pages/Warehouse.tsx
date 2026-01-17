
import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { Task, Order, ProductionReport, Product } from '../types';
import { Archive, Plus, Minus, Search, Filter, Loader, X, Save, Trash2, Box } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, increment } from "firebase/firestore";
import { db } from "../services/firebase";

interface WIPItem {
  taskId: string;
  orderNumber: string;
  productName: string;
  stageName: string;
  produced: number;
  used: number;
  balance: number;
  isFinalStage: boolean;
}

export const Warehouse: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<ProductionReport[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Manual Stock Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'deduct'>('add');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [manualQty, setManualQty] = useState<number | string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      // setIsLoading(true); // Optional: Only set loading on initial load or full refresh
      const [tasksData, ordersData, reportsData, productsData] = await Promise.all([
        API.getTasks(),
        API.getOrders(),
        new Promise<ProductionReport[]>((resolve) => {
           const unsub = API.subscribeToReports((data) => {
               resolve(data);
               unsub();
           });
        }),
        API.getProducts()
      ]);
      setTasks(tasksData);
      setOrders(ordersData);
      setReports(reportsData);
      setProducts(productsData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getWIPInventory = (): WIPItem[] => {
    return tasks
      .filter(t => t.type === 'production' && t.status !== 'archived') // Only production tasks, exclude archived
      .map(task => {
        const order = orders.find(o => o.id === task.orderId);
        const product = products.find(p => p.id === order?.productId);
        
        // Calculate totals from approved reports (Production + Manual Stock +/-)
        const taskReports = reports.filter(r => r.taskId === task.id && r.status === 'approved');
        
        const produced = taskReports.reduce((sum, r) => sum + r.quantity, 0); // Quantity can be negative for deduction
        const used = taskReports.reduce((sum, r) => sum + (r.usedQuantity || 0), 0);
        
        return {
          taskId: task.id,
          orderNumber: order?.orderNumber || '???',
          productName: product?.name || 'Unknown Product',
          stageName: task.title,
          produced,
          used,
          balance: produced - used,
          isFinalStage: !!task.isFinalStage
        };
      })
      .filter(item => 
         item.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
         item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
         item.stageName.toLowerCase().includes(searchTerm.toLowerCase())
      );
  };

  const inventory = getWIPInventory();

  const handleOpenModal = (task: Task, mode: 'add' | 'deduct') => {
      setSelectedTask(task);
      setModalMode(mode);
      setManualQty('');
      setIsModalOpen(true);
  };

  const handleArchiveTask = async (task: Task) => {
      if (!confirm(`Архівувати завдання "${task.title}"? Воно зникне зі списку складу, але залишиться в історії.`)) return;
      
      try {
          // Optimistic UI Update: Remove from local state immediately
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'archived' } : t));
          
          await API.updateTaskStatus(task.id, 'archived');
          // No need to fetch data again if optimistic update works
      } catch (e) {
          console.error(e);
          alert("Помилка архівування");
      }
  };

  const handleSaveStock = async () => {
      if (!selectedTask || !manualQty) return;
      setIsSubmitting(true);
      try {
          // 1. Prepare Data
          const order = orders.find(o => o.id === selectedTask.orderId);
          const product = products.find(p => p.id === order?.productId);
          
          let qty = Number(manualQty);
          if (modalMode === 'deduct') {
              qty = -Math.abs(qty); // Ensure negative
          } else {
              qty = Math.abs(qty); // Ensure positive
          }

          // 2. Create Payload with Snapshots
          const reportPayload = {
              taskId: selectedTask.id,
              userId: 'admin_manual', // Marker for admin actions
              date: new Date().toISOString().split('T')[0],
              quantity: qty,
              scrapQuantity: 0,
              notes: modalMode === 'add' ? `Manual Stock Added by Admin` : `Manual Deduction (Write-off) by Admin`,
              status: 'approved',
              type: modalMode === 'add' ? 'manual_stock' : 'manual_deduction',
              createdAt: new Date().toISOString(),
              usedQuantity: 0,
              // SNAPSHOTS (Fixes "Deleted Task" issue)
              taskTitle: selectedTask.title,
              orderNumber: order?.orderNumber || 'Unknown Order',
              stageName: selectedTask.title,
              productName: product?.name || 'Unknown Product' 
          };

          // 3. Save to Firestore
          await addDoc(collection(db, "reports"), reportPayload);

          // 4. Update Task Progress (Atomic)
          const taskRef = doc(db, "tasks", selectedTask.id);
          await updateDoc(taskRef, {
              factQuantity: increment(qty)
          });

          // 5. Close & Refresh (NO RELOAD)
          setIsModalOpen(false);
          await fetchData(); // Re-fetch data to show new totals
          
      } catch (e) {
          console.error(e);
          alert("Помилка оновлення залишку");
      } finally {
          setIsSubmitting(false);
      }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader className="animate-spin text-blue-600"/></div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Склад незавершеного виробництва (WIP)</h1>
          <p className="text-gray-500">Залишки на етапах виробництва</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex gap-4">
         <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input 
              placeholder="Пошук по замовленню, виробу або етапу..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
         <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b">
               <tr>
                  <th className="p-4">Замовлення</th>
                  <th className="p-4">Виріб</th>
                  <th className="p-4">Етап (Завдання)</th>
                  <th className="p-4 text-center">Вироблено</th>
                  <th className="p-4 text-center">Використано</th>
                  <th className="p-4 text-right">Баланс (Доступно)</th>
                  <th className="p-4 text-right">Дії</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {inventory.length === 0 && (
                   <tr><td colSpan={7} className="p-8 text-center text-gray-400">Немає активних виробничих етапів</td></tr>
               )}
               {inventory.map(item => (
                   <tr key={item.taskId} className="hover:bg-gray-50 transition-colors group">
                       <td className="p-4 font-bold text-blue-600">{item.orderNumber}</td>
                       <td className="p-4 text-gray-700">{item.productName}</td>
                       <td className="p-4 font-medium">
                           {item.stageName}
                           {item.isFinalStage && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">FINAL</span>}
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
                                 onClick={() => handleOpenModal(tasks.find(t => t.id === item.taskId)!, 'add')}
                                 className="text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 p-2 rounded-lg transition-colors"
                                 title="Додати залишок (+)"
                               >
                                   <Plus size={16}/>
                               </button>
                               <button 
                                 onClick={() => handleOpenModal(tasks.find(t => t.id === item.taskId)!, 'deduct')}
                                 className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                                 title="Списати залишок (-)"
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

      {isModalOpen && selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">
                          {modalMode === 'add' ? 'Додати залишок' : 'Списати залишок'}
                      </h3>
                      <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400"/></button>
                  </div>
                  <div className={`mb-4 p-3 rounded-lg text-xs border ${modalMode === 'add' ? 'bg-green-50 text-green-800 border-green-100' : 'bg-red-50 text-red-800 border-red-100'}`}>
                      {modalMode === 'add' 
                        ? `Ви додаєте деталі на етап "${selectedTask.title}".`
                        : `Ви списуєте деталі з етапу "${selectedTask.title}". Введіть додатне число, система відніме його.`
                      }
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Кількість (шт)</label>
                          <input 
                            type="number" 
                            className="w-full p-3 border rounded-lg font-bold text-lg"
                            autoFocus
                            placeholder="0"
                            value={manualQty}
                            onChange={e => setManualQty(Number(e.target.value))}
                          />
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Скасувати</button>
                      <button 
                        onClick={handleSaveStock} 
                        disabled={isSubmitting || !manualQty} 
                        className={`flex-1 py-2 text-white font-bold rounded-lg disabled:opacity-50 flex justify-center items-center ${modalMode === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                      >
                          {isSubmitting ? <Loader size={16} className="animate-spin"/> : (modalMode === 'add' ? 'Додати' : 'Списати')}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
