
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/Protected-route";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase-config";
import { doc, getDoc, setDoc, collection, updateDoc, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { LatexRenderer } from "@/components/LatexRenderer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Clock, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UjianPage() {
  const { id: examId } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isBlurred, setIsBlurred] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour default

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
        // Log warning to Firestore
        if (user && examId) {
          const sessionRef = doc(db, "exam_sessions", `${user.uid}_${examId}`);
          const sessionSnap = await getDoc(sessionRef);
          const warnings = sessionSnap.exists() ? (sessionSnap.data().warnings || []) : [];
          warnings.push({ timestamp: new Date(), type: 'tab_switch' });
          await setDoc(sessionRef, { warnings }, { merge: true });
          
          toast({
            variant: "destructive",
            title: "Peringatan Keamanan!",
            description: "Aktivitas mencurigakan (pindah tab) terdeteksi dan dicatat.",
          });
        }
      } else {
        // We keep it blurred until they click back into the content specifically?
        // Let's just notify. 
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
          setTimeLeft(examData.duration * 60 || 3600);

          // Check for existing session
          const sessionRef = doc(db, "exam_sessions", `${user.uid}_${examId}`);
          const sessionSnap = await getDoc(sessionRef);
          if (sessionSnap.exists()) {
            const sessionData = sessionSnap.data();
            setAnswers(sessionData.answers || {});
            setCurrentIndex(sessionData.lastIndex || 0);
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

  // AUTO-SAVE: Save answer every time it changes
  const saveProgress = useCallback(async (newAnswers: Record<string, string>, lastIdx: number) => {
    if (!user || !examId) return;
    try {
      const sessionRef = doc(db, "exam_sessions", `${user.uid}_${examId}`);
      await setDoc(sessionRef, {
        userId: user.uid,
        examId: examId,
        answers: newAnswers,
        lastIndex: lastIdx,
        lastUpdated: new Date()
      }, { merge: true });
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  }, [user, examId]);

  const handleSelectAnswer = (value: string) => {
    const questionId = questions[currentIndex].id || `q_${currentIndex}`;
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    saveProgress(newAnswers, currentIndex);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      saveProgress(answers, nextIdx);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      saveProgress(answers, prevIdx);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const calculateScoreIRT = () => {
    let totalScore = 0;
    let totalWeight = 0;
    
    questions.forEach((q, idx) => {
      const qId = q.id || `q_${idx}`;
      const difficulty = q.difficulty_level || 1;
      totalWeight += difficulty;
      
      if (answers[qId] === q.correct_answer) {
        totalScore += (100 * difficulty); // Weighted scoring as proxy for IRT
      }
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  };

  const handleSubmit = async () => {
    if (!user || !examId) return;
    
    const score = calculateScoreIRT();
    
    try {
      const resultRef = doc(collection(db, "results"), `${user.uid}_${examId}`);
      await setDoc(resultRef, {
        userId: user.uid,
        userEmail: user.email,
        examId,
        examTitle: exam.title,
        score,
        completedAt: new Date(),
        answers
      });

      toast({
        title: "Ujian Selesai!",
        description: `Skor akhir Anda: ${score}`,
      });
      
      router.push("/dashboard");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal Mengirim",
        description: "Terjadi kesalahan saat menyimpan hasil ujian.",
      });
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <ProtectedRoute>
      <div className={`min-h-screen bg-muted/20 transition-all duration-500 ${isBlurred ? 'blur-xl grayscale' : ''}`}>
        <header className="sticky top-0 z-50 bg-white border-b shadow-sm h-16">
          <div className="container mx-auto px-4 h-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-primary truncate max-w-[200px] sm:max-w-md">
                {exam?.title}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold ${timeLeft < 300 ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-muted text-foreground'}`}>
                <Clock className="h-4 w-4" />
                {formatTime(timeLeft)}
              </div>
              <Button variant="destructive" size="sm" onClick={handleSubmit}>Selesai</Button>
            </div>
          </div>
          <Progress value={progressPercent} className="h-1 rounded-none bg-muted" />
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {isBlurred && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md">
                <Card className="max-w-sm text-center p-6 space-y-4">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                  <CardTitle>Keamanan Terdeteksi</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Anda meninggalkan jendela ujian. Klik tombol di bawah untuk melanjutkan. Aktivitas ini telah dicatat.
                  </p>
                  <Button className="w-full bg-primary" onClick={() => setIsBlurred(false)}>Lanjutkan Ujian</Button>
                </Card>
              </div>
            )}

            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="font-medium">Soal No. {currentIndex + 1} dari {questions.length}</span>
                <span className="bg-secondary/20 text-secondary-foreground px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                  Level Kesulitan: {currentQuestion?.difficulty_level || 1}
                </span>
              </div>

              <Card className="border-none shadow-xl">
                <CardHeader className="pt-8 px-8">
                  <div className="text-xl leading-relaxed text-foreground/90">
                    <LatexRenderer content={currentQuestion?.question || ""} />
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <RadioGroup 
                    value={answers[currentQuestion?.id || `q_${currentIndex}`] || ""} 
                    onValueChange={handleSelectAnswer}
                    className="grid grid-cols-1 gap-4"
                  >
                    {currentQuestion?.options?.map((opt: any, i: number) => {
                      const optKey = String.fromCharCode(65 + i); // A, B, C, D...
                      return (
                        <div key={i} className={`flex items-center space-x-3 rounded-xl border p-4 transition-all hover:bg-muted/50 ${answers[currentQuestion?.id || `q_${currentIndex}`] === optKey ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'}`}>
                          <RadioGroupItem value={optKey} id={`opt-${i}`} className="sr-only" />
                          <Label 
                            htmlFor={`opt-${i}`} 
                            className="flex-1 cursor-pointer flex items-center gap-4 text-base font-normal"
                          >
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${answers[currentQuestion?.id || `q_${currentIndex}`] === optKey ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-transparent'}`}>
                              {optKey}
                            </span>
                            <LatexRenderer content={opt} inline />
                          </Label>
                          {answers[currentQuestion?.id || `q_${currentIndex}`] === optKey && (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      );
                    })}
                  </RadioGroup>
                </CardContent>
                <CardFooter className="p-8 border-t bg-muted/10 flex justify-between">
                  <Button 
                    variant="outline" 
                    onClick={handlePrev} 
                    disabled={currentIndex === 0}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" /> Sebelumnya
                  </Button>
                  
                  <div className="flex gap-2">
                    {currentIndex < questions.length - 1 ? (
                      <Button onClick={handleNext} className="bg-primary hover:bg-primary/90 gap-2">
                        Selanjutnya <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90 gap-2">
                        Selesaikan Ujian <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>

              {/* Number Navigation Map */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentIndex(i);
                      saveProgress(answers, i);
                    }}
                    className={`h-10 rounded-md text-xs font-bold transition-all ${
                      currentIndex === i 
                        ? 'bg-primary text-white scale-110 shadow-md ring-2 ring-primary ring-offset-2' 
                        : answers[questions[i].id || `q_${i}`] 
                          ? 'bg-secondary text-secondary-foreground' 
                          : 'bg-white text-muted-foreground border'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
