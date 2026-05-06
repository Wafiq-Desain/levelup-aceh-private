
"use client";

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { useAppAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, GraduationCap, MapPin, Phone, Calendar as CalendarIcon, Users } from "lucide-react";

export default function CompleteProfilePage() {
  const { user, role } = useAppAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");

  useEffect(() => {
    if (!user) return;
    
    const fetchProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, "userProfiles", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.displayName || user.displayName || "");
          setStudentClass(data.class || "");
          setSchoolName(data.schoolName || "");
          setPhoneNumber(data.phoneNumber || "");
          setBirthDate(data.birthDate || "");
          setGender(data.gender || "");
          
          // If already complete, redirect to dashboard
          if (data.displayName && data.class && data.schoolName && data.phoneNumber && data.birthDate && data.gender) {
            router.replace("/dashboard");
          }
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [user, db, router]);

  const handleSave = () => {
    if (!name || !studentClass || !schoolName || !phoneNumber || !birthDate || !gender) {
      toast({ variant: "destructive", title: "Mohon lengkapi seluruh data profil Anda" });
      return;
    }

    setSaving(true);
    const profileRef = doc(db, "userProfiles", user!.uid);
    const updatedData = {
      displayName: name,
      class: studentClass,
      schoolName: schoolName,
      phoneNumber: phoneNumber,
      birthDate: birthDate,
      gender: gender,
      updatedAt: new Date().toISOString()
    };

    setDocumentNonBlocking(profileRef, updatedData, { merge: true });
    
    toast({ title: "Profil Disimpan", description: "Terima kasih telah melengkapi data diri Anda." });
    
    setTimeout(() => {
      setSaving(false);
      router.push("/dashboard");
    }, 1500);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl shadow-2xl border-t-8 border-primary">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary">Lengkapi Biodata Siswa</CardTitle>
            <CardDescription>
              Silakan lengkapi data diri Anda untuk melanjutkan ke aplikasi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><User className="h-4 w-4" /> Nama Lengkap</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Lengkap Sesuai Ijazah" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Pilih Kelas</Label>
                <Select value={studentClass} onValueChange={setStudentClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenjang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10 SMA">10 SMA</SelectItem>
                    <SelectItem value="11 SMA">11 SMA</SelectItem>
                    <SelectItem value="12 SMA">12 SMA</SelectItem>
                    <SelectItem value="Gapyear">Gapyear / Alumni</SelectItem>
                    <SelectItem value="Kedinasan">Kedinasan</SelectItem>
                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> Tanggal Lahir</Label>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Jenis Kelamin</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Jenis Kelamin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                    <SelectItem value="Perempuan">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Asal Sekolah</Label>
                <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Contoh: SMAN 1 Banda Aceh" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Nomor WhatsApp</Label>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="08123456789" />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-12 text-lg font-bold bg-primary shadow-lg" onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan & Masuk ke Dashboard"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
