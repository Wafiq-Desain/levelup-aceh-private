
'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/Protected-route";
import { useAuth } from "@/contexts/auth-context";
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase-config";
import { 
  setDocumentNonBlocking, 
  updateDocumentNonBlocking, 
  addDocumentNonBlocking 
} from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { LatexRenderer } from "@/components/LatexRenderer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  AlertCircle, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Flag,
  User as UserIcon,
  BookOpen
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function UjianPage() {
  const { id: examId } = useParams();
  const { user } = useAuth();
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

  // Refs for tracking changes
  const lastSavedIndex = useRef<number>(0);

  // SECURITY: Disable right-click and selection
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

  // SECURITY: Detect tab switching
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
        if (user && examId) {
          const warningRef = collection(db, "users", user.uid, "examSessions", examId as string, "antiCheatWarnings");
          const warningData = {
            timestamp: new Date().toISOString(),
            reason: "tab_switch",
            createdAt: new Date().toISOString()
          };
          
          addDocumentNonBlocking(warningRef, warningData);
          
          toast({
            variant: "destructive",
            title: "Peringatan Keamanan!",
            description: "Pindah tab terdeteksi. Aktivitas Anda telah dicatat oleh sistem.",
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, examId, toast]);

  // Load Exam Data & Resume Session
  useEffect(() => {
    const fetchData = async () => {
      if (!examId || !user) return;

      try {
        const examDoc = await getDoc(doc(db, "exams", examId as string));
        if (examDoc.exists()) {
          const examData = examDoc.data();
          setExam(examData);
          
          // Fetch questions from subcollection
          const questionsRef = collection(db, "exams", examId as string, "questions");
          const qSnap = await getDocs(query(questionsRef, orderBy("createdAt", "asc")));
          const qList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setQuestions(qList);
          
          setTimeLeft(examData.durationMinutes ? examData.durationMinutes * 60 : 3600);

          // Check for existing session
          const sessionRef = doc(db, "users", user.uid, "examSessions", examId as string);
          const sessionSnap = await getDoc(sessionRef);
          
          if (sessionSnap.exists()) {
            const sessionData = sessionSnap.data();
            setCurrentIndex(sessionData.currentQuestionIndex || 0);
            lastSavedIndex.current = sessionData.currentQuestionIndex || 0;
            
            // Load answers
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
            // Create new session
            const initialSession = {
              id: examId,
              studentId: user.uid,
              examId: examId,
              startTime: new Date().toISOString(),
              currentQuestionIndex: 0,
              examAnswerIds: [],
              antiCheatWarningIds: [],
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
  }, [examId, user]);

  // Timer Countdown
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

  // Auto-save current question index
  const saveIndex = useCallback((qIdx: number) => {
    if (!user || !examId) return;
    const sessionRef = doc(db, "users", user.uid, "examSessions", examId as string);
    updateDocumentNonBlocking(sessionRef, { 
      currentQuestionIndex: qIdx,
      updatedAt: new Date().toISOString() 
    });
    lastSavedIndex.current = qIdx;
  }, [user, examId]);

  const handleSelectAnswer = (value: string) => {
    if (!user || !examId) return;
    const q = questions[currentIndex];
    const qId = q.id;
    
    const newAnswers = { 
      ...answers, 
      [qId]: { ...answers[qId], choice: value } 
    };
    setAnswers(newAnswers);

    // Auto-save answer to Firestore
    const answerRef = doc(db, "users", user.uid, "examSessions", examId as string, "examAnswers", qId);
    const answerData = {
      id: qId,
      examSessionId: examId,
      questionId: qId,
      chosenAnswerIndex: value.charCodeAt(0) - 65,
      isFlagged: answers[qId]?.isFlagged || false,
      answerTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setDocumentNonBlocking(answerRef, answerData, { merge: true });
  };

  const handleToggleFlag = () => {
    if (!user || !examId) return;
    const q = questions[currentIndex];
    const qId = q.id;
    const newFlag = !answers[qId]?.isFlagged;
    
    const newAnswers = { 
      ...answers, 
      [qId]: { ...answers[qId], isFlagged: newFlag } 
    };
    setAnswers(newAnswers);

    const answerRef = doc(db, "users", user.uid, "examSessions", examId as string, "examAnswers", qId);
    updateDocumentNonBlocking(answerRef, { 
      isFlagged: newFlag, 
      updatedAt: new Date().toISOString() 
    });
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
      let correct = 0;
      questions.forEach((q) => {
        const qId = q.id;
        if (answers[qId]?.choice === String.fromCharCode(65 + q.correctAnswerIndex)) {
          correct++;
        }
      });

      const resultRef = doc(db, "users", user.uid, "results", examId as string);
      const resultData = {
        id: examId,
        studentId: user.uid,
        examId: examId,
        examSessionId: examId,
        submissionTime: new Date().toISOString(),
        totalScore: Math.round((correct / questions.length) * 100),
        weightedScore: correct, // IRT logic could be more complex here
        correctAnswerCount: correct,
        incorrectAnswerCount: questions.length - correct,
        unansweredCount: questions.length - Object.keys(answers).length,
        resultAnswerIds: [],
        antiCheatWarningCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDocumentNonBlocking(resultRef, resultData, { merge: true });

      toast({
        title: "Ujian Selesai!",
        description: "Jawaban Anda telah berhasil dikirim.",
      });
      
      router.push("/dashboard");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal Mengirim",
        description: "Terjadi kesalahan saat menyimpan hasil.",
      });
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <ProtectedRoute>
      <div className={cn("min-h-screen bg-muted/30 transition-all duration-500", isBlurred && "blur-2xl grayscale pointer-events-none")}>
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="container mx-auto px-4 h-20 flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-primary truncate max-w-[200px] md:max-w-md">
                {exam?.title}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <UserIcon className="h-4 w-4" />
                <span className="font-semibold">{user?.displayName || user?.email}</span>
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
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto">
              <Card className="max-w-sm text-center p-8 space-y-6 shadow-2xl border-t-8 border-destructive">
                <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
                <div className="space-y-2">
                  <CardTitle className="text-2xl font-bold">PERINGATAN KERAS!</CardTitle>
                  <p className="text-muted-foreground font-medium">
                    Anda terdeteksi meninggalkan halaman ujian. Kejadian ini dicatat otomatis. Klik tombol di bawah untuk kembali.
                  </p>
                </div>
                <Button className="w-full bg-primary h-14 text-xl font-bold" onClick={() => setIsBlurred(false)}>
                  KEMBALI KE UJIAN
                </Button>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Panel: Navigation */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="shadow-lg border-t-4 border-primary">
                <CardHeader className="pb-3 bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    NAVIGASI SOAL
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-5 gap-3">
                    {questions.map((q, i) => {
                      const hasAnswer = !!answers[q.id]?.choice;
                      const isFlagged = answers[q.id]?.isFlagged;
                      const isActive = currentIndex === i;

                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setCurrentIndex(i);
                            saveIndex(i);
                          }}
                          className={cn(
                            "h-12 rounded-lg text-sm font-black transition-all border-2 shadow-sm flex items-center justify-center relative",
                            isActive || isFlagged
                              ? "bg-secondary text-secondary-foreground border-secondary scale-105 ring-2 ring-secondary ring-offset-2 z-10" 
                              : hasAnswer
                                ? "bg-primary/10 text-primary border-primary/30"
                                : "bg-white text-muted-foreground border-muted hover:border-primary/50"
                          )}
                        >
                          {i + 1}
                          {isFlagged && (
                            <div className="absolute -top-2 -right-2 bg-primary rounded-full p-1 shadow-md">
                              <Flag className="h-3 w-3 fill-white text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 pt-0 text-xs font-semibold">
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-4 h-4 bg-secondary rounded border shadow-sm" />
                    <span>Aktif / Ragu-ragu</span>
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-4 h-4 bg-primary/10 rounded border border-primary/30" />
                    <span>Sudah Terjawab</span>
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* Right Panel: Question Content */}
            <div className="lg:col-span-3">
              <Card className="border-none shadow-2xl overflow-hidden min-h-[600px] flex flex-col bg-white">
                <CardHeader className="bg-muted/5 border-b p-8">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-black tracking-widest text-primary px-4 py-1.5 bg-primary/10 rounded-full uppercase">
                      Soal Nomor {currentIndex + 1}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleToggleFlag}
                      className={cn(
                        "gap-2 font-bold transition-all px-6 border-2",
                        answers[currentQuestion?.id]?.isFlagged 
                          ? "bg-secondary text-secondary-foreground border-secondary" 
                          : "text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <Flag className={cn("h-4 w-4", answers[currentQuestion?.id]?.isFlagged && "fill-current")} />
                      {answers[currentQuestion?.id]?.isFlagged ? "HAPUS TANDA" : "RAGU-RAGU"}
                    </Button>
                  </div>
                  <div className="text-xl leading-relaxed text-foreground font-semibold">
                    <LatexRenderer content={currentQuestion?.questionText || ""} />
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 p-8 bg-muted/5">
                  <RadioGroup 
                    value={answers[currentQuestion?.id]?.choice || ""} 
                    onValueChange={handleSelectAnswer}
                    className="grid grid-cols-1 gap-5"
                  >
                    {currentQuestion?.options?.map((opt: string, i: number) => {
                      const optKey = String.fromCharCode(65 + i);
                      const isSelected = answers[currentQuestion?.id]?.choice === optKey;
                      
                      return (
                        <div 
                          key={i} 
                          className={cn(
                            "flex items-center space-x-3 rounded-2xl border-2 p-6 transition-all hover:bg-white hover:shadow-md cursor-pointer",
                            isSelected ? "border-primary bg-white ring-2 ring-primary/20 shadow-lg" : "border-border bg-white/50"
                          )}
                          onClick={() => handleSelectAnswer(optKey)}
                        >
                          <RadioGroupItem value={optKey} id={`opt-${i}`} className="sr-only" />
                          <Label 
                            htmlFor={`opt-${i}`} 
                            className="flex-1 cursor-pointer flex items-center gap-6 text-lg font-medium"
                          >
                            <span className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black border-2 transition-all shadow-sm",
                              isSelected ? "bg-primary text-white border-primary rotate-3" : "bg-muted/50 text-muted-foreground border-muted"
                            )}>
                              {optKey}
                            </span>
                            <div className="flex-1">
                              <LatexRenderer content={opt} inline />
                            </div>
                          </Label>
                          {isSelected && (
                            <CheckCircle2 className="h-8 w-8 text-primary animate-in zoom-in-50" />
                          )}
                        </div>
                      );
                    })}
                  </RadioGroup>
                </CardContent>

                <CardFooter className="p-8 border-t bg-white flex justify-between items-center">
                  <Button 
                    variant="ghost" 
                    onClick={handlePrev} 
                    disabled={currentIndex === 0}
                    className="gap-2 h-14 text-lg font-bold px-8 hover:bg-muted"
                  >
                    <ChevronLeft className="h-5 w-5" /> SEBELUMNYA
                  </Button>
                  
                  <div className="flex gap-4">
                    {currentIndex < questions.length - 1 ? (
                      <Button onClick={handleNext} className="bg-primary hover:bg-primary/90 gap-3 h-14 px-10 text-xl font-black shadow-xl transition-all active:scale-95 text-white">
                        SIMPAN & LANJUTKAN <ChevronRight className="h-6 w-6" />
                      </Button>
                    ) : (
                      <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 gap-3 h-14 px-10 text-xl font-black shadow-xl transition-all active:scale-95 text-white">
                        {isSubmitting ? "MENGIRIM..." : "KIRIM JAWABAN"} <CheckCircle2 className="h-6 w-6" />
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
