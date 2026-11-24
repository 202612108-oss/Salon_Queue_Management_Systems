import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Scissors, 
  Clock, 
  Users, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle,
  Timer
} from 'lucide-react';
import { fetchDisplayData } from '../../lib/api.js';
import { useSocket } from '../../hooks/useSocket.js';
import { playNotificationChime } from '../../lib/sound.js';

interface NowServingBarber {
  barberId: string;
  barberName: string;
  barberSlug: string;
  barberAvatar?: string | null;
  barberStatus: 'Available' | 'Busy' | 'On Break' | 'Off';
  currentCustomer: {
    id: string;
    tokenNumber: string;
    customerName: string;
    status: 'Called' | 'In Chair';
    calledAt?: string | null;
    serviceStartedAt?: string | null;
    totalDurationMinutes: number;
    servicesSummary: string;
    elapsedSeconds: number;
  } | null;
}

interface NextFiveCustomer {
  position: number;
  id: string;
  tokenNumber: string;
  customerName: string;
  preferredBarberName: string;
  servicesSummary: string;
  totalDurationMinutes: number;
  estimatedWaitMinutes: number;
}

interface DisplayData {
  salonName: string;
  queueStatus: 'open' | 'closed' | 'paused';
  currentTime: string;
  totalWaiting: number;
  nowServing: NowServingBarber[];
  nextFive: NextFiveCustomer[];
}

