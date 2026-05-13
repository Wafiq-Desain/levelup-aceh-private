
'use client';

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChevronLeft, 
  Search, 
  AlertTriangle, 
  Info, 
  Trash2,
  ShieldAlert,
  RefreshCw,
  Loader2,
  History,
  TrendingUp,
  UserCheck,
  AlertCircle,
  Eye,
  FileBarChart
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useFirestore } from "@/firebase";
import { collection, collectionGroup, getDocs, query, orderBy, doc, where } from "firebase/firestore";
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminReportsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [results, setResults] = useState<any[]>([]);
  const [allAnswers, setAllAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<string>("all");
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [examsMap, setExamsMap] = useState<Record<string, any>>({});
  const [statusMessage, setStatusMessage] = useState<{title: string, desc: string, type: 'error' | 'info'} | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setStatusMessage(null);
    
    try {
      // 1. Fetch User Profiles
      const usersSnap = await getDocs(collection(db, "userProfiles"));
      const uMap: Record<string, any> = {};
      usersSnap.forEach(d => { uMap[d.id] = d.data(); });
      setUsersMap(uMap);

      // 2. Fetch Exam titles
      const examsSnap = await getDocs(collection(db, "exams"));
      const eMap: Record<string, any> = {};
      examsSnap.forEach(d => { eMap[d.id] = d.data(); });
      setExamsMap(eMap);

      // 3. Fetch results
      const resultsQuery = query(collectionGroup(db, "results"), orderBy("submissionTime", "desc"));
      const resultsSnap = await getDocs(resultsQuery);
      
      const resultsList = resultsSnap.docs.map(d => {
        const data = d.data();
        const pathParts = d.ref.path.split('/');
        return { 
          id: d.id, 
          ...data,
          studentId: pathParts[1],
          fullPath: d.ref.path 
        };
      });
      setResults(resultsList);

      // 4. Fetch Answers for pattern analysis
      const answersSnap = await getDocs(collectionGroup(db, "resultAnswers"));
      setAllAnswers(answersSnap.docs.map(d => d.data()));

    } catch (err: any) {
      console.error("Error fetching reports:", err);
      if (err.message?.includes('building')) {
        setStatusMessage({ title: "Indeks Sedang Dibuat", desc: "Firestore sedang memproses data laporan.", type: 'info' });
      }
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ANALYTICS ENGINE: Categorize A, B, C
  const analyticsData = useMemo(() => {
    if (results.length === 0) return [];

    const examResults = selectedExamId === "all" ? results : results.filter(r => r.examId === selectedExamId);
    
    return examResults.map(res => {
      let riskScore = 0;
      const studentAnswers = allAnswers.filter(a => a.resultId === res.id);
      const otherStudentsAnswers = allAnswers.filter(a => a.resultId !== res.id && a.examId === res.examId);
      
      // Indicator 1: Speed vs Accuracy
      // (Assumed: High score > 80 and very low violations might be suspicious if finished too fast)
      // Since we don't have total duration in Result, we check IRT score vs AntiCheat count
      if (res.totalScore > 90 && res.antiCheatWarningCount === 0) riskScore += 1;

      // Indicator 2: Pattern Similarity
      // We look for shared INCORRECT answers with others (classic cheating sign)
      const myWrongAnswers = studentAnswers.filter(a => !a.isCorrect).map(a => `${a.questionId}_${a.chosenAnswerIndex}`);
      
      let maxSharedWrongs = 0;
      const resultsByExam = results.filter(r => r.examId === res.examId && r.id !== res.id);
      
      resultsByExam.forEach(otherRes => {
        const otherWrongAnswers = allAnswers.filter(a => a.resultId === otherRes.id && !a.isCorrect).map(a => `${a.questionId}_${a.chosenAnswerIndex}`);
        const shared = myWrongAnswers.filter(w => otherWrongAnswers.includes(w)).length;
        if (shared > maxSharedWrongs) maxSharedWrongs = shared;
      });

      if (maxSharedWrongs >= 3) riskScore += 2; // Strong similarity in errors
      if (res.antiCheatWarningCount > 0) riskScore += 1;

      // Final Classification
      let category: 'A' | 'B' | 'C' = 'A';
      if (riskScore >= 3) category = 'C';
      else if (riskScore >= 1) category = 'B';

      return {
        ...res,
        category,
        riskScore,
        sharedWrongs: maxSharedWrongs
      };
    });
  }, [results, allAnswers, selectedExamId]);

  const handleDeleteResult = (res: any) => {
    if (!confirm(`Hapus nilai secara permanen?`)) return;
    deleteDocumentNonBlocking(doc(db, res.fullPath));
    setResults(prev => prev.filter(r => r.fullPath !== res.fullPath));
    toast({ title: "Dihapus", description: "Data nilai telah dibersihkan." });
  };

  const handleResetAllAttempts = async () => {
    setIsResetting(true);
    results.forEach((res) => deleteDocumentNonBlocking(doc(db, res.fullPath)));
    toast({ title: "Reset Berhasil", description: "Seluruh data percobaan telah dihapus." });
    setResults([]);
    setIsResetting(false);
  };

  const filteredOverview = results.filter(res => {
    const student = usersMap[res.studentId];
    const searchString = `${student?.displayName} ${student?.email} ${examsMap[res.examId]?.title}`.toLowerCase();
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
              <h1 className="text-xl font-bold text-primary">Integritas & Hasil Ujian</h1>
            </div>
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={loading || results.length === 0}>
                    <History className="h-4 w-4 mr-2" /> Reset Masal
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Seluruh Nilai?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini akan menghapus permanen {results.length} data nilai. Siswa akan dapat mengerjakan ulang.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetAllAttempts} className="bg-destructive">Ya, Hapus Semua</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} /> Segarkan
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
              <TabsTrigger value="overview">Daftar Nilai</TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <TrendingUp className="h-4 w-4" /> Analisis Detail
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Cari Nama, Email, atau Ujian..." 
                      className="pl-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-6 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Selesai</p>
                      <p className="text-xl font-black text-primary">{results.length}</p>
                    </div>
                    <div className="w-px bg-border h-8 self-center" />
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Pelanggaran HP</p>
                      <p className="text-xl font-black text-destructive">{results.reduce((acc, curr) => acc + (curr.antiCheatWarningCount || 0), 0)}</p>
                    </div>
                  </div>
                </div>

                <Card className="border-none shadow-lg">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>SISWA</TableHead>
                          <TableHead>PAKET UJIAN</TableHead>
                          <TableHead className="text-center">SKOR IRT</TableHead>
                          <TableHead className="text-center">STATUS HP</TableHead>
                          <TableHead className="text-right">AKSI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOverview.map((res) => (
                          <TableRow key={res.fullPath}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold uppercase text-primary">{usersMap[res.studentId]?.displayName || "Siswa"}</span>
                                <span className="text-[10px] text-muted-foreground">{usersMap[res.studentId]?.email}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium">{examsMap[res.examId]?.title}</TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-primary text-white font-black">{res.totalScore}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {res.antiCheatWarningCount > 0 ? (
                                <Badge variant="destructive" className="gap-1">
                                  <ShieldAlert className="h-3 w-3" /> {res.antiCheatWarningCount}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-600 border-green-200">Aman</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteResult(res)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="analytics">
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-primary">ANALISIS INTEGRITAS</h2>
                    <p className="text-sm text-muted-foreground">Deteksi otomatis pola jawaban & anomali pengerjaan.</p>
                  </div>
                  <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                    <SelectTrigger className="w-full md:w-64 bg-white">
                      <SelectValue placeholder="Pilih Paket Ujian" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Paket</SelectItem>
                      {Object.entries(examsMap).map(([id, exam]: any) => (
                        <SelectItem key={id} value={id}>{exam.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-green-50 border-green-200 border-2">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-green-800 text-sm">KATEGORI A</CardTitle>
                        <UserCheck className="h-5 w-5 text-green-600" />
                      </div>
                      <CardDescription className="text-green-600 text-xs">Sangat Dipercaya</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-black text-green-800">
                        {analyticsData.filter(d => d.category === 'A').length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-50 border-amber-200 border-2">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-amber-800 text-sm">KATEGORI B</CardTitle>
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                      </div>
                      <CardDescription className="text-amber-600 text-xs">Abu-abu / Indikasi</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-black text-amber-800">
                        {analyticsData.filter(d => d.category === 'B').length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200 border-2">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-red-800 text-sm">KATEGORI C</CardTitle>
                        <ShieldAlert className="h-5 w-5 text-red-600" />
                      </div>
                      <CardDescription className="text-red-600 text-xs">Terindikasi Kuat</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-black text-red-800">
                        {analyticsData.filter(d => d.category === 'C').length}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-none shadow-xl">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>SISWA</TableHead>
                          <TableHead className="text-center">KLASIFIKASI</TableHead>
                          <TableHead>INDIKATOR TEMUAN</TableHead>
                          <TableHead className="text-center">KEMIRIPAN SALAH</TableHead>
                          <TableHead className="text-center">SKOR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyticsData.map((res) => (
                          <TableRow key={res.id} className={cn(
                            res.category === 'C' && "bg-red-50/30",
                            res.category === 'B' && "bg-amber-50/30"
                          )}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold uppercase">{usersMap[res.studentId]?.displayName}</span>
                                <span className="text-[10px] text-muted-foreground">{examsMap[res.examId]?.title}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn(
                                "font-black px-3 py-1",
                                res.category === 'A' && "bg-green-600",
                                res.category === 'B' && "bg-amber-500",
                                res.category === 'C' && "bg-red-600"
                              )}>
                                KELAS {res.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="space-y-1">
                                {res.category === 'A' && <span className="text-green-700 flex items-center gap-1"><UserCheck className="h-3 w-3" /> Pola pengerjaan natural</span>}
                                {res.category === 'B' && <span className="text-amber-700 flex items-center gap-1"><Info className="h-3 w-3" /> Ada indikasi bantuan luar</span>}
                                {res.category === 'C' && <span className="text-red-700 flex items-center gap-1 font-bold"><AlertTriangle className="h-3 w-3" /> Pola jawaban identik kelompok</span>}
                                {res.antiCheatWarningCount > 0 && <span className="text-destructive flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Terdeteksi pindah tab/split screen</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span className={cn("text-lg font-black", res.sharedWrongs >= 3 ? "text-red-600" : "text-muted-foreground")}>
                                  {res.sharedWrongs} Soal
                                </span>
                                <span className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Opsi Salah Sama</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="text-xl font-black text-primary">{res.totalScore}</div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ProtectedRoute>
  );
}
