import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Scissors,
  Users,
  Clock,
  CheckCircle2,
  UserPlus,
  BellRing,
  AlertTriangle,
  XCircle,
  Timer,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Plus,
  Coffee,
  X,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useSocket } from '../../hooks/useSocket.js';
import {
  fetchReceptionDashboard,
  callNextCustomer,
  markNoShow,
  cancelReceptionEntry,
  addWalkInCustomer,
  seedDummyCustomers,
  fetchServices,
} from '../../lib/api.js';

interface BarberCardData {
  id: string;
  name: string;
  slug: string;
  status: 'Available' | 'Busy' | 'On Break' | 'Off';
  workingToday: boolean;
  isAvailable: boolean;
  isOccupied: boolean;
  waitingCount: number;
  currentCustomer: {
    id: string;
    tokenNumber: string;
    customerName: string;
    serviceName: string;
    status: string;
    totalDurationMinutes: number;
    elapsedSeconds: number;
  } | null;
}

interface WaitingCustomerData {
  id: string;
  tokenNumber: string;
  customerName: string;
  customerPhone: string;
  preferredBarberId: string | null;
  preferredBarberName: string | null;
  assignedBarberId: string | null;
  assignedBarberName: string | null;
  status: 'Waiting' | 'Called';
  source: 'online' | 'walk-in';
  servicesSummary: string;
  totalDurationMinutes: number;
  totalPrice: number;
  joinedAt: string;
  calledAt?: string | null;
  waitMinutesSoFar: number;
  isOver60Min: boolean;
}

interface ReceptionData {
  topSection: {
    salonName: string;
    totalWaiting: number;
    customersServedToday: number;
    averageWaitMinutes: number;
    currentTime: string;
  };
  barbers: BarberCardData[];
  waitingList: WaitingCustomerData[];
}

