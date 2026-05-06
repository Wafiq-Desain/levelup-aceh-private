
"use client";

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { useAppAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { 
  BookOpen, 
  LogOut, 
  Award, 
  User, 
  ListChecks, 
  LayoutDashboard, 
  ShieldCheck, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  FileText,
  TrendingUp
} from "lucide-react";
import { useAuth, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import { useEffect, useState, useCallback } from "react";
import { collection, query, getDocs, orderBy, where, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { user, role } = useAppAuth();
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const [exams, setExams] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      const profileSnap = await getDoc(doc(db, "userProfiles", user.uid));
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        setUserProfile(data);
        
        // Pengecekan kelengkapan biodata yang lebih aman
        const isComplete = !!(
          data.displayName && 
          data.class && 
          data.schoolName && 
          data.phoneNumber && 
          data.birthDate && 
          data.gender
        );

        if (!isComplete && role === 'student') {
          router.replace("/complete-profile");
          return;
        }
      } else if (role === 'student') {
        // Jika dokumen profil belum ada sama sekali
        router.replace("/complete-profile");
        return;
      }

      const examsSnapshot = await getDocs(query(collection(db, "exams")));
      setExams(examsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const resultsSnapshot = await getDocs(query(collection(db, "users", user.uid, "results"), orderBy("submissionTime", "desc")));
      setUserResults(resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      if (role === 'admin') {
        const studentsSnapshot = await getDocs(query(collection(db, "userProfiles"), where("role", "==", "student")));
        setTotalStudents(studentsSnapshot.size);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [db, user, role, router]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleStartExam = (examId: string) => {
    router.push(`/ujian/${examId}`);
  };

  const getAttemptCount = (examId: string) => {
    return userResults.filter(r => r.examId === examId).length;
  };

  const completedExams = userResults.length;
  const averageScore = userResults.length > 0 
    ? Math.round(userResults.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / userResults.length)
    : 0;

  if (loading) return <div className="flex h-screen items-center justify-center bg-white"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div></div>;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/10 pb-12">
        <header className="bg-primary text-white shadow-md sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/10 rounded-lg">
                <LayoutDashboard className="h-5 w-5 text-secondary" />
              </div>
              <h1 className="text-lg md:text-xl font-bold">Level Up Aceh</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-xs text-white hover:bg-white/10">
                <LogOut className="h-4 w-4 mr-2" /> <span className="hidden sm:inline">Keluar</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-8">
              {role === 'admin' && (
                <section className="bg-primary/5 p-4 md:p-6 rounded-2xl border border-primary/10">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-primary">
                    <ShieldCheck className="h-6 w-6" /> Admin Dashboard
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="hover:shadow-md transition-all border-none shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2 text-primary">
                          <ListChecks className="h-4 w-4" /> Bank Soal
                        </CardTitle>
                        <CardDescription className="text-[11px]">Kelola paket ujian & pertanyaan.</CardDescription>
                      </CardHeader>
                      <CardFooter><Button size="sm" className="w-full bg-primary" onClick={() => router.push('/admin/exams')}>Kelola</Button></CardFooter>
                    </Card>
                    <Card className="hover:shadow-md transition-all border-none shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2 text-blue-600">
                          <Users className="h-4 w-4" /> Siswa ({totalStudents})
                        </CardTitle>
                        <CardDescription className="text-[11px]">Lihat profil & nilai individu.</CardDescription>
                      </CardHeader>
                      <CardFooter><Button size="sm" className="w-full bg-blue-600 text-white" onClick={() => router.push('/admin/students')}>Buka</Button></CardFooter>
                    </Card>
                    <Card className="hover:shadow-md transition-all border-none shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2 text-green-600">
                          <FileText className="h-4 w-4" /> Laporan Hasil
                        </CardTitle>
                        <CardDescription className="text-[11px]">Monitoring riwayat & pelanggaran.</CardDescription>
                      </CardHeader>
                      <CardFooter><Button size="sm" className="w-full bg-green-600 text-white" onClick={() => router.push('/admin/reports')}>Lihat Laporan</Button></CardFooter>
                    </Card>
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <BookOpen className="text-primary h-6 w-6" /> Ujian Tersedia
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {exams.map((exam) => {
                    const attempts = getAttemptCount(exam.id);
                    const isLimitReached = attempts >= 2;
                    return (
                      <Card key={exam.id} className={cn("hover:shadow-lg transition-all border-none shadow-sm flex flex-col h-full", isLimitReached && "opacity-60")}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start gap-2">
                            <CardTitle className="text-base md:text-lg font-bold line-clamp-2">{exam.title}</CardTitle>
                            {isLimitReached ? <AlertCircle className="h-5 w-5 text-destructive shrink-0" /> : attempts > 0 && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-[9px] uppercase font-bold px-2 py-0.5">{exam.durationMinutes} Menit</Badge>
                            <Badge variant="outline" className="text-[9px] uppercase font-bold px-2 py-0.5">{exam.questionIds?.length || 0} Soal</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                          <div className={cn("text-[10px] font-black uppercase tracking-widest", isLimitReached ? "text-destructive" : "text-primary")}>
                            Percobaan: {attempts}/2
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Button 
                            className="w-full h-11 text-xs font-bold"
                            variant={isLimitReached ? "secondary" : attempts > 0 ? "outline" : "default"}
                            onClick={() => !isLimitReached && handleStartExam(exam.id)}
                            disabled={isLimitReached}
                          >
                            {isLimitReached ? "Batas Tercapai" : attempts > 0 ? "Ulangi Ujian" : "Mulai Sekarang"}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                  {exams.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-10">Belum ada ujian yang tersedia.</p>}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <Card className="border-none shadow-lg overflow-hidden">
                <div className="h-1.5 bg-primary" />
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Profil Saya
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Nama Lengkap</span>
                    <span className="text-sm font-bold uppercase">{userProfile?.displayName || "N/A"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Kelas & Sekolah</span>
                    <span className="text-sm font-medium">{userProfile?.class || "-"} - {userProfile?.schoolName || "-"}</span>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-2 bg-muted/30 rounded-xl">
                      <div className="text-xl font-black text-primary">{completedExams}</div>
                      <div className="text-[8px] font-bold uppercase text-muted-foreground">Ujian</div>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded-xl">
                      <div className="text-xl font-black text-primary">{averageScore}%</div>
                      <div className="text-[8px] font-bold uppercase text-muted-foreground">Rata-rata</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary text-white border-none shadow-xl overflow-hidden relative">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-secondary" /> Tata Tertib
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-[11px] leading-relaxed relative z-10">
                  <p className="mb-3">1. Batas pengerjaan <strong>Maksimal 2 kali</strong>.</p>
                  <p className="mb-3">2. <strong>No Tolerance</strong>: Jika HP keluar aplikasi atau layar terkunci, ujian langsung selesai otomatis.</p>
                  <p>3. Gunakan koneksi internet stabil.</p>
                </CardContent>
                <Award className="absolute -bottom-4 -right-4 h-24 w-24 text-white/10" />
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
