
"use client";

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash, Save, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { db } from "@/lib/firebase-config";
import { collection, addDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function AdminExamsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [questions, setQuestions] = useState<any[]>([
    { question: "", options: ["", "", "", ""], correct_answer: "A", difficulty_level: 1 }
  ]);

  const addQuestion = () => {
    setQuestions([...questions, { question: "", options: ["", "", "", ""], correct_answer: "A", difficulty_level: 1 }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
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
    
    try {
      await addDoc(collection(db, "exams"), {
        title,
        duration: parseInt(duration),
        questions,
        createdAt: new Date(),
      });
      toast({ title: "Berhasil", description: "Ujian baru telah disimpan." });
      router.push("/dashboard");
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Gagal menyimpan ujian." });
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
              <h1 className="text-xl font-bold">Manajemen Ujian</h1>
            </div>
            <Button className="bg-primary" onClick={handleSaveExam}>
              <Save className="h-4 w-4 mr-2" />
              Simpan Ujian
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
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
              <h2 className="text-xl font-bold">Daftar Soal</h2>
              <Button variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="h-4 w-4 mr-2" /> Tambah Soal
              </Button>
            </div>

            {questions.map((q, qIdx) => (
              <Card key={qIdx} className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Soal #{qIdx + 1}</CardTitle>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeQuestion(qIdx)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Pertanyaan (Mendukung LaTeX)</Label>
                    <Textarea 
                      value={q.question} 
                      onChange={(e) => updateQuestion(qIdx, "question", e.target.value)} 
                      placeholder="Masukkan pertanyaan di sini... Gunakan $...$ untuk LaTeX."
                    />
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
                      <Select value={q.correct_answer} onValueChange={(val) => updateQuestion(qIdx, "correct_answer", val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">Opsi A</SelectItem>
                          <SelectItem value="B">Opsi B</SelectItem>
                          <SelectItem value="C">Opsi C</SelectItem>
                          <SelectItem value="D">Opsi D</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Difficulty Level (IRT Weight)</Label>
                      <Select value={String(q.difficulty_level)} onValueChange={(val) => updateQuestion(qIdx, "difficulty_level", parseInt(val))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Level 1 (Mudah)</SelectItem>
                          <SelectItem value="2">Level 2 (Sedang)</SelectItem>
                          <SelectItem value="3">Level 3 (Sulit)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <Button className="w-full h-12 text-lg bg-primary" onClick={handleSaveExam}>
            <Save className="h-5 w-5 mr-2" /> Simpan Seluruh Ujian
          </Button>
        </main>
      </div>
    </ProtectedRoute>
  );
}
