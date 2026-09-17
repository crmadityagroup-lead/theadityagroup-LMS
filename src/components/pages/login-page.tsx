'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth, CrmUser } from '@/lib/auth-context';
import { Logo } from '@/components/logo';
import { ArrowRight, CheckCircle2, Download, LockKeyhole, Mail } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function LoginPage() {
  const { refresh, setUserDirect } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const sendingRef = useRef(false);
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (!otpExpiresAt) return;

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);

      if (remaining === 0) setOtpExpiresAt(null);
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [otpExpiresAt]);

  useEffect(() => {
    const isMobile = /Android|iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isMobile) return;
    setShowInstallHelp(true);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        toast.success('CRM app installation started.');
        setInstallPrompt(null);
      }
      return;
    }
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    toast.message(isIos
      ? 'In Safari, tap Share, then choose Add to Home Screen.'
      : 'Open your browser menu and choose Install app or Add to Home screen.');
  }

  async function sendOtp() {
    if (sendingRef.current || secondsRemaining > 0) return;
    sendingRef.current = true;
    if (!email.trim()) {
      toast.error('Please enter your email');
      sendingRef.current = false;
      return;
    }
    setSending(true);
    try {
      const res = await api.post<{ message: string; ttl_minutes?: number }>('/auth/send-otp', { email: email.trim() });
      toast.success(res.message || 'OTP sent');
      setStep('otp');
      const ttlMinutes = Number(res.ttl_minutes || 2);
      const ttlSeconds = Math.max(60, ttlMinutes * 60);
      setCode('');
      setSecondsRemaining(ttlSeconds);
      setOtpExpiresAt(Date.now() + ttlSeconds * 1000);
    } catch (e: any) {
      toast.error(e.message || 'Failed to send OTP');
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    if (!code.trim()) {
      toast.error('Please enter the OTP code');
      verifyingRef.current = false;
      return;
    }
    setVerifying(true);
    try {
      const res = await api.post<{ token: string; user: CrmUser }>('/auth/verify-otp', { email: email.trim(), code: code.trim() });
      toast.success(`Welcome, ${res.user?.name || email}`);
      if (res.user) setUserDirect(res.user);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Login failed');
    } finally {
      setVerifying(false);
      verifyingRef.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-5 lg:p-7">
      <div className="neo-login-shell mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1440px] overflow-hidden rounded-sm border-2 border-foreground lg:grid-cols-2 lg:min-h-[calc(100vh-3.5rem)]">
        <section className="relative hidden min-h-[620px] overflow-hidden border-r-2 border-white bg-black lg:flex lg:items-center lg:justify-center">
          <Image
            src="/Pin%20code%20Password%20Protection%2C%20Secure%20Login%20animation.svg"
            alt="Secure login animation"
            width={460}
            height={460}
            priority
            className="h-[460px] w-[460px] max-w-[80%] object-contain"
          />
        </section>
        <section className="relative flex min-h-screen items-center justify-center bg-background px-4 py-20 sm:px-8 lg:min-h-0 lg:px-16">
          <div className="absolute left-5 top-5">
            <Logo variant="full" size={60} />
          </div>
          <div className="w-full max-w-md min-w-0">
            <div className="mb-8">
              <p className="inline-block border-2 border-foreground bg-[var(--color-gold)] px-2 py-1 text-sm font-black tracking-wide text-black">ADITYA GROUP PORTAL</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{step === 'email' ? 'Sign in to your workspace' : 'Check your inbox'}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {step === 'email'
                  ? "Enter your registered email and we'll send a secure one-time code."
                  : 'Enter the six-digit verification code sent to your email.'}
              </p>
            </div>

            {step === 'email' ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold">Work email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      className="h-12 pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          sendOtp();
                        }
                      }}
                    />
                  </div>
                </div>
                <Button className="h-12 w-full btn-gold" onClick={sendOtp} disabled={sending}>
                  {sending ? 'Sending secure code...' : <><span>Continue with email</span><ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
                {showInstallHelp && <Button type="button" variant="outline" className="h-10 w-full" onClick={() => void installApp()}>
                  <Download className="mr-2 h-4 w-4" /> {installPrompt ? 'Install CRM App' : 'Install on this phone'}
                </Button>}
                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <LockKeyhole className="h-3.5 w-3.5" /> Protected with one-time authentication
                </p>
              </div>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-semibold">Verification code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    className="h-14 text-center text-2xl tracking-[0.45em]"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Sent to <strong className="font-medium text-foreground">{email}</strong>
                  </p>
                </div>
                <Button type="submit" className="h-12 w-full btn-gold" disabled={verifying}>
                  {verifying ? 'Verifying...' : <><CheckCircle2 className="mr-2 h-4 w-4" /> Verify and sign in</>}
                </Button>
                <div className="text-center text-xs text-muted-foreground">
                  {secondsRemaining > 0 ? (
                    `OTP expires in ${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}`
                  ) : (
                    <button type="button" className="cursor-pointer font-semibold text-[var(--color-gold)] hover:underline" onClick={sendOtp}>
                      OTP expired. Resend OTP
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
          <p className="absolute bottom-5 px-5 text-center text-xs text-muted-foreground">&copy; 2026 Aditya Group. All Rights Reserved.</p>
        </section>
      </div>
    </div>
  );
}
