
'use client';

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ChevronLeft, 
  Search, 
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
      // 1. Fetch User Profiles first to map IDs to Names
      const usersSnap = await getDocs(collection(db, "userProfiles"));
      const uMap: Record<string, any> = {};
      usersSnap.forEach(d => {
        uMap[d.id] = d.data();
      });
      setUsersMap(uMap);

      // 2. Fetch Exam titles
      const examsSnap = await getDocs(collection(db, "exams"));
      const eMap: Record<string, any> = {};
      examsSnap.forEach(d => {
        eMap[d.id] = d.data();
      });
      setExamsMap(eMap);

      // 3. Fetch results using collectionGroup
      const resultsQuery = query(collectionGroup(db, "results"), orderBy("submissionTime", "desc"));
      const resultsSnap = await getDocs(resultsQuery);
      
      const resultsList = resultsSnap.docs.map(d => {
        const data = d.data();
        const path = d.ref.path;
        const pathParts = path.split('/');
        // Extract studentId from path: users/{userId}/results/{resultId}
        const studentIdFromPath = pathParts[pathParts.indexOf('users') + 1];
        
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
    const userProfile = usersMap[res.studentId];
    const studentDisplayName = userProfile?.displayName || userProfile?.email || res.studentId;
    
    if (!confirm(`Hapus nilai untuk siswa: ${studentDisplayName}?\n\nTindakan ini permanen dan tidak dapat dibatalkan.`)) {
      return;
    }

    // Optimistic UI update
    setResults(prev => prev.filter(r => r.fullPath !== res.fullPath));

    // Ensure we use the correct absolute document reference from the fullPath
    const resultRef = doc(db, res.fullPath);
    deleteDocumentNonBlocking(resultRef);
    
    toast({
      title: "Berhasil Dihapus",
      description: `Data nilai ${studentDisplayName} telah dihapus.`
    });
  };

  const filteredResults = results.filter(res => {
    const student = usersMap[res.studentId];
    const studentName = (student?.displayName || "Siswa Tanpa Nama").toLowerCase();
    const studentEmail = (student?.email || "").toLowerCase();
    const studentId = (res.studentId || "").toLowerCase();
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
                Segarkan Data
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
                Sistem memerlukan indeks pencarian grup. Silakan klik link yang muncul di konsol.
              </AlertDescription>
            </Alert>
          )}

          {permissionDenied ? (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="pt-6 text-center space-y-4">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                <h2 className="text-xl font-bold text-destructive">Akses Ditolak</h2>
                <p className="text-muted-foreground">Pastikan UID Anda terdaftar di koleksi adminUsers.</p>
                <Button variant="outline" onClick={fetchData}>Muat Ulang</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="border-l-4 border-primary shadow-sm bg-white">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Ujian Selesai</CardDescription>
                    <CardTitle className="text-3xl font-bold">{results.length}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-l-4 border-green-500 shadow-sm bg-white">
                  <CardHeader className="pb-2">
                    <CardDescription>Rata-rata Skor</CardDescription>
                    <CardTitle className="text-3xl font-bold">
                      {results.length > 0 
                        ? Math.round(results.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / results.length)
                        : 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-l-4 border-amber-500 shadow-sm bg-white">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Pelanggaran</CardDescription>
                    <CardTitle className="text-3xl font-bold">
                      {results.reduce((acc, curr) => acc + (curr.antiCheatWarningCount || 0), 0)}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card className="shadow-lg border-none">
                <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 bg-muted/10 border-b">
                  <div>
                    <CardTitle className="text-lg">Monitoring Nilai Siswa</CardTitle>
                    <CardDescription>Data identitas diambil dari profil registrasi siswa.</CardDescription>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Cari Nama, Email atau ID..." 
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
                      <p className="text-muted-foreground">Sinkronisasi data...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="font-bold text-foreground">IDENTITAS SISWA</TableHead>
                            <TableHead className="font-bold text-foreground">PAKET UJIAN</TableHead>
                            <TableHead className="text-center font-bold text-foreground">PELANGGARAN</TableHead>
                            <TableHead className="text-center font-bold text-foreground">SKOR IRT</TableHead>
                            <TableHead className="text-right font-bold text-foreground">AKSI</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredResults.map((res) => {
                            const userProfile = usersMap[res.studentId];
                            const exam = examsMap[res.examId];
                            const warnings = res.antiCheatWarningCount || 0;

                            return (
                              <TableRow key={res.fullPath} className="hover:bg-muted/10 border-b">
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-primary text-base uppercase">
                                      {userProfile?.displayName || "Siswa Tanpa Nama"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono bg-muted/80 px-1 rounded w-fit mt-1">
                                      ID: {res.studentId}
                                    </span>
                                    {userProfile?.email && (
                                      <span className="text-xs text-muted-foreground italic">
                                        {userProfile.email}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {exam?.title || "Ujian Tidak Diketahui"}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge 
                                    variant={warnings > 0 ? "destructive" : "outline"}
                                    className="font-bold"
                                  >
                                    <ShieldAlert className="h-3 w-3 mr-1" /> {warnings}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-primary text-white font-black text-sm px-3 shadow-sm">
                                    {res.totalScore}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-destructive hover:bg-destructive/10 h-10 w-10"
                                    onClick={() => handleDeleteResult(res)}
                                    title="Hapus Nilai"
                                  >
                                    <Trash2 className="h-5 w-5" />
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