export const ReceptionPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { socket, isConnected } = useSocket();

  const [data, setData] = useState<ReceptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live ticking clock state
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // Local live timer tick for active service cards
  const [timerTick, setTimerTick] = useState(0);

  // Phone mask toggle per row
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});

  // Action feedback toasts & banners
  const [bannerNotice, setBannerNotice] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // Modals
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    type: 'no-show' | 'cancel';
    entry: WaitingCustomerData;
  } | null>(null);

  // Walk-in form state
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInServices, setWalkInServices] = useState<string[]>([]);
  const [walkInBarber, setWalkInBarber] = useState<string | null>(null);
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInError, setWalkInError] = useState<string | null>(null);

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const res = await fetchReceptionDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load reception data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    fetchServices().then(res => setAvailableServices(res)).catch(() => {});
  }, [loadDashboard]);

  // Socket.IO live sync
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      loadDashboard();
    };
    socket.on('queue:updated', handleUpdate);
    socket.on('service:completed', handleUpdate);
    socket.on('service:started', handleUpdate);
    socket.on('customer:called', handleUpdate);
    socket.on('barber:status_changed', handleUpdate);
    socket.on('connect', handleUpdate);
    socket.on('reconnect', handleUpdate);

    return () => {
      socket.off('queue:updated', handleUpdate);
      socket.off('service:completed', handleUpdate);
      socket.off('service:started', handleUpdate);
      socket.off('customer:called', handleUpdate);
      socket.off('barber:status_changed', handleUpdate);
      socket.off('connect', handleUpdate);
      socket.off('reconnect', handleUpdate);
    };
  }, [socket, loadDashboard]);

  // Fallback sync: ensures reception dashboard updates within 5 seconds without manual browser refresh
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboard();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  // Live clock and timer tick
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleDateString(language === 'gu' ? 'gu-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setTimerTick(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [language]);

  // Call Next Handler (General or for specific barber)
  const handleCallNext = async (barberId?: string) => {
    try {
      setBannerNotice(null);
      const res = await callNextCustomer(barberId);
      if (res.success) {
        let msg = `Called token ${res.calledCustomer.tokenNumber} (${res.calledCustomer.customerName}) for ${res.assignedBarber.name}.`;
        if (res.skippedEntries && res.skippedEntries.length > 0) {
          const skipDetails = res.skippedEntries
            .map((s: any) => `${s.tokenNumber} (${s.customerName}): ${s.reason}`)
            .join('; ');
          msg += ` [Notice: Earlier customers were skipped due to busy preferences: ${skipDetails}]`;
        }
        setBannerNotice({
          type: res.skippedEntries?.length > 0 ? 'warning' : 'success',
          message: msg,
        });
        await loadDashboard();
      }
    } catch (err: any) {
      setBannerNotice({
        type: 'error',
        message: err.message || 'Could not call next customer.',
      });
    }
  };

  // Mark No-show Handler
  const handleConfirmNoShow = async () => {
    if (!confirmModal || confirmModal.type !== 'no-show') return;
    try {
      const res = await markNoShow(confirmModal.entry.id);
      setBannerNotice({ type: 'success', message: res.message || 'Marked as No-show.' });
      setConfirmModal(null);
      await loadDashboard();
    } catch (err: any) {
      setBannerNotice({ type: 'error', message: err.message || 'Failed to mark no-show.' });
    }
  };

  // Cancel Handler
  const handleConfirmCancel = async () => {
    if (!confirmModal || confirmModal.type !== 'cancel') return;
    try {
      const res = await cancelReceptionEntry(confirmModal.entry.id);
      setBannerNotice({ type: 'success', message: res.message || 'Customer spot cancelled.' });
      setConfirmModal(null);
      await loadDashboard();
    } catch (err: any) {
      setBannerNotice({ type: 'error', message: err.message || 'Failed to cancel spot.' });
    }
  };

  // Add Walk-in submit handler
  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (walkInServices.length === 0 || walkInName.trim().length < 2) {
      setWalkInError('Please enter a valid name and select at least 1 service.');
      return;
    }
    setWalkInSubmitting(true);
    setWalkInError(null);
    try {
      const res = await addWalkInCustomer({
        customerName: walkInName.trim(),
        customerPhone: walkInPhone.trim(),
        serviceIds: walkInServices,
        preferredBarberId: walkInBarber,
      });
      if (res.success) {
        setShowWalkInModal(false);
        setWalkInName('');
        setWalkInPhone('');
        setWalkInServices([]);
        setWalkInBarber(null);
        setBannerNotice({
          type: 'success',
          message: `Walk-in customer ${res.entry.customerName} added with token ${res.entry.tokenNumber}!`,
        });
        await loadDashboard();
      }
    } catch (err: any) {
      setWalkInError(err.message || 'Failed to add walk-in customer.');
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // Seed 8 realistic dummy customers helper
  const handleSeedDummy = async () => {
    try {
      const res = await seedDummyCustomers();
      setBannerNotice({
        type: 'success',
        message: `${res.message || 'Dummy customers loaded!'} (${res.count} added).`,
      });
      await loadDashboard();
    } catch (err: any) {
      setBannerNotice({ type: 'error', message: err.message || 'Failed to seed dummy data.' });
    }
  };

  // Format phone with masking (revealed on click)
  const formatPhone = (phone: string, id: string) => {
    if (!phone) return 'Walk-in (No phone)';
    if (revealedPhones[id]) return `+91 ${phone}`;
    if (phone.length === 10) {
      return `${phone.slice(0, 2)}***${phone.slice(6)}`;
    }
    return phone;
  };

  // Format elapsed seconds into mm:ss
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-silver">{t.common.loading}</p>
      </div>
    );
  }

  const top = data?.topSection;
  const barbers = data?.barbers || [];
  const waitingList = data?.waitingList || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Offline banner */}
      {!isConnected && (
        <div className="p-2.5 rounded-xl bg-status-warning/20 border border-status-warning/40 text-status-warning text-xs text-center flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>{t.errors.offline}</span>
        </div>
      )}

      {/* Banner Notice (Toasts / Feedback) */}
      {bannerNotice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between shadow-lg animate-fadeIn ${
            bannerNotice.type === 'success'
              ? 'bg-status-success/15 border-status-success/50 text-status-success'
              : bannerNotice.type === 'warning'
              ? 'bg-status-warning/15 border-status-warning/50 text-status-warning'
              : 'bg-status-danger/15 border-status-danger/50 text-status-danger'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {bannerNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : bannerNotice.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="font-medium">{bannerNotice.message}</span>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-silver hover:text-silver-highlight ml-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TOP SECTION: Salon Name, Clock, Metrics & Global Actions  */}
      {/* ========================================================= */}
      <Card highlight className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-charcoal-border/70 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-charcoal text-gold border border-gold/40">
                <Scissors className="w-5 h-5 -rotate-45" />
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-silver-highlight tracking-tight">
                {top?.salonName || t.common.salonName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gold/15 text-gold border border-gold/30">
                {t.reception.title}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-silver mt-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-gold" />
              <span>{currentTimeStr || new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Action Bar: Add Walk-in & Global Call Next */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedDummy}
              className="gap-1.5 text-xs border-charcoal-border hover:border-gold"
              title="Loads 8 dummy queue customers for complete testing"
            >
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              <span>{t.reception.seedDummyBtn}</span>
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowWalkInModal(true)}
              className="gap-2 text-xs sm:text-sm"
            >
              <UserPlus className="w-4 h-4 text-gold" />
              <span>{t.reception.addWalkInBtn}</span>
            </Button>

            <Button
              size="md"
              disabled={top?.totalWaiting === 0}
              onClick={() => handleCallNext()}
              className="gap-2 text-xs sm:text-sm shadow-lg shadow-gold/15"
            >
              <BellRing className="w-4 h-4" />
              <span>{t.reception.callNextBtn}</span>
            </Button>
          </div>
        </div>

        {/* 4 Summary Metric Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Waiting Count */}
          <div className="p-3.5 rounded-xl bg-charcoal border border-charcoal-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-charcoal-surface border border-charcoal-border flex items-center justify-center text-gold flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-silver uppercase font-semibold">
                {t.reception.statsWaiting}
              </div>
              <div className="text-2xl font-black text-silver-highlight font-mono">
                {top?.totalWaiting ?? 0}
              </div>
            </div>
          </div>

          {/* In Chair Count */}
          <div className="p-3.5 rounded-xl bg-charcoal border border-charcoal-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-charcoal-surface border border-charcoal-border flex items-center justify-center text-gold flex-shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-silver uppercase font-semibold">
                {t.reception.statsServing}
              </div>
              <div className="text-2xl font-black text-gold font-mono">
                {barbers.filter(b => b.currentCustomer !== null).length}
              </div>
            </div>
          </div>

          {/* Customers Served Today */}
          <div className="p-3.5 rounded-xl bg-charcoal border border-charcoal-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-charcoal-surface border border-charcoal-border flex items-center justify-center text-status-success flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-silver uppercase font-semibold">
                {t.reception.statsCompleted}
              </div>
              <div className="text-2xl font-black text-status-success font-mono">
                {top?.customersServedToday ?? 0}
              </div>
            </div>
          </div>

          {/* Average Wait Time */}
          <div className="p-3.5 rounded-xl bg-charcoal border border-charcoal-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-charcoal-surface border border-charcoal-border flex items-center justify-center text-gold flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-silver uppercase font-semibold">
                {t.reception.avgWait}
              </div>
              <div className="text-2xl font-black text-gold font-mono">
                ~{top?.averageWaitMinutes ?? 0} {t.common.minutes}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================= */}
      {/* BARBER CARDS ROW: Three-column layout on 10-inch tablets   */}
      {/* ========================================================= */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-silver-highlight uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            {t.reception.barberStatusTitle}
          </h2>
          <span className="text-xs text-silver">
            {barbers.length} Stations (Ravi, Amit, Imran)
          </span>
        </div>

        {/* Three-column row for 10-inch tablet & desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
          {barbers.map((barber) => {
            const current = barber.currentCustomer;
            const isServing = Boolean(current);
            // Live elapsed seconds based on local tick
            const elapsed = current ? current.elapsedSeconds + (timerTick % 2 === 0 ? 0 : 0) : 0;
            const totalDurationMinutes = current?.totalDurationMinutes || 30;
            const totalDurationSec = totalDurationMinutes * 60;
            const remainingSec = Math.max(0, totalDurationSec - elapsed);
            const remainingMinutes = Math.ceil(remainingSec / 60);
            const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDurationSec) * 100)));
            const isOvertime = isServing && elapsed > totalDurationSec;

            return (
              <Card
                key={barber.id}
                className={`flex flex-col justify-between relative overflow-hidden transition-all p-4.5 sm:p-5 ${
                  isServing
                    ? 'border-gold/50 bg-charcoal-surface shadow-xl ring-1 ring-gold/20'
                    : 'border-charcoal-border bg-charcoal-surface hover:border-gold/30'
                }`}
              >
                <div className="space-y-3.5">
                  {/* 1. Header: Barber Name, Station Avatar & Availability Status */}
                  <div className="flex items-center justify-between border-b border-charcoal-border/70 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-charcoal border border-gold/40 flex items-center justify-center font-black text-gold text-sm shadow-sm flex-shrink-0">
                        {barber.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-extrabold text-base text-silver-highlight tracking-tight">
                          {barber.name}
                        </div>
                        <div className="text-[11px] text-silver">
                          {barber.waitingCount > 0
                            ? `${barber.waitingCount} waiting for ${barber.name}`
                            : 'Queue open'}
                        </div>
                      </div>
                    </div>

                    {/* Availability Status Chip */}
                    <div>
                      {barber.status === 'Available' && !barber.isOccupied ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-status-success/15 text-status-success border border-status-success/30 flex items-center gap-1.5 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
                          Available
                        </span>
                      ) : barber.status === 'On Break' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-status-warning/15 text-status-warning border border-status-warning/30 flex items-center gap-1.5 shadow-sm">
                          <Coffee className="w-3.5 h-3.5" />
                          On Break
                        </span>
                      ) : isServing && current ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gold/15 text-gold border border-gold/30 flex items-center gap-1.5 shadow-sm">
                          <Scissors className="w-3.5 h-3.5 text-gold -rotate-45" />
                          {current.status}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-charcoal text-silver border border-charcoal-border">
                          {barber.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2. Current Customer, Service Name & Progress Bar */}
                  {isServing && current ? (
                    <div className="p-3.5 rounded-xl bg-charcoal border border-charcoal-border space-y-3">
                      {/* Customer Row */}
                      <div className="flex justify-between items-center">
                        <div className="min-w-0 pr-2">
                          <div className="text-[10px] text-silver uppercase font-bold tracking-wider">
                            {t.reception.currentCustomer}
                          </div>
                          <div className="font-extrabold text-silver-highlight text-sm sm:text-base mt-0.5 truncate">
                            {current.customerName}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-gold px-2 py-0.5 bg-charcoal-surface rounded-lg border border-gold/40 text-xs sm:text-sm flex-shrink-0">
                          {current.tokenNumber}
                        </span>
                      </div>

                      {/* Service Name */}
                      <div className="pt-2 border-t border-charcoal-border/50 flex items-center gap-1.5 text-xs">
                        <Scissors className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                        <span className="font-semibold text-silver-highlight truncate" title={current.serviceName}>
                          {current.serviceName}
                        </span>
                      </div>

                      {/* Time Remaining as a Progress Bar */}
                      <div className="space-y-1.5 pt-1 border-t border-charcoal-border/50">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-silver uppercase tracking-wider font-semibold flex items-center gap-1">
                            <Timer className="w-3 h-3 text-gold" />
                            Time Remaining:
                          </span>
                          <span className={`font-mono font-bold ${isOvertime ? 'text-status-warning' : 'text-gold'}`}>
                            {isOvertime ? `Overtime (+${Math.floor((elapsed - totalDurationSec) / 60)}m)` : `~${remainingMinutes} min left`}
                          </span>
                        </div>

                        {/* Visual Progress Bar Track & Fill */}
                        <div className="w-full bg-charcoal-surface border border-charcoal-border rounded-full h-2.5 overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOvertime ? 'bg-status-warning' : 'bg-gradient-to-r from-gold/70 via-gold to-gold-highlight'
                            }`}
                            style={{ width: `${isOvertime ? 100 : progressPercent}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-[10px] text-silver/70 font-mono pt-0.5">
                          <span>Elapsed: {formatTimer(elapsed)}</span>
                          <span>Total: {totalDurationMinutes} min</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-charcoal/40 border border-charcoal-border/40 space-y-3 text-center">
                      <div className="py-2">
                        <div className="text-xs text-silver/80 font-semibold">
                          {t.reception.noCustomerAssigned}
                        </div>
                        <div className="text-sm font-bold text-status-success mt-1">
                          {t.reception.noServiceActive}
                        </div>
                      </div>

                      {/* Idle Progress Bar Track */}
                      <div className="space-y-1 pt-1 border-t border-charcoal-border/30">
                        <div className="flex justify-between items-center text-[10px] text-silver/60">
                          <span>Time Remaining:</span>
                          <span className="font-mono">0 min</span>
                        </div>
                        <div className="w-full bg-charcoal-surface border border-charcoal-border/40 rounded-full h-2.5 overflow-hidden p-0.5">
                          <div className="h-full bg-charcoal-border/30 w-0 rounded-full" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Footer: Call Next Button */}
                <div className="pt-3 mt-3 border-t border-charcoal-border/40">
                  <Button
                    fullWidth
                    size="md"
                    disabled={!barber.isAvailable || top?.totalWaiting === 0}
                    onClick={() => handleCallNext(barber.id)}
                    className="gap-2 text-xs sm:text-sm font-bold py-2.5 shadow-md shadow-gold/10"
                    title={
                      !barber.isAvailable
                        ? 'Finish current customer or return from break first'
                        : `Calls the next customer who prefers ${barber.name} or Any Barber`
                    }
                  >
                    <BellRing className="w-4 h-4" />
                    <span>
                      {t.reception.callNextForBarber} ({barber.name})
                    </span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* LIVE WAITING LIST: Full-width Table on Tablet & Desktop   */}
      {/* ========================================================= */}
      <div className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-silver-highlight uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-gold" />
            {t.reception.waitingListTitle} ({waitingList.length})
          </h2>
          <span className="text-xs text-silver">
            Ordered by arrival (First Come, First Served)
          </span>
        </div>

          <Card padding="none" className="overflow-hidden">
            {waitingList.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Users className="w-12 h-12 text-silver/40 mx-auto" />
                <h3 className="text-base font-bold text-silver-highlight">
                  {t.reception.noOneWaiting}
                </h3>
                <p className="text-xs text-silver max-w-sm mx-auto">
                  {t.reception.noOneWaitingDesc}
                </p>
                <div className="pt-2">
                  <Button size="sm" onClick={() => setShowWalkInModal(true)} className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    {t.reception.addWalkInBtn}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-silver">
                  <thead className="bg-charcoal text-[11px] text-silver/80 uppercase tracking-wider border-b border-charcoal-border">
                    <tr>
                      <th className="py-3 px-3.5 font-bold">Token</th>
                      <th className="py-3 px-3.5 font-bold">Customer</th>
                      <th className="py-3 px-3.5 font-bold">Services</th>
                      <th className="py-3 px-3.5 font-bold">Preferred Barber</th>
                      <th className="py-3 px-3.5 font-bold">Wait Time</th>
                      <th className="py-3 px-3.5 font-bold">Status</th>
                      <th className="py-3 px-3.5 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal-border">
                    {waitingList.map((entry, index) => {
                      const isCalled = entry.status === 'Called';
                      const isOverdue = entry.isOver60Min;

                      return (
                        <tr
                          key={entry.id}
                          className={`transition-colors ${
                            isCalled
                              ? 'bg-status-success/10 hover:bg-status-success/15'
                              : isOverdue
                              ? 'bg-status-danger/10 hover:bg-status-danger/15'
                              : index % 2 === 0
                              ? 'bg-charcoal-surface/40 hover:bg-charcoal-surface'
                              : 'bg-charcoal-surface/80 hover:bg-charcoal-surface'
                          }`}
                        >
                          {/* Token */}
                          <td className="py-3 px-3.5 font-mono font-bold text-gold text-sm whitespace-nowrap">
                            <span className="px-2 py-1 rounded-lg bg-charcoal border border-gold/40">
                              {entry.tokenNumber}
                            </span>
                          </td>

                          {/* Customer Name & Masked Phone */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="font-bold text-silver-highlight text-sm">
                              {entry.customerName}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-silver mt-0.5">
                              <span>{formatPhone(entry.customerPhone, entry.id)}</span>
                              {entry.customerPhone && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRevealedPhones(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))
                                  }
                                  className="text-silver hover:text-gold"
                                  title="Reveal full phone"
                                >
                                  {revealedPhones[entry.id] ? (
                                    <EyeOff className="w-3 h-3" />
                                  ) : (
                                    <Eye className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                              <span className="px-1 py-0.2 rounded text-[9px] bg-charcoal border border-charcoal-border uppercase">
                                {entry.source}
                              </span>
                            </div>
                          </td>

                          {/* Services */}
                          <td className="py-3 px-3.5 max-w-[160px] truncate">
                            <div className="text-silver-highlight font-medium truncate" title={entry.servicesSummary}>
                              {entry.servicesSummary}
                            </div>
                            <div className="text-[10px] text-silver mt-0.5">
                              ₹{entry.totalPrice} • {entry.totalDurationMinutes} min
                            </div>
                          </td>

                          {/* Preferred Barber */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {entry.preferredBarberName ? (
                              <span className="font-semibold text-silver-highlight flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-gold inline-block"></span>
                                {entry.preferredBarberName}
                              </span>
                            ) : (
                              <span className="text-gold font-medium">
                                Any Barber
                              </span>
                            )}
                            {entry.assignedBarberName && (
                              <div className="text-[10px] text-status-success font-semibold mt-0.5">
                                Assigned: {entry.assignedBarberName}
                              </div>
                            )}
                          </td>

                          {/* Waiting Time with > 60m Highlight Rule */}
                          <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className={isOverdue ? 'font-bold text-status-danger' : 'text-silver'}>
                                {entry.waitMinutesSoFar} min
                              </span>
                              {isOverdue && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-status-danger/20 text-status-danger border border-status-danger/40 animate-pulse flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {t.reception.over60MinBadge}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {isCalled ? (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-status-success/20 text-status-success border border-status-success/40 animate-pulse">
                                  Called
                                </span>
                                {(() => {
                                  const elapsedSec = entry.calledAt ? Math.max(0, Math.floor((Date.now() - new Date(entry.calledAt).getTime()) / 1000)) : 0;
                                  return elapsedSec >= 600 ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-status-danger/25 text-status-danger border border-status-danger/50 animate-pulse flex items-center gap-0.5">
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      {t.reception.noShowOverdueBadge}
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-charcoal text-silver border border-charcoal-border">
                                Waiting
                              </span>
                            )}
                          </td>

                          {/* Action Buttons: Call, No-show, Cancel */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* No-show button (for Called entries, Rule R6: enabled only after 10 min) */}
                              {isCalled && (() => {
                                const elapsedSec = entry.calledAt ? Math.max(0, Math.floor((Date.now() - new Date(entry.calledAt).getTime()) / 1000)) : 0;
                                const isEligible = elapsedSec >= 600;
                                const remainingMins = Math.max(0, Math.ceil((600 - elapsedSec) / 60));

                                return isEligible ? (
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => setConfirmModal({ type: 'no-show', entry })}
                                    className="text-[11px] px-2.5 py-1 font-bold shadow-md animate-pulse"
                                  >
                                    {t.reception.noShowBtn}
                                  </Button>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled
                                    title={`No-show button becomes available after 10 minutes of arrival waiting time. Remaining: ${remainingMins} min.`}
                                    className="text-[11px] px-2.5 py-1 opacity-50 cursor-not-allowed"
                                  >
                                    {t.reception.noShowBtn} ({remainingMins}m)
                                  </Button>
                                );
                              })()}

                              {/* Cancel button (for Waiting and Called entries) */}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setConfirmModal({ type: 'cancel', entry })}
                                className="text-[11px] px-2 py-1 text-silver hover:text-status-danger hover:border-status-danger"
                              >
                                {t.reception.cancelBtn}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

      {/* ========================================================= */}
      {/* ADD WALK-IN MODAL DIALOG                                  */}
      {/* ========================================================= */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-lg w-full bg-charcoal-surface border border-charcoal-border rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-charcoal-border pb-3">
              <h3 className="font-bold text-lg text-silver-highlight flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-gold" />
                {t.reception.walkInModalTitle}
              </h3>
              <button
                onClick={() => setShowWalkInModal(false)}
                className="text-silver hover:text-silver-highlight"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {walkInError && (
              <div className="p-3 rounded-xl bg-status-danger/15 border border-status-danger/40 text-status-danger text-xs">
                {walkInError}
              </div>
            )}

            <form onSubmit={handleWalkInSubmit} className="space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block text-silver font-semibold mb-1">
                  Customer Name <span className="text-gold">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter walk-in customer name"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-charcoal border border-charcoal-border text-silver-highlight text-sm focus:outline-none focus:border-gold"
                />
              </div>

              {/* Phone (10 digits) */}
              <div>
                <label className="block text-silver font-semibold mb-1">
                  Mobile Number (Optional or 10 digits)
                </label>
                <div className="flex rounded-xl bg-charcoal border border-charcoal-border overflow-hidden">
                  <span className="px-3 py-2.5 text-xs text-gold font-bold bg-charcoal-border/40 flex items-center">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="10-digit phone number"
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full px-3 py-2.5 bg-transparent text-silver-highlight text-sm focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Services Selection (Max 3) */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-silver font-semibold">
                    Select Services ({walkInServices.length} of 3 selected)
                  </label>
                  {walkInServices.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setWalkInServices([])}
                      className="text-gold underline text-[11px]"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableServices.map((s) => {
                    const isSelected = walkInServices.includes(s.id);
                    const isMax = walkInServices.length >= 3 && !isSelected;

                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          if (isMax) return;
                          setWalkInServices(prev =>
                            prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                          );
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-charcoal border-gold text-silver-highlight'
                            : isMax
                            ? 'opacity-40 border-charcoal-border bg-charcoal/50 cursor-not-allowed'
                            : 'bg-charcoal border-charcoal-border hover:border-gold/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                              isSelected ? 'bg-gold border-gold text-charcoal-dark font-bold' : 'border-charcoal-border'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-semibold text-xs">{s.nameEn}</div>
                            <div className="text-[10px] text-silver">{s.durationMinutes} min</div>
                          </div>
                        </div>
                        <div className="font-bold text-gold font-mono">₹{s.price}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Barber Preference */}
              <div>
                <label className="block text-silver font-semibold mb-1.5">
                  Preferred Barber
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div
                    onClick={() => setWalkInBarber(null)}
                    className={`p-2 rounded-xl border text-center cursor-pointer transition-all ${
                      walkInBarber === null
                        ? 'bg-charcoal border-gold text-gold font-bold ring-1 ring-gold/20'
                        : 'bg-charcoal border-charcoal-border text-silver hover:border-gold/40'
                    }`}
                  >
                    Any Barber
                  </div>
                  {barbers.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => setWalkInBarber(b.id)}
                      className={`p-2 rounded-xl border text-center cursor-pointer transition-all ${
                        walkInBarber === b.id
                          ? 'bg-charcoal border-gold text-gold font-bold ring-1 ring-gold/20'
                          : 'bg-charcoal border-charcoal-border text-silver hover:border-gold/40'
                      }`}
                    >
                      {b.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-charcoal-border">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => setShowWalkInModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  fullWidth
                  disabled={walkInSubmitting}
                >
                  {walkInSubmitting ? 'Adding...' : t.reception.addWalkInConfirm}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CONFIRMATION MODAL (NO-SHOW / CANCEL)                      */}
      {/* ========================================================= */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-sm w-full bg-charcoal-surface border border-charcoal-border rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-base text-silver-highlight flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-status-warning" />
                {confirmModal.type === 'no-show'
                  ? t.reception.confirmNoShowTitle
                  : t.reception.confirmCancelTitle}
              </h4>
              <button
                onClick={() => setConfirmModal(null)}
                className="text-silver hover:text-silver-highlight"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-silver leading-relaxed">
              {confirmModal.type === 'no-show'
                ? `${t.reception.confirmNoShowNotice} ${t.reception.confirmNoShowDesc}`
                : t.reception.confirmCancelDesc}
              <br />
              <strong className="text-gold font-mono text-sm mt-1 inline-block">
                Token {confirmModal.entry.tokenNumber} ({confirmModal.entry.customerName})
              </strong>
            </p>

            <div className="flex gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => setConfirmModal(null)}
              >
                Keep
              </Button>
              <Button
                variant="danger"
                size="sm"
                fullWidth
                onClick={
                  confirmModal.type === 'no-show'
                    ? handleConfirmNoShow
                    : handleConfirmCancel
                }
              >
                Confirm {confirmModal.type === 'no-show' ? 'No-show' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
