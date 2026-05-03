
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/Protected-route";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase-config";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  getDocs,
  serverTimestamp,
  addDoc
} from "firebase/firestore";
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

  // SECURITY: Disable right-click and selection
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 's' || e.key === 'p' || e.key === 'a')) {
        e.preventDefault();
      }
    };
    
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("no-select");

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("no-select");
    };
  }, []);

  // SECURITY: Detect tab switching
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        setIsBlurred(true);
        if (user && examId) {
          const warningRef = collection(db, "users", user.uid, "examSessions", examId as string, "antiCheatWarnings");
          await addDoc(warningRef, {
            timestamp: new Date().toISOString(),
            reason: "tab_switch",
            createdAt: new Date().toISOString()
          });
          
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
          setQuestions(examData.questions || []);
          
          // Use duration from exam if available, else default
          setTimeLeft(examData.durationMinutes ? examData.durationMinutes * 60 : 3600);

          // Check for existing session and answers
          const sessionRef = doc(db, "users", user.uid, "examSessions", examId as string);
          const sessionSnap = await getDoc(sessionRef);
          
          if (sessionSnap.exists()) {
            const sessionData = sessionSnap.data();
            setCurrentIndex(sessionData.currentQuestionIndex || 0);
            
            // Fetch saved answers
            const answersRef = collection(db, "users", user.uid, "examSessions", examId as string, "examAnswers");
            const answersSnap = await getDocs(answersRef);
            const loadedAnswers: any = {};
            answersSnap.forEach(doc => {
              const data = doc.data();
              loadedAnswers[data.questionId] = { 
                choice: String.fromCharCode(65 + data.chosenAnswerIndex), 
                isFlagged: data.isFlagged 
              };
            });
            setAnswers(loadedAnswers);
          } else {
            // Initialize new session
            await setDoc(sessionRef, {
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
            });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [examId, user]);

  // TIMER
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

  const saveProgress = useCallback(async (qIdx: number) => {
    if (!user || !examId) return;
    const sessionRef = doc(db, "users", user.uid, "examSessions", examId as string);
    await setDoc(sessionRef, { 
      currentQuestionIndex: qIdx,
      updatedAt: new Date().toISOString() 
    }, { merge: true });
  }, [user, examId]);

  const handleSelectAnswer = async (value: string) => {
    const q = questions[currentIndex];
    const qId = q.id || `q_${currentIndex}`;
    const newAnswers = { 
      ...answers, 
      [qId]: { ...answers[qId], choice: value } 
    };
    setAnswers(newAnswers);

    // Save answer to subcollection
    const answerRef = doc(db, "users", user.uid, "examSessions", examId as string, "examAnswers", qId);
    await setDoc(answerRef, {
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

  const handleToggleFlag = async () => {
    const q = questions[currentIndex];
    const qId = q.id || `q_${currentIndex}`;
    const newFlag = !answers[qId]?.isFlagged;
    
    const newAnswers = { 
      ...answers, 
      [qId]: { ...answers[qId], isFlagged: newFlag } 
    };
    setAnswers(newAnswers);

    const answerRef = doc(db, "users", user.uid, "examSessions", examId as string, "examAnswers", qId);
    await setDoc(answerRef, { isFlagged: newFlag, updatedAt: new Date().toISOString() }, { merge: true });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      saveProgress(nextIdx);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      saveProgress(prevIdx);
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
      // Calculate basic score
      let correct = 0;
      questions.forEach((q, idx) => {
        const qId = q.id || `q_${idx}`;
        if (answers[qId]?.choice === q.correct_answer) correct++;
      });

      const resultRef = doc(db, "users", user.uid, "results", examId as string);
      await setDoc(resultRef, {
        id: examId,
        studentId: user.uid,
        examId: examId,
        examSessionId: examId,
        submissionTime: new Date().toISOString(),
        totalScore: Math.round((correct / questions.length) * 100),
        weightedScore: correct, // IRT placeholder
        correctAnswerCount: correct,
        incorrectAnswerCount: questions.length - correct,
        unansweredCount: questions.length - Object.keys(answers).length,
        resultAnswerIds: [],
        antiCheatWarningCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

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
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-primary truncate max-w-[200px] md:max-w-md">
                {exam?.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserIcon className="h-3 w-3" />
                <span>{user?.email}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold transition-colors",
                timeLeft < 300 ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-foreground"
              )}>
                <Clock className="h-4 w-4" />
                {formatTime(timeLeft)}
              </div>
              <Button variant="destructive" size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                Selesai
              </Button>
            </div>
          </div>
          <Progress value={progressPercent} className="h-1 rounded-none bg-muted" />
        </header>

        <main className="container mx-auto px-4 py-8">
          {isBlurred && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto">
              <Card className="max-w-sm text-center p-8 space-y-6 shadow-2xl border-t-4 border-destructive">
                <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
                <div className="space-y-2">
                  <CardTitle className="text-2xl">Aktivitas Terlarang</CardTitle>
                  <p className="text-muted-foreground">
                    Anda terdeteksi meninggalkan halaman ujian. Klik tombol di bawah untuk kembali. Kejadian ini dicatat sistem.
                  </p>
                </div>
                <Button className="w-full bg-primary h-12 text-lg" onClick={() => setIsBlurred(false)}>
                  Kembali ke Ujian
                </Button>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Panel: Navigation */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Navigasi Soal
                  </CardTitle>
                  <CardDescription>Pilih nomor untuk melompat ke soal</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2">
                    {questions.map((_, i) => {
                      const qId = questions[i].id || `q_${i}`;
                      const hasAnswer = !!answers[qId]?.choice;
                      const isFlagged = answers[qId]?.isFlagged;
                      const isActive = currentIndex === i;

                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setCurrentIndex(i);
                            saveProgress(i);
                          }}
                          className={cn(
                            "h-10 rounded-md text-sm font-bold transition-all border shadow-sm flex items-center justify-center relative",
                            isActive 
                              ? "bg-primary text-white scale-110 ring-2 ring-primary ring-offset-2 z-10" 
                              : isFlagged
                                ? "bg-secondary text-secondary-foreground border-secondary"
                                : hasAnswer
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : "bg-white text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {i + 1}
                          {isFlagged && (
                            <div className="absolute -top-1 -right-1">
                              <Flag className="h-3 w-3 fill-current text-primary" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 pt-0">
                  <div className="flex items-center gap-2 text-xs w-full">
                    <div className="w-3 h-3 bg-secondary rounded border" />
                    <span>Ragu-ragu / Ditandai</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs w-full">
                    <div className="w-3 h-3 bg-primary/10 rounded border" />
                    <span>Sudah Terjawab</span>
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* Right Panel: Question Content */}
            <div className="lg:col-span-3">
              <Card className="border-none shadow-xl overflow-hidden min-h-[500px] flex flex-col">
                <CardHeader className="bg-muted/10 border-b p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-primary px-3 py-1 bg-primary/5 rounded-full">
                      SOAL NOMOR {currentIndex + 1}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleToggleFlag}
                      className={cn(
                        "gap-2 font-medium transition-colors",
                        answers[currentQuestion?.id || `q_${currentIndex}`]?.isFlagged 
                          ? "bg-secondary text-secondary-foreground border-secondary" 
                          : "text-muted-foreground"
                      )}
                    >
                      <Flag className={cn("h-4 w-4", answers[currentQuestion?.id || `q_${currentIndex}`]?.isFlagged && "fill-current")} />
                      {answers[currentQuestion?.id || `q_${currentIndex}`]?.isFlagged ? "Hapus Tanda" : "Ragu-ragu"}
                    </Button>
                  </div>
                  <div className="text-lg leading-relaxed text-foreground/90 font-medium">
                    <LatexRenderer content={currentQuestion?.questionText || ""} />
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 p-8">
                  <RadioGroup 
                    value={answers[currentQuestion?.id || `q_${currentIndex}`]?.choice || ""} 
                    onValueChange={handleSelectAnswer}
                    className="grid grid-cols-1 gap-4"
                  >
                    {currentQuestion?.options?.map((opt: string, i: number) => {
                      const optKey = String.fromCharCode(65 + i);
                      const isSelected = answers[currentQuestion?.id || `q_${currentIndex}`]?.choice === optKey;
                      
                      return (
                        <div 
                          key={i} 
                          className={cn(
                            "flex items-center space-x-3 rounded-xl border-2 p-4 transition-all hover:border-primary/50 cursor-pointer",
                            isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border"
                          )}
                          onClick={() => handleSelectAnswer(optKey)}
                        >
                          <RadioGroupItem value={optKey} id={`opt-${i}`} className="sr-only" />
                          <Label 
                            htmlFor={`opt-${i}`} 
                            className="flex-1 cursor-pointer flex items-center gap-5 text-base font-normal"
                          >
                            <span className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
                              isSelected ? "bg-primary text-white border-primary" : "bg-muted text-muted-foreground border-transparent"
                            )}>
                              {optKey}
                            </span>
                            <div className="flex-1">
                              <LatexRenderer content={opt} inline />
                            </div>
                          </Label>
                          {isSelected && (
                            <CheckCircle2 className="h-6 w-6 text-primary animate-in zoom-in-50" />
                          )}
                        </div>
                      );
                    })}
                  </RadioGroup>
                </CardContent>

                <CardFooter className="p-6 border-t bg-muted/5 flex justify-between items-center">
                  <Button 
                    variant="ghost" 
                    onClick={handlePrev} 
                    disabled={currentIndex === 0}
                    className="gap-2 h-11"
                  >
                    <ChevronLeft className="h-4 w-4" /> Sebelumnya
                  </Button>
                  
                  <div className="flex gap-4">
                    {currentIndex < questions.length - 1 ? (
                      <Button onClick={handleNext} className="bg-primary hover:bg-primary/90 gap-2 h-11 px-8 font-bold">
                        Simpan & Lanjutkan <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 gap-2 h-11 px-8 font-bold shadow-lg">
                        {isSubmitting ? "Mengirim..." : "Kirim Jawaban"} <CheckCircle2 className="h-4 w-4" />
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
