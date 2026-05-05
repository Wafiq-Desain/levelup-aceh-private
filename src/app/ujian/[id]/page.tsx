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
  increment,
  where
} from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { 
  setDocumentNonBlocking, 
  updateDocumentNonBlocking, 
  addDocumentNonBlocking 
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
  const [warningCount, setWarningCount] = useState(0);
  const [attemptLimitReached, setAttemptLimitReached] = useState(false);
  
  const hasSubmitted = useRef(false);
  const warningCountRef = useRef(0);

  // Security: Prevent Right Click, Selection, and Navigation
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasSubmitted.current) {
        e.preventDefault();
        e.returnValue = "Ujian sedang berlangsung. Keluar sekarang akan menghanguskan sesi ini.";
      }
    };

    document.addEventListener("contextmenu", preventDefault);
    document.addEventListener("selectstart", preventDefault);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.body.classList.add("no-select");

    // Push state to prevent back button
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      toast({
        variant: "destructive",
        title: "Navigasi Dilarang!",
        description: "Gunakan tombol selesai untuk mengakhiri ujian."
      });
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("contextmenu", preventDefault);
      document.removeEventListener("selectstart", preventDefault);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.body.classList.remove("no-select");
    };
  }, [toast]);

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
        unansweredCount: Math.max(0, questions.length - answeredCount),
        antiCheatWarningCount: warningCountRef.current,
        isAutoSubmitted: isAuto,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setDocumentNonBlocking(resultRef, resultData, { merge: true });

      toast({ 
        title: isAuto ? "Ujian Dihentikan Paksa!" : "Ujian Selesai!", 
        description: isAuto ? "Kecurangan berulang terdeteksi (Keluar Halaman/Pindah Tab)." : "Hasil Anda telah berhasil disimpan.",
        variant: isAuto ? "destructive" : "default"
      });
      
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err) {
      console.error("Submit error:", err);
      setIsSubmitting(false);
      hasSubmitted.current = false;
    }
  }, [user, examId, questions, answers, db, router, toast]);

  // Anti-Cheat: Enhanced Detection (Tab Switch + App Switch/Blur)
  useEffect(() => {
    const handleViolation = () => {
      if (hasSubmitted.current) return;
      
      setIsBlurred(true);
      warningCountRef.current += 1;
      setWarningCount(warningCountRef.current);
      
      if (user && examId) {
        const warningRef = collection(db, "users", user.uid, "examSessions", examId as string, "antiCheatWarnings");
        addDocumentNonBlocking(warningRef, {
          timestamp: new Date().toISOString(),
          reason: "window_blur_or_tab_switch",
          createdAt: new Date().toISOString()
        });
        
        const sessionRef = doc(db, "users", user.uid, "examSessions", examId as string);
        updateDocumentNonBlocking(sessionRef, { 
          antiCheatWarningCount: increment(1),
          updatedAt: new Date().toISOString() 
        });
      }

      if (warningCountRef.current >= 3) {
        handleSubmit(true);
      } else {
        toast({
          variant: "destructive",
          title: "PERINGATAN KERAS!",
          description: `Jangan meninggalkan halaman ujian! Pelanggaran: ${warningCountRef.current}/3.`,
        });
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) handleViolation();
    };

    const onWindowBlur = () => {
      handleViolation();
    };

    const onWindowFocus = () => {
      // Keep blurred until user clicks "I Understand"
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [user, examId, toast, db, handleSubmit]);

  useEffect(() => {
    const fetchData = async () => {
      if (!examId || !user) return;
      try {
        setLoading(true);

        const resultsRef = collection(db, "users", user.uid, "results");
        const resultsQuery = query(resultsRef, where("examId", "==", examId));
        const resultsSnap = await getDocs(resultsQuery);
        if (resultsSnap.size >= 3) {
          setAttemptLimitReached(true);
          setLoading(false);
          return;
        }

        const examDoc = await getDoc(doc(db, "exams", examId as string));
        if (examDoc.exists()) {
          const examData = examDoc.data();
          setExam(examData);
          
          const questionsRef = collection(db, "exams", examId as string, "questions");
          const qSnap = await getDocs(query(questionsRef, orderBy("createdAt", "asc")));
          const qList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          let orderedQuestions = [];
          if (examData.questionIds && examData.questionIds.length > 0) {
            orderedQuestions = examData.questionIds.map((qId: string) => 
              qList.find(q => q.id === qId)
            ).filter(Boolean);
          } else {
            orderedQuestions = qList;
          }
          setQuestions(orderedQuestions);
          
          setTimeLeft(examData.durationMinutes ? examData.durationMinutes * 60 : 3600);

          const sessionRef = doc(db, "users", user.uid, "examSessions", examId as string);
          const sessionSnap = await getDoc(sessionRef);
          
          if (sessionSnap.exists()) {
            const sessionData = sessionSnap.data();
            setCurrentIndex(sessionData.currentQuestionIndex || 0);
            warningCountRef.current = sessionData.antiCheatWarningCount || 0;
            setWarningCount(warningCountRef.current);
            
            const answersRef = collection(db, "users", user.uid, "examSessions", examId as string, "examAnswers");
            const answersSnap = await getDocs(answersRef);
            const loadedAnswers: any = {};
            answersSnap.forEach(doc => {
              const data = doc.data();
              loadedAnswers[data.questionId] = { 
                choice: String.fromCharCode(65 + data.chosenAnswerIndex), 
                isFlagged: data.isFlagged || false
              };
            });
            setAnswers(loadedAnswers);
          } else {
            setDocumentNonBlocking(sessionRef, {
              id: examId,
              studentId: user.uid,
              examId: examId,
              startTime: new Date().toISOString(),
              currentQuestionIndex: 0,
              antiCheatWarningCount: 0,
              isCompleted: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [examId, user, db]);

  useEffect(() => {
    if (loading || isSubmitting || attemptLimitReached) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, isSubmitting, attemptLimitReached, handleSubmit]);

  const handleSelectAnswer = (value: string) => {
    if (!user || !examId) return;
    const q = questions[currentIndex];
    const qId = q.id;
    const newAnswers = { ...answers, [qId]: { ...answers[qId], choice: value } };
    setAnswers(newAnswers);

    const answerRef = doc(db, "users", user.uid, "examSessions", examId as string, "examAnswers", qId);
    setDocumentNonBlocking(answerRef, {
      id: qId,
      examSessionId: examId,
      questionId: qId,
      chosenAnswerIndex: value.charCodeAt(0) - 65,
      isFlagged: answers[qId]?.isFlagged || false,
      answerTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const handleToggleFlag = () => {
    if (!user || !examId) return;
    const q = questions[currentIndex];
    const qId = q.id;
    const newFlag = !answers[qId]?.isFlagged;
    setAnswers({ ...answers, [qId]: { ...answers[qId], isFlagged: newFlag } });

    const answerRef = doc(db, "users", user.uid, "examSessions", examId as string, "examAnswers", qId);
    updateDocumentNonBlocking(answerRef, { isFlagged: newFlag, updatedAt: new Date().toISOString() });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  if (attemptLimitReached) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen items-center justify-center p-4 bg-muted/20">
          <Card className="max-w-md w-full text-center p-8 space-y-6 shadow-xl border-t-8 border-destructive">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold">Batas Percobaan Habis</CardTitle>
              <p className="text-muted-foreground">Anda telah mencapai batas maksimal 3 kali percobaan untuk paket ujian ini.</p>
            </div>
            <Button className="w-full h-12 font-bold" onClick={() => router.push('/dashboard')}>Kembali ke Dashboard</Button>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <ProtectedRoute>
      <div className={cn("min-h-screen bg-muted/30 transition-all duration-500", isBlurred && "blur-2xl grayscale pointer-events-none")}>
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="container mx-auto px-4 h-20 flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-primary truncate max-w-[200px] md:max-w-md">{exam?.title}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <ShieldAlert className={cn("h-4 w-4", warningCount > 0 ? "text-destructive" : "text-green-500")} />
                <span className="font-semibold text-destructive">Pelanggaran: {warningCount}/3</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-full font-mono text-xl font-bold transition-colors shadow-inner",
                timeLeft < 300 ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-foreground"
              )}>
                <Clock className="h-6 w-6" />
                {formatTime(timeLeft)}
              </div>
              <Button variant="destructive" size="lg" onClick={() => handleSubmit()} disabled={isSubmitting} className="font-bold px-8 bg-primary hover:bg-primary/90 text-white">
                SELESAI
              </Button>
            </div>
          </div>
          <Progress value={progressPercent} className="h-1.5 rounded-none bg-muted" />
        </header>

        <main className="container mx-auto px-4 py-8">
          {isBlurred && !hasSubmitted.current && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-auto">
              <Card className="max-w-md text-center p-10 space-y-6 shadow-2xl border-t-8 border-destructive">
                <ShieldAlert className="h-20 w-20 text-destructive mx-auto animate-bounce" />
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-black text-destructive">DETEKSI PELANGGARAN!</CardTitle>
                  <p className="text-muted-foreground text-lg font-medium leading-relaxed">
                    Anda terdeteksi meninggalkan halaman atau membuka aplikasi lain (kalkulator/browser). <br/><br/>
                    <strong>Peringatan ke-3 akan mengakhiri ujian otomatis!</strong>
                  </p>
                </div>
                <Button className="w-full bg-primary h-16 text-2xl font-bold shadow-xl text-white" onClick={() => setIsBlurred(false)}>SAYA MENGERTI</Button>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <Card className="shadow-lg border-t-4 border-primary">
                <CardHeader className="pb-3 bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />NAVIGASI SOAL</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-5 gap-3">
                    {questions.map((q, i) => {
                      const hasAnswer = !!answers[q?.id]?.choice;
                      const isFlagged = answers[q?.id]?.isFlagged;
                      const isActive = currentIndex === i;
                      return (
                        <button key={i} onClick={() => { setCurrentIndex(i); }} className={cn(
                          "h-12 rounded-lg text-sm font-black transition-all border-2 shadow-sm flex items-center justify-center relative",
                          isActive ? "bg-secondary text-secondary-foreground border-secondary scale-110 z-10" 
                          : isFlagged ? "bg-amber-400 text-black border-amber-500"
                          : hasAnswer ? "bg-primary/10 text-primary border-primary/30" : "bg-white text-muted-foreground border-muted hover:border-primary/50"
                        )}>
                          {i + 1}
                          {isFlagged && <div className="absolute -top-2 -right-2 bg-primary rounded-full p-1 shadow-md"><Flag className="h-3 w-3 fill-white text-white" /></div>}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-3">
              <Card className="border-none shadow-2xl overflow-hidden min-h-[600px] flex flex-col bg-white">
                <CardHeader className="bg-muted/5 border-b p-8">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-black tracking-widest text-primary px-4 py-1.5 bg-primary/10 rounded-full uppercase">Soal Nomor {currentIndex + 1}</span>
                    <Button variant="outline" size="sm" onClick={handleToggleFlag} className={cn("gap-2 font-bold transition-all px-6 border-2", answers[currentQuestion?.id]?.isFlagged ? "bg-amber-400 text-black border-amber-500" : "text-muted-foreground hover:border-primary/50")}>
                      <Flag className={cn("h-4 w-4", answers[currentQuestion?.id]?.isFlagged && "fill-current")} />
                      {answers[currentQuestion?.id]?.isFlagged ? "HAPUS TANDA" : "RAGU-RAGU"}
                    </Button>
                  </div>
                  {currentQuestion?.imageUrl && (
                    <div className="mb-6 relative w-full aspect-video md:aspect-[21/9] rounded-xl overflow-hidden border bg-muted/20">
                      <img src={currentQuestion.imageUrl} alt="Visual Soal" className="object-contain w-full h-full" />
                    </div>
                  )}
                  <div className="text-xl leading-relaxed text-foreground font-semibold"><LatexRenderer content={currentQuestion?.questionText || ""} /></div>
                </CardHeader>
                
                <CardContent className="flex-1 p-8 bg-muted/5">
                  <RadioGroup value={answers[currentQuestion?.id]?.choice || ""} onValueChange={handleSelectAnswer} className="grid grid-cols-1 gap-5">
                    {currentQuestion?.options?.map((opt: string, i: number) => {
                      const optKey = String.fromCharCode(65 + i);
                      const isSelected = answers[currentQuestion?.id]?.choice === optKey;
                      return (
                        <div key={i} className={cn("flex items-center space-x-3 rounded-2xl border-2 p-6 transition-all hover:bg-white hover:shadow-md cursor-pointer", isSelected ? "border-primary bg-white ring-2 ring-primary/20 shadow-lg" : "border-border bg-white/50")} onClick={() => handleSelectAnswer(optKey)}>
                          <RadioGroupItem value={optKey} id={`opt-${i}`} className="sr-only" />
                          <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer flex items-center gap-6 text-lg font-medium">
                            <span className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black border-2 transition-all shadow-sm", isSelected ? "bg-primary text-white border-primary rotate-3" : "bg-muted/50 text-muted-foreground border-muted")}>{optKey}</span>
                            <div className="flex-1"><LatexRenderer content={opt} inline /></div>
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </CardContent>

                <CardFooter className="p-8 border-t bg-white flex justify-between items-center">
                  <Button variant="ghost" onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0} className="gap-2 h-14 text-lg font-bold px-8 hover:bg-muted"><ChevronLeft className="h-5 w-5" /> SEBELUMNYA</Button>
                  {currentIndex < questions.length - 1 ? (
                    <Button onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))} className="bg-primary hover:bg-primary/90 gap-3 h-14 px-10 text-xl font-black shadow-xl transition-all active:scale-95 text-white">SIMPAN & LANJUTKAN <ChevronRight className="h-6 w-6" /></Button>
                  ) : (
                    <Button onClick={() => handleSubmit()} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 gap-3 h-14 px-10 text-xl font-black shadow-xl transition-all active:scale-95 text-white">{isSubmitting ? "MENGIRIM..." : "KIRIM JAWABAN"} <CheckCircle2 className="h-6 w-6" /></Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
