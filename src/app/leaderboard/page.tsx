
'use client';

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, ChevronLeft, Medal, Star, School, Search, Info, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useFirestore } from "@/firebase";
import { collection, collectionGroup, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LeaderboardPage() {
  const router = useRouter();
  const db = useFirestore();
  
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [statusMessage, setStatusMessage] = useState<{title: string, desc: string, type: 'error' | 'info'} | null>(null);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const q = query(collection(db, "exams"));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setExams(list);
        if (list.length > 0) {
          setSelectedExamId(list[0].id);
        }
      } catch (err) {
        console.error("Fetch exams error:", err);
      }
    };
    fetchExams();
  }, [db]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "userProfiles"));
        const uMap: Record<string, any> = {};
        snap.forEach(d => {
          uMap[d.id] = d.data();
        });
        setUsersMap(uMap);
      } catch (err) {
        console.error("Fetch users error:", err);
      }
    };
    fetchUsers();
  }, [db]);

  const fetchLeaderboard = useCallback(async () => {
    if (!selectedExamId) return;
    setLoading(true);
    setStatusMessage(null);
    
    try {
      // Query untuk mengambil skor tertinggi terlebih dahulu
      const q = query(
        collectionGroup(db, "results"),
        where("examId", "==", selectedExamId),
        orderBy("totalScore", "desc"),
        limit(100) // Ambil lebih banyak untuk dideduplikasi di sisi klien
      );
      
      const snap = await getDocs(q);
      const list = snap.docs.map(d => {
        const data = d.data();
        const pathParts = d.ref.path.split('/');
        // Path: users/{userId}/results/{id}
        const studentIdFromPath = pathParts[1];
        
        return { 
          id: d.id, 
          ...data,
          studentId: studentIdFromPath
        };
      });

      // Deduplikasi: Hanya ambil skor tertinggi per siswa
      const uniqueLeaderboard: any[] = [];
      const seenUsers = new Set();
      
      list.forEach(res => {
        if (res.studentId && !seenUsers.has(res.studentId)) {
          uniqueLeaderboard.push(res);
          seenUsers.add(res.studentId);
        }
      });
      
      // Ambil 10 teratas setelah dideduplikasi
      setLeaderboard(uniqueLeaderboard.slice(0, 10));
    } catch (err: any) {
      console.error("Leaderboard fetch error:", err);
      if (err.message?.includes('building')) {
        setStatusMessage({
          title: "Indeks Sedang Dibuat",
          desc: "Firestore sedang memproses data peringkat Anda. Mohon tunggu 3-5 menit lalu segarkan halaman ini.",
          type: 'info'
        });
      } else if (err.code === 'failed-precondition' || err.message?.includes('index')) {
        setStatusMessage({
          title: "Indeks Diperlukan",
          desc: "Sistem memerlukan indeks untuk menampilkan leaderboard ini. Klik link di Console (F12) untuk mengaktifkan.",
          type: 'error'
        });
      }
    } finally {
      setLoading(false);
    }
  }, [db, selectedExamId]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/30 pb-20">
        <header className="bg-white border-b shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                <Trophy className="h-5 w-5 text-secondary" /> Peringkat Tryout
              </h1>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="mb-8 border-none shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Pilih Paket Tryout</CardTitle>
              <CardDescription>Lihat 10 terbaik dari paket pilihan Anda.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger className="w-full md:max-w-md h-12 text-base font-medium border-2 border-primary/20">
                  <SelectValue placeholder="Pilih Tryout" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map(exam => (
                    <SelectItem key={exam.id} value={exam.id}>{exam.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {statusMessage && (
            <Alert variant={statusMessage.type === 'error' ? "destructive" : "default"} className={cn(
              "mb-6 border-2",
              statusMessage.type === 'info' ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-amber-50 border-amber-500 text-amber-900"
            )}>
              {statusMessage.type === 'info' ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : <Info className="h-5 w-5 text-amber-600" />}
              <div className="ml-3">
                <AlertTitle className="font-bold">{statusMessage.title}</AlertTitle>
                <AlertDescription className="mt-1">
                  {statusMessage.desc}
                </AlertDescription>
              </div>
            </Alert>
          )}

          <Card className="shadow-2xl border-none overflow-hidden rounded-2xl">
            <div className="bg-primary p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Medal className="h-8 w-8 text-secondary" />
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">TOP 10 TERBAIK</h2>
                    <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Global Ranking</p>
                  </div>
                </div>
                <Star className="h-10 w-10 text-secondary/30 animate-pulse" />
              </div>
            </div>
            
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                  <p className="text-muted-foreground font-medium">Mencari jawara...</p>
                </div>
              ) : leaderboard.length === 0 && !statusMessage ? (
                <div className="text-center py-20">
                  <Search className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">Belum ada data nilai untuk tryout ini.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 border-b">
                      <TableRow>
                        <TableHead className="w-20 text-center font-black">RANK</TableHead>
                        <TableHead className="font-bold">SISWA</TableHead>
                        <TableHead className="hidden md:table-cell font-bold">SEKOLAH</TableHead>
                        <TableHead className="text-center font-bold">SKOR IRT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.map((res, index) => {
                        const userProfile = usersMap[res.studentId];
                        const rank = index + 1;
                        
                        return (
                          <TableRow key={`${res.id}-${index}`} className={cn(
                            "group hover:bg-primary/5 transition-colors border-b",
                            rank === 1 && "bg-secondary/10",
                            rank === 2 && "bg-blue-50/10",
                            rank === 3 && "bg-amber-50/10"
                          )}>
                            <TableCell className="text-center">
                              <div className="flex justify-center">
                                {rank === 1 ? (
                                  <div className="bg-secondary text-black w-8 h-8 rounded-full flex items-center justify-center font-black shadow-md border-2 border-white">1</div>
                                ) : rank === 2 ? (
                                  <div className="bg-gray-200 text-gray-700 w-7 h-7 rounded-full flex items-center justify-center font-black">2</div>
                                ) : rank === 3 ? (
                                  <div className="bg-orange-100 text-orange-700 w-7 h-7 rounded-full flex items-center justify-center font-black">3</div>
                                ) : (
                                  <span className="text-muted-foreground font-bold">{rank}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className={cn(
                                  "font-bold text-sm md:text-base uppercase",
                                  rank === 1 ? "text-primary" : "text-foreground"
                                )}>
                                  {userProfile?.displayName || "Siswa"}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 bg-white">
                                    {userProfile?.class || "Umum"}
                                  </Badge>
                                  {userProfile?.initialClass && (
                                    <span className="text-[10px] text-primary font-bold">{userProfile.initialClass}</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                <School className="h-3 w-3" />
                                {userProfile?.schoolName || "-"}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className={cn(
                                "inline-block px-4 py-1.5 rounded-full font-black text-lg shadow-sm",
                                rank === 1 ? "bg-primary text-white scale-110" : "bg-muted text-primary"
                              )}>
                                {res.totalScore}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <div className="bg-muted/30 p-4 border-t text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              Data Diperbarui Secara Real-Time
            </div>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
