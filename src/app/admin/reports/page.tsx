
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
  RefreshCw
} from "lucide-react";
import { useState, useEffect } from "react";
import { useFirestore } from "@/firebase";
import { collection, collectionGroup, getDocs, query, orderBy, doc } from "firebase/firestore";
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
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

  const fetchData = async () => {
    setLoading(true);
    setPermissionDenied(false);
    setIndexMissing(false);
    
    try {
      // 1. Fetch User Profiles independently
      try {
        const usersSnap = await getDocs(collection(db, "userProfiles"));
        const uMap: Record<string, any> = {};
        usersSnap.forEach(d => {
          uMap[d.id] = d.data();
        });
        setUsersMap(uMap);
      } catch (e) {
        console.warn("Could not fetch user profiles:", e);
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
        console.warn("Could not fetch exams:", e);
      }

      // 3. Fetch Results using Collection Group
      const resultsQuery = query(collectionGroup(db, "results"), orderBy("submissionTime", "desc"));
      const resultsSnap = await getDocs(resultsQuery);
      
      const resultsList = resultsSnap.docs.map(d => {
        const data = d.data();
        const path = d.ref.path;
        // Path: users/{userId}/results/{resultId}
        const pathParts = path.split('/');
        const studentIdFromPath = pathParts[1]; // Index 1 is the userId
        
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
        const permissionError = new FirestorePermissionError({
          path: 'results',
          operation: 'list'
        });
        errorEmitter.emit('permission-error', permissionError);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [db]);

  const handleDeleteResult = (res: any) => {
    const student = usersMap[res.studentId];
    const studentName = student?.displayName || 'Siswa';
    
    if (!confirm(`Apakah Anda yakin ingin menghapus nilai ${studentName} untuk ujian ${examsMap[res.examId]?.title || ''}?`)) {
      return;
    }

    // Optimistic Update
    setResults(prev => prev.filter(r => r.fullPath !== res.fullPath));

    const resultRef = doc(db, res.fullPath);
    deleteDocumentNonBlocking(resultRef);
    
    toast({
      title: "Menghapus...",
      description: `Hasil ujian sedang dihapus dari database.`
    });
  };

  const filteredResults = results.filter(res => {
    const student = usersMap[res.studentId];
    const studentName = (student?.displayName || student?.email || "Siswa").toLowerCase();
    const exam = examsMap[res.examId];
    const examTitle = (exam?.title || "Ujian").toLowerCase();
    const searchString = `${studentName} ${examTitle}`;
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
              <h1 className="text-xl font-bold text-primary">Analitik & Hasil Ujian</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
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
                Halaman ini memerlukan indeks kueri grup. Silakan klik link di pesan error konsol atau log Firebase untuk mengaktifkannya.
              </AlertDescription>
            </Alert>
          )}

          {permissionDenied ? (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="pt-6 text-center space-y-4">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                <h2 className="text-xl font-bold text-destructive">Akses Database Ditolak</h2>
                <p className="text-muted-foreground">
                  Akun Anda belum memiliki izin admin yang valid di database.
                </p>
                <Button variant="outline" onClick={() => window.location.reload()}>Coba Lagi</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="border-l-4 border-primary shadow-md">
                  <CardHeader className="pb-2">
                    <CardDescription>Ujian Diselesaikan</CardDescription>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-3xl font-bold">{results.length}</CardTitle>
                      <FileText className="h-8 w-8 text-primary/20" />
                    </div>
                  </CardHeader>
                </Card>
                <Card className="border-l-4 border-green-500 shadow-md">
                  <CardHeader className="pb-2">
                    <CardDescription>Rata-rata Skor</CardDescription>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-3xl font-bold">
                        {results.length > 0 
                          ? Math.round(results.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / results.length)
                          : 0}%
                      </CardTitle>
                      <TrendingUp className="h-8 w-8 text-green-500/20" />
                    </div>
                  </CardHeader>
                </Card>
                <Card className="border-l-4 border-amber-500 shadow-md">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Pelanggaran</CardDescription>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-3xl font-bold">
                        {results.reduce((acc, curr) => acc + (curr.antiCheatWarningCount || 0), 0)}
                      </CardTitle>
                      <ShieldAlert className="h-8 w-8 text-amber-500/20" />
                    </div>
                  </CardHeader>
                </Card>
              </div>

              <Card className="shadow-lg">
                <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 bg-muted/5">
                  <div>
                    <CardTitle className="text-xl">Monitoring Peserta</CardTitle>
                    <CardDescription>Hasil ujian dan indikasi kecurangan.</CardDescription>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Cari siswa atau paket..." 
                      className="pl-9 bg-white border-2"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                      <p>Sinkronisasi data...</p>
                    </div>
                  ) : filteredResults.length === 0 ? (
                    <div className="text-center py-20 bg-muted/10 rounded-lg">
                      <p className="text-muted-foreground">Tidak ada data yang ditemukan.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="font-bold">Siswa</TableHead>
                            <TableHead className="font-bold">Ujian</TableHead>
                            <TableHead className="text-center font-bold">Pelanggaran</TableHead>
                            <TableHead className="text-center font-bold">Skor (IRT)</TableHead>
                            <TableHead className="text-right font-bold">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredResults.map((res) => {
                            const user = usersMap[res.studentId];
                            const exam = examsMap[res.examId];
                            const warnings = res.antiCheatWarningCount || 0;

                            return (
                              <TableRow key={res.fullPath} className="hover:bg-muted/30">
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-foreground">
                                      {user?.displayName || (user?.email ? user.email.split('@')[0] : "Siswa")}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      {res.studentId.substring(0, 8)}...
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{exam?.title || "Paket Ujian"}</TableCell>
                                <TableCell className="text-center">
                                  <Badge 
                                    variant={warnings > 0 ? "destructive" : "outline"}
                                    className={cn(warnings > 3 && "animate-bounce")}
                                  >
                                    <ShieldAlert className="h-3 w-3 mr-1" /> {warnings}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge 
                                    className={cn(
                                      "font-black text-sm text-white",
                                      res.totalScore >= 70 ? "bg-green-600" : "bg-red-600"
                                    )}
                                  >
                                    {res.totalScore}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-destructive hover:bg-destructive/10 h-8 w-8"
                                    onClick={() => handleDeleteResult(res)}
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