export const DisplayPage: React.FC = () => {
  const [data, setData] = useState<DisplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [clock, setClock] = useState({ time: '', date: '', ampm: '' });

  // Language rotation on TV (English -> Gujarati -> Hindi every 8s)
  const [langIndex, setLangIndex] = useState<0 | 1 | 2>(0);

  // Newly called token tracking for 8-second flash animation
  const [newlyCalledToken, setNewlyCalledToken] = useState<string | null>(null);
  const lastCalledRef = useRef<string | null>(null);

  // Translations object for 3 languages on the TV screen
  const tvLabels = {
    nowServing: ['NOW SERVING', 'હાલમાં સેવા', 'वर्तमान सेवा'],
    upNext: ['UP NEXT (NEXT 5)', 'આગળના ગ્રાહકો', 'अगले ५ ग्राहक'],
    waitingCount: ['Waiting', 'પ્રતીક્ષારત', 'प्रतीक्षारत'],
    pleaseCome: ['PLEASE COME', 'કૃપા કરીને આવો', 'कृपया आएं'],
    inService: ['IN SERVICE', 'સેવામાં છે', 'सेवा में'],
    available: ['READY', 'ઉપલબ્ધ', 'तैयार'],
    onBreak: ['ON BREAK', 'વિરામ પર', 'ब्रेक पर'],
    noOneServing: ['No customers in chair right now', 'હાલમાં કોઈ સેવામાં નથી', 'वर्तमान में कोई सेवा में नहीं'],
    noOneWaiting: ['No wait right now. Walk right in!', 'કોઈ પ્રતીક્ષા નથી. સીધા અંદર પધારો!', 'कोई प्रतीक्षा नहीं। सीधे अंदर आएं!'],
    footerTicker: [
      'Please keep your phone handy. Thank you for choosing Royal Cuts Lounge.',
      'કૃપા કરીને તમારો ફોન સાથે રાખો. રોયલ કટ્સ લાઉન્જ પસંદ કરવા બદલ આભાર.',
      'कृपया अपना फ़ोन पास रखें। रॉयल कट्स लाउंज चुनने के लिए धन्यवाद।',
    ],
    aboutMinutes: ['About', 'આશરે', 'लगभग'],
    minutesSuffix: ['min', 'મિનિટ', 'मिनट'],
    rightAway: ['Right away', 'તરત જ', 'तुरंत'],
    youAreNext: ["You're next", 'તમારો વારો આગળ છે', 'आप अगले हैं'],
  };

  // Fetch display data
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchDisplayData();
      setData(res);
    } catch (err) {
      console.error('Failed to load display data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    setIsDisconnected(!isConnected);
  }, [isConnected]);

  // Socket.IO synchronization
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      loadData(true);
    };

    const handleCustomerCalled = (payload: { tokenNumber: string; customerName: string; barberName: string }) => {
      loadData(true);
      if (payload?.tokenNumber) {
        setNewlyCalledToken(payload.tokenNumber);
        lastCalledRef.current = payload.tokenNumber;

        // Play chime sound
        playNotificationChime(isMuted);

        // Clear newly called highlight after 8 seconds
        setTimeout(() => {
          setNewlyCalledToken((current) => (current === payload.tokenNumber ? null : current));
        }, 8000);
      }
    };

    socket.on('queue:updated', handleUpdate);
    socket.on('customer:called', handleCustomerCalled);
    socket.on('service:started', handleUpdate);
    socket.on('service:completed', handleUpdate);
    socket.on('barber:status_changed', handleUpdate);
    socket.on('connect', handleUpdate);
    socket.on('reconnect', handleUpdate);

    return () => {
      socket.off('queue:updated', handleUpdate);
      socket.off('customer:called', handleCustomerCalled);
      socket.off('service:started', handleUpdate);
      socket.off('service:completed', handleUpdate);
      socket.off('barber:status_changed', handleUpdate);
      socket.off('connect', handleUpdate);
      socket.off('reconnect', handleUpdate);
    };
  }, [socket, loadData, isMuted]);

  // Fallback sync: ensures Waiting Area TV updates within 5 seconds without manual browser refresh
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Live clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const formattedHours = hours.toString().padStart(2, '0');

      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      };
      const dateStr = now.toLocaleDateString('en-GB', options);

      setClock({
        time: `${formattedHours}:${minutes}:${seconds}`,
        ampm,
        date: dateStr,
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Language rotation every 8 seconds
  useEffect(() => {
    const langInterval = setInterval(() => {
      setLangIndex((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
    }, 8000);

    return () => clearInterval(langInterval);
  }, []);

  // Keyboard shortcuts: F for Fullscreen, M for Mute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const enableAudioOnUserGesture = () => {
    setSoundEnabled(true);
    playNotificationChime(false);
  };

  if (loading && !data) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-charcoal-dark text-silver-highlight space-y-4">
        <Sparkles className="w-12 h-12 text-gold animate-spin" />
        <p className="text-silver text-lg font-medium">Initializing Waiting Area Display...</p>
      </div>
    );
  }

  const { salonName, totalWaiting, nowServing, nextFive, queueStatus } = data || {
    salonName: 'Royal Cuts Lounge',
    totalWaiting: 0,
    nowServing: [],
    nextFive: [],
    queueStatus: 'open',
  };

  return (
    <div
      onClick={!soundEnabled ? enableAudioOnUserGesture : undefined}
      className="w-screen h-screen bg-[#021945] text-silver-highlight overflow-hidden flex flex-col justify-between select-none p-6 lg:p-8 cursor-default"
      style={{
        background: 'radial-gradient(circle at 50% 20%, #052461 0%, #021945 80%, #011130 100%)',
      }}
    >
      {/* 1. TOP HEADER BAND */}
      <header className="flex items-center justify-between border-b border-silver/20 pb-5">
        {/* Salon Logo and Title */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold/30 to-charcoal border-2 border-gold/60 flex items-center justify-center text-gold shadow-lg shadow-gold/10">
            <Scissors className="w-8 h-8 -rotate-45" />
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-black text-silver-highlight tracking-wide font-sans drop-shadow-md">
              {salonName}
            </h1>
            <p className="text-xs lg:text-sm font-bold text-gold uppercase tracking-widest mt-0.5">
              Live Queue Board • {tvLabels.waitingCount[langIndex]}:{' '}
              <span className="text-silver-highlight font-mono font-black text-base ml-1">
                {totalWaiting}
              </span>
            </p>
          </div>
        </div>

        {/* Center: Offline or Closed notice */}
        <div className="flex items-center gap-3">
          {isDisconnected && (
            <div className="px-3.5 py-1.5 rounded-full bg-status-danger/20 border border-status-danger/40 text-status-danger text-xs font-bold flex items-center gap-2 animate-pulse">
              <WifiOff className="w-4 h-4" />
              Reconnecting...
            </div>
          )}
          {queueStatus === 'closed' && (
            <div className="px-4 py-1.5 rounded-full bg-status-warning/20 border border-status-warning/40 text-status-warning text-xs font-bold">
              Queue Closed
            </div>
          )}
        </div>

        {/* Right: Clock & Date */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-3xl lg:text-4xl font-black font-mono text-silver-highlight tracking-tight flex items-center gap-2 justify-end">
              <span>{clock.time}</span>
              <span className="text-xs lg:text-sm font-bold text-gold px-1.5 py-0.5 rounded bg-charcoal border border-gold/30">
                {clock.ampm}
              </span>
            </div>
            <div className="text-xs lg:text-sm text-silver/80 font-medium tracking-wide mt-0.5">
              {clock.date}
            </div>
          </div>

          {/* Quick TV Control icons */}
          <div className="hidden sm:flex items-center gap-2 border-l border-silver/20 pl-4 text-silver">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              className="p-2 rounded-xl hover:bg-charcoal/50 hover:text-gold transition-colors"
              title={isMuted ? 'Unmute Chime (Press M)' : 'Mute Chime (Press M)'}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-status-danger" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="p-2 rounded-xl hover:bg-charcoal/50 hover:text-gold transition-colors"
              title="Toggle Fullscreen (Press F)"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. UPPER HALF: NOW SERVING SECTION (50-55% of height) */}
      <section className="flex-1 my-4 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm lg:text-base font-black tracking-widest text-gold uppercase flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-status-success animate-ping"></span>
            {tvLabels.nowServing[langIndex]}
          </h2>
          <span className="text-xs font-semibold text-silver/60">
            {nowServing.length} active barber stations
          </span>
        </div>

        {/* 3 Large Barber Cards Row (Ravi, Amit, Imran) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full max-h-[48vh]">
          {nowServing.map((station) => {
            const customer = station.currentCustomer;
            const isNewlyCalled = customer && customer.tokenNumber === newlyCalledToken;
            const isInChair = customer?.status === 'In Chair';
            const isCalled = customer?.status === 'Called';

            return (
              <div
                key={station.barberId}
                className={`relative flex flex-col justify-between p-6 rounded-3xl border transition-all duration-700 shadow-2xl overflow-hidden ${
                  isNewlyCalled
                    ? 'bg-gradient-to-b from-[#113a8a] to-[#041d4f] border-gold ring-4 ring-gold/40 scale-[1.02]'
                    : isServing(customer)
                    ? 'bg-[#07255f]/80 border-gold/40 shadow-gold/5'
                    : 'bg-[#041a45]/60 border-silver/20 opacity-85'
                }`}
              >
                {/* Gold Glow flare when newly called */}
                {isNewlyCalled && (
                  <div className="absolute inset-0 bg-gold/10 animate-pulse pointer-events-none"></div>
                )}

                {/* Card Top: Barber Name & Avatar */}
                <div className="flex items-center justify-between border-b border-silver/15 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-charcoal border border-gold/40 flex items-center justify-center font-bold text-gold text-sm shadow">
                      {station.barberName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-base lg:text-lg font-bold text-silver-highlight">
                        {station.barberName}
                      </div>
                      <div className="text-[11px] text-silver/70">Barber Station</div>
                    </div>
                  </div>

                  {/* Status Label (Please Come vs In Service vs Ready) */}
                  <div>
                    {isCalled ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-status-warning/20 text-status-warning border border-status-warning/40 animate-pulse flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-status-warning"></span>
                        {tvLabels.pleaseCome[langIndex]}
                      </span>
                    ) : isInChair ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-status-success/20 text-status-success border border-status-success/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-status-success animate-ping"></span>
                        {tvLabels.inService[langIndex]}
                      </span>
                    ) : station.barberStatus === 'On Break' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-charcoal text-silver border border-silver/20">
                        {tvLabels.onBreak[langIndex]}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-status-success/10 text-status-success/80 border border-status-success/20">
                        {tvLabels.available[langIndex]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Center: Token & Customer Name */}
                <div className="my-auto py-4 text-center">
                  {customer ? (
                    <div className="space-y-1">
                      {/* Very Large Token (100px - 120px on TV) */}
                      <div
                        className={`text-6xl sm:text-7xl lg:text-8xl font-black font-mono tracking-tight transition-transform ${
                          isNewlyCalled
                            ? 'text-gold scale-110 drop-shadow-[0_0_25px_rgba(212,175,55,0.7)]'
                            : 'text-silver-highlight drop-shadow-md'
                        }`}
                      >
                        {customer.tokenNumber}
                      </div>
                      {/* Customer Name */}
                      <div className="text-xl lg:text-2xl font-bold text-silver-highlight tracking-wide">
                        {customer.customerName}
                      </div>
                      {/* Services summary */}
                      <div className="text-xs lg:text-sm text-silver/80 font-medium truncate max-w-xs mx-auto">
                        {customer.servicesSummary}
                      </div>
                    </div>
                  ) : (
                    /* Idle State */
                    <div className="py-6 space-y-2 opacity-60">
                      <div className="text-5xl font-mono font-bold text-silver/40">---</div>
                      <p className="text-xs lg:text-sm text-silver">
                        {station.barberStatus === 'On Break'
                          ? tvLabels.onBreak[langIndex]
                          : tvLabels.noOneServing[langIndex]}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Bottom: Service Duration / Timer */}
                <div className="border-t border-silver/15 pt-3 flex items-center justify-between text-xs text-silver">
                  {customer ? (
                    <>
                      <span className="flex items-center gap-1 font-mono text-gold font-bold">
                        <Timer className="w-3.5 h-3.5" />
                        {customer.totalDurationMinutes} min service
                      </span>
                      <span className="font-semibold text-silver/80 uppercase tracking-wider text-[11px]">
                        {isCalled ? 'Arriving' : 'Active'}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-silver/60 mx-auto">
                      Ready for next customer
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. LOWER HALF: UP NEXT (NEXT 5 TOKENS) */}
      <section className="mt-2 mb-2">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs lg:text-sm font-black tracking-widest text-silver-highlight uppercase flex items-center gap-2">
            <Users className="w-4 h-4 text-gold" />
            {tvLabels.upNext[langIndex]}
          </h2>
          <span className="text-xs text-silver/70">
            {nextFive.length > 0 ? `Showing next ${nextFive.length} in queue` : 'Queue is clear'}
          </span>
        </div>

        {/* Next 5 Cards in a row */}
        {nextFive.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 lg:gap-4">
            {nextFive.map((cust) => {
              const estimateText =
                cust.estimatedWaitMinutes === 0
                  ? cust.position === 1
                    ? tvLabels.youAreNext[langIndex]
                    : tvLabels.rightAway[langIndex]
                  : `${tvLabels.aboutMinutes[langIndex]} ${cust.estimatedWaitMinutes} ${tvLabels.minutesSuffix[langIndex]}`;

              return (
                <div
                  key={cust.id}
                  className="p-3.5 lg:p-4 rounded-2xl bg-[#062052]/90 border border-silver/25 shadow-lg flex flex-col justify-between transition-all hover:border-gold/50"
                >
                  {/* Position Badge & Preferred Barber */}
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-lg bg-charcoal border border-silver/30 flex items-center justify-center font-bold text-xs text-silver">
                      #{cust.position}
                    </span>
                    <span className="text-[11px] font-bold text-gold truncate max-w-[90px]">
                      {cust.preferredBarberName}
                    </span>
                  </div>

                  {/* Large Token */}
                  <div className="py-2 text-center">
                    <div className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono text-silver-highlight tracking-tight">
                      {cust.tokenNumber}
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-silver-highlight truncate mt-0.5">
                      {cust.customerName}
                    </div>
                  </div>

                  {/* Estimated Wait Pill */}
                  <div className="pt-2 border-t border-silver/15 text-center">
                    <span className="text-[10px] sm:text-xs font-bold text-gold/90 px-2 py-0.5 rounded-md bg-[#021945] border border-gold/30 inline-block font-mono">
                      {estimateText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center rounded-2xl bg-[#062052]/50 border border-silver/15 text-silver text-sm">
            {tvLabels.noOneWaiting[langIndex]}
          </div>
        )}
      </section>

      {/* 4. FOOTER TICKER */}
      <footer className="border-t border-silver/20 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-silver">
        <div className="flex items-center gap-2 overflow-hidden">
          <Sparkles className="w-3.5 h-3.5 text-gold flex-shrink-0" />
          <span className="truncate text-silver-highlight/90 font-medium">
            {tvLabels.footerTicker[langIndex]}
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-silver/70 flex-shrink-0">
          {!soundEnabled && (
            <span className="text-gold font-semibold underline cursor-pointer animate-pulse">
              Click to enable chime sound
            </span>
          )}
          <span>Press F for Fullscreen • M to Mute</span>
        </div>
      </footer>
    </div>
  );
};

function isServing(customer: any): boolean {
  return Boolean(customer && (customer.status === 'In Chair' || customer.status === 'Called'));
}

export default DisplayPage;
