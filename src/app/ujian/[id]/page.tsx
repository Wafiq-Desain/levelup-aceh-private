
'use client';

import { useEffect, useState, useCallback } from "react";
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
  increment
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
  ShieldAlert
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

  // Security: Prevent Right Click and Selection
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", preventDefault);
    document.addEventListener("selectstart", preventDefault);
    document.body.classList.add("no-select");

    return () => {
      document.removeEventListener("contextmenu", preventDefault);
      document.removeEventListener("selectstart", preventDefault);
      document.body.classList.remove("no-select");
    };
  }, []);

  // Anti-Cheat: Tab Switching Detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
        if (user && examId) {
          const newWarningCount = warningCount + 1;
          setWarningCount(newWarningCount);
          
          const warningRef = collection(db, "users", user.uid, "examSessions", examId as string, "antiCheatWarnings");
          const warningData = {
            timestamp: new Date().toISOString(),
            reason: "tab_switch",
            createdAt: new Date().toISOString()
          };
          addDocumentNonBlocking(warningRef, warningData);
          
          // Also update warning count in session
          const sessionRef = doc(db, "users", user.uid, "examSessions", examId as string);
          updateDocumentNonBlocking(sessionRef, { 
            antiCheatWarningCount: increment(1),
            updatedAt: new Date().toISOString() 
          });

          toast({
            variant: "destructive",
            title: "Peringatan Keamanan!",
            description: "Pindah tab terdeteksi. Pelanggaran Anda telah dicatat.",
          });
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, examId, toast, db, warningCount]);

  useEffect(() => {
    const fetchData = async () => {
      if (!examId || !user) return;
      try {
        const examDoc = await getDoc(doc(db, "exams", examId as string));
        if (examDoc.exists()) {
          const examData = examDoc.data();
          setExam(examData);
          
          const questionsRef = collection(db, "exams", examId as string, "questions");
          const qSnap = await getDocs(query(questionsRef, orderBy("createdAt", "asc")));
          const qList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Filter questions based on the questionIds array in the exam document
          // This ensures that deleted questions don't show up
          if (examData.questionIds && examData.questionIds.length > 0) {
            const filtered = examData.questionIds.map((qId: string) => 
              qList.find(q => q.id === qId)
            ).filter(Boolean);
            setQuestions(filtered);
          } else {
            setQuestions(qList);
          }
          
          setTimeLeft(examData.durationMinutes ? examData.durationMinutes * 60 : 3600);

          const sessionRef = doc(db, "users", user.uid, "examSessions", examId as string);
          const sessionSnap = await getDoc(sessionRef);
          
          if (sessionSnap.exists()) {
            const sessionData = sessionSnap.data();
            setCurrentIndex(sessionData.currentQuestionIndex || 0);
            setWarningCount(sessionData.antiCheatWarningCount || 0);
            
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
            const initialSession = {
              id: examId,
              studentId: user.uid,
              examId: examId,
              startTime: new Date().toISOString(),
              currentQuestionIndex: 0,
              examAnswerIds: [],
              antiCheatWarningIds: [],
              antiCheatWarningCount: 0,
              isCompleted: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            setDocumentNonBlocking(sessionRef, initialSession, { merge: true });
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
    if (loading || isSubmitting) return;
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
  }, [loading, isSubmitting]);

  const saveIndex = useCallback((qIdx: number) => {
    if (!user || !examId) return;
    const sessionRef = doc(db, "users", user.uid, "examSessions", examId as string);
    updateDocumentNonBlocking(sessionRef, { 
      currentQuestionIndex: qIdx,
      updatedAt: new Date().toISOString() 
    });
  }, [user, examId, db]);

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

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      saveIndex(nextIdx);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      saveIndex(prevIdx);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!user || !examId || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const weights: Record<string, number> = { 'easy': 1, 'medium': 3, 'hard': 5 };
      let totalEarnedWeight = 0;
      let totalMaxWeight = 0;
      let correctCount = 0;

      questions.forEach((q) => {
        const weight = weights[q.difficultyLevel] || 1;
        totalMaxWeight += weight;
        if (answers[q.id]?.choice === String.fromCharCode(65 + q.correctAnswerIndex)) {
          totalEarnedWeight += weight;
          correctCount++;
        }
      });

      const irtScore = totalMaxWeight > 0 ? Math.round((totalEarnedWeight / totalMaxWeight) * 100) : 0;

      const resultRef = doc(db, "users", user.uid, "results", examId as string);
      const resultData = {
        id: examId,
        studentId: user.uid,
        examId: examId,
        examSessionId: examId,
        submissionTime: new Date().toISOString(),
        totalScore: irtScore,
        weightedScore: totalEarnedWeight,
        correctAnswerCount: correctCount,
        incorrectAnswerCount: questions.length - correctCount,
        unansweredCount: questions.length - Object.keys(answers).length,
        antiCheatWarningCount: warningCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDocumentNonBlocking(resultRef, resultData, { merge: true });

      toast({ title: "Ujian Selesai!", description: "Skor Anda telah berhasil dikirim." });
      router.push("/dashboard");
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal Mengirim", description: "Terjadi kesalahan saat menyimpan hasil." });
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <ProtectedRoute>
      <div className={cn("min-h-screen bg-muted/30 transition-all duration-500", isBlurred && "blur-xl grayscale pointer-events-none")}>
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="container mx-auto px-4 h-20 flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-primary truncate max-w-[200px] md:max-w-md">{exam?.title}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <ShieldAlert className={cn("h-4 w-4", warningCount > 0 ? "text-destructive" : "text-green-500")} />
                <span className="font-semibold">Pelanggaran: {warningCount}</span>
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
              <Button variant="destructive" size="lg" onClick={handleSubmit} disabled={isSubmitting} className="font-bold px-8 bg-primary hover:bg-primary/90">
                SELESAI
              </Button>
            </div>
          </div>
          <Progress value={progressPercent} className="h-1.5 rounded-none bg-muted" />
        </header>

        <main className="container mx-auto px-4 py-8">
          {isBlurred && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-auto">
              <Card className="max-w-md text-center p-10 space-y-6 shadow-2xl border-t-8 border-destructive">
                <ShieldAlert className="h-20 w-20 text-destructive mx-auto animate-bounce" />
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-black text-destructive">DETEKSI PELANGGARAN!</CardTitle>
                  <p className="text-muted-foreground text-lg font-medium">Anda terdeteksi meninggalkan halaman ujian atau mencoba melakukan screenshot. Aktivitas ini telah dicatat oleh sistem admin.</p>
                </div>
                <Button className="w-full bg-primary h-16 text-2xl font-bold shadow-xl hover:scale-105 transition-transform" onClick={() => setIsBlurred(false)}>SAYA MENGERTI</Button>
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
                      const hasAnswer = !!answers[q.id]?.choice;
                      const isFlagged = answers[q.id]?.isFlagged;
                      const isActive = currentIndex === i;
                      return (
                        <button key={i} onClick={() => { setCurrentIndex(i); saveIndex(i); }} className={cn(
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
                  <Button variant="ghost" onClick={handlePrev} disabled={currentIndex === 0} className="gap-2 h-14 text-lg font-bold px-8 hover:bg-muted"><ChevronLeft className="h-5 w-5" /> SEBELUMNYA</Button>
                  {currentIndex < questions.length - 1 ? (
                    <Button onClick={handleNext} className="bg-primary hover:bg-primary/90 gap-3 h-14 px-10 text-xl font-black shadow-xl transition-all active:scale-95 text-white">SIMPAN & LANJUTKAN <ChevronRight className="h-6 w-6" /></Button>
                  ) : (
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 gap-3 h-14 px-10 text-xl font-black shadow-xl transition-all active:scale-95 text-white">{isSubmitting ? "MENGIRIM..." : "KIRIM JAWABAN"} <CheckCircle2 className="h-6 w-6" /></Button>
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
