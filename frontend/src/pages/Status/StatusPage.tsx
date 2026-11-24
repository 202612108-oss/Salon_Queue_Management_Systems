import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  Users,
  ArrowLeft,
  Bell,
  Sparkles,
  Scissors,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  Phone,
  Coffee,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useSocket } from '../../hooks/useSocket.js';
import { fetchQueueEntry, cancelQueueEntry } from '../../lib/api.js';

interface ServiceItem {
  serviceId: string;
  nameEn: string;
  nameGu?: string;
  nameHi?: string;
  durationMinutes: number;
  price: number;
}

interface EntryData {
  id: string;
  tokenNumber: string;
  customerName: string;
  customerPhone: string;
  preferredBarberId: string | null;
  preferredBarberName: string | null;
  isPreferredBarberOnBreak?: boolean;
  assignedBarberId: string | null;
  assignedBarberName: string | null;
  status: 'Waiting' | 'Called' | 'In Chair' | 'Done' | 'Cancelled' | 'No-show';
  source: 'online' | 'walk-in';
  totalPrice: number;
  totalDurationMinutes: number;
  position: number | null;
  estimatedWaitMinutes: number;
  joinedAt: string;
  calledAt?: string | null;
  serviceStartedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  services: ServiceItem[];
}

export const StatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();

  const [entry, setEntry] = useState<EntryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation modal & submitting states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Audio / notification chime ref
  const audioNotifiedRef = useRef<string | null>(null);

  const loadEntry = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await fetchQueueEntry(id);
      setEntry(data);
    } catch (err: any) {
      if (err.status === 404) {
        setError(t.status.entryNotFound);
      } else {
        setError(err.message || 'Failed to load queue status');
      }
    } finally {
      setLoading(false);
    }
  }, [id, t.status.entryNotFound]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  // Listen to Socket.IO for live queue movements
  useEffect(() => {
    if (!socket) return;
    const handleSync = () => {
      loadEntry();
    };

    socket.on('queue:updated', handleSync);
    socket.on('service:completed', handleSync);
    socket.on('service:started', handleSync);
    socket.on('customer:called', handleSync);
    socket.on('barber:status_changed', handleSync);
    socket.on('connect', handleSync);
    socket.on('reconnect', handleSync);

    return () => {
      socket.off('queue:updated', handleSync);
      socket.off('service:completed', handleSync);
      socket.off('service:started', handleSync);
      socket.off('customer:called', handleSync);
      socket.off('barber:status_changed', handleSync);
      socket.off('connect', handleSync);
      socket.off('reconnect', handleSync);
    };
  }, [socket, loadEntry]);

  // Fallback sync: ensures customer status updates within 5 seconds without manual browser refresh
  useEffect(() => {
    const interval = setInterval(() => {
      loadEntry();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadEntry]);

  // Audio / browser notification helper & active spot cleanup
  useEffect(() => {
    if (!entry) return;

    // Clear active spot from localStorage if this entry is closed (No-show, Cancelled, Done)
    if (entry.status === 'No-show' || entry.status === 'Cancelled' || entry.status === 'Done') {
      const saved = localStorage.getItem('active_queue_spot');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.id === entry.id) {
            localStorage.removeItem('active_queue_spot');
          }
        } catch (e) {
          // ignore
        }
      }
    }

    if (entry.status === 'Called' && audioNotifiedRef.current !== 'Called') {
      audioNotifiedRef.current = 'Called';
      // Web vibration if supported on mobile
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch (e) {
          // ignore
        }
      }
    } else if (
      entry.status === 'Waiting' &&
      entry.position !== null &&
      entry.position <= 2 &&
      audioNotifiedRef.current !== 'StartComing'
    ) {
      audioNotifiedRef.current = 'StartComing';
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(200);
        } catch (e) {
          // ignore
        }
      }
    }
  }, [entry]);

  // Handle Cancellation
  const handleConfirmCancel = async () => {
    if (!id || cancelling) return;
    setCancelling(true);
    setCancelError(null);

    try {
      const res = await cancelQueueEntry(id);
      if (res.success) {
        // Clear active spot from localStorage
        localStorage.removeItem('active_queue_spot');
        setShowCancelModal(false);
        // Refresh local entry data
        await loadEntry();
      }
    } catch (err: any) {
      setCancelError(err.message || 'Could not cancel your spot.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-silver">{t.common.loading}</p>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-5">
        <AlertCircle className="w-12 h-12 text-status-danger mx-auto" />
        <h3 className="text-xl font-bold text-silver-highlight">
          {error || t.status.entryNotFound}
        </h3>
        <p className="text-xs text-silver">
          Please check the URL or join the queue to receive a fresh token.
        </p>
        <Link to="/">
          <Button variant="secondary" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t.status.backHomeBtn}
          </Button>
        </Link>
      </div>
    );
  }

  const isWaiting = entry.status === 'Waiting';
  const isCalled = entry.status === 'Called';
  const isInChair = entry.status === 'In Chair';
  const isDone = entry.status === 'Done';
  const isCancelled = entry.status === 'Cancelled';
  const isNoShow = entry.status === 'No-show';

  // Condition 1: Second in line (or next) banner
  // Condition 2: When called: "It's your turn!" banner
  const isSecondInLine = isWaiting && entry.position !== null && entry.position <= 2;

  // Status Chip Rendering
  const getStatusChip = () => {
    switch (entry.status) {
      case 'Waiting':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-gold/15 text-gold border border-gold/40 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
            Waiting
          </span>
        );
      case 'Called':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-status-success/20 text-status-success border border-status-success/50 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-status-success animate-ping"></span>
            Called (Your Turn)
          </span>
        );
      case 'In Chair':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-gold text-charcoal-dark shadow-md flex items-center gap-1.5 font-bold">
            <Scissors className="w-3.5 h-3.5" />
            In Chair
          </span>
        );
      case 'Done':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-status-success/20 text-status-success border border-status-success/40 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      case 'Cancelled':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-status-danger/20 text-status-danger border border-status-danger/40 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      case 'No-show':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-charcoal text-silver border border-charcoal-border flex items-center gap-1.5">
            No-show
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20">
      {/* Offline / Reconnecting Banner */}
      {!isConnected && (
        <div className="p-2.5 rounded-xl bg-status-warning/20 border border-status-warning/40 text-status-warning text-xs text-center flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>{t.errors.offline}</span>
        </div>
      )}

      {/* Top Notification 1: Called ("It's your turn!") Green Banner */}
      {isCalled && (
        <div className="p-4 rounded-2xl bg-status-success/20 border-2 border-status-success shadow-xl shadow-status-success/10 flex items-center gap-3.5 text-status-success animate-bounce">
          <div className="p-2.5 rounded-xl bg-status-success text-charcoal-dark font-black">
            <Bell className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-silver-highlight">
              {t.status.yourTurnBanner}
            </h3>
            <p className="text-xs text-status-success mt-0.5 font-medium">
              Barber:{' '}
              <strong className="underline text-silver-highlight">
                {entry.assignedBarberName || entry.preferredBarberName || 'Barber Station'}
              </strong>
            </p>
          </div>
        </div>
      )}

      {/* Top Notification 2: Second in line ("Start coming to the salon") Amber Banner */}
      {isSecondInLine && !isCalled && (
        <div className="p-4 rounded-2xl bg-gold/15 border border-gold/60 shadow-lg shadow-gold/10 flex items-center gap-3.5 text-gold animate-fadeIn">
          <div className="p-2.5 rounded-xl bg-gold text-charcoal-dark font-bold">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-silver-highlight">
              {t.status.startComingBanner}
            </h3>
            <p className="text-xs text-gold/90 mt-0.5">
              {entry.position === 1 ? t.status.youAreNext : `Position ${entry.position} in line`}
            </p>
          </div>
        </div>
      )}

      {/* Cancelled State Banner */}
      {isCancelled && (
        <div className="p-4 rounded-2xl bg-charcoal-surface border border-charcoal-border text-center space-y-2">
          <XCircle className="w-8 h-8 text-status-danger mx-auto" />
          <h3 className="text-base font-bold text-silver-highlight">
            {t.status.spotCancelledTitle}
          </h3>
          <p className="text-xs text-silver max-w-sm mx-auto">
            {t.status.spotCancelledDesc}
          </p>
          <div className="pt-2">
            <Link to="/join">
              <Button size="md" className="gap-2" onClick={() => localStorage.removeItem('active_queue_spot')}>
                {t.status.joinAgainBtn}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* No-show State Banner (Rule R6 & R7) */}
      {isNoShow && (
        <div className="p-4 rounded-2xl bg-charcoal-surface border border-status-danger/40 text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-status-danger mx-auto" />
          <h3 className="text-base font-bold text-silver-highlight">
            {t.status.noShowTitle}
          </h3>
          <p className="text-xs text-silver max-w-sm mx-auto">
            {t.status.noShowDesc}
          </p>
          <div className="pt-2">
            <Link to="/join">
              <Button size="md" className="gap-2" onClick={() => localStorage.removeItem('active_queue_spot')}>
                {t.status.joinAgainBtn}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Preferred Barber on Break Banner (Rule R10 & T24) */}
      {isWaiting && entry.isPreferredBarberOnBreak && (
        <div className="p-3.5 rounded-2xl bg-status-warning/15 border border-status-warning/50 text-status-warning flex items-center gap-3 text-xs">
          <Coffee className="w-5 h-5 flex-shrink-0" />
          <div>
            <span className="font-bold">{entry.preferredBarberName || 'Your barber'} is on break</span>
            <p className="text-silver mt-0.5">{t.status.barberOnBreakWaitNotice}</p>
          </div>
        </div>
      )}

      {/* In Chair State Banner */}
      {isInChair && (
        <div className="p-4 rounded-2xl bg-charcoal border border-gold/40 text-center space-y-1">
          <Scissors className="w-6 h-6 text-gold mx-auto" />
          <h3 className="text-sm font-bold text-silver-highlight">
            {t.status.serviceInProgress}{' '}
            <span className="text-gold">
              {entry.assignedBarberName || entry.preferredBarberName || 'your barber'}
            </span>
          </h3>
        </div>
      )}

      {/* Completed State Banner */}
      {isDone && (
        <div className="p-4 rounded-2xl bg-status-success/15 border border-status-success/40 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-status-success mx-auto" />
          <h3 className="text-base font-bold text-silver-highlight">
            {t.status.completedTitle}
          </h3>
          <Link to="/">
            <Button size="sm" variant="secondary" className="mt-2">
              {t.status.backHomeBtn}
            </Button>
          </Link>
        </div>
      )}

      {/* Large Token Display Card */}
      <Card highlight className="text-center py-7 px-4 relative overflow-hidden">
        <div className="flex justify-between items-center mb-2 px-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-silver">
            {t.status.yourToken}
          </span>
          {getStatusChip()}
        </div>

        {/* Big Sequential Token (e.g. S-1, S-2) */}
        <div className="text-6xl sm:text-7xl font-black text-gold tracking-tight font-mono py-2 select-all">
          {entry.tokenNumber}
        </div>

        {/* Customer Name */}
        <div className="text-lg font-bold text-silver-highlight mt-1 flex items-center justify-center gap-2">
          <User className="w-4 h-4 text-gold" />
          <span>{entry.customerName}</span>
        </div>

        <div className="text-xs text-silver mt-0.5">
          {entry.customerPhone}
        </div>
      </Card>

      {/* Live Position & Estimated Wait Row */}
      {isWaiting && (
        <div className="grid grid-cols-2 gap-3.5">
          {/* Queue Position Tile */}
          <Card className="text-center py-5">
            <Users className="w-5 h-5 text-gold mx-auto mb-1.5" />
            <div className="text-xs text-silver font-medium">
              {t.status.yourPosition}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-silver-highlight mt-1 font-mono">
              {entry.position === 1 ? (
                <span className="text-status-success text-xl sm:text-2xl font-bold">Next</span>
              ) : (
                `#${entry.position}`
              )}
            </div>
          </Card>

          {/* Wait Time Tile */}
          <Card className="text-center py-5">
            <Clock className="w-5 h-5 text-gold mx-auto mb-1.5" />
            <div className="text-xs text-silver font-medium">
              {t.status.estimatedWait}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gold mt-1 font-mono">
              {entry.estimatedWaitMinutes === 0 ? (
                <span className="text-status-success text-xl sm:text-2xl font-bold">
                  {t.status.rightAway}
                </span>
              ) : (
                `~${entry.estimatedWaitMinutes} ${t.common.minutes}`
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Selected Services & Booking Details Card */}
      <Card className="space-y-4">
        <h4 className="text-xs font-bold text-silver uppercase tracking-wider border-b border-charcoal-border pb-2.5 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          {t.status.selectedServices}
        </h4>

        {/* List of services with individual prices */}
        <div className="space-y-2 text-xs">
          {entry.services.map((srv) => (
            <div key={srv.serviceId} className="flex justify-between items-center text-silver">
              <span className="font-medium text-silver-highlight">{srv.nameEn}</span>
              <div className="flex items-center gap-3">
                <span className="text-silver/70">{srv.durationMinutes} min</span>
                <span className="font-bold text-gold font-mono">₹{srv.price}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Barber & Totals */}
        <div className="border-t border-charcoal-border pt-3 space-y-2 text-xs text-silver">
          {/* Barber */}
          <div className="flex justify-between items-center">
            <span>{t.status.preferredBarber}:</span>
            <span className="font-bold text-gold">
              {entry.preferredBarberName || entry.assignedBarberName || t.join.anyBarber}
            </span>
          </div>

          {/* Total Duration */}
          <div className="flex justify-between items-center">
            <span>{t.status.totalDuration}:</span>
            <span className="font-bold text-silver-highlight font-mono">
              {entry.totalDurationMinutes} {t.common.minutes}
            </span>
          </div>

          {/* Total Price */}
          <div className="flex justify-between items-center pt-1 border-t border-charcoal-border/50 text-sm">
            <span className="font-bold text-silver-highlight">{t.status.totalPrice}:</span>
            <span className="text-xl font-black text-gold font-mono">
              ₹{entry.totalPrice}
            </span>
          </div>
        </div>
      </Card>

      {/* Helper notice */}
      <p className="text-[11px] text-center text-silver/70 italic">
        {t.status.keepTabOpenTip}
      </p>

      {/* Actions */}
      <div className="space-y-3 pt-2">
        {/* Cancel My Spot Button (ONLY visible/enabled while Waiting) */}
        {isWaiting && (
          <Button
            variant="danger"
            fullWidth
            onClick={() => setShowCancelModal(true)}
            className="py-3 text-sm"
          >
            {t.status.cancelBtn}
          </Button>
        )}

        {/* Back to Home Link */}
        <Link to="/" className="block">
          <Button variant="secondary" fullWidth className="gap-2 py-3 text-sm">
            <ArrowLeft className="w-4 h-4" />
            {t.status.backHomeBtn}
          </Button>
        </Link>
      </div>

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-sm w-full bg-charcoal-surface border border-charcoal-border rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-base text-silver-highlight flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-status-danger" />
                {t.status.cancelDialogTitle}
              </h4>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-silver hover:text-silver-highlight"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-silver leading-relaxed">
              {t.status.cancelDialogDesc}
            </p>

            {cancelError && (
              <p className="text-xs text-status-danger bg-status-danger/10 p-2 rounded-lg">
                {cancelError}
              </p>
            )}

            <div className="flex gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                disabled={cancelling}
                onClick={() => setShowCancelModal(false)}
              >
                {t.status.keepMySpot}
              </Button>
              <Button
                variant="danger"
                size="sm"
                fullWidth
                disabled={cancelling}
                onClick={handleConfirmCancel}
              >
                {cancelling ? t.status.cancelling : t.status.confirmCancel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
