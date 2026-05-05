
'use client';

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ChevronLeft, 
  Download, 
  Search, 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  Info, 
  Trash2,
  ShieldAlert,
  RefreshCw,
  User as UserIcon
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useFirestore } from "@/firebase";
import { collection, collectionGroup, getDocs, query, orderBy, doc } from "firebase/firestore";
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function AdminReportsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [examsMap, setExamsMap] = useState<Record<string, any>>({});
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [indexMissing, setIndexMissing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPermissionDenied(false);
    setIndexMissing(false);
    
    try {
      // 1. Fetch User Profiles independently to build the name map
      try {
        const usersSnap = await getDocs(collection(db, "userProfiles"));
        const uMap: Record<string, any> = {};
        usersSnap.forEach(d => {
          uMap[d.id] = d.data();
        });
        setUsersMap(uMap);
      } catch (e) {
        console.warn("Could not fetch user profiles mapping:", e);
      }

      // 2. Fetch Exams independently
      try {
        const examsSnap = await getDocs(collection(db, "exams"));
        const eMap: Record<string, any> = {};
        examsSnap.forEach(d => {
          eMap[d.id] = d.data();
        });
        setExamsMap(eMap);
      } catch (e) {
        console.warn("Could not fetch exams mapping:", e);
      }

      // 3. Fetch Results using Collection Group
      const resultsQuery = query(collectionGroup(db, "results"), orderBy("submissionTime", "desc"));
      const resultsSnap = await getDocs(resultsQuery);
      
      const resultsList = resultsSnap.docs.map(d => {
        const data = d.data();
        const path = d.ref.path;
        // Expected Path: users/{userId}/results/{resultId}
        const pathParts = path.split('/');
        const studentIdFromPath = pathParts[1]; 
        
        return { 
          id: d.id, 
          ...data,
          studentId: studentIdFromPath || data.studentId,
          fullPath: path 
        };
      });
      
      setResults(resultsList);
    } catch (err: any) {
      console.error("Error fetching reports:", err);
      if (err.message?.includes("index") || err.code === 'failed-precondition') {
        setIndexMissing(true);
      } else if (err.code === 'permission-denied') {
        setPermissionDenied(true);
      }
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteResult = (res: any) => {
    const user = usersMap[res.studentId];
    const studentDisplayName = user?.displayName || user?.email || res.studentId;
    
    if (!confirm(`Hapus nilai untuk siswa: ${studentDisplayName}?\n\nTindakan ini permanen.`)) {
      return;
    }

    // Optimistic Update: remove from local state immediately
    setResults(prev => prev.filter(r => r.fullPath !== res.fullPath));

    const resultRef = doc(db, res.fullPath);
    deleteDocumentNonBlocking(resultRef);
    
    toast({
      title: "Berhasil",
      description: `Data nilai ${studentDisplayName} telah dihapus.`
    });
  };

  const filteredResults = results.filter(res => {
    const student = usersMap[res.studentId];
    const studentName = (student?.displayName || "Siswa").toLowerCase();
    const studentEmail = (student?.email || "").toLowerCase();
    const studentId = res.studentId.toLowerCase();
    const exam = examsMap[res.examId];
    const examTitle = (exam?.title || "Ujian").toLowerCase();
    
    const searchString = `${studentName} ${studentEmail} ${studentId} ${examTitle}`;
    return searchString.includes(searchTerm.toLowerCase());
  });

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-muted/30 pb-20">
        <header className="bg-white border-b shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-primary">Laporan Hasil Ujian</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Muat Ulang
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-6xl">
          {indexMissing && (
            <Alert variant="destructive" className="mb-6 bg-amber-50 border-amber-500 text-amber-900">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="font-bold">Indeks Firestore Diperlukan</AlertTitle>
              <AlertDescription>
                Sistem memerlukan indeks pencarian grup. Silakan klik link di konsol browser untuk mengaktifkannya atau hubungi developer.
              </AlertDescription>
            </Alert>
          )}

          {permissionDenied ? (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="pt-6 text-center space-y-4">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                <h2 className="text-xl font-bold text-destructive">Akses Database Ditolak</h2>
                <p className="text-muted-foreground">Akun Anda tidak memiliki izin Admin untuk melihat data ini.</p>
                <Button variant="outline" onClick={fetchData}>Coba Lagi</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="border-l-4 border-primary shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Peserta</CardDescription>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-3xl font-bold">{results.length}</CardTitle>
                      <UserIcon className="h-8 w-8 text-primary/10" />
                    </div>
                  </CardHeader>
                </Card>
                <Card className="border-l-4 border-green-500 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Rata-rata Nilai</CardDescription>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-3xl font-bold">
                        {results.length > 0 
                          ? Math.round(results.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / results.length)
                          : 0}
                      </CardTitle>
                      <TrendingUp className="h-8 w-8 text-green-500/10" />
                    </div>
                  </CardHeader>
                </Card>
                <Card className="border-l-4 border-amber-500 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription>Peringatan Curang</CardDescription>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-3xl font-bold">
                        {results.reduce((acc, curr) => acc + (curr.antiCheatWarningCount || 0), 0)}
                      </CardTitle>
                      <ShieldAlert className="h-8 w-8 text-amber-500/10" />
                    </div>
                  </CardHeader>
                </Card>
              </div>

              <Card className="shadow-lg">
                <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 bg-muted/5 border-b">
                  <div>
                    <CardTitle className="text-lg">Daftar Hasil Pengerjaan</CardTitle>
                    <CardDescription>Monitor skor IRT dan aktivitas siswa.</CardDescription>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Cari Nama atau ID..." 
                      className="pl-9 bg-white"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                      <p className="text-muted-foreground">Menyingkronkan data siswa...</p>
                    </div>
                  ) : filteredResults.length === 0 ? (
                    <div className="text-center py-20">
                      <Info className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                      <p className="text-muted-foreground">Tidak ada data pengerjaan.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="font-bold">Identitas Siswa</TableHead>
                            <TableHead className="font-bold">Paket Ujian</TableHead>
                            <TableHead className="text-center font-bold">Waktu Selesai</TableHead>
                            <TableHead className="text-center font-bold">Peringatan</TableHead>
                            <TableHead className="text-center font-bold">Skor IRT</TableHead>
                            <TableHead className="text-right font-bold">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredResults.map((res) => {
                            const user = usersMap[res.studentId];
                            const exam = examsMap[res.examId];
                            const warnings = res.antiCheatWarningCount || 0;

                            return (
                              <TableRow key={res.fullPath} className="hover:bg-muted/20">
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-primary text-base">
                                      {user?.displayName || user?.email?.split('@')[0] || "Siswa Tanpa Nama"}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                      ID: {res.studentId}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium text-foreground">
                                  {exam?.title || "Ujian Tidak Diketahui"}
                                </TableCell>
                                <TableCell className="text-center text-xs text-muted-foreground">
                                  {res.submissionTime ? new Date(res.submissionTime).toLocaleString('id-ID') : '-'}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge 
                                    variant={warnings > 0 ? "destructive" : "outline"}
                                    className={cn("font-bold", warnings > 3 && "animate-pulse")}
                                  >
                                    <ShieldAlert className="h-3 w-3 mr-1" /> {warnings}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-primary text-white font-black text-sm px-3">
                                    {res.totalScore}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-destructive hover:bg-destructive/10 h-9 w-9"
                                    onClick={() => handleDeleteResult(res)}
                                    title="Hapus Nilai"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
