
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
  const [attemptLimitReached, setAttemptLimitReached] = useState(false);
  
  const hasSubmitted = useRef(false);

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
        unansweredCount: questions.length - answeredCount,
        antiCheatWarningCount: isAuto ? 1 : 0,
        isAutoSubmitted: isAuto,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setDocumentNonBlocking(resultRef, resultData, { merge: true });

      toast({ 
        title: isAuto ? "KECURANGAN TERDETEKSI!" : "Ujian Selesai!", 
        description: isAuto ? "Anda terkeluar otomatis karena pindah tab/apps. Kuota percobaan berkurang." : "Hasil Anda telah disimpan.",
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

  // Anti-Cheat: NO TOLERANCE (1 violation = Force Submit)
  useEffect(() => {
    const handleViolation = () => {
      if (hasSubmitted.current) return;
      setIsBlurred(true);
      handleSubmit(true);
    };

    const onVisibilityChange = () => { if (document.hidden) handleViolation(); };
    const onWindowBlur = () => { handleViolation(); };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [handleSubmit]);

  useEffect(() => {
    const fetchData = async () => {
      if (!examId || !user) return;
      try {
        setLoading(true);

        const resultsRef = collection(db, "users", user.uid, "results");
        const resultsQuery = query(resultsRef, where("examId", "==", examId));
        const resultsSnap = await getDocs(resultsQuery);
        
        // STRICT 2 ATTEMPTS LIMIT
        if (resultsSnap.size >= 2) {
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
    const qId = questions[currentIndex].id;
    setAnswers({ ...answers, [qId]: { ...answers[qId], choice: value } });

    const answerRef = doc(db, "users", user.uid, "examSessions", examId as string, "examAnswers", qId);
    setDocumentNonBlocking(answerRef, {
      id: qId,
      examSessionId: examId,
      questionId: qId,
      chosenAnswerIndex: value.charCodeAt(0) - 65,
      answerTime: new Date().toISOString()
    }, { merge: true });
  };

  const handleToggleFlag = () => {
    const qId = questions[currentIndex].id;
    const newFlag = !answers[qId]?.isFlagged;
    setAnswers({ ...answers, [qId]: { ...answers[qId], isFlagged: newFlag } });
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
        <div className="flex h-screen items-center justify-center p-4 bg-muted/20 text-center">
          <Card className="max-w-md w-full p-8 border-t-8 border-destructive">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle className="text-2xl font-bold">Batas Percobaan Habis</CardTitle>
            <p className="text-muted-foreground my-4">Anda sudah menggunakan maksimal 2 kali percobaan untuk ujian ini.</p>
            <Button className="w-full h-12" onClick={() => router.push('/dashboard')}>Kembali ke Dashboard</Button>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <ProtectedRoute>
      <div className={cn("min-h-screen bg-muted/30 transition-all", isBlurred && "blur-2xl grayscale pointer-events-none")}>
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="container mx-auto px-4 h-20 flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-primary truncate max-w-md">{exam?.title}</h2>
              <div className="flex items-center gap-2 text-[10px] text-destructive font-black uppercase">
                <ShieldAlert className="h-3 w-3" /> Keamanan Ketat: Pindah Tab = Gagal
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-full font-mono text-xl font-bold shadow-inner",
                timeLeft < 300 ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-foreground"
              )}>
                <Clock className="h-6 w-6" />
                {formatTime(timeLeft)}
              </div>
              <Button variant="destructive" size="lg" onClick={() => handleSubmit()} disabled={isSubmitting} className="font-bold px-8 bg-primary">
                SELESAI
              </Button>
            </div>
          </div>
          <Progress value={progressPercent} className="h-1.5 rounded-none" />
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-4">
              <Card className="shadow-lg border-t-4 border-primary">
                <CardHeader className="pb-3 bg-muted/20">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest"><BookOpen className="h-3 w-3" /> Navigasi</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-5 gap-2">
                    {questions.map((q, i) => {
                      const hasAnswer = !!answers[q?.id]?.choice;
                      const isFlagged = answers[q?.id]?.isFlagged;
                      const isActive = currentIndex === i;
                      return (
                        <button key={i} onClick={() => setCurrentIndex(i)} className={cn(
                          "h-10 rounded text-xs font-black transition-all border flex items-center justify-center relative",
                          isActive ? "bg-secondary text-secondary-foreground border-secondary" 
                          : isFlagged ? "bg-amber-400 text-black border-amber-500"
                          : hasAnswer ? "bg-primary/10 text-primary border-primary/30" : "bg-white text-muted-foreground border-muted"
                        )}>
                          {i + 1}
                          {isFlagged && <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5"><Flag className="h-2 w-2 fill-white text-white" /></div>}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-3">
              <Card className="border-none shadow-xl min-h-[500px] flex flex-col bg-white overflow-hidden">
                <CardHeader className="p-8 border-b">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black tracking-widest text-primary px-3 py-1 bg-primary/10 rounded-full uppercase">Nomor {currentIndex + 1}</span>
                    <Button variant="outline" size="sm" onClick={handleToggleFlag} className={cn("gap-2 font-bold", answers[currentQuestion?.id]?.isFlagged ? "bg-amber-400 text-black" : "text-muted-foreground")}>
                      <Flag className={cn("h-4 w-4", answers[currentQuestion?.id]?.isFlagged && "fill-current")} />
                      {answers[currentQuestion?.id]?.isFlagged ? "Hapus Tanda" : "Ragu-ragu"}
                    </Button>
                  </div>
                  {currentQuestion?.imageUrl && (
                    <div className="mb-6 border rounded-lg bg-muted/20 flex justify-center p-2">
                      <img src={currentQuestion.imageUrl} alt="Soal" className="max-h-60 object-contain" />
                    </div>
                  )}
                  <div className="text-lg font-semibold leading-relaxed">
                    <LatexRenderer content={currentQuestion?.questionText || ""} />
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 p-8 bg-muted/5">
                  <RadioGroup value={answers[currentQuestion?.id]?.choice || ""} onValueChange={handleSelectAnswer} className="grid grid-cols-1 gap-4">
                    {currentQuestion?.options?.map((opt: string, i: number) => {
                      const optKey = String.fromCharCode(65 + i);
                      const isSelected = answers[currentQuestion?.id]?.choice === optKey;
                      return (
                        <div key={i} className={cn("flex items-center space-x-3 rounded-xl border-2 p-5 transition-all cursor-pointer bg-white", isSelected ? "border-primary ring-2 ring-primary/10 shadow-md" : "border-border hover:border-primary/30")} onClick={() => handleSelectAnswer(optKey)}>
                          <RadioGroupItem value={optKey} id={`opt-${i}`} className="sr-only" />
                          <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer flex items-center gap-4 text-sm font-medium">
                            <span className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black border-2", isSelected ? "bg-primary text-white border-primary" : "bg-muted/50 text-muted-foreground")}>{optKey}</span>
                            <div className="flex-1"><LatexRenderer content={opt} inline /></div>
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </CardContent>

                <CardFooter className="p-6 border-t bg-white flex justify-between">
                  <Button variant="ghost" onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0} className="font-bold"><ChevronLeft className="h-4 w-4 mr-2" /> SEBELUMNYA</Button>
                  {currentIndex < questions.length - 1 ? (
                    <Button onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))} className="bg-primary font-black px-8 h-12">SELANJUTNYA <ChevronRight className="h-4 w-4 ml-2" /></Button>
                  ) : (
                    <Button onClick={() => handleSubmit()} disabled={isSubmitting} className="bg-primary font-black px-8 h-12">KIRIM JAWABAN <CheckCircle2 className="h-4 w-4 ml-2" /></Button>
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
