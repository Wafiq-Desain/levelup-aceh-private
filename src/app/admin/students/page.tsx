
"use client";

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Search, User, Mail, GraduationCap, Award, Info, RefreshCw, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { useFirestore } from "@/firebase";
import { collection, query, getDocs, where, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function AdminStudentsPage() {
  const router = useRouter();
  const db = useFirestore();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [examsMap, setExamsMap] = useState<Record<string, string>>({});
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchExams();
  }, [db]);

  const fetchExams = async () => {
    const examsSnap = await getDocs(collection(db, "exams"));
    const eMap: Record<string, string> = {};
    examsSnap.forEach(d => {
      eMap[d.id] = d.data().title;
    });
    setExamsMap(eMap);
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "userProfiles"), where("role", "==", "student"));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(list);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = async (student: any) => {
    setSelectedStudent(student);
    setResultsLoading(true);
    try {
      const q = query(collection(db, "users", student.id, "results"), orderBy("submissionTime", "desc"));
      const snapshot = await getDocs(q);
      setStudentResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error fetching student results:", err);
      setStudentResults([]);
    } finally {
      setResultsLoading(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const name = (s.displayName || "").toLowerCase();
    const email = (s.email || "").toLowerCase();
    const sClass = (s.class || "").toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search) || email.includes(search) || sClass.includes(search);
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
              <h1 className="text-xl font-bold text-primary">Manajemen Siswa</h1>
            </div>
            <Button variant="outline" size="sm" onClick={fetchStudents} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <Card className="shadow-lg border-none">
            <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 bg-muted/10 border-b">
              <div>
                <CardTitle className="text-lg">Daftar Siswa Terdaftar</CardTitle>
                <CardDescription>Kalkulasi total: {students.length} Siswa</CardDescription>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Cari Nama, Email, atau Kelas..." 
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
                  <p className="text-muted-foreground">Memuat data siswa...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-20">
                  <User className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                  <p className="text-muted-foreground">Tidak ada siswa yang ditemukan.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="font-bold text-foreground">NAMA LENGKAP</TableHead>
                        <TableHead className="font-bold text-foreground">EMAIL</TableHead>
                        <TableHead className="font-bold text-foreground">KELAS</TableHead>
                        <TableHead className="text-right font-bold text-foreground">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((s) => (
                        <TableRow key={s.id} className="hover:bg-muted/10">
                          <TableCell className="font-bold uppercase text-primary">{s.displayName || "N/A"}</TableCell>
                          <TableCell className="text-muted-foreground">{s.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">
                              <GraduationCap className="h-3 w-3 mr-1" /> {s.class || "Umum"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10" onClick={() => handleViewResults(s)}>
                              <Eye className="h-4 w-4 mr-2" /> Lihat Nilai
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        {/* Results Modal */}
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Histori Nilai: {selectedStudent?.displayName}
              </DialogTitle>
              <DialogDescription>
                Jenjang: {selectedStudent?.class || "Umum"} • Email: {selectedStudent?.email}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              {resultsLoading ? (
                <div className="py-10 text-center animate-pulse text-muted-foreground">Mencari data nilai...</div>
              ) : studentResults.length === 0 ? (
                <div className="py-10 text-center border-dashed border-2 rounded-lg bg-muted/20">
                  <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground">Siswa ini belum pernah menyelesaikan ujian.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {studentResults.map((res) => (
                    <div key={res.id} className="flex items-center justify-between p-4 border rounded-xl bg-white shadow-sm hover:border-primary transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-base">{examsMap[res.examId] || "Ujian Terhapus"}</span>
                        <span className="text-xs text-muted-foreground">
                          Diselesaikan pada: {new Date(res.submissionTime).toLocaleString('id-ID')}
                        </span>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50">Benar: {res.correctAnswerCount}</Badge>
                          <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">Salah: {res.incorrectAnswerCount}</Badge>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-black text-primary">{res.totalScore}</div>
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Skor IRT</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end mt-4">
              <Button onClick={() => setSelectedStudent(null)}>Tutup</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
