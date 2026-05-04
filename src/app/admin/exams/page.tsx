
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
import { collection, addDoc, getDocs, query, orderBy, doc, setDoc, deleteDoc } from "firebase/firestore";
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
    try {
      const q = query(collection(db, "exams"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExams(list);
    } catch (err) {
      console.error("Error fetching exams:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditExam = async (exam: any) => {
    setEditingExamId(exam.id);
    setTitle(exam.title);
    setDuration(String(exam.durationMinutes));
    
    // Fetch questions for this exam
    try {
      const qSnap = await getDocs(query(collection(db, "exams", exam.id, "questions"), orderBy("createdAt", "asc")));
      const qList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (qList.length > 0) {
        setQuestions(qList);
      } else {
        setQuestions([{ questionText: "", options: ["", "", "", "", ""], correctAnswerIndex: 0, difficultyLevel: "medium", imageUrl: "" }]);
      }
      
      setActiveTab("new");
    } catch (err) {
      console.error("Error fetching questions:", err);
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat soal ujian." });
    }
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

  const handleSaveExam = async () => {
    if (!title) {
      toast({ variant: "destructive", title: "Judul Wajib Diisi" });
      return;
    }
    
    setSaving(true);
    try {
      let examRef;
      const examData = {
        title,
        durationMinutes: parseInt(duration),
        updatedAt: new Date().toISOString(),
      };

      if (editingExamId) {
        examRef = doc(db, "exams", editingExamId);
        await setDoc(examRef, examData, { merge: true });
      } else {
        const newExamData = {
          ...examData,
          questionIds: [],
          createdAt: new Date().toISOString(),
        };
        examRef = await addDoc(collection(db, "exams"), newExamData);
      }

      // Hapus soal lama jika sedang mengedit (opsional, tergantung strategi update)
      // Untuk kesederhanaan, kita update/set soal berdasarkan urutan
      const questionsPromises = questions.map((q, idx) => {
        const qId = q.id || doc(collection(db, "exams", examRef.id, "questions")).id;
        const qRef = doc(db, "exams", examRef.id, "questions", qId);
        
        return setDoc(qRef, {
          id: qId,
          examId: examRef.id,
          questionText: q.questionText,
          options: q.options,
          correctAnswerIndex: q.correctAnswerIndex,
          difficultyLevel: q.difficultyLevel,
          imageUrl: q.imageUrl || "",
          updatedAt: new Date().toISOString(),
          createdAt: q.createdAt || new Date().toISOString()
        });
      });

      await Promise.all(questionsPromises);

      toast({ title: "Berhasil", description: editingExamId ? "Ujian telah diperbarui." : "Ujian baru telah disimpan." });
      resetForm();
      setActiveTab("list");
      fetchExams();
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "Gagal menyimpan ujian." });
    } finally {
      setSaving(false);
    }
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
              <h1 className="text-xl font-bold">{editingExamId ? "Edit Ujian" : "Manajemen Ujian"}</h1>
            </div>
            <div className="flex gap-2">
              {editingExamId && (
                <Button variant="outline" onClick={resetForm}>
                  Batal
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
                <div className="text-center py-20">Memuat data...</div>
              ) : exams.length === 0 ? (
                <Card className="border-dashed border-2 py-20 text-center">
                  <p className="text-muted-foreground mb-4">Belum ada ujian yang dibuat.</p>
                  <Button onClick={() => setActiveTab("new")}>Buat Ujian Pertama</Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exams.map((exam) => (
                    <Card key={exam.id} className="hover:shadow-md transition-all">
                      <CardHeader>
                        <CardTitle className="text-lg">{exam.title}</CardTitle>
                        <CardDescription>{exam.durationMinutes} Menit • Dibuat {new Date(exam.createdAt).toLocaleDateString()}</CardDescription>
                      </CardHeader>
                      <CardFooter className="flex justify-end gap-2 border-t pt-4">
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
                  <Card key={qIdx} className="relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">Soal #{qIdx + 1}</CardTitle>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeQuestion(qIdx)} disabled={questions.length <= 1}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Pertanyaan (Mendukung LaTeX)</Label>
                        <Textarea 
                          value={q.questionText} 
                          onChange={(e) => updateQuestion(qIdx, "questionText", e.target.value)} 
                          placeholder="Masukkan pertanyaan di sini... Gunakan $...$ untuk LaTeX."
                          className="min-h-[100px]"
                        />
                      </div>

                      <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                        <Label className="flex items-center gap-2 mb-2 font-bold">
                          <ImageIcon className="h-4 w-4" /> Media Gambar Soal
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Pilih Gambar Dari Komputer</Label>
                            <Input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => handleFileUpload(qIdx, e)}
                              className="cursor-pointer"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Atau Masukkan URL (Opsional)</Label>
                            <Input 
                              value={q.imageUrl || ""} 
                              onChange={(e) => updateQuestion(qIdx, "imageUrl", e.target.value)} 
                              placeholder="https://example.com/foto.jpg"
                            />
                          </div>
                        </div>
                        {q.imageUrl && (
                          <div className="mt-4 border rounded-lg p-2 bg-white flex justify-center relative group">
                            <img src={q.imageUrl} alt="Preview" className="max-h-40 object-contain rounded" />
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => updateQuestion(qIdx, "imageUrl", "")}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt: string, oIdx: number) => (
                          <div key={oIdx} className="space-y-2">
                            <Label>Opsi {String.fromCharCode(65 + oIdx)}</Label>
                            <Input value={opt} onChange={(e) => updateOption(qIdx, oIdx, e.target.value)} />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Jawaban Benar</Label>
                          <Select value={String(q.correctAnswerIndex)} onValueChange={(val) => updateQuestion(qIdx, "correctAnswerIndex", parseInt(val))}>
                            <SelectTrigger>
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
                          <Label>Tingkat Kesulitan (IRT)</Label>
                          <Select value={q.difficultyLevel} onValueChange={(val) => updateQuestion(qIdx, "difficultyLevel", val)}>
                            <SelectTrigger>
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
              
              <Button className="w-full h-12 text-lg bg-primary" onClick={handleSaveExam} disabled={saving}>
                <Save className="h-5 w-5 mr-2" /> 
                {saving ? "Sedang Menyimpan..." : (editingExamId ? "Perbarui Seluruh Ujian" : "Simpan Seluruh Ujian")}
              </Button>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ProtectedRoute>
  );
}
