import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sliders, 
  Scissors, 
  Users, 
  BarChart3, 
  Power, 
  Pause, 
  Clock, 
  Plus, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink,
  DollarSign,
  UserCheck,
  UserX,
  AlertTriangle
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher.js';
import { useSocket } from '../../hooks/useSocket.js';
import {
  fetchAdminDashboard,
  createAdminService,
  updateAdminService,
  deleteAdminService,
  toggleAdminService,
  createAdminBarber,
  updateAdminBarber,
  deleteAdminBarber,
  setAdminBarberDuty,
  updateAdminQueueStatus,
  updateAdminQueueHours,
} from '../../lib/api.js';

interface ServiceItem {
  id: string;
  nameEn: string;
  nameGu?: string | null;
  nameHi?: string | null;
  durationMinutes: number;
  price: number;
  active: boolean;
  orderIndex: number;
  timesUsed: number;
}

interface BarberItem {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
  active: boolean;
  workingToday: boolean;
  status: string;
  isOccupied: boolean;
  customersServedToday: number;
}

interface AdminData {
  services: ServiceItem[];
  barbers: BarberItem[];
  queueSettings: {
    isOpen: boolean;
    isPaused: boolean;
    openingTime: string;
    closingTime: string;
    salonName: string;
    totalWaiting: number;
  };
  dailyStats: {
    customersServedToday: number;
    averageWaitMinutes: number;
    totalNoShows: number;
    totalCancelled: number;
    totalJoinedToday: number;
    totalRevenue: number;
  };
}

