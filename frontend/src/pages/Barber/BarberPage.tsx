import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Play, 
  CheckCircle2, 
  Coffee, 
  User, 
  Clock, 
  Timer, 
  Sparkles, 
  AlertCircle, 
  ChevronRight, 
  WifiOff, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Users,
  Check
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher.js';
import { useSocket } from '../../hooks/useSocket.js';
import { 
  fetchBarberDetails, 
  startBarberService, 
  completeBarberService, 
  updateBarberStatus 
} from '../../lib/api.js';

interface ServiceItem {
  serviceId: string;
  nameEn: string;
  durationMinutes: number;
  price: number;
}

interface CurrentCustomer {
  id: string;
  tokenNumber: string;
  customerName: string;
  customerPhone: string;
  status: 'Called' | 'In Chair';
  calledAt?: string | null;
  serviceStartedAt?: string | null;
  totalDurationMinutes: number;
  totalPrice: number;
  services: ServiceItem[];
  elapsedSeconds: number;
}

interface NextUpCustomer {
  id: string;
  tokenNumber: string;
  customerName: string;
  servicesSummary: string;
  totalDurationMinutes: number;
  isDirectPreference: boolean;
}

interface BarberDetails {
  barber: {
    id: string;
    name: string;
    slug: string;
    avatarUrl?: string | null;
    active: boolean;
    workingToday: boolean;
    status: 'Available' | 'Busy' | 'On Break' | 'Off';
    breakStartedAt?: string | null;
  };
  currentCustomer: CurrentCustomer | null;
  nextUp: NextUpCustomer[];
  todaySummary: {
    completedCount: number;
    avgServiceMinutes: number;
  };
}

