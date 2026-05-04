
"use client";

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, Download, Search, FileText, Calendar, TrendingUp, User as UserIcon, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { useFirestore } from "@/firebase";
import { collection, collectionGroup, getDocs, query, orderBy } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AdminReportsPage() {
  const router = useRouter();
  const db = useFirestore();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [examsMap, setExamsMap] = useState<Record<string, any>>({});
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setPermissionDenied(false);
      try {
        // Fetch users and exams first
        const [usersSnap, examsSnap] = await Promise.all([
          getDocs(collection(db, "userProfiles")),
          getDocs(collection(db, "exams"))
        ]);

        const uMap: Record<string, any> = {};
        usersSnap.forEach(doc => uMap[doc.id] = doc.data());
        setUsersMap(uMap);

        const eMap: Record<string, any> = {};
        examsSnap.forEach(doc => eMap[doc.id] = doc.data());
        setExamsMap(eMap);

        // Fetch results via collection group
        const resultsQuery = query(collectionGroup(db, "results"), orderBy("submissionTime", "desc"));
        const resultsSnap = await getDocs(resultsQuery);
        const resultsList = resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setResults(resultsList);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching reports:", err);
        if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
          setPermissionDenied(true);
          const permissionError = new FirestorePermissionError({
            path: 'collectionGroup(results)',
            operation: 'list'
          });
          errorEmitter.emit('permission-error', permissionError);
        }
        setLoading(false);
      }
    };

    fetchData();
  }, [db]);

  const filteredResults = results.filter(res => {
    const student = usersMap[res.studentId];
    const studentName = student?.displayName || student?.email || "Unknown";
    const exam = examsMap[res.examId];
    const examTitle = exam?.title || "Unknown Exam";
    const searchString = `${studentName} ${examTitle}`.toLowerCase();
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
            <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden sm:flex" disabled={permissionDenied}>
              <Download className="h-4 w-4 mr-2" /> Cetak Laporan
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-6xl">
          {permissionDenied ? (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="pt-6 text-center space-y-4">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                <h2 className="text-xl font-bold text-destructive">Akses Database Ditolak</h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Akun Anda belum memiliki izin akses penuh ke database hasil ujian. 
                  Pastikan UID Anda sudah terdaftar di koleksi <strong>adminUsers</strong> di Console Firebase.
                </p>
                <Button variant="outline" onClick={() => window.location.reload()}>Coba Lagi</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="border-l-4 border-primary shadow-md">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Ujian Selesai</CardDescription>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-3xl font-bold">{results.length}</CardTitle>
                      <FileText className="h-8 w-8 text-primary/20" />
                    </div>
                  </CardHeader>
                </Card>
                <Card className="border-l-4 border-green-500 shadow-md">
                  <CardHeader className="pb-2">
                    <CardDescription>Rata-rata Skor Nasional</CardDescription>
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
                <Card className="border-l-4 border-secondary shadow-md">
                  <CardHeader className="pb-2">
                    <CardDescription>Peserta Terdaftar</CardDescription>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-3xl font-bold">{Object.keys(usersMap).length}</CardTitle>
                      <UserIcon className="h-8 w-8 text-secondary/20" />
                    </div>
                  </CardHeader>
                </Card>
              </div>

              <Card className="shadow-lg">
                <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 bg-muted/5">
                  <div>
                    <CardTitle className="text-xl">Daftar Riwayat Ujian</CardTitle>
                    <CardDescription>Pantau performa seluruh siswa dalam satu tabel.</CardDescription>
                  </div>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Cari nama siswa atau paket ujian..." 
                      className="pl-9 bg-white border-2 focus:border-primary"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                      <p className="text-muted-foreground animate-pulse">Menghimpun data laporan...</p>
                    </div>
                  ) : filteredResults.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/10">
                      <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-10" />
                      <p className="text-muted-foreground font-medium">Belum ada data pengerjaan ujian.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="font-bold">Siswa</TableHead>
                            <TableHead className="font-bold">Paket Ujian</TableHead>
                            <TableHead className="font-bold">Waktu Submit</TableHead>
                            <TableHead className="text-center font-bold">Skor</TableHead>
                            <TableHead className="text-center font-bold">Statistik</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredResults.map((res) => {
                            const user = usersMap[res.studentId];
                            const exam = examsMap[res.examId];
                            const date = new Date(res.submissionTime);
                            const formattedDate = date.toLocaleDateString('id-ID', {
                              day: '2-digit', month: 'short', year: 'numeric'
                            }) + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                            return (
                              <TableRow key={res.id} className="hover:bg-primary/5 transition-colors cursor-default">
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-primary">{user?.displayName || "Siswa"}</span>
                                    <span className="text-xs text-muted-foreground">{user?.email || "-"}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{exam?.title || "Ujian dihapus"}</TableCell>
                                <TableCell className="text-sm">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3 opacity-40 text-primary" />
                                    {formattedDate}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge 
                                    variant={res.totalScore >= 70 ? "default" : "destructive"} 
                                    className={cn(
                                      "font-black text-sm px-4 py-1",
                                      res.totalScore >= 70 ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                                    )}
                                  >
                                    {res.totalScore}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="text-xs font-mono bg-muted/80 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm">
                                    <span className="text-green-700 font-bold" title="Benar">{res.correctAnswerCount}B</span>
                                    <span className="w-px h-3 bg-muted-foreground/30"></span>
                                    <span className="text-red-700 font-bold" title="Salah">{res.incorrectAnswerCount}S</span>
                                    <span className="w-px h-3 bg-muted-foreground/30"></span>
                                    <span className="text-gray-600" title="Kosong">{res.unansweredCount || 0}K</span>
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
              </Card>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
