
"use client";

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { useAppAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, Settings, Award, User, ListChecks, LayoutDashboard, ShieldCheck, TrendingUp, CheckCircle, AlertCircle, Users } from "lucide-react";
import { useAuth, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, where } from "firebase/firestore";

export default function DashboardPage() {
  const { user, role } = useAppAuth();
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const [exams, setExams] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;
      try {
        setLoading(true);
        // Fetch Exams
        const qExams = query(collection(db, "exams"));
        const examsSnapshot = await getDocs(qExams);
        setExams(examsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch User Results
        const qResults = query(collection(db, "users", user.uid, "results"), orderBy("submissionTime", "desc"));
        const resultsSnapshot = await getDocs(qResults);
        setUserResults(resultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Admin Stats: Total Students
        if (role === 'admin') {
          const qStudents = query(collection(db, "userProfiles"), where("role", "==", "student"));
          const studentsSnapshot = await getDocs(qStudents);
          setTotalStudents(studentsSnapshot.size);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [db, user, role]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const getAttemptCount = (examId: string) => {
    return userResults.filter(r => r.examId === examId).length;
  };

  // Calculate Stats
  const completedExams = userResults.length;
  const averageScore = userResults.length > 0 
    ? Math.round(userResults.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / userResults.length)
    : 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/30 pb-12">
        <header className="bg-primary text-white shadow-lg sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-secondary" />
              <h1 className="text-xl font-bold tracking-tight">Level Up Aceh</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 mr-4 text-sm font-medium bg-black/10 px-3 py-1.5 rounded-full border border-white/20">
                <User className="h-4 w-4 text-secondary" />
                <span>{user?.displayName || user?.email}</span>
                <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-[10px] uppercase font-bold ml-2">
                  {role}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-white hover:bg-white/10">
                <LogOut className="h-4 w-4 mr-2" />
                Keluar
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Admin Quick Access */}
              {role === 'admin' && (
                <section className="bg-primary/5 p-6 rounded-xl border border-primary/20 shadow-inner">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-primary">
                    <ShieldCheck className="h-7 w-7" />
                    Panel Administrator
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="hover:shadow-md transition-all border-l-4 border-primary bg-white">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <ListChecks className="h-5 w-5 text-primary" />
                          Bank Soal & Ujian
                        </CardTitle>
                        <CardDescription>Tambah, edit, atau hapus paket ujian.</CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => router.push('/admin/exams')}>
                          Kelola Ujian
                        </Button>
                      </CardFooter>
                    </Card>
                    <Card className="hover:shadow-md transition-all border-l-4 border-secondary bg-white">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Award className="h-5 w-5 text-secondary-foreground" />
                          Laporan & Hasil
                        </CardTitle>
                        <CardDescription>Lihat perkembangan skor secara umum.</CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10" onClick={() => router.push('/admin/reports')}>
                          Buka Laporan
                        </Button>
                      </CardFooter>
                    </Card>
                    <Card className="hover:shadow-md transition-all border-l-4 border-blue-500 bg-white sm:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-500" />
                          Manajemen Siswa
                        </CardTitle>
                        <CardDescription>Total {totalStudents} Siswa Terdaftar. Lihat profil dan nilai individu.</CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push('/admin/students')}>
                          Kelola Siswa
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                </section>
              )}

              {/* Student Exams List */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <BookOpen className="text-primary h-7 w-7" />
                    Ujian Aktif
                  </h2>
                  <span className="text-sm font-medium text-muted-foreground">{exams.length} Tersedia</span>
                </div>
                
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                      <Card key={i} className="animate-pulse h-40 bg-muted" />
                    ))}
                  </div>
                ) : exams.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {exams.map((exam) => {
                      const attempts = getAttemptCount(exam.id);
                      const isLimitReached = attempts >= 3;
                      const hasFinishedOnce = attempts > 0;

                      return (
                        <Card key={exam.id} className={`hover:shadow-xl transition-all group border-t-4 ${isLimitReached ? 'border-destructive/20 opacity-80' : 'border-primary/20 hover:border-primary'}`}>
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <CardTitle className={`text-xl transition-colors ${isLimitReached ? 'text-muted-foreground' : 'group-hover:text-primary'}`}>
                                {exam.title || "Judul Ujian"}
                              </CardTitle>
                              {isLimitReached ? (
                                <AlertCircle className="h-5 w-5 text-destructive" />
                              ) : hasFinishedOnce ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : null}
                            </div>
                            <CardDescription className="flex flex-col gap-1 mt-1">
                              <div className="flex items-center gap-2">
                                <span className="bg-muted px-2 py-0.5 rounded text-xs font-semibold">
                                  {exam.durationMinutes || 60} menit
                                </span>
                                <span className="text-xs">•</span>
                                <span className="text-xs capitalize">{exam.questionIds?.length || 0} Soal</span>
                              </div>
                              <div className={`text-[11px] font-bold ${isLimitReached ? 'text-destructive' : 'text-primary'}`}>
                                Percobaan: {attempts}/3 {isLimitReached && "(Batas Tercapai)"}
                              </div>
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <Button 
                              variant={isLimitReached ? "secondary" : (hasFinishedOnce ? "outline" : "default")}
                              className={`w-full ${!isLimitReached && !hasFinishedOnce ? "bg-primary hover:bg-primary/90 shadow-md group-hover:shadow-lg" : ""} transition-all`}
                              onClick={() => !isLimitReached && router.push(`/ujian/${exam.id}`)}
                              disabled={isLimitReached}
                            >
                              {isLimitReached ? "Batas Percobaan Habis" : (hasFinishedOnce ? "Ulangi Ujian" : "Mulai Sekarang")}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="border-dashed border-2 py-12 text-center bg-white/50">
                    <CardContent className="space-y-3">
                      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
                      <p className="text-muted-foreground font-medium">Belum ada ujian yang ditugaskan untuk Anda.</p>
                    </CardContent>
                  </Card>
                )}
              </section>
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-6">
              <Card className="bg-white shadow-lg overflow-hidden border-none">
                <div className="h-2 bg-primary" />
                <CardHeader>
                  <CardTitle className="text-lg">Statistik Belajar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex justify-between items-center py-3 border-b border-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium">Ujian Selesai</span>
                    </div>
                    <span className="font-bold text-lg text-primary">{completedExams}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium">Rata-rata Skor</span>
                    </div>
                    <span className="font-bold text-lg text-primary">{averageScore}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary text-white overflow-hidden relative shadow-xl border-none">
                <CardHeader>
                  <CardTitle className="text-lg relative z-10 flex items-center gap-2">
                    <Settings className="h-5 w-5 text-secondary" />
                    Pusat Informasi
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10 pt-0">
                  <p className="text-sm opacity-90 leading-relaxed">
                    Setiap paket ujian memiliki batas 3 kali percobaan. Jika Anda terdeteksi melakukan kecurangan seperti berpindah tab sebanyak 3 kali, sistem akan otomatis mengeluarkan Anda dan kuota percobaan akan berkurang.
                  </p>
                </CardContent>
                <div className="absolute -bottom-6 -right-6 p-4 opacity-10">
                  <Award className="h-32 w-32" />
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
