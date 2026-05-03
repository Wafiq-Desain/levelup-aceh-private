
"use client";

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, Settings, Award, User, ListChecks } from "lucide-react";
import { auth, db } from "@/lib/firebase-config";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { collection, query, getDocs, where } from "firebase/firestore";

export default function DashboardPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<any[]>([]);

  useEffect(() => {
    const fetchExams = async () => {
      const q = query(collection(db, "exams"));
      const querySnapshot = await getDocs(q);
      setExams(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchExams();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/30">
        <header className="bg-primary text-white shadow-lg">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">Level Up Aceh</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 mr-4 text-sm font-medium">
                <User className="h-4 w-4" />
                <span>{user?.email}</span>
                <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-[10px] uppercase font-bold">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <section>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="text-primary h-6 w-6" />
                  Daftar Ujian Tersedia
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {exams.length > 0 ? (
                    exams.map((exam) => (
                      <Card key={exam.id} className="hover:shadow-md transition-shadow group">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">
                            {exam.title || "Judul Ujian"}
                          </CardTitle>
                          <CardDescription>
                            {exam.duration || 60} menit • {exam.difficulty_level ? `Level ${exam.difficulty_level}` : 'General'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button 
                            className="w-full bg-primary hover:bg-primary/90"
                            onClick={() => router.push(`/ujian/${exam.id}`)}
                          >
                            Mulai Ujian
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-2 py-10 text-center bg-white rounded-lg border border-dashed border-muted-foreground/30">
                      <p className="text-muted-foreground">Tidak ada ujian yang tersedia saat ini.</p>
                    </div>
                  )}
                </div>
              </section>

              {role === 'admin' && (
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Settings className="text-primary h-6 w-6" />
                    Panel Admin
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="bg-white border-l-4 border-primary">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <ListChecks className="h-5 w-5" />
                          Kelola Soal
                        </CardTitle>
                        <CardDescription>Tambah atau edit bank soal ujian.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button variant="outline" className="w-full" onClick={() => router.push('/admin/exams')}>
                          Buka Manajemen
                        </Button>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-l-4 border-secondary">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Award className="h-5 w-5" />
                          Laporan Siswa
                        </CardTitle>
                        <CardDescription>Lihat hasil raport dan skor IRT siswa.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button variant="outline" className="w-full" onClick={() => router.push('/admin/reports')}>
                          Buka Laporan
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-6">
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">Statistik Saya</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Ujian Selesai</span>
                    <span className="font-bold">0</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Rata-rata Skor</span>
                    <span className="font-bold">0%</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Rank</span>
                    <span className="font-bold text-secondary-foreground">--</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary text-white overflow-hidden relative">
                <CardHeader>
                  <CardTitle className="text-lg relative z-10">Informasi Penting</CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-sm opacity-90">
                    Pastikan koneksi internet stabil sebelum memulai ujian. Dilarang berpindah tab selama ujian berlangsung.
                  </p>
                </CardContent>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Award className="h-24 w-24" />
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
