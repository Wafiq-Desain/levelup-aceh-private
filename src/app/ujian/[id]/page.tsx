
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Flag,
  BookOpen,
  ShieldAlert,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function UjianPage() {
  const { id: examId } = useParams();
  const { user } = useAppAuth();
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
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current) wakeLockRef.current.release();
    };
  }, []);

  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasSubmitted.current) {
        e.preventDefault();
        e.returnValue = "Ujian sedang berlangsung!";
      }
    };

    document.addEventListener("contextmenu", preventDefault);
    document.addEventListener("selectstart", preventDefault);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.body.classList.add("no-select");

    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("contextmenu", preventDefault);
      document.removeEventListener("selectstart", preventDefault);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.body.classList.remove("no-select");
    };
  }, []);

  const handleSubmit = useCallback(async (isAuto = false) => {
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setDocumentNonBlocking(resultRef, resultData, { merge: true });

      toast({ 
        title: isAuto ? "PELANGGARAN DETEKSI!" : "Berhasil Dikirim", 
        description: isAuto ? "Sesi dihentikan karena pindah tab/aplikasi." : "Jawaban Anda telah aman tersimpan.",
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

  useEffect(() => {
    if (loading || isSubmitting || attemptLimitReached) return;
    
    const handleViolation = () => {
      if (!hasSubmitted.current) {
        setIsBlurred(true);
        handleSubmit(true);
      }
    };

    const onVisibilityChange = () => { if (document.hidden) handleViolation(); };
    const onWindowBlur = () => { handleViolation(); };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [handleSubmit, loading, isSubmitting, attemptLimitReached]);

  useEffect(() => {
    const fetchData = async () => {
      if (!examId || !user) return;
      try {
        setLoading(true);

        const profileSnap = await getDoc(doc(db, "userProfiles", user.uid));
        const profile = profileSnap.data();
        
        if (!profileSnap.exists()) {
          router.replace('/complete-profile');
          return;
        }

        const isComplete = !!(
          profile?.displayName && 
          profile?.class && 
          profile?.schoolName && 
          profile?.phoneNumber &&
          profile?.birthDate &&
          profile?.gender
        );

        if (!isComplete) {
            router.replace('/complete-profile');
            return;
        }

        const resultsRef = collection(db, "users", user.uid, "results");
        const resultsQuery = query(resultsRef, where("examId", "==", examId));
        const resultsSnap = await getDocs(resultsQuery);
        
        if (resultsSnap.size >= 2) {
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
  }, [examId, user, db, router]);

  useEffect(() => {
    if (loading || isSubmitting || attemptLimitReached) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, isSubmitting, attemptLimitReached, handleSubmit]);

  const handleSelectAnswer = (value: string) => {
    if (hasSubmitted.current) return;
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
          <h2 className="text-xl font-bold mb-2">Akses Terkunci</h2>
          <p className="text-muted-foreground mb-6">Anda sudah mengerjakan ujian ini sebanyak 2 kali. Tidak ada kuota tambahan tersedia.</p>
          <Button className="w-full" onClick={() => router.replace('/dashboard')}>Kembali ke Beranda</Button>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <ProtectedRoute>
      <div className={cn("min-h-screen bg-muted/20 flex flex-col transition-all duration-500", isBlurred && "blur-3xl grayscale pointer-events-none")}>
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm h-14 md:h-16 flex items-center">
          <div className="container mx-auto px-4 flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <h2 className="text-sm md:text-base font-bold text-primary truncate max-w-[150px] md:max-w-md">{exam?.title}</h2>
              <span className="text-[9px] font-black text-destructive uppercase tracking-tighter">Strict Mode Active</span>
            </div>
            
            <div className="flex items-center gap-3 md:gap-6">
              <div className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full font-mono text-sm md:text-lg font-bold border",
                timeLeft < 300 ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : "bg-muted/50 text-foreground border-transparent"
              )}>
                <Clock className="h-4 w-4 md:h-5 md:w-5" />
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
              <Button size="sm" variant="destructive" onClick={() => handleSubmit()} className="h-8 md:h-10 text-xs md:text-sm font-bold bg-primary">
                SELESAI
              </Button>
            </div>
          </div>
        </header>

        <Progress value={((currentIndex + 1) / (questions.length || 1)) * 100} className="h-1 rounded-none bg-muted" />

        <main className="flex-1 container mx-auto px-4 py-4 md:py-8 flex flex-col lg:flex-row gap-6">
          <aside className="w-full lg:w-1/4">
            <Card className="shadow-sm border-none bg-white">
              <CardHeader className="py-3 px-4 bg-muted/10 border-b">
                <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <BookOpen className="h-3 w-3" /> Navigasi Soal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-4">
                <div className="grid grid-cols-5 md:grid-cols-5 gap-2">
                  {questions.map((q, i) => (
                    <button 
                      key={i} 
                      onClick={() => setCurrentIndex(i)} 
                      className={cn(
                        "h-9 md:h-10 rounded text-xs font-bold transition-all border flex items-center justify-center relative",
                        currentIndex === i ? "bg-secondary text-black border-secondary ring-2 ring-secondary/20" 
                        : answers[q?.id]?.choice ? "bg-primary/5 text-primary border-primary/20" 
                        : "bg-white text-muted-foreground border-muted"
                      )}
                    >
                      {i + 1}
                      {answers[q?.id]?.isFlagged && <div className="absolute -top-1 -right-1 bg-amber-500 h-2 w-2 rounded-full ring-2 ring-white"></div>}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="flex-1 flex flex-col gap-4">
            <Card className="border-none shadow-lg overflow-hidden flex-1 bg-white">
              <CardHeader className="p-5 md:p-8 border-b">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-primary px-3 py-1 bg-primary/5 rounded-full">SOAL {currentIndex + 1}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      const qId = currentQ?.id;
                      if (qId) setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], isFlagged: !prev[qId]?.isFlagged } }));
                    }}
                    className={cn("h-8 text-[10px] font-bold gap-1", answers[currentQ?.id]?.isFlagged ? "bg-amber-100 text-amber-700" : "text-muted-foreground")}
                  >
                    <Flag className={cn("h-3 w-3", answers[currentQ?.id]?.isFlagged && "fill-current")} />
                    RAGU
                  </Button>
                </div>
                {currentQ?.imageUrl && (
                  <div className="mb-6 rounded-lg bg-muted/30 p-2 flex justify-center">
                    <img src={currentQ.imageUrl} alt="Visual" className="max-h-40 md:max-h-60 object-contain" />
                  </div>
                )}
                <div className="text-base md:text-lg font-medium leading-relaxed w-full">
                  <LatexRenderer content={currentQ?.questionText || ""} />
                </div>
              </CardHeader>

              <CardContent className="p-5 md:p-8 bg-muted/5">
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
                        key={i} 
                        onClick={() => handleSelectAnswer(label)}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer bg-white group",
                          isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/20"
                        )}
                      >
                        <RadioGroupItem value={label} id={`opt-${i}`} className="sr-only" />
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border-2 transition-colors shrink-0",
                          isSelected ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground group-hover:border-primary/30"
                        )}>
                          {label}
                        </div>
                        <div className="flex-1 min-w-0">
                          <LatexRenderer content={opt} inline />
                        </div>
                      </div>
                    );
                  })}
                </RadioGroup>
              </CardContent>

              <CardFooter className="p-4 md:p-6 border-t flex justify-between bg-white">
                <Button 
                  variant="ghost" 
                  onClick={() => setCurrentIndex(p => Math.max(0, p - 1))} 
                  disabled={currentIndex === 0}
                  className="font-bold text-xs"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> KEMBALI
                </Button>
                {currentIndex < questions.length - 1 ? (
                  <Button onClick={() => setCurrentIndex(p => p + 1)} className="bg-primary font-bold px-6 h-10 text-xs">
                    LANJUT <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={() => handleSubmit()} className="bg-green-600 hover:bg-green-700 font-bold px-6 h-10 text-xs text-white">
                    KIRIM <CheckCircle2 className="h-4 w-4 ml-1" />
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
