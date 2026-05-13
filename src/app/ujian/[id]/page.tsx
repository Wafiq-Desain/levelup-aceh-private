
'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/Protected-route";
import { useAppAuth } from "@/contexts/auth-context";
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs,
  query,
  orderBy,
  where
} from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { 
  setDocumentNonBlocking
} from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { LatexRenderer } from "@/components/LatexRenderer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Flag,
  BookOpen,
  AlertTriangle,
  Lock,
  ShieldAlert
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function UjianPage() {
  const { id: examId } = useParams();
  const { user, role } = useAppAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { choice: string, isFlagged: boolean }>>({});
  const [isBlurred, setIsBlurred] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptLimitReached, setAttemptLimitReached] = useState(false);
  
  const hasSubmitted = useRef(false);
  const wakeLockRef = useRef<any>(null);

  // 1. WAKE LOCK & ZOOM BLOCKER
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.warn("Wake Lock failed:", err);
    }
  };

  useEffect(() => {
    requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    // Block Zooming gestures for modern mobile browsers
    const preventZoom = (e: any) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('touchstart', preventZoom, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('touchstart', preventZoom);
      if (wakeLockRef.current) wakeLockRef.current.release();
    };
  }, []);

  // 2. INPUT PROTECTION: Blokir Klik Kanan, Seleksi, Copy-Paste, Drag, Print, Zoom
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const forbiddenKeys = ['F12', 'F11'];
      const ctrlKeys = ['c', 'v', 'u', 'i', 'p', 's', 'j', '+', '-', '0'];
      
      if (forbiddenKeys.includes(e.key) || (e.ctrlKey && ctrlKeys.includes(e.key.toLowerCase())) || (e.metaKey && ctrlKeys.includes(e.key.toLowerCase()))) {
        e.preventDefault();
        toast({
          variant: "destructive",
          title: "PINTASAN DIBLOKIR",
          description: "Dilarang memanipulasi tampilan atau menyalin konten.",
        });
        return false;
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasSubmitted.current) {
        e.preventDefault();
        e.returnValue = "Ujian sedang berlangsung! Keluar akan mengakhiri sesi.";
      }
    };

    // Block Mouse Wheel Zoom
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", preventDefault);
    document.addEventListener("selectstart", preventDefault);
    document.addEventListener("dragstart", preventDefault);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.body.classList.add("no-select");

    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      toast({
        variant: "destructive",
        title: "TOMBOL KEMBALI DIBLOKIR",
        description: "Gunakan navigasi di layar untuk berpindah soal.",
      });
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("contextmenu", preventDefault);
      document.removeEventListener("selectstart", preventDefault);
      document.removeEventListener("dragstart", preventDefault);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("wheel", handleWheel);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.body.classList.remove("no-select");
    };
  }, [toast]);

  // 3. SUBMIT LOGIC
  const handleSubmit = useCallback(async (isAuto = false, reason = "") => {
    if (!user || !examId || hasSubmitted.current) return;
    hasSubmitted.current = true;
    setIsSubmitting(true);
    
    try {
      const weights: Record<string, number> = { 'easy': 1, 'medium': 3, 'hard': 5 };
      let totalEarnedWeight = 0;
      let totalMaxWeight = 0;
      let correctCount = 0;
      let answeredCount = 0;

      questions.forEach((q) => {
        const weight = weights[q.difficultyLevel] || 1;
        totalMaxWeight += weight;
        const studentAnswer = answers[q.id]?.choice;
        
        if (studentAnswer) {
          answeredCount++;
          if (studentAnswer === String.fromCharCode(65 + q.correctAnswerIndex)) {
            totalEarnedWeight += weight;
            correctCount++;
          }
        }
      });

      const irtScore = totalMaxWeight > 0 ? Math.round((totalEarnedWeight / totalMaxWeight) * 100) : 0;
      const attemptTimestamp = new Date().getTime();
      const resultRef = doc(db, "users", user.uid, "results", `${examId}_${attemptTimestamp}`);
      
      const resultData = {
        id: `${examId}_${attemptTimestamp}`,
        studentId: user.uid,
        examId: examId,
        examSessionId: examId,
        submissionTime: new Date().toISOString(),
        totalScore: irtScore,
        weightedScore: totalEarnedWeight,
        correctAnswerCount: correctCount,
        incorrectAnswerCount: answeredCount - correctCount,
        unansweredCount: questions.length - answeredCount,
        antiCheatWarningCount: isAuto ? 1 : 0,
        isAutoSubmitted: isAuto,
        autoSubmitReason: reason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setDocumentNonBlocking(resultRef, resultData, { merge: true });

      toast({ 
        title: isAuto ? "PELANGGARAN TERDETEKSI!" : "Berhasil Dikirim", 
        description: isAuto ? `Ujian dihentikan paksa: ${reason}` : "Jawaban Anda telah aman tersimpan.",
        variant: isAuto ? "destructive" : "default"
      });
      
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err) {
      console.error("Submit error:", err);
      setIsSubmitting(false);
      hasSubmitted.current = false;
    }
  }, [user, examId, questions, answers, db, router, toast]);

  // 4. HP/MOBILE PROTECTION: Deteksi Layar Terbagi, Ganti Aplikasi, Zooming
  useEffect(() => {
    if (loading || isSubmitting || attemptLimitReached || role === 'admin') return;
    
    const handleViolation = (reason: string) => {
      if (!hasSubmitted.current) {
        setIsBlurred(true);
        handleSubmit(true, reason);
      }
    };

    const onVisibilityChange = () => { if (document.hidden) handleViolation("Keluar Tab/Ganti Aplikasi"); };
    const onWindowBlur = () => { if (!hasSubmitted.current) handleViolation("Layar Kehilangan Fokus (Notifikasi/Sistem)"); };
    
    const onResize = () => {
      // Detection for Split Screen and Zoom Manipulation
      const screenHeight = window.screen.availHeight;
      const currentHeight = window.innerHeight;
      const ratio = currentHeight / screenHeight;

      if (ratio < 0.65) {
        handleViolation("Upaya Layar Terbagi (Split Screen)");
      }
      
      // Detection for Browser Zoom (Visual Viewport)
      if (window.visualViewport && window.visualViewport.scale !== 1) {
        handleViolation("Upaya Perubahan Skala (Zooming) Terdeteksi");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("resize", onResize);
    };
  }, [handleSubmit, loading, isSubmitting, attemptLimitReached, role]);

  // 5. FETCH DATA
  useEffect(() => {
    const fetchData = async () => {
      if (!examId || !user || !role) return;
      try {
        setLoading(true);
        const resultsRef = collection(db, "users", user.uid, "results");
        const resultsQuery = query(resultsRef, where("examId", "==", examId));
        const resultsSnap = await getDocs(resultsQuery);
        
        if (role === 'student' && resultsSnap.size >= 2) {
          setAttemptLimitReached(true);
          setLoading(false);
          return;
        }

        const examDoc = await getDoc(doc(db, "exams", examId as string));
        if (examDoc.exists()) {
          const examData = examDoc.data();
          setExam(examData);
          
          const qSnap = await getDocs(query(collection(db, "exams", examId as string, "questions"), orderBy("createdAt", "asc")));
          const qList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          let ordered = examData.questionIds ? examData.questionIds.map((id: string) => qList.find(q => q.id === id)).filter(Boolean) : qList;
          setQuestions(ordered);
          setTimeLeft(examData.durationMinutes * 60);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [examId, user, role, db]);

  // 6. TIMER
  useEffect(() => {
    if (loading || isSubmitting || attemptLimitReached) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          if (role !== 'admin') handleSubmit(true, "Waktu Pengerjaan Habis");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, isSubmitting, attemptLimitReached, handleSubmit, role]);

  const handleSelectAnswer = (value: string) => {
    if (hasSubmitted.current || role === 'admin') return;
    const qId = questions[currentIndex]?.id;
    if (!qId) return;

    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], choice: value } }));
    
    const answerRef = doc(db, "users", user!.uid, "examSessions", examId as string, "examAnswers", qId);
    setDocumentNonBlocking(answerRef, {
      id: qId,
      examSessionId: examId,
      questionId: qId,
      chosenAnswerIndex: value.charCodeAt(0) - 65,
      answerTime: new Date().toISOString()
    }, { merge: true });
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-white"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div></div>;

  if (attemptLimitReached) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center">
        <Card className="max-w-sm w-full p-6 border-t-8 border-destructive shadow-2xl">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Batas Percobaan Habis</h2>
          <p className="text-muted-foreground mb-6">Anda telah menyelesaikan 2 kali percobaan untuk paket ini.</p>
          <Button className="w-full" onClick={() => router.replace('/dashboard')}>Kembali ke Dashboard</Button>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <ProtectedRoute>
      <div className={cn("min-h-screen bg-muted/20 flex flex-col transition-all duration-500", isBlurred && "blur-3xl grayscale pointer-events-none")}>
        
        {/* ENHANCED DIGITAL WATERMARK MATRIX (Mencegah Foto/Scan Layar) */}
        <div className="watermark-overlay overflow-hidden select-none pointer-events-none fixed inset-0 z-[100] opacity-10 flex flex-wrap justify-center content-center gap-20 md:gap-32">
          {Array.from({ length: 48 }).map((_, i) => (
            <div 
              key={i} 
              className="text-[10px] md:text-xs font-black text-black whitespace-nowrap uppercase tracking-widest"
              style={{ transform: `rotate(${-25 + (i % 5)}deg)` }}
            >
              {user?.email} • {user?.uid.slice(0, 8)}
            </div>
          ))}
        </div>

        <header className="sticky top-0 z-50 bg-white border-b shadow-sm h-14 md:h-16 flex items-center">
          <div className="container mx-auto px-4 flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <h2 className="text-xs md:text-sm font-black text-primary truncate max-w-[140px] md:max-w-md uppercase tracking-tight">{exam?.title}</h2>
              <div className="flex items-center gap-1">
                <ShieldAlert className="h-2.5 w-2.5 text-destructive animate-pulse" />
                <span className="text-[7px] font-black text-destructive uppercase tracking-tighter">Super Strict Security Active</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full font-mono text-sm md:text-lg font-bold border",
                timeLeft < 300 && role !== 'admin' ? "bg-red-100 text-red-600 border-red-300 animate-pulse" : "bg-muted text-foreground border-transparent"
              )}>
                <Clock className="h-4 w-4 md:h-5 md:w-5" />
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
              <Button size="sm" variant="destructive" onClick={() => handleSubmit()} className="h-9 px-4 text-xs font-black bg-primary" disabled={isSubmitting}>
                {isSubmitting ? "..." : "SELESAI"}
              </Button>
            </div>
          </div>
        </header>

        <Progress value={((currentIndex + 1) / (questions.length || 1)) * 100} className="h-1 rounded-none bg-muted" />

        <main className="flex-1 container mx-auto px-2 py-4 md:px-4 md:py-8 flex flex-col lg:flex-row gap-6">
          <aside className="w-full lg:w-1/4 order-2 lg:order-1">
            <Card className="shadow-md border-none bg-white">
              <CardHeader className="py-3 px-4 bg-primary/5 border-b">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                  <BookOpen className="h-3 w-3" /> Navigasi Nomor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, i) => (
                    <button 
                      key={`nav-${i}`} 
                      onClick={() => setCurrentIndex(i)} 
                      className={cn(
                        "h-10 rounded-lg text-xs font-black transition-all border-2 flex items-center justify-center",
                        currentIndex === i ? "bg-secondary text-black border-primary" 
                        : answers[q?.id]?.choice ? "bg-green-50 text-green-700 border-green-200" 
                        : "bg-white text-muted-foreground border-muted"
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="flex-1 flex flex-col gap-4 order-1 lg:order-2 touch-none">
            <Card className="border-none shadow-xl flex-1 bg-white relative">
              <CardHeader className="p-5 md:p-8 border-b">
                <div className="flex items-center justify-between mb-4">
                  <Badge className="bg-primary text-[10px] font-black px-4 py-1">SOAL {currentIndex + 1}</Badge>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      if (role === 'admin') return;
                      const qId = currentQ?.id;
                      if (qId) setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], isFlagged: !prev[qId]?.isFlagged } }));
                    }}
                    className={cn("h-8 text-[10px] font-bold gap-2", answers[currentQ?.id]?.isFlagged ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground")}
                  >
                    <Flag className="h-3 w-3" /> RAGU-RAGU
                  </Button>
                </div>
                {currentQ?.imageUrl && (
                  <div className="mb-6 rounded-2xl bg-muted/30 p-3 flex justify-center border-2 border-dashed">
                    <img src={currentQ.imageUrl} alt="Visual Soal" className="max-h-48 md:max-h-72 object-contain rounded-lg pointer-events-none" />
                  </div>
                )}
                <div className="text-base md:text-xl font-medium leading-relaxed">
                  <LatexRenderer content={currentQ?.questionText || "..."} />
                </div>
              </CardHeader>

              <CardContent className="p-4 md:p-8">
                <RadioGroup 
                  value={answers[currentQ?.id]?.choice || ""} 
                  onValueChange={handleSelectAnswer} 
                  className="space-y-3"
                >
                  {currentQ?.options?.map((opt: string, i: number) => {
                    const label = String.fromCharCode(65 + i);
                    const isSelected = answers[currentQ?.id]?.choice === label;
                    return (
                      <div 
                        key={`opt-${i}`} 
                        onClick={() => handleSelectAnswer(label)}
                        className={cn(
                          "flex items-center gap-4 p-4 md:p-5 rounded-2xl border-2 cursor-pointer bg-white transition-all",
                          isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/20"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border-2",
                          isSelected ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {label}
                        </div>
                        <div className="flex-1 text-sm md:text-base font-medium">
                          <LatexRenderer content={opt} inline />
                        </div>
                      </div>
                    );
                  })}
                </RadioGroup>
              </CardContent>

              <CardFooter className="p-4 md:p-6 border-t flex justify-between bg-white sticky bottom-0 z-10">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentIndex(p => Math.max(0, p - 1))} 
                  disabled={currentIndex === 0}
                  className="font-bold text-xs h-11"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> KEMBALI
                </Button>
                {currentIndex < questions.length - 1 ? (
                  <Button onClick={() => setCurrentIndex(p => p + 1)} className="bg-primary font-bold px-8 h-11">
                    BERIKUTNYA <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={() => handleSubmit()} className="bg-green-600 font-black px-8 h-11 text-white shadow-lg">
                    SELESAI & KIRIM <CheckCircle2 className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