export const BarberPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [data, setData] = useState<BarberDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [revealPhone, setRevealPhone] = useState(false);

  // Local ticking timer for service and break
  const [serviceTimerSeconds, setServiceTimerSeconds] = useState(0);
  const [breakTimerSeconds, setBreakTimerSeconds] = useState(0);
  const [tickedServices, setTickedServices] = useState<Record<string, boolean>>({});

  // Confirm dialogs
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'start' | 'done';
    title: string;
    desc: string;
  } | null>(null);

  // Station switch list
  const knownBarbers = [
    { name: 'Ravi', slug: 'ravi' },
    { name: 'Amit', slug: 'amit' },
    { name: 'Imran', slug: 'imran' },
  ];

  const currentSlug = name?.toLowerCase() || 'ravi';

  // Load barber details
  const loadBarberData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetchBarberDetails(currentSlug);
      setData(res);

      // Initialize service timer if In Chair or Called
      if (res.currentCustomer) {
        if (res.currentCustomer.status === 'In Chair' && res.currentCustomer.serviceStartedAt) {
          const started = new Date(res.currentCustomer.serviceStartedAt).getTime();
          setServiceTimerSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
        } else if (res.currentCustomer.status === 'Called' && res.currentCustomer.calledAt) {
          const called = new Date(res.currentCustomer.calledAt).getTime();
          setServiceTimerSeconds(Math.max(0, Math.floor((Date.now() - called) / 1000)));
        }
      } else {
        setServiceTimerSeconds(0);
        setTickedServices({});
      }

      // Initialize break timer if On Break
      if (res.barber.status === 'On Break' && res.barber.breakStartedAt) {
        const breakStart = new Date(res.barber.breakStartedAt).getTime();
        setBreakTimerSeconds(Math.max(0, Math.floor((Date.now() - breakStart) / 1000)));
      } else {
        setBreakTimerSeconds(0);
      }
    } catch (err: any) {
      console.error('Failed to load barber details:', err);
      setError(err.message || 'Barber not found');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentSlug]);

  useEffect(() => {
    loadBarberData();
  }, [loadBarberData]);

  const { socket, isConnected } = useSocket();

  // Socket.IO real-time synchronization
  useEffect(() => {
    setIsDisconnected(!isConnected);
  }, [isConnected]);

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      loadBarberData(true);
    };

    socket.on('queue:updated', handleUpdate);
    socket.on('customer:called', handleUpdate);
    socket.on('service:started', handleUpdate);
    socket.on('service:completed', handleUpdate);
    socket.on('barber:status_changed', handleUpdate);
    socket.on('connect', handleUpdate);
    socket.on('reconnect', handleUpdate);

    return () => {
      socket.off('queue:updated', handleUpdate);
      socket.off('customer:called', handleUpdate);
      socket.off('service:started', handleUpdate);
      socket.off('service:completed', handleUpdate);
      socket.off('barber:status_changed', handleUpdate);
      socket.off('connect', handleUpdate);
      socket.off('reconnect', handleUpdate);
    };
  }, [socket, loadBarberData]);

  // Fallback sync: ensures barber station updates within 5 seconds without manual browser refresh
  useEffect(() => {
    const interval = setInterval(() => {
      loadBarberData(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [loadBarberData]);

  // Local second-by-second ticker
  useEffect(() => {
    const interval = setInterval(() => {
      if (data?.currentCustomer) {
        setServiceTimerSeconds((prev) => prev + 1);
      }
      if (data?.barber.status === 'On Break') {
        setBreakTimerSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [data?.currentCustomer, data?.barber.status]);

  // Helper formatting mm:ss
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer color threshold
  const getTimerColorClass = () => {
    if (!data?.currentCustomer || data.currentCustomer.status !== 'In Chair') {
      return 'text-gold';
    }
    const expectedSec = data.currentCustomer.totalDurationMinutes * 60;
    if (expectedSec <= 0) return 'text-gold';

    const ratio = serviceTimerSeconds / expectedSec;
    if (ratio >= 1.25) {
      return 'text-status-danger animate-pulse'; // +25% over
    }
    if (ratio >= 1.1) {
      return 'text-status-warning'; // +10% over
    }
    return 'text-gold';
  };

  // Toggle per-service checklist
  const toggleServiceTick = (serviceId: string) => {
    setTickedServices((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }));
  };

  // Handler: Start service
  const handleStartService = async () => {
    if (!data?.barber.id) return;
    setActionLoading(true);
    setActionError(null);
    setConfirmDialog(null);
    try {
      await startBarberService(data.barber.id);
      await loadBarberData(true);
    } catch (err: any) {
      setActionError(err.message || 'Failed to start service');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Complete service
  const handleCompleteService = async () => {
    if (!data?.barber.id) return;
    setActionLoading(true);
    setActionError(null);
    setConfirmDialog(null);
    try {
      await completeBarberService(data.barber.id);
      await loadBarberData(true);
    } catch (err: any) {
      setActionError(err.message || 'Failed to complete service');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Toggle break
  const handleToggleBreak = async () => {
    if (!data?.barber.id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const nextStatus = data.barber.status === 'On Break' ? 'Available' : 'On Break';
      await updateBarberStatus(data.barber.id, nextStatus);
      await loadBarberData(true);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update break status');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-10 h-10 text-gold animate-spin" />
        <p className="text-silver text-sm">Loading barber station...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-charcoal-surface border border-charcoal-border flex items-center justify-center text-gold">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-silver-highlight">{t.barber.barberNotFound}</h2>
        <p className="text-silver text-sm">{error || `We couldn't find barber "${name}".`}</p>

        {/* Station switcher */}
        <div className="space-y-3 pt-4">
          <p className="text-xs uppercase tracking-wider text-gold font-bold">{t.barber.switchStation}:</p>
          <div className="flex justify-center gap-3">
            {knownBarbers.map((b) => (
              <Button
                key={b.slug}
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/barber/${b.slug}`)}
              >
                {b.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { barber, currentCustomer, nextUp, todaySummary } = data;
  const isServing = Boolean(currentCustomer);
  const isInChair = currentCustomer?.status === 'In Chair';
  const isCalled = currentCustomer?.status === 'Called';
  const isOnBreak = barber.status === 'On Break';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Reconnection Alert Banner */}
      {isDisconnected && (
        <div className="p-3 bg-status-warning/20 border border-status-warning/40 rounded-2xl flex items-center gap-2.5 text-status-warning text-xs font-semibold animate-pulse">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>{t.errors.offline}</span>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-3 bg-status-danger/20 border border-status-danger/40 rounded-2xl flex items-center justify-between text-status-danger text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-xs underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header & Station Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-charcoal-surface p-4 sm:p-5 rounded-3xl border border-charcoal-border shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-charcoal border-2 border-gold/40 flex items-center justify-center font-bold text-gold text-lg shadow-md">
            {barber.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-silver-highlight tracking-wide">
                {barber.name}
              </h1>
              <span className="text-xs text-silver font-medium">({t.barber.title})</span>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-2 mt-1">
              {barber.status === 'Available' && !isServing ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-status-success/15 text-status-success border border-status-success/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
                  {t.barber.statusAvailable}
                </span>
              ) : isOnBreak ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-status-warning/15 text-status-warning border border-status-warning/30 flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5" />
                  {t.barber.statusBreak}
                </span>
              ) : isServing ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gold/15 text-gold border border-gold/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gold animate-ping"></span>
                  {isInChair ? t.barber.inService : t.barber.calledWaitingArrival}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-charcoal text-silver border border-charcoal-border">
                  {barber.status}
                </span>
              )}

              {/* Station Switcher Pills */}
              <div className="hidden sm:flex items-center gap-1 ml-4 pl-4 border-l border-charcoal-border/70">
                <span className="text-[11px] text-silver uppercase font-semibold mr-1">Station:</span>
                {knownBarbers.map((b) => (
                  <button
                    key={b.slug}
                    onClick={() => navigate(`/barber/${b.slug}`)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      b.slug === currentSlug
                        ? 'bg-gold text-charcoal-dark shadow-sm'
                        : 'bg-charcoal text-silver hover:text-silver-highlight hover:bg-charcoal-border'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3 justify-between sm:justify-end">
          <Link
            to="/reception"
            className="text-xs text-silver hover:text-gold flex items-center gap-1 font-medium transition-colors"
          >
            Reception Dashboard <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Break Status / Toggle Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-charcoal-surface/60 rounded-2xl border border-charcoal-border/60">
        <div className="flex items-center gap-2.5 text-xs">
          <Coffee className={`w-4 h-4 ${isOnBreak ? 'text-status-warning' : 'text-silver'}`} />
          {isOnBreak ? (
            <span className="text-status-warning font-semibold">
              {t.barber.onBreakTitle} •{' '}
              <span className="font-mono">{formatTime(breakTimerSeconds)}</span>
            </span>
          ) : isServing ? (
            <span className="text-silver/80">
              {t.barber.cannotBreakWhileBusy}
            </span>
          ) : (
            <span className="text-silver">
              Currently available for customer calls.
            </span>
          )}
        </div>

        <div>
          {isOnBreak ? (
            <Button
              variant="primary"
              size="sm"
              disabled={actionLoading}
              onClick={handleToggleBreak}
              className="gap-2 text-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t.barber.backFromBreak}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled={isServing || actionLoading}
              onClick={handleToggleBreak}
              className="gap-2 text-xs text-silver hover:text-gold"
              title={isServing ? t.barber.cannotBreakWhileBusy : undefined}
            >
              <Coffee className="w-4 h-4 text-gold" />
              {t.barber.goOnBreak}
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid: Current Customer & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Current Customer Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card highlight={isServing} className="p-6 sm:p-7 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-charcoal-border/70 pb-4">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-gold flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {t.barber.currentCustomer}
                </h2>
                <p className="text-xs text-silver mt-0.5">
                  {isServing
                    ? isInChair
                      ? t.barber.inService
                      : t.barber.calledWaitingArrival
                    : t.barber.noCustomerAssigned}
                </p>
              </div>

              {currentCustomer && (
                <div className="text-right">
                  <span className="text-xs text-silver uppercase font-semibold">
                    {t.barber.expectedTime}:
                  </span>
                  <div className="text-sm font-bold text-silver-highlight font-mono">
                    {currentCustomer.totalDurationMinutes} min
                  </div>
                </div>
              )}
            </div>

            {currentCustomer ? (
              <div className="py-6 space-y-6">
                {/* Token and Name */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-charcoal border border-charcoal-border/80">
                  <div>
                    <div className="text-4xl sm:text-5xl font-black font-mono text-gold tracking-tight">
                      {currentCustomer.tokenNumber}
                    </div>
                    <div className="text-xl font-bold text-silver-highlight mt-1">
                      {currentCustomer.customerName}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-silver mt-1">
                      <span>Phone:</span>
                      <span className="font-mono">
                        {revealPhone
                          ? currentCustomer.customerPhone
                          : `${currentCustomer.customerPhone.slice(0, 2)}••••••${currentCustomer.customerPhone.slice(-2)}`}
                      </span>
                      <button
                        onClick={() => setRevealPhone(!revealPhone)}
                        className="text-gold/70 hover:text-gold p-0.5"
                        title="Toggle phone visibility"
                      >
                        {revealPhone ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Timer Display */}
                  <div className="sm:text-right flex flex-col sm:items-end justify-center pt-3 sm:pt-0 border-t sm:border-t-0 border-charcoal-border/50">
                    <div className="text-xs text-silver uppercase font-semibold flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-gold" />
                      {isInChair ? t.barber.elapsed : 'Arrival Timer'}
                    </div>
                    <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tight mt-1 ${getTimerColorClass()}`}>
                      {formatTime(serviceTimerSeconds)}
                    </div>
                    {isInChair && serviceTimerSeconds > currentCustomer.totalDurationMinutes * 60 * 1.1 && (
                      <span className="text-[11px] font-bold text-status-warning mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {t.barber.overExpectedTime}
                      </span>
                    )}
                  </div>
                </div>

                {/* Selected Services Checklist */}
                <div>
                  <h3 className="text-xs font-bold text-silver uppercase tracking-wider mb-2.5">
                    Selected Services & Checkpoints:
                  </h3>
                  <div className="space-y-2">
                    {currentCustomer.services.map((srv) => {
                      const isTicked = Boolean(tickedServices[srv.serviceId]);
                      return (
                        <div
                          key={srv.serviceId}
                          onClick={() => toggleServiceTick(srv.serviceId)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isTicked
                              ? 'bg-status-success/10 border-status-success/30 text-status-success'
                              : 'bg-charcoal/70 border-charcoal-border text-silver-highlight hover:border-gold/40'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                                isTicked
                                  ? 'bg-status-success border-status-success text-charcoal-dark font-bold'
                                  : 'border-silver/40 text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-sm font-semibold ${isTicked ? 'line-through text-silver' : ''}`}>
                              {srv.nameEn}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded bg-charcoal-surface border border-charcoal-border text-silver">
                              {srv.durationMinutes} min
                            </span>
                            <span className="font-bold text-gold">₹{srv.price}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Main Action Buttons: Start vs Done */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  {isCalled && (
                    <Button
                      fullWidth
                      size="lg"
                      variant="primary"
                      disabled={actionLoading}
                      onClick={() =>
                        setConfirmDialog({
                          type: 'start',
                          title: t.barber.confirmStartTitle,
                          desc: t.barber.confirmStartDesc
                            .replace('{name}', currentCustomer.customerName)
                            .replace('{token}', currentCustomer.tokenNumber),
                        })
                      }
                      className="py-4 text-base font-bold shadow-lg shadow-gold/20 gap-2"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      {t.barber.startBtn}
                    </Button>
                  )}

                  {isInChair && (
                    <Button
                      fullWidth
                      size="lg"
                      variant="primary"
                      disabled={actionLoading}
                      onClick={() =>
                        setConfirmDialog({
                          type: 'done',
                          title: t.barber.confirmDoneTitle,
                          desc: t.barber.confirmDoneDesc
                            .replace('{name}', currentCustomer.customerName)
                            .replace('{token}', currentCustomer.tokenNumber),
                        })
                      }
                      className="py-4 text-base font-bold shadow-lg shadow-gold/20 gap-2 bg-gradient-to-r from-gold via-silver-highlight to-gold text-charcoal-dark"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      {t.barber.doneBtn}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Empty State: No Customer Currently */
              <div className="py-14 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-charcoal border border-charcoal-border/70 flex items-center justify-center text-status-success">
                  <User className="w-8 h-8 opacity-60" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-silver-highlight">
                    {t.barber.noCustomerAssigned}
                  </h3>
                  <p className="text-xs text-silver max-w-sm mx-auto">
                    {t.barber.noCustomerSub}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-status-success/15 text-status-success border border-status-success/30">
                  <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
                  Ready at station
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Next Up Queue & Today's Performance */}
        <div className="space-y-6">
          {/* Next Up in Queue */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-charcoal-border/70 pb-3">
              <h3 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t.barber.nextUp}
              </h3>
              <span className="text-[11px] text-silver font-semibold">
                {nextUp.length} waiting
              </span>
            </div>

            {nextUp.length > 0 ? (
              <div className="space-y-3">
                {nextUp.map((cust, idx) => (
                  <div
                    key={cust.id}
                    className="p-3 rounded-2xl bg-charcoal border border-charcoal-border/70 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-silver/60">#{idx + 1}</span>
                        <span className="font-mono font-bold text-gold text-xs px-2 py-0.5 rounded bg-charcoal-surface border border-gold/30">
                          {cust.tokenNumber}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          cust.isDirectPreference
                            ? 'bg-gold/15 text-gold border border-gold/30'
                            : 'bg-silver/10 text-silver border border-silver/20'
                        }`}
                      >
                        {cust.isDirectPreference ? barber.name : 'Any Barber'}
                      </span>
                    </div>

                    <div className="font-bold text-sm text-silver-highlight">
                      {cust.customerName}
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-silver pt-1 border-t border-charcoal-border/40">
                      <span className="truncate max-w-[150px]">{cust.servicesSummary}</span>
                      <span className="font-mono font-semibold">{cust.totalDurationMinutes} min</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-silver/60 text-xs">
                No customers waiting for this station.
              </div>
            )}
          </Card>

          {/* Today's Summary */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-bold text-gold uppercase tracking-wider border-b border-charcoal-border/70 pb-3">
              Today's Station Summary
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-charcoal border border-charcoal-border/60 text-center space-y-1">
                <span className="text-[11px] text-silver block uppercase font-semibold">
                  {t.barber.servicesCompletedToday}
                </span>
                <span className="text-2xl font-black font-mono text-silver-highlight">
                  {todaySummary.completedCount}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-charcoal border border-charcoal-border/60 text-center space-y-1">
                <span className="text-[11px] text-silver block uppercase font-semibold">
                  {t.barber.avgServiceTime}
                </span>
                <span className="text-2xl font-black font-mono text-gold">
                  {todaySummary.avgServiceMinutes}m
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-dark/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-charcoal-surface w-full max-w-sm rounded-3xl border border-charcoal-border p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center mx-auto">
              {confirmDialog.type === 'start' ? (
                <Play className="w-6 h-6 fill-current" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-silver-highlight">
                {confirmDialog.title}
              </h3>
              <p className="text-xs text-silver mt-1">{confirmDialog.desc}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                fullWidth
                variant="secondary"
                size="sm"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                variant="primary"
                size="sm"
                disabled={actionLoading}
                onClick={
                  confirmDialog.type === 'start' ? handleStartService : handleCompleteService
                }
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarberPage;
