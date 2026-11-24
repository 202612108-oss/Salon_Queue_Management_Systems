import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Scissors,
  Users,
  Clock,
  Phone,
  MapPin,
  Clock3,
  Sparkles,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Coffee,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useSocket } from '../../hooks/useSocket.js';
import { fetchSalonStatus, fetchQueueEntry } from '../../lib/api.js';

interface BarberData {
  id: string;
  name: string;
  slug: string;
  status: 'Available' | 'Busy' | 'On Break' | 'Off';
  workingToday: boolean;
  customersWaitingCount: number;
}

interface SalonData {
  settings: {
    salonName: string;
    tagline: string;
    address: string;
    phone: string;
    openingTime: string;
    closingTime: string;
    isOpen: boolean;
    isPaused: boolean;
    onlineJoiningAllowed: boolean;
    onlineJoiningReason?: 'closed' | 'paused' | 'cutoff';
  };
  queueSummary: {
    waitingCount: number;
    inChairCount: number;
    estimatedWaitMinutes: number;
    isOpen: boolean;
    isPaused: boolean;
  };
  barbers: BarberData[];
}

export const HomePage: React.FC = () => {
  const { t } = useLanguage();
  const { socket } = useSocket();

  const [salonData, setSalonData] = useState<SalonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeUserToken, setActiveUserToken] = useState<{ id: string; tokenNumber: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchSalonStatus();
      setSalonData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to salon system');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Check if customer already joined on this device and verify spot is still active
    const saved = localStorage.getItem('active_queue_spot');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id && parsed.tokenNumber) {
          fetchQueueEntry(parsed.id)
            .then((entry) => {
              if (entry && (entry.status === 'Waiting' || entry.status === 'Called' || entry.status === 'In Chair')) {
                setActiveUserToken({ id: entry.id, tokenNumber: entry.tokenNumber });
              } else {
                // If entry has reached a terminal status (No-show, Cancelled, Done), clear stale spot
                localStorage.removeItem('active_queue_spot');
                setActiveUserToken(null);
              }
            })
            .catch(() => {
              // Clear stale entry if not found
              localStorage.removeItem('active_queue_spot');
              setActiveUserToken(null);
            });
        }
      } catch (e) {
        // ignore invalid json
      }
    }
  }, [loadData]);

  // Real-time synchronization
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      loadData();
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
  }, [socket, loadData]);

  // Fallback sync: keeps home overview updated within 5s
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && !salonData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-silver tracking-wide">{t.common.loading}</p>
      </div>
    );
  }

  if (error && !salonData) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-status-danger mx-auto" />
        <h3 className="text-lg font-bold text-silver-highlight">{t.errors.generic}</h3>
        <p className="text-xs text-silver">{error}</p>
        <Button onClick={loadData} className="gap-2 mx-auto">
          <RefreshCw className="w-4 h-4" />
          {t.common.retry}
        </Button>
      </div>
    );
  }

  const settings = salonData?.settings;
  const queue = salonData?.queueSummary;
  const barbers = salonData?.barbers || [];

  const isQueueOpen = settings?.isOpen && !settings?.isPaused && settings?.onlineJoiningAllowed;
  const waitingCount = queue?.waitingCount ?? 0;
  const approxWait = queue?.estimatedWaitMinutes ?? 0;

  // Status Badge Logic
  const getStatusBadge = () => {
    if (!settings?.isOpen) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-status-danger/20 text-status-danger border border-status-danger/40">
          <span className="w-2 h-2 rounded-full bg-status-danger"></span>
          {t.common.closed}
        </span>
      );
    }
    if (settings?.isPaused) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-status-warning/20 text-status-warning border border-status-warning/40">
          <span className="w-2 h-2 rounded-full bg-status-warning animate-pulse"></span>
          {t.common.paused}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-status-success/20 text-status-success border border-status-success/40">
        <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
        {t.common.open}
      </span>
    );
  };

  const getBarberStatusChip = (status: BarberData['status']) => {
    switch (status) {
      case 'Available':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-status-success/15 text-status-success border border-status-success/30">
            {t.barber.statusAvailable}
          </span>
        );
      case 'Busy':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gold/15 text-gold border border-gold/30">
            {t.barber.statusBusy}
          </span>
        );
      case 'On Break':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-status-warning/15 text-status-warning border border-status-warning/30 flex items-center gap-1">
            <Coffee className="w-3 h-3" />
            {t.barber.statusBreak}
          </span>
        );
      case 'Off':
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-charcoal text-silver border border-charcoal-border">
            {t.barber.statusOff}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 md:pb-8">
      {/* Returning customer notification strip */}
      {activeUserToken && (
        <div className="p-3.5 rounded-2xl bg-charcoal-surface border border-gold/50 shadow-md flex items-center justify-between text-xs transition-all animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-gold flex-shrink-0" />
            <div>
              <span className="text-silver">{t.home.alreadyInQueue} </span>
              <span className="font-bold text-gold font-mono">{activeUserToken.tokenNumber}</span>
            </div>
          </div>
          <Link
            to={`/status/${activeUserToken.id}`}
            className="text-gold font-bold hover:underline flex items-center gap-1"
          >
            {t.home.viewStatusBtn}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Hero Salon Info Card */}
      <Card highlight className="relative overflow-hidden text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Salon Logo */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-charcoal border-2 border-gold/40 flex items-center justify-center text-gold shadow-lg shadow-gold/10 flex-shrink-0">
              <Scissors className="w-10 h-10 sm:w-12 sm:h-12 -rotate-45" />
            </div>

            {/* Salon Details */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-silver-highlight tracking-tight">
                  {settings?.salonName || t.common.salonName}
                </h1>
                {getStatusBadge()}
              </div>

              <p className="text-xs sm:text-sm text-gold font-medium">
                {settings?.tagline}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-y-1 gap-x-4 text-xs text-silver">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                  <span>{settings?.address}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock3 className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                  <span>
                    {settings?.openingTime} - {settings?.closingTime}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Call Salon Button (Tappable phone dialer) */}
          <div className="w-full sm:w-auto">
            <a
              href={`tel:${settings?.phone}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-charcoal border border-charcoal-border hover:border-gold/50 text-silver-highlight text-xs font-semibold w-full sm:w-auto transition-all shadow-sm"
            >
              <Phone className="w-3.5 h-3.5 text-gold" />
              <span>{t.home.callSalon}</span>
            </a>
          </div>
        </div>
      </Card>

      {/* Live Queue Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Waiting Count */}
        <Card className="flex items-center gap-4 py-6">
          <div className="w-14 h-14 rounded-2xl bg-charcoal border border-charcoal-border flex items-center justify-center text-gold shadow-inner flex-shrink-0">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-black text-silver-highlight tracking-tight font-mono">
              {waitingCount}
            </div>
            <div className="text-xs text-silver mt-0.5">
              {t.home.customersWaiting}
            </div>
          </div>
        </Card>

        {/* Estimated Wait */}
        <Card className="flex items-center gap-4 py-6">
          <div className="w-14 h-14 rounded-2xl bg-charcoal border border-charcoal-border flex items-center justify-center text-gold shadow-inner flex-shrink-0">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            {waitingCount === 0 ? (
              <>
                <div className="text-xl sm:text-2xl font-bold text-status-success">
                  {t.home.noWaitingServedImmediately}
                </div>
                <div className="text-xs text-silver mt-0.5">
                  {t.home.newCustomerWait}
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl sm:text-4xl font-black text-gold tracking-tight font-mono">
                  ~{approxWait} {t.common.minutes}
                </div>
                <div className="text-xs text-silver mt-0.5">
                  {t.home.newCustomerWait}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Notice Banner if Queue Closed or Paused */}
      {!isQueueOpen && (
        <div className="p-4 rounded-2xl bg-status-warning/10 border border-status-warning/30 flex items-start gap-3 text-status-warning text-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">
              {settings?.isPaused ? t.home.queuePaused : t.home.queueClosed}
            </span>
            <p className="mt-0.5 text-silver text-[11px]">{t.home.queueClosedNote}</p>
          </div>
        </div>
      )}

      {/* Barber Availability Section */}
      <Card>
        <div className="flex items-center justify-between mb-4 border-b border-charcoal-border/70 pb-3">
          <h3 className="text-sm sm:text-base font-bold text-silver-highlight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            {t.home.barberAvailability}
          </h3>
          <span className="text-xs text-silver">
            {barbers.filter(b => b.workingToday).length} Barbers Available
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {barbers.map((barber) => (
            <div
              key={barber.id}
              className="p-3.5 rounded-xl bg-charcoal border border-charcoal-border flex items-center justify-between transition-all hover:border-gold/30"
            >
              <div className="flex items-center gap-3">
                {/* Initials Avatar */}
                <div className="w-10 h-10 rounded-xl bg-charcoal-surface border border-gold/30 flex items-center justify-center font-bold text-gold text-sm shadow-sm">
                  {barber.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-sm text-silver-highlight">
                    {barber.name}
                  </div>
                  <div className="text-[11px] text-silver">
                    {barber.customersWaitingCount > 0
                      ? `${barber.customersWaitingCount} waiting`
                      : 'No queue'}
                  </div>
                </div>
              </div>
              <div>{getBarberStatusChip(barber.status)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Desktop / Tablet Inline Join Button */}
      <div className="hidden sm:block pt-2">
        <Link to={isQueueOpen ? '/join' : '#'}>
          <Button
            size="lg"
            fullWidth
            disabled={!isQueueOpen}
            className="text-base py-4 gap-2.5 shadow-xl shadow-gold/15"
          >
            <span>{t.home.joinQueueBtn}</span>
            <ArrowRight className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      {/* Mobile Sticky Bottom Bar (as specified in docs/02-screens.md 1.9) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-charcoal-dark/95 backdrop-blur-md border-t border-charcoal-border z-40 shadow-2xl">
        <Link to={isQueueOpen ? '/join' : '#'}>
          <Button
            size="lg"
            fullWidth
            disabled={!isQueueOpen}
            className="text-sm py-3.5 gap-2 shadow-lg shadow-gold/20"
          >
            <span>{t.home.joinQueueBtn}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
};