export const AdminPage: React.FC = () => {
  const { t } = useLanguage();
  const { socket, isConnected } = useSocket();

  const [activeTab, setActiveTab] = useState<'services' | 'barbers' | 'queue' | 'stats'>('services');
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Service Modal state
  const [serviceModal, setServiceModal] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    serviceId?: string;
    nameEn: string;
    nameGu: string;
    nameHi: string;
    durationMinutes: number;
    price: number;
    active: boolean;
  }>({
    open: false,
    mode: 'add',
    nameEn: '',
    nameGu: '',
    nameHi: '',
    durationMinutes: 30,
    price: 150,
    active: true,
  });

  // Barber Modal state
  const [barberModal, setBarberModal] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    barberId?: string;
    name: string;
    workingToday: boolean;
    active: boolean;
  }>({
    open: false,
    mode: 'add',
    name: '',
    workingToday: true,
    active: true,
  });

  // Hours form state
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('23:00');

  // Confirmation dialogs
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'service' | 'barber';
    id: string;
    name: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load admin dashboard
  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchAdminDashboard();
      setData(res);
      setOpeningTime(res.queueSettings.openingTime);
      setClosingTime(res.queueSettings.closingTime);
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err);
      showToast('error', err.message || 'Failed to load dashboard data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Socket.IO real-time synchronization
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      loadDashboard(true);
    };

    socket.on('queue:updated', handleUpdate);
    socket.on('settings:updated', handleUpdate);
    socket.on('barber:status_changed', handleUpdate);

    return () => {
      socket.off('queue:updated', handleUpdate);
      socket.off('settings:updated', handleUpdate);
      socket.off('barber:status_changed', handleUpdate);
    };
  }, [socket, loadDashboard]);

  // Handler: Toggle queue open/closed
  const handleToggleQueueOpen = async () => {
    if (!data) return;
    setActionLoading(true);
    try {
      const nextOpen = !data.queueSettings.isOpen;
      await updateAdminQueueStatus({ isOpen: nextOpen });
      showToast('success', nextOpen ? 'Live queue is now OPEN' : 'Live queue is now CLOSED to online joiners');
      await loadDashboard(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to toggle queue open status');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Save Salon Operating Hours
  const handleSaveHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await updateAdminQueueHours({ openingTime, closingTime });
      showToast('success', `Hours saved: ${openingTime} to ${closingTime}`);
      await loadDashboard(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save salon hours');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Save Service (Add / Edit)
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (serviceModal.mode === 'add') {
        await createAdminService({
          nameEn: serviceModal.nameEn,
          nameGu: serviceModal.nameGu || undefined,
          nameHi: serviceModal.nameHi || undefined,
          durationMinutes: Number(serviceModal.durationMinutes),
          price: Number(serviceModal.price),
          active: serviceModal.active,
        });
        showToast('success', `Service '${serviceModal.nameEn}' created.`);
      } else if (serviceModal.serviceId) {
        await updateAdminService(serviceModal.serviceId, {
          nameEn: serviceModal.nameEn,
          nameGu: serviceModal.nameGu || undefined,
          nameHi: serviceModal.nameHi || undefined,
          durationMinutes: Number(serviceModal.durationMinutes),
          price: Number(serviceModal.price),
          active: serviceModal.active,
        });
        showToast('success', `Service '${serviceModal.nameEn}' updated.`);
      }
      setServiceModal({ ...serviceModal, open: false });
      await loadDashboard(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save service');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Delete Service
  const handleDeleteService = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'service') return;
    setActionLoading(true);
    try {
      await deleteAdminService(deleteConfirm.id);
      showToast('success', `Service '${deleteConfirm.name}' deleted.`);
      setDeleteConfirm(null);
      await loadDashboard(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete service');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Toggle Service Active
  const handleToggleService = async (serviceId: string) => {
    try {
      await toggleAdminService(serviceId);
      await loadDashboard(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to toggle service status');
    }
  };

  // Handler: Save Barber (Add / Edit)
  const handleSaveBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (barberModal.mode === 'add') {
        await createAdminBarber({
          name: barberModal.name,
          workingToday: barberModal.workingToday,
          active: barberModal.active,
        });
        showToast('success', `Barber '${barberModal.name}' added.`);
      } else if (barberModal.barberId) {
        await updateAdminBarber(barberModal.barberId, {
          name: barberModal.name,
          active: barberModal.active,
        });
        showToast('success', `Barber '${barberModal.name}' updated.`);
      }
      setBarberModal({ ...barberModal, open: false });
      await loadDashboard(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save barber');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Delete Barber
  const handleDeleteBarber = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'barber') return;
    setActionLoading(true);
    try {
      await deleteAdminBarber(deleteConfirm.id);
      showToast('success', `Barber '${deleteConfirm.name}' removed.`);
      setDeleteConfirm(null);
      await loadDashboard(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to remove barber');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Set Barber Duty
  const handleToggleBarberDuty = async (barberId: string, currentDuty: boolean) => {
    try {
      await setAdminBarberDuty(barberId, !currentDuty);
      await loadDashboard(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update barber duty');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-gold animate-spin" />
        <p className="text-xs text-silver">{t.common.loading}</p>
      </div>
    );
  }

  const queue = data?.queueSettings;
  const stats = data?.dailyStats;
  const services = data?.services || [];
  const barbers = data?.barbers || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl border shadow-2xl flex items-center gap-3 text-xs font-semibold animate-fade-in ${
            toast.type === 'success'
              ? 'bg-status-success/20 border-status-success/50 text-status-success'
              : 'bg-status-danger/20 border-status-danger/50 text-status-danger'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-charcoal-border/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-silver-highlight flex items-center gap-2.5">
            <Sliders className="w-7 h-7 text-gold" />
            {t.admin.title}
          </h1>
          <p className="text-xs text-silver mt-1">
            {queue?.salonName || 'Royal Cuts Lounge'} • Owner Administration & System Settings
          </p>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
        </div>
      </div>

      {/* Queue Master Control Card (Top Priority) */}
      <Card highlight className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                queue?.isOpen ? 'bg-status-success animate-pulse' : 'bg-status-danger'
              }`}
            ></span>
            <h2 className="text-base font-bold text-silver-highlight">
              {queue?.isOpen ? t.admin.queueIsOpen : t.admin.queueIsClosed}
            </h2>
          </div>
          <p className="text-xs text-silver max-w-lg">
            {queue?.isOpen
              ? 'Online customers can join from their phones. Walk-ins can be registered by the receptionist.'
              : t.admin.queueClosedNotice}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={queue?.isOpen ? 'danger' : 'primary'}
            size="md"
            disabled={actionLoading}
            onClick={handleToggleQueueOpen}
            className="gap-2 font-bold px-5"
          >
            <Power className="w-4 h-4" />
            {queue?.isOpen ? t.admin.closeQueue : t.admin.openQueue}
          </Button>
        </div>
      </Card>

      {/* Section Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-charcoal-border/70 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('services')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'services'
              ? 'text-gold border-b-2 border-gold bg-charcoal-surface font-bold shadow-sm'
              : 'text-silver hover:text-silver-highlight'
          }`}
        >
          <Scissors className="w-4 h-4" />
          {t.admin.servicesTab} ({services.length})
        </button>

        <button
          onClick={() => setActiveTab('barbers')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'barbers'
              ? 'text-gold border-b-2 border-gold bg-charcoal-surface font-bold shadow-sm'
              : 'text-silver hover:text-silver-highlight'
          }`}
        >
          <Users className="w-4 h-4" />
          {t.admin.barbersTab} ({barbers.length})
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'queue'
              ? 'text-gold border-b-2 border-gold bg-charcoal-surface font-bold shadow-sm'
              : 'text-silver hover:text-silver-highlight'
          }`}
        >
          <Clock className="w-4 h-4" />
          {t.admin.queueSettingsTab}
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'stats'
              ? 'text-gold border-b-2 border-gold bg-charcoal-surface font-bold shadow-sm'
              : 'text-silver hover:text-silver-highlight'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          {t.admin.statsTab}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: Service Management Tab */}
      {/* ========================================================================= */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-silver-highlight">Salon Services Menu</h2>
              <p className="text-xs text-silver">Manage service catalog, pricing, and availability</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                setServiceModal({
                  open: true,
                  mode: 'add',
                  nameEn: '',
                  nameGu: '',
                  nameHi: '',
                  durationMinutes: 30,
                  price: 150,
                  active: true,
                })
              }
              className="gap-2 font-bold"
            >
              <Plus className="w-4 h-4" />
              {t.admin.addServiceBtn}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((srv) => (
              <Card key={srv.id} className="p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-charcoal-border/60 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-silver-highlight">{srv.nameEn}</h3>
                    <div className="text-xs text-silver mt-0.5 space-x-2">
                      {srv.nameGu && <span className="text-gold/90">{srv.nameGu}</span>}
                      {srv.nameHi && <span className="text-silver/70">• {srv.nameHi}</span>}
                    </div>
                  </div>
                  <span className="font-mono font-black text-lg text-gold">₹{srv.price}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-silver">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-gold" />
                    {srv.durationMinutes} min
                  </span>

                  <button
                    onClick={() => handleToggleService(srv.id)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all ${
                      srv.active
                        ? 'bg-status-success/20 text-status-success border border-status-success/40'
                        : 'bg-charcoal text-silver border border-charcoal-border'
                    }`}
                  >
                    {srv.active ? t.admin.active : t.admin.inactive}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-charcoal-border/50">
                  <span className="text-[10px] text-silver/60">
                    Used: {srv.timesUsed} visits
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setServiceModal({
                          open: true,
                          mode: 'edit',
                          serviceId: srv.id,
                          nameEn: srv.nameEn,
                          nameGu: srv.nameGu || '',
                          nameHi: srv.nameHi || '',
                          durationMinutes: srv.durationMinutes,
                          price: srv.price,
                          active: srv.active,
                        })
                      }
                      className="p-1.5 rounded-lg text-silver hover:text-gold hover:bg-charcoal-surface transition-colors"
                      title="Edit Service"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteConfirm({
                          type: 'service',
                          id: srv.id,
                          name: srv.nameEn,
                        })
                      }
                      className="p-1.5 rounded-lg text-silver hover:text-status-danger hover:bg-charcoal-surface transition-colors"
                      title="Delete Service"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: Barber Management Tab */}
      {/* ========================================================================= */}
      {activeTab === 'barbers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-silver-highlight">Barbers & Station Roster</h2>
              <p className="text-xs text-silver">Manage barber staff, stations, and on-duty availability</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                setBarberModal({
                  open: true,
                  mode: 'add',
                  name: '',
                  workingToday: true,
                  active: true,
                })
              }
              className="gap-2 font-bold"
            >
              <Plus className="w-4 h-4" />
              {t.admin.addBarberBtn}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {barbers.map((barber) => (
              <Card key={barber.id} className="p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-charcoal-border/60 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-charcoal border border-gold/40 flex items-center justify-center font-bold text-gold text-sm shadow">
                      {barber.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-silver-highlight">{barber.name}</h3>
                      <div className="text-[11px] text-silver font-mono">/barber/{barber.slug}</div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      barber.isOccupied
                        ? 'bg-gold/20 text-gold border border-gold/40'
                        : barber.workingToday
                        ? 'bg-status-success/20 text-status-success border border-status-success/40'
                        : 'bg-charcoal text-silver border border-charcoal-border'
                    }`}
                  >
                    {barber.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-silver">Daily Duty Status:</span>
                  <button
                    onClick={() => handleToggleBarberDuty(barber.id, barber.workingToday)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      barber.workingToday
                        ? 'bg-status-success/15 text-status-success border border-status-success/40'
                        : 'bg-charcoal text-silver border border-charcoal-border'
                    }`}
                  >
                    {barber.workingToday ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        {t.admin.onDuty}
                      </>
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        {t.admin.offDuty}
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-charcoal-border/50 text-xs text-silver">
                  <span>Served today: {barber.customersServedToday}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setBarberModal({
                          open: true,
                          mode: 'edit',
                          barberId: barber.id,
                          name: barber.name,
                          workingToday: barber.workingToday,
                          active: barber.active,
                        })
                      }
                      className="p-1.5 rounded-lg text-silver hover:text-gold hover:bg-charcoal-surface transition-colors"
                      title="Edit Barber"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteConfirm({
                          type: 'barber',
                          id: barber.id,
                          name: barber.name,
                        })
                      }
                      className="p-1.5 rounded-lg text-silver hover:text-status-danger hover:bg-charcoal-surface transition-colors"
                      title="Remove Barber"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: Queue Settings Tab (Hours & Operations) */}
      {/* ========================================================================= */}
      {activeTab === 'queue' && (
        <div className="max-w-xl mx-auto space-y-6">
          <Card className="p-6 space-y-6">
            <div className="border-b border-charcoal-border/70 pb-4">
              <h2 className="text-lg font-bold text-silver-highlight flex items-center gap-2">
                <Clock className="w-5 h-5 text-gold" />
                Salon Operating Hours
              </h2>
              <p className="text-xs text-silver mt-1">
                Configure opening and closing times. Online joining automatically stops 30 minutes before closing.
              </p>
            </div>

            <form onSubmit={handleSaveHours} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-silver uppercase mb-1.5">
                    {t.admin.openingTime}
                  </label>
                  <input
                    type="time"
                    required
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-charcoal border border-charcoal-border text-silver-highlight font-mono font-bold focus:border-gold outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-silver uppercase mb-1.5">
                    {t.admin.closingTime}
                  </label>
                  <input
                    type="time"
                    required
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-charcoal border border-charcoal-border text-silver-highlight font-mono font-bold focus:border-gold outline-none text-sm"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-charcoal/60 border border-charcoal-border/60 text-xs text-silver space-y-1">
                <p className="font-semibold text-gold">Cut-off Rule R9:</p>
                <p>
                  Online queue joining automatically closes 30 minutes before closing time ({closingTime}).
                  Walk-in registration remains available at the Reception Dashboard.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  fullWidth
                  variant="primary"
                  type="submit"
                  disabled={actionLoading}
                  className="font-bold py-3"
                >
                  {t.admin.saveSettingsBtn}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: Daily Statistics Tab */}
      {/* ========================================================================= */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-silver-highlight">Today's Salon Performance</h2>
            <p className="text-xs text-silver">Live statistics for completed visits, waiting times, and exceptions</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Metric 1: Served Today */}
            <Card className="p-4 text-center space-y-1">
              <span className="text-[11px] font-semibold text-silver uppercase block">
                {t.admin.customersServedToday}
              </span>
              <span className="text-3xl font-black font-mono text-status-success">
                {stats?.customersServedToday ?? 0}
              </span>
            </Card>

            {/* Metric 2: Avg Wait Time */}
            <Card className="p-4 text-center space-y-1">
              <span className="text-[11px] font-semibold text-silver uppercase block">
                {t.admin.avgWaitTime}
              </span>
              <span className="text-3xl font-black font-mono text-gold">
                {stats?.averageWaitMinutes ?? 0}m
              </span>
            </Card>

            {/* Metric 3: Total Joined Today */}
            <Card className="p-4 text-center space-y-1">
              <span className="text-[11px] font-semibold text-silver uppercase block">
                {t.admin.totalJoinedToday}
              </span>
              <span className="text-3xl font-black font-mono text-silver-highlight">
                {stats?.totalJoinedToday ?? 0}
              </span>
            </Card>

            {/* Metric 4: Total No-Shows */}
            <Card className="p-4 text-center space-y-1">
              <span className="text-[11px] font-semibold text-silver uppercase block">
                {t.admin.totalNoShows}
              </span>
              <span className="text-3xl font-black font-mono text-status-warning">
                {stats?.totalNoShows ?? 0}
              </span>
            </Card>

            {/* Metric 5: Total Cancelled */}
            <Card className="p-4 text-center space-y-1">
              <span className="text-[11px] font-semibold text-silver uppercase block">
                {t.admin.totalCancelled}
              </span>
              <span className="text-3xl font-black font-mono text-status-danger">
                {stats?.totalCancelled ?? 0}
              </span>
            </Card>

            {/* Metric 6: Completed Revenue */}
            <Card className="p-4 text-center space-y-1">
              <span className="text-[11px] font-semibold text-silver uppercase block">
                Completed Value
              </span>
              <span className="text-2xl font-black font-mono text-gold">
                ₹{stats?.totalRevenue ?? 0}
              </span>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SERVICE MODAL (Add / Edit) */}
      {/* ========================================================================= */}
      {serviceModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-dark/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-charcoal-surface w-full max-w-md rounded-3xl border border-charcoal-border p-6 shadow-2xl space-y-4">
            <div className="border-b border-charcoal-border/70 pb-3">
              <h3 className="text-lg font-bold text-silver-highlight">
                {serviceModal.mode === 'add' ? t.admin.addServiceTitle : t.admin.editServiceTitle}
              </h3>
            </div>

            <form onSubmit={handleSaveService} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-silver uppercase mb-1">
                  {t.admin.serviceNameEn} *
                </label>
                <input
                  type="text"
                  required
                  value={serviceModal.nameEn}
                  onChange={(e) => setServiceModal({ ...serviceModal, nameEn: e.target.value })}
                  placeholder="e.g. Beard Styling"
                  className="w-full px-3 py-2 rounded-xl bg-charcoal border border-charcoal-border text-silver-highlight text-sm outline-none focus:border-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-silver uppercase mb-1">
                    {t.admin.serviceNameGu}
                  </label>
                  <input
                    type="text"
                    value={serviceModal.nameGu}
                    onChange={(e) => setServiceModal({ ...serviceModal, nameGu: e.target.value })}
                    placeholder="દાઢી સ્ટાઇલ"
                    className="w-full px-3 py-2 rounded-xl bg-charcoal border border-charcoal-border text-silver-highlight text-sm outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-silver uppercase mb-1">
                    {t.admin.serviceNameHi}
                  </label>
                  <input
                    type="text"
                    value={serviceModal.nameHi}
                    onChange={(e) => setServiceModal({ ...serviceModal, nameHi: e.target.value })}
                    placeholder="दाढ़ी स्टाइल"
                    className="w-full px-3 py-2 rounded-xl bg-charcoal border border-charcoal-border text-silver-highlight text-sm outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-silver uppercase mb-1">
                    {t.admin.durationMinutes} *
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    step="5"
                    required
                    value={serviceModal.durationMinutes}
                    onChange={(e) =>
                      setServiceModal({ ...serviceModal, durationMinutes: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-charcoal border border-charcoal-border text-silver-highlight text-sm font-mono outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-silver uppercase mb-1">
                    {t.admin.priceInr} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="99999"
                    required
                    value={serviceModal.price}
                    onChange={(e) =>
                      setServiceModal({ ...serviceModal, price: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-charcoal border border-charcoal-border text-silver-highlight text-sm font-mono outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="srv-active"
                  checked={serviceModal.active}
                  onChange={(e) => setServiceModal({ ...serviceModal, active: e.target.checked })}
                  className="rounded accent-gold w-4 h-4 cursor-pointer"
                />
                <label htmlFor="srv-active" className="text-xs text-silver-highlight cursor-pointer">
                  Available in queue selection (Active)
                </label>
              </div>

              <div className="flex gap-2 pt-3 border-t border-charcoal-border/60">
                <Button
                  fullWidth
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setServiceModal({ ...serviceModal, open: false })}
                >
                  {t.admin.cancelBtn}
                </Button>
                <Button
                  fullWidth
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={actionLoading}
                >
                  {t.admin.saveBtn}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BARBER MODAL (Add / Edit) */}
      {/* ========================================================================= */}
      {barberModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-dark/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-charcoal-surface w-full max-w-sm rounded-3xl border border-charcoal-border p-6 shadow-2xl space-y-4">
            <div className="border-b border-charcoal-border/70 pb-3">
              <h3 className="text-lg font-bold text-silver-highlight">
                {barberModal.mode === 'add' ? t.admin.addBarberTitle : t.admin.editBarberTitle}
              </h3>
            </div>

            <form onSubmit={handleSaveBarber} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-silver uppercase mb-1">
                  {t.admin.barberName} *
                </label>
                <input
                  type="text"
                  required
                  value={barberModal.name}
                  onChange={(e) => setBarberModal({ ...barberModal, name: e.target.value })}
                  placeholder="e.g. Sameer"
                  className="w-full px-3 py-2.5 rounded-xl bg-charcoal border border-charcoal-border text-silver-highlight text-sm outline-none focus:border-gold"
                />
              </div>

              {barberModal.mode === 'add' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="barb-duty"
                    checked={barberModal.workingToday}
                    onChange={(e) =>
                      setBarberModal({ ...barberModal, workingToday: e.target.checked })
                    }
                    className="rounded accent-gold w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="barb-duty" className="text-xs text-silver-highlight cursor-pointer">
                    On Duty today (Available)
                  </label>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-charcoal-border/60">
                <Button
                  fullWidth
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setBarberModal({ ...barberModal, open: false })}
                >
                  {t.admin.cancelBtn}
                </Button>
                <Button
                  fullWidth
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={actionLoading}
                >
                  {t.admin.saveBtn}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-dark/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-charcoal-surface w-full max-w-sm rounded-3xl border border-charcoal-border p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-status-danger/15 border border-status-danger/30 text-status-danger flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-silver-highlight">
                {deleteConfirm.type === 'service'
                  ? t.admin.deleteServiceConfirm
                  : t.admin.deleteBarberConfirm}
              </h3>
              <p className="text-xs text-silver mt-1">
                {deleteConfirm.name} ({deleteConfirm.type})
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                fullWidth
                variant="secondary"
                size="sm"
                onClick={() => setDeleteConfirm(null)}
              >
                {t.admin.cancelBtn}
              </Button>
              <Button
                fullWidth
                variant="danger"
                size="sm"
                disabled={actionLoading}
                onClick={
                  deleteConfirm.type === 'service' ? handleDeleteService : handleDeleteBarber
                }
              >
                {t.admin.deleteBtn}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
