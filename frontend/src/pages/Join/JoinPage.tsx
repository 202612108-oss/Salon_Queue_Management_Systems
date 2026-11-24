import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  Scissors,
  UserCheck,
  Check,
  Clock,
  Sparkles,
  AlertCircle,
  X,
  Coffee,
  HelpCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useSocket } from '../../hooks/useSocket.js';
import {
  fetchServices,
  fetchBarbers,
  fetchSalonStatus,
  joinQueueApi,
  checkActivePhone,
} from '../../lib/api.js';

interface ServiceItem {
  id: string;
  nameEn: string;
  nameGu?: string;
  nameHi?: string;
  durationMinutes: number;
  price: number;
  active: boolean;
  orderIndex: number;
}

interface BarberItem {
  id: string;
  name: string;
  slug: string;
  status: 'Available' | 'Busy' | 'On Break' | 'Off';
  workingToday: boolean;
  customersWaitingCount: number;
}

export const JoinPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { socket } = useSocket();
  const navigate = useNavigate();

  // Data states
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [barbers, setBarbers] = useState<BarberItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form input states
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);

  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null); // null = "Any Barber"

  // Submission & Validation states
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateEntry, setDuplicateEntry] = useState<{ id: string; tokenNumber: string } | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Estimated wait based on current salon queue
  const [salonWaitMinutes, setSalonWaitMinutes] = useState<number>(0);
  const [isOnlineOpen, setIsOnlineOpen] = useState(true);

  // Load services, barbers, and salon info
  const loadOptions = useCallback(async () => {
    try {
      const [srvs, barbs, salon] = await Promise.all([
        fetchServices(),
        fetchBarbers(),
        fetchSalonStatus(),
      ]);

      setServices(srvs);
      setBarbers(barbs);
      setSalonWaitMinutes(salon?.queueSummary?.estimatedWaitMinutes || 0);

      const onlineAllowed = salon?.settings?.isOpen && !salon?.settings?.isPaused && salon?.settings?.onlineJoiningAllowed;
      setIsOnlineOpen(Boolean(onlineAllowed));

      // Pre-select Haircut if nothing selected
      setSelectedServiceIds(prev => {
        if (prev.length === 0 && srvs.length > 0) {
          const haircut = srvs.find((s: ServiceItem) => s.nameEn.toLowerCase().includes('haircut'));
          return haircut ? [haircut.id] : [];
        }
        return prev;
      });
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load options');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Live real-time menu and salon state updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      loadOptions();
    };
    socket.on('queue:updated', handleUpdate);
    socket.on('service:updated', handleUpdate);
    socket.on('salon:status_changed', handleUpdate);
    socket.on('barber:status_changed', handleUpdate);

    return () => {
      socket.off('queue:updated', handleUpdate);
      socket.off('service:updated', handleUpdate);
      socket.off('salon:status_changed', handleUpdate);
      socket.off('barber:status_changed', handleUpdate);
    };
  }, [socket, loadOptions]);

  // Form validations
  const isNameValid = useMemo(() => {
    const trimmed = name.trim();
    return trimmed.length >= 2 && trimmed.length <= 50;
  }, [name]);

  const nameError = useMemo(() => {
    if (!nameTouched) return null;
    if (name.trim().length === 0) return t.validation.nameRequired;
    if (name.trim().length < 2) return t.validation.nameRequired;
    if (name.trim().length > 50) return 'Name is too long (max 50 chars).';
    return null;
  }, [name, nameTouched, t]);

  const normalizedPhoneDigits = useMemo(() => {
    return phone.replace(/\D/g, '');
  }, [phone]);

  const isPhoneValid = useMemo(() => {
    return normalizedPhoneDigits.length === 10 && /^[6-9]/.test(normalizedPhoneDigits);
  }, [normalizedPhoneDigits]);

  const phoneError = useMemo(() => {
    if (!phoneTouched) return null;
    if (normalizedPhoneDigits.length === 0) return t.validation.phoneInvalid;
    if (normalizedPhoneDigits.length !== 10 || !/^[6-9]/.test(normalizedPhoneDigits)) {
      return t.validation.phoneInvalid;
    }
    return null;
  }, [normalizedPhoneDigits, phoneTouched, t]);

  const isServicesValid = useMemo(() => {
    return selectedServiceIds.length >= 1 && selectedServiceIds.length <= 3;
  }, [selectedServiceIds]);

  const isFormValid = isNameValid && isPhoneValid && isServicesValid;

  // Selected services objects
  const selectedServices = useMemo(() => {
    return services.filter(s => selectedServiceIds.includes(s.id));
  }, [services, selectedServiceIds]);

  // Dynamically calculated total price and duration
  const totalPrice = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + s.price, 0);
  }, [selectedServices]);

  const totalDurationMinutes = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [selectedServices]);

  // Selected barber object
  const chosenBarber = useMemo(() => {
    if (!selectedBarberId) return null;
    return barbers.find(b => b.id === selectedBarberId) || null;
  }, [barbers, selectedBarberId]);

  // Service toggle handler (maximum 3 limit)
  const toggleService = (id: string) => {
    setSelectedServiceIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      if (prev.length >= 3) {
        return prev; // capped at 3
      }
      return [...prev, id];
    });
  };

  // Check duplicate phone on blur
  const handlePhoneBlur = async () => {
    setPhoneTouched(true);
    if (isPhoneValid) {
      try {
        const check = await checkActivePhone(normalizedPhoneDigits);
        if (check.activeEntry) {
          setDuplicateEntry({
            id: check.activeEntry.id,
            tokenNumber: check.activeEntry.tokenNumber,
          });
        } else {
          setDuplicateEntry(null);
        }
      } catch (e) {
        // ignore background check failure
      }
    }
  };

  // Back button handler with dirty form check
  const isFormDirty = name.trim().length > 0 || phone.trim().length > 0;
  const handleBack = () => {
    if (isFormDirty) {
      setShowDiscardDialog(true);
    } else {
      navigate('/');
    }
  };

  // Submission handler
  const handleConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setNameTouched(true);
    setPhoneTouched(true);

    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    setDuplicateEntry(null);

    try {
      const response = await joinQueueApi({
        customerName: name.trim(),
        customerPhone: normalizedPhoneDigits,
        serviceIds: selectedServiceIds,
        preferredBarberId: selectedBarberId,
        source: 'online',
      });

      if (response.success && response.entry) {
        // Save token to localStorage for returning customer detection
        localStorage.setItem(
          'active_queue_spot',
          JSON.stringify({
            id: response.entry.id,
            tokenNumber: response.entry.tokenNumber,
            customerPhone: normalizedPhoneDigits,
          })
        );
        // Redirect directly to My Status (/status/:id)
        navigate(`/status/${response.entry.id}`);
      }
    } catch (err: any) {
      if (err.status === 409 && err.data?.existingId) {
        // Rule R5: Duplicate active entry
        setDuplicateEntry({
          id: err.data.existingId,
          tokenNumber: err.data.existingToken || 'T-***',
        });
      } else {
        setSubmitError(err.message || t.join.saveFailed);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Get localized service name
  const getServiceName = (srv: ServiceItem) => {
    if (language === 'gu' && srv.nameGu) return srv.nameGu;
    if (language === 'hi' && srv.nameHi) return srv.nameHi;
    return srv.nameEn;
  };

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-silver">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32 lg:pb-12">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2.5 rounded-xl bg-charcoal-surface border border-charcoal-border text-silver hover:text-gold hover:border-gold/40 transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-silver-highlight tracking-tight">
            {t.join.title}
          </h2>
          <p className="text-xs text-silver mt-0.5">
            {t.common.salonName} • Live Queue Entry
          </p>
        </div>
      </div>

      {/* Queue Closed Alert Banner */}
      {!isOnlineOpen && (
        <div className="p-4 rounded-2xl bg-status-danger/15 border border-status-danger/40 text-status-danger text-xs font-semibold flex items-start gap-3 shadow-md animate-fadeIn">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold text-sm">Online Joining is Closed</div>
            <p className="text-silver/90 leading-relaxed font-normal">
              Online queue joining is currently closed. Customers already in line will still be served.
              You may visit the salon to be registered as a walk-in at reception.
            </p>
          </div>
        </div>
      )}

      {/* Duplicate active entry alert banner (Rule R5 / Checklist T4) */}
      {duplicateEntry && (
        <div className="p-4 rounded-2xl bg-gold/15 border border-gold/50 shadow-lg space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-gold font-bold text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{t.join.duplicateFoundTitle}</span>
          </div>
          <p className="text-xs text-silver leading-relaxed">
            {t.join.duplicateFoundDesc} Token:{' '}
            <span className="font-mono font-bold text-gold">{duplicateEntry.tokenNumber}</span>
          </p>
          <div className="pt-1">
            <Link to={`/status/${duplicateEntry.id}`}>
              <Button size="sm" className="gap-2">
                <span>{t.home.viewStatusBtn}</span>
                <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* General Submission Error */}
      {submitError && (
        <div className="p-3.5 rounded-xl bg-status-danger/15 border border-status-danger/40 text-status-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Main Form & Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Steps (65% on Desktop) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Your Details Card */}
          <Card>
            <h3 className="text-sm font-bold text-silver-highlight uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-gold" />
              {t.join.stepDetails}
            </h3>

            <div className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-xs font-semibold text-silver mb-1.5">
                  {t.join.nameLabel} <span className="text-gold">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setNameTouched(true)}
                  placeholder={t.join.namePlaceholder}
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-charcoal border text-sm text-silver-highlight placeholder-silver/40 focus:outline-none transition-colors ${
                    nameError
                      ? 'border-status-danger focus:ring-1 focus:ring-status-danger'
                      : 'border-charcoal-border focus:border-gold'
                  }`}
                />
                {nameError && (
                  <p className="text-[11px] text-status-danger mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {nameError}
                  </p>
                )}
              </div>

              {/* Phone Field */}
              <div>
                <label className="block text-xs font-semibold text-silver mb-1.5">
                  {t.join.phoneLabel} <span className="text-gold">*</span>
                </label>
                <div
                  className={`flex rounded-xl bg-charcoal border overflow-hidden transition-colors ${
                    phoneError
                      ? 'border-status-danger'
                      : 'border-charcoal-border focus-within:border-gold'
                  }`}
                >
                  <span className="px-3.5 py-2.5 text-xs bg-charcoal-border/40 text-gold font-bold flex items-center">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhone(val);
                    }}
                    onBlur={handlePhoneBlur}
                    placeholder={t.join.phonePlaceholder}
                    className="w-full px-3.5 py-2.5 bg-transparent text-sm text-silver-highlight placeholder-silver/40 focus:outline-none font-mono"
                  />
                </div>
                {phoneError && (
                  <p className="text-[11px] text-status-danger mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {phoneError}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Step 2: Choose Services Card */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-silver-highlight uppercase tracking-wider flex items-center gap-2">
                <Scissors className="w-4 h-4 text-gold" />
                {t.join.stepServices}
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gold">
                  {selectedServiceIds.length} {t.join.selectedCount}
                </span>
                {selectedServiceIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedServiceIds([])}
                    className="text-[11px] text-silver hover:text-gold underline"
                  >
                    {t.join.clearSelection}
                  </button>
                )}
              </div>
            </div>

            {selectedServiceIds.length >= 3 && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/30 text-[11px] text-gold font-semibold flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{t.join.maxReached}</span>
              </div>
            )}

            <div className="space-y-2.5">
              {services.map((service) => {
                const isSelected = selectedServiceIds.includes(service.id);
                const isMaxReached = selectedServiceIds.length >= 3 && !isSelected;

                return (
                  <div
                    key={service.id}
                    onClick={() => !isMaxReached && toggleService(service.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-charcoal border-gold shadow-md shadow-gold/5'
                        : isMaxReached
                        ? 'bg-charcoal/50 border-charcoal-border/50 opacity-40 cursor-not-allowed'
                        : 'bg-charcoal border-charcoal-border hover:border-gold/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox box */}
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors flex-shrink-0 ${
                          isSelected
                            ? 'bg-gold border-gold text-charcoal-dark'
                            : 'border-charcoal-border bg-charcoal-surface'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-silver-highlight">
                          {getServiceName(service)}
                        </div>
                        <div className="text-xs text-silver flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-gold" />
                          <span>{service.durationMinutes} {t.common.minutes}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-sm font-extrabold text-gold font-mono">
                      ₹{service.price}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Step 3: Choose Barber Card */}
          <Card>
            <h3 className="text-sm font-bold text-silver-highlight uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-gold" />
              {t.join.stepBarber}
            </h3>

            <div className="space-y-2.5">
              {/* "Any Barber" option (Fastest, Default) */}
              <div
                onClick={() => setSelectedBarberId(null)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedBarberId === null
                    ? 'bg-charcoal border-gold shadow-md shadow-gold/5 ring-1 ring-gold/20'
                    : 'bg-charcoal border-charcoal-border hover:border-gold/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      selectedBarberId === null
                        ? 'border-gold bg-gold text-charcoal-dark'
                        : 'border-charcoal-border'
                    }`}
                  >
                    {selectedBarberId === null && <div className="w-2 h-2 rounded-full bg-charcoal-dark" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-silver-highlight">
                      {t.join.anyBarber}
                    </div>
                    <div className="text-[11px] text-silver">
                      Assign whoever is free first
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-gold/15 text-gold border border-gold/30">
                  {t.join.fastest}
                </span>
              </div>

              {/* Working Barbers List */}
              {barbers.map((barber) => {
                const isSelected = selectedBarberId === barber.id;
                const isOnBreak = barber.status === 'On Break';

                return (
                  <div
                    key={barber.id}
                    onClick={() => setSelectedBarberId(barber.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-charcoal border-gold shadow-md shadow-gold/5 ring-1 ring-gold/20'
                        : 'bg-charcoal border-charcoal-border hover:border-gold/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-gold bg-gold text-charcoal-dark'
                              : 'border-charcoal-border'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-charcoal-dark" />}
                        </div>

                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-lg bg-charcoal-surface border border-gold/30 flex items-center justify-center font-bold text-xs text-gold">
                          {barber.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div>
                          <div className="text-sm font-semibold text-silver-highlight">
                            {barber.name}
                          </div>
                          <div className="text-[11px] text-silver">
                            {barber.customersWaitingCount > 0
                              ? `${barber.customersWaitingCount} ${t.join.waitingForBarber}`
                              : '0 in line'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isOnBreak ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-status-warning/15 text-status-warning border border-status-warning/30 flex items-center gap-1">
                            <Coffee className="w-3 h-3" />
                            {t.barber.statusBreak}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-status-success/15 text-status-success border border-status-success/30">
                            {t.barber.statusAvailable}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rule R10 Break Alert Notice */}
                    {isSelected && isOnBreak && (
                      <div className="p-2.5 rounded-lg bg-status-warning/10 border border-status-warning/30 text-[11px] text-status-warning leading-relaxed flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>{barber.name}</strong> {t.join.barberOnBreakNote}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Sticky Summary Card (35% on Desktop) */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 space-y-4">
            <Card highlight className="space-y-4">
              <h3 className="text-sm font-bold text-gold uppercase tracking-wider border-b border-charcoal-border/70 pb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {t.join.summaryTitle}
              </h3>

              {/* Selected Services Breakdown */}
              <div className="space-y-2 text-xs">
                {selectedServices.length === 0 ? (
                  <p className="text-silver italic py-2">
                    {t.validation.selectService}
                  </p>
                ) : (
                  selectedServices.map(srv => (
                    <div key={srv.id} className="flex justify-between items-center text-silver">
                      <span>{getServiceName(srv)}</span>
                      <span className="font-semibold text-silver-highlight font-mono">₹{srv.price}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-charcoal-border/70 pt-3 space-y-2 text-xs">
                {/* Total Service Time */}
                <div className="flex justify-between items-center text-silver">
                  <span>{t.join.totalDuration}</span>
                  <span className="font-bold text-silver-highlight font-mono">
                    {totalDurationMinutes} {t.common.minutes}
                  </span>
                </div>

                {/* Preferred Barber */}
                <div className="flex justify-between items-center text-silver">
                  <span>Barber:</span>
                  <span className="font-bold text-gold">
                    {chosenBarber ? chosenBarber.name : t.join.anyBarber}
                  </span>
                </div>

                {/* Estimated Wait */}
                <div className="flex justify-between items-center text-silver">
                  <span>{t.join.estimatedWait}</span>
                  <span className="font-bold text-gold font-mono">
                    ~{salonWaitMinutes} {t.common.minutes}
                  </span>
                </div>
              </div>

              {/* Total Price Row */}
              <div className="border-t border-charcoal-border pt-3 flex justify-between items-baseline">
                <span className="text-sm font-bold text-silver-highlight">{t.join.totalPrice}</span>
                <span className="text-2xl font-black text-gold font-mono">
                  ₹{totalPrice}
                </span>
              </div>

              <p className="text-[11px] text-silver/70 italic">
                {t.join.waitEstimateNote}
              </p>

              {/* Desktop Confirm Button */}
              <div className="hidden lg:block pt-2">
                <Button
                  fullWidth
                  size="lg"
                  disabled={!isFormValid || submitting || !isOnlineOpen}
                  onClick={() => handleConfirm()}
                  className="py-3.5 shadow-lg shadow-gold/15"
                >
                  {!isOnlineOpen ? 'Queue Closed' : submitting ? t.join.submitting : t.join.confirmBtn}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-charcoal-dark/95 backdrop-blur-md border-t border-charcoal-border z-40 shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] text-silver uppercase">{t.join.totalPrice}</div>
            <div className="text-xl font-black text-gold font-mono">₹{totalPrice}</div>
          </div>
          <Button
            size="lg"
            disabled={!isFormValid || submitting || !isOnlineOpen}
            onClick={() => handleConfirm()}
            className="flex-1 max-w-[220px] py-3 text-sm shadow-lg shadow-gold/20"
          >
            {!isOnlineOpen ? 'Queue Closed' : submitting ? t.join.submitting : t.join.confirmBtn}
          </Button>
        </div>
      </div>

      {/* Discard Details Confirmation Dialog */}
      {showDiscardDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-sm w-full bg-charcoal-surface border border-charcoal-border rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-base text-silver-highlight flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-status-warning" />
                {t.join.discardDialogTitle}
              </h4>
              <button
                onClick={() => setShowDiscardDialog(false)}
                className="text-silver hover:text-silver-highlight"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-silver leading-relaxed">
              {t.join.discardDialogDesc}
            </p>
            <div className="flex gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => setShowDiscardDialog(false)}
              >
                {t.join.discardKeep}
              </Button>
              <Button
                variant="danger"
                size="sm"
                fullWidth
                onClick={() => {
                  setShowDiscardDialog(false);
                  navigate('/');
                }}
              >
                {t.join.discardConfirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
