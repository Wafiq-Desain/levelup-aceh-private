
"use client";

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash, Save, ChevronLeft, LayoutList, FilePlus, Pencil, Image as ImageIcon, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useFirestore } from "@/firebase";
import { collection, getDocs, query, orderBy, doc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminExamsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const db = useFirestore();
  
  const [activeTab, setActiveTab] = useState("list");
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [questions, setQuestions] = useState<any[]>([
    { questionText: "", options: ["", "", "", "", ""], correctAnswerIndex: 0, difficultyLevel: "medium", imageUrl: "" }
  ]);

  useEffect(() => {
    fetchExams();
  }, [db]);

  const fetchExams = async () => {
    setLoading(true);
    const q = query(collection(db, "exams"), orderBy("createdAt", "desc"));
    getDocs(q)
      .then(querySnapshot => {
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setExams(list);
        setLoading(false);
      })
      .catch(async (err) => {
        const permissionError = new FirestorePermissionError({
          path: 'exams',
          operation: 'list'
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
      });
  };

  const handleEditExam = async (exam: any) => {
    setEditingExamId(exam.id);
    setTitle(exam.title);
    setDuration(String(exam.durationMinutes));
    
    setLoading(true);
    const q = query(collection(db, "exams", exam.id, "questions"), orderBy("createdAt", "asc"));
    getDocs(q)
      .then(qSnap => {
        const qList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (qList.length > 0) {
          setQuestions(qList);
        } else {
          setQuestions([{ questionText: "", options: ["", "", "", "", ""], correctAnswerIndex: 0, difficultyLevel: "medium", imageUrl: "" }]);
        }
        setLoading(false);
        setActiveTab("new");
      })
      .catch(async (err) => {
        const permissionError = new FirestorePermissionError({
          path: `exams/${exam.id}/questions`,
          operation: 'list'
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
      });
  };

  const resetForm = () => {
    setEditingExamId(null);
    setTitle("");
    setDuration("60");
    setQuestions([{ questionText: "", options: ["", "", "", "", ""], correctAnswerIndex: 0, difficultyLevel: "medium", imageUrl: "" }]);
  };

  const addQuestion = () => {
    setQuestions([...questions, { questionText: "", options: ["", "", "", "", ""], correctAnswerIndex: 0, difficultyLevel: "medium", imageUrl: "" }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const handleFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateQuestion(index, "imageUrl", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[qIdx].options[oIdx] = value;
    setQuestions(newQuestions);
  };

  const handleSaveExam = () => {
    if (!title) {
      toast({ variant: "destructive", title: "Judul Wajib Diisi" });
      return;
    }
    
    setSaving(true);
    const examData = {
      title,
      durationMinutes: parseInt(duration),
      updatedAt: new Date().toISOString(),
    };

    let examRef;
    if (editingExamId) {
      examRef = doc(db, "exams", editingExamId);
      setDocumentNonBlocking(examRef, examData, { merge: true });
    } else {
      examRef = doc(collection(db, "exams"));
      const newExamData = {
        ...examData,
        id: examRef.id,
        questionIds: [],
        createdAt: new Date().toISOString(),
      };
      setDocumentNonBlocking(examRef, newExamData, { merge: true });
    }

    const questionIdsList: string[] = [];
    questions.forEach((q) => {
      const qId = q.id || doc(collection(db, "exams", examRef.id, "questions")).id;
      const qRef = doc(db, "exams", examRef.id, "questions", qId);
      questionIdsList.push(qId);
      
      setDocumentNonBlocking(qRef, {
        id: qId,
        examId: examRef.id,
        questionText: q.questionText,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
        difficultyLevel: q.difficultyLevel,
        imageUrl: q.imageUrl || "",
        updatedAt: new Date().toISOString(),
        createdAt: q.createdAt || new Date().toISOString()
      }, { merge: true });
    });

    setDocumentNonBlocking(examRef, { questionIds: questionIdsList }, { merge: true });

    toast({ title: "Berhasil", description: "Paket ujian telah disimpan." });
    setTimeout(() => {
      resetForm();
      setActiveTab("list");
      fetchExams();
      setSaving(false);
    }, 1000);
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-muted/30 pb-20">
        <header className="bg-white border-b shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold">{editingExamId ? "Mode Edit Ujian" : "Manajemen Ujian"}</h1>
            </div>
            <div className="flex gap-2">
              {editingExamId && (
                <Button variant="outline" onClick={() => {
                  resetForm();
                  setActiveTab("list");
                }}>
                  Batal Edit
                </Button>
              )}
              {activeTab === 'new' && (
                <Button className="bg-primary" onClick={handleSaveExam} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Menyimpan..." : (editingExamId ? "Perbarui" : "Simpan Ujian")}
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <Tabs value={activeTab} onValueChange={(val) => {
            if (val === 'list') resetForm();
            setActiveTab(val);
          }} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <LayoutList className="h-4 w-4" /> Daftar Ujian
              </TabsTrigger>
              <TabsTrigger value="new" className="flex items-center gap-2">
                <FilePlus className="h-4 w-4" /> {editingExamId ? "Edit Ujian" : "Ujian Baru"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4">
              {loading ? (
                <div className="text-center py-20 flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                  <span>Memuat data ujian...</span>
                </div>
              ) : exams.length === 0 ? (
                <Card className="border-dashed border-2 py-20 text-center">
                  <p className="text-muted-foreground mb-4">Belum ada ujian yang dibuat.</p>
                  <Button onClick={() => setActiveTab("new")}>Buat Ujian Pertama</Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exams.map((exam) => (
                    <Card key={exam.id} className="hover:shadow-md transition-all border-l-4 border-primary">
                      <CardHeader>
                        <CardTitle className="text-lg">{exam.title}</CardTitle>
                        <CardDescription>{exam.durationMinutes} Menit • Dibuat {new Date(exam.createdAt).toLocaleDateString()}</CardDescription>
                      </CardHeader>
                      <CardFooter className="flex justify-end gap-2 border-t pt-4 bg-muted/5">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/ujian/${exam.id}`)}>
                          Pratinjau
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleEditExam(exam)}>
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="new" className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Informasi Dasar</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Judul Ujian</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Try Out SNBT Matematika" />
                  </div>
                  <div className="space-y-2">
                    <Label>Durasi (Menit)</Label>
                    <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Daftar Soal ({questions.length})</h2>
                  <Button variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="h-4 w-4 mr-2" /> Tambah Soal
                  </Button>
                </div>

                {questions.map((q, qIdx) => (
                  <Card key={qIdx} className="relative overflow-hidden shadow-sm border-t-2 border-primary">
                    <CardHeader className="flex flex-row items-center justify-between bg-muted/10">
                      <CardTitle className="text-lg">Soal Nomor {qIdx + 1}</CardTitle>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeQuestion(qIdx)} disabled={questions.length <= 1}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="space-y-2">
                        <Label>Pertanyaan (Mendukung LaTeX)</Label>
                        <Textarea 
                          value={q.questionText} 
                          onChange={(e) => updateQuestion(qIdx, "questionText", e.target.value)} 
                          placeholder="Masukkan pertanyaan di sini... Gunakan $...$ untuk rumus matematika."
                          className="min-h-[100px]"
                        />
                      </div>

                      <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                        <Label className="flex items-center gap-2 mb-2 font-bold">
                          <ImageIcon className="h-4 w-4 text-primary" /> Media Gambar Soal
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Unggah dari Perangkat</Label>
                            <Input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => handleFileUpload(qIdx, e)}
                              className="cursor-pointer bg-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Atau URL Gambar</Label>
                            <Input 
                              value={q.imageUrl || ""} 
                              onChange={(e) => updateQuestion(qIdx, "imageUrl", e.target.value)} 
                              placeholder="https://example.com/foto.jpg"
                              className="bg-white"
                            />
                          </div>
                        </div>
                        {q.imageUrl && (
                          <div className="mt-4 border rounded-lg p-2 bg-white flex justify-center relative group">
                            <img src={q.imageUrl} alt="Preview" className="max-h-48 object-contain rounded" />
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => updateQuestion(qIdx, "imageUrl", "")}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {q.options.map((opt: string, oIdx: number) => (
                          <div key={oIdx} className="space-y-2">
                            <Label>Opsi {String.fromCharCode(65 + oIdx)}</Label>
                            <Input value={opt} onChange={(e) => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Jawaban ${String.fromCharCode(65 + oIdx)}`} />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                        <div className="space-y-2">
                          <Label className="font-bold text-primary">Kunci Jawaban Benar</Label>
                          <Select value={String(q.correctAnswerIndex)} onValueChange={(val) => updateQuestion(qIdx, "correctAnswerIndex", parseInt(val))}>
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Opsi A</SelectItem>
                              <SelectItem value="1">Opsi B</SelectItem>
                              <SelectItem value="2">Opsi C</SelectItem>
                              <SelectItem value="3">Opsi D</SelectItem>
                              <SelectItem value="4">Opsi E</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bold">Tingkat Kesulitan (IRT)</Label>
                          <Select value={q.difficultyLevel} onValueChange={(val) => updateQuestion(qIdx, "difficultyLevel", val)}>
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">Mudah</SelectItem>
                              <SelectItem value="medium">Sedang</SelectItem>
                              <SelectItem value="hard">Sulit</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <Button className="w-full h-14 text-xl font-bold bg-primary shadow-lg hover:shadow-xl transition-all" onClick={handleSaveExam} disabled={saving}>
                <Save className="h-6 w-6 mr-2" /> 
                {saving ? "Sedang Mengirim..." : (editingExamId ? "Perbarui Seluruh Paket Ujian" : "Simpan Seluruh Paket Ujian")}
              </Button>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ProtectedRoute>
  );
}
