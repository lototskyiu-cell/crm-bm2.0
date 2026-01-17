
import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import { Order, Product, JobCycle, Task } from '../types';
import { SearchableSelect } from '../components/SearchableSelect';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { Plus, Calendar, Box, X, Pencil, Trash2, Loader, Settings } from 'lucide-react';

export const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newOrder, setNewOrder] = useState<Partial<Order>>({ status: 'pending', progress: 0, orderNumber: '' });
  
  // Cycles State for dropdown
  const [availableCycles, setAvailableCycles] = useState<JobCycle[]>([]);

  // Delete State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let unsubscribeOrders: () => void;
    let unsubscribeTasks: () => void;

    const initData = async () => {
      try {
        // Fetch Products once
        const productsData = await API.getProducts();
        setProducts(productsData);

        // Real-time listener for Orders
        unsubscribeOrders = API.subscribeToOrders((data) => {
          setOrders(data);
          setIsLoading(false); // Can be triggered by either first
        });

        // Real-time listener for Tasks (To calculate progress correctly)
        unsubscribeTasks = API.subscribeToTasks((data) => {
            setTasks(data);
        });

      } catch (e) {
        console.error("Failed to init orders page", e);
        setIsLoading(false);
      }
    };

    initData();

    return () => {
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeTasks) unsubscribeTasks();
    };
  }, []);

  const getProduct = (id: string) => products.find(p => p.id === id);

  const getOrderProgress = (order: Order) => {
      // Find all tasks for this order
      const orderTasks = tasks.filter(t => t.orderId === order.id);
      
      if (orderTasks.length === 0) return order.progress || 0; // Fallback to manual if no tasks

      // Find the FINAL stage task
      // Priority 1: Task marked as final stage
      let finalTask = orderTasks.find(t => t.isFinalStage);
      
      // Priority 2: Fallback logic if legacy data (no isFinalStage)
      // We assume the task created LAST is the final one (sorted by date)
      if (!finalTask && orderTasks.length > 0) {
          // Sort by creation time desc
          finalTask = orderTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      }

      if (finalTask) {
          // Calculate %
          const percent = (finalTask.completedQuantity || 0) / (order.quantity || 1) * 100;
          return Math.min(100, Math.round(percent));
      }

      return order.progress || 0;
  };

  const getOrderCompletedCount = (order: Order) => {
      const orderTasks = tasks.filter(t => t.orderId === order.id);
      if (orderTasks.length === 0) return Math.round(order.quantity * ((order.progress || 0) / 100));

      let finalTask = orderTasks.find(t => t.isFinalStage);
      
      // Fallback
      if (!finalTask && orderTasks.length > 0) {
          finalTask = orderTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      }

      if (finalTask) return finalTask.completedQuantity || 0;
      
      return Math.round(order.quantity * ((order.progress || 0) / 100));
  };

  const handleCreate = async () => {
    if (!newOrder.productId || !newOrder.quantity || !newOrder.deadline || !newOrder.orderNumber) {
        alert("Будь ласка, заповніть всі обов'язкові поля:\n- Номер замовлення\n- Виріб\n- Кількість\n- Дедлайн");
        return;
    }
    
    setIsSaving(true);

    const order: Order = {
      id: editingId || `ord_temp_${Date.now()}`,
      orderNumber: newOrder.orderNumber, 
      productId: newOrder.productId,
      quantity: Number(newOrder.quantity),
      deadline: newOrder.deadline,
      status: newOrder.status || 'pending',
      progress: newOrder.progress || 0,
      customerName: newOrder.customerName || '',
      createdAt: editingId 
        ? orders.find(o => o.id === editingId)?.createdAt || new Date().toISOString()
        : new Date().toISOString().split('T')[0],
      workCycleId: newOrder.workCycleId,
      workCycleName: newOrder.workCycleName
    };

    try {
        await API.saveOrder(order);
        
        // --- TRIGGER NOTIFICATION FOR ADMIN ---
        if (!editingId) {
            const product = getProduct(order.productId);
            await API.sendNotification(
                'admin', 
                `Нове замовлення: ${order.orderNumber} (${product?.name || 'Виріб'}) - ${order.quantity} шт.`,
                'info',
                undefined,
                'admin', // Target
                'Нове замовлення' // Title
            );
        }

        setIsModalOpen(false);
    } catch (e) {
        alert("Error saving order");
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
      if (!deleteConfirmId) return;
      setIsDeleting(true);
      try {
          await API.deleteOrder(deleteConfirmId);
          setDeleteConfirmId(null);
      } catch (e) {
          alert("Error deleting order");
      } finally {
          setIsDeleting(false);
      }
  };

  const handleEdit = async (order: Order) => {
    setEditingId(order.id);
    setNewOrder({ ...order });
    
    // Fetch cycles for existing product
    if (order.productId) {
        const cycles = await API.getJobCyclesByProduct(order.productId);
        setAvailableCycles(cycles);
    }
    
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setNewOrder({ status: 'pending', progress: 0, orderNumber: '' });
    setAvailableCycles([]);
    setIsModalOpen(true);
  };

  const handleProductSelect = async (productId: string) => {
      setNewOrder({...newOrder, productId, workCycleId: undefined, workCycleName: undefined}); // Reset cycle
      const cycles = await API.getJobCyclesByProduct(productId);
      setAvailableCycles(cycles);
  };

  const handleCycleSelect = (cycleId: string) => {
      const cycle = availableCycles.find(c => c.id === cycleId);
      setNewOrder({...newOrder, workCycleId: cycleId, workCycleName: cycle?.name});
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader className="animate-spin text-blue-600"/></div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Замовлення</h1>
          <p className="text-gray-500">Партії виробництва (Firestore Sync)</p>
        </div>
        <button onClick={handleOpenNew} className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center hover:bg-slate-800 transition-colors shadow-lg">
          <Plus size={20} className="mr-2" />
          Створити замовлення
        </button>
      </div>

      <div className="space-y-4">
        {orders.length === 0 && <div className="text-center text-gray-400 py-10">Список замовлень порожній</div>}
        {orders.map(order => {
          const product = getProduct(order.productId);
          const dynamicProgress = getOrderProgress(order);
          const completedCount = getOrderCompletedCount(order);

          return (
            <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm hover:shadow-md transition-shadow group relative">
              {/* Product Info */}
              <div className="flex items-center w-full md:w-1/3">
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-100">
                  {product?.photo ? <img src={product.photo} className="w-full h-full object-cover"/> : <Box className="m-auto text-gray-400"/>}
                </div>
                <div className="ml-4">
                   <div className="text-xs font-bold text-blue-600">{order.orderNumber}</div>
                   <h3 className="font-bold text-gray-900">{product?.name || 'Unknown Product'}</h3>
                   <div className="text-sm text-gray-500">{order.customerName}</div>
                   {order.workCycleName && (
                       <div className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded w-fit mt-1 flex items-center">
                           <Settings size={10} className="mr-1"/> {order.workCycleName}
                       </div>
                   )}
                </div>
              </div>

              {/* Progress */}
              <div className="flex-1 w-full">
                <div className="flex justify-between text-sm mb-2">
                   <span className="font-medium text-gray-700">Прогрес (Фініш)</span>
                   <span className="font-bold text-gray-900">{dynamicProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                   <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${dynamicProgress}%` }}></div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                   <span>Замовлено: {order.quantity} шт</span>
                   <span>Готово: {completedCount} шт</span>
                </div>
              </div>

              {/* Meta & Actions */}
              <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-4 md:gap-1">
                 <div className="flex items-center text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-lg">
                    <Calendar size={14} className="mr-2" />
                    {order.deadline}
                 </div>
                 <div className={`text-xs px-2 py-1 rounded font-bold uppercase ${order.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {order.status === 'in_progress' ? 'В роботі' : order.status}
                 </div>
              </div>
              
              {/* Context Actions (Always Visible) */}
              <div className="absolute top-2 right-2 flex gap-1 bg-white p-1 rounded-lg shadow-sm">
                 <button onClick={() => handleEdit(order)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                    <Pencil size={16}/>
                 </button>
                 <button onClick={() => handleDelete(order.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={16}/>
                 </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-visible">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                 <h3 className="text-lg font-bold">{editingId ? 'Редагувати замовлення' : 'Створити замовлення'}</h3>
                 <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400"/></button>
              </div>
              <div className="p-6 space-y-4">
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Номер замовлення</label>
                    <input 
                        value={newOrder.orderNumber || ''} 
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-slate-500 outline-none font-bold" 
                        placeholder="Напр: 254-Б або Замовлення №1" 
                        onChange={e => setNewOrder({...newOrder, orderNumber: e.target.value})}
                        autoFocus 
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Виріб</label>
                    <SearchableSelect 
                        value={newOrder.productId || ''}
                        onChange={handleProductSelect}
                        options={products.map(p => ({
                            value: p.id,
                            label: p.name,
                            subLabel: p.sku,
                            image: p.photo
                        }))}
                        placeholder="Оберіть виріб..."
                    />
                 </div>

                 {newOrder.productId && (
                     <div className="animate-fade-in">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Техпроцес (Work Cycle)</label>
                        {availableCycles.length > 0 ? (
                            <select 
                                value={newOrder.workCycleId || ''} 
                                onChange={(e) => handleCycleSelect(e.target.value)}
                                className="w-full p-2.5 border border-blue-200 rounded-lg bg-blue-50 text-blue-900 font-medium outline-none"
                            >
                                <option value="">-- Оберіть цикл виробництва --</option>
                                {availableCycles.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">
                                Для цього виробу не створено жодного циклу робіт (Tech Process).
                            </div>
                        )}
                     </div>
                 )}

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Кількість (шт)</label>
                       <input type="number" value={newOrder.quantity || ''} className="w-full p-2.5 border rounded-lg" onChange={e => setNewOrder({...newOrder, quantity: Number(e.target.value)})} />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Дедлайн</label>
                       <input type="date" value={newOrder.deadline || ''} className="w-full p-2.5 border rounded-lg" onChange={e => setNewOrder({...newOrder, deadline: e.target.value})} />
                    </div>
                 </div>
              </div>
              <div className="p-6 border-t flex justify-end">
                 <button 
                    onClick={handleCreate} 
                    disabled={isSaving}
                    className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    {isSaving && <Loader size={16} className="animate-spin mr-2"/>}
                    {editingId ? 'Зберегти' : 'Створити'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {deleteConfirmId && (
        <DeleteConfirmModal 
            isOpen={!!deleteConfirmId}
            title="Видалити замовлення?"
            message="Ви впевнені? Це незворотня дія."
            onClose={() => setDeleteConfirmId(null)}
            onConfirm={confirmDelete}
            isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
