
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
import { User, GraduationCap, MapPin, Phone, Calendar as CalendarIcon, Users, LayoutList, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CompleteProfilePage() {
  const { user, role, loading: authLoading } = useAppAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [initialClass, setInitialClass] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    
    // Admin bypass biodata
    if (role === 'admin') {
      router.replace("/dashboard");
      return;
    }
    
    const fetchProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, "userProfiles", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.displayName || user.displayName || "");
          setStudentClass(data.class || "");
          setInitialClass(data.initialClass || "");
          setSchoolName(data.schoolName || "");
          setPhoneNumber(data.phoneNumber || "");
          setBirthDate(data.birthDate || "");
          setGender(data.gender || "");
          
          // Logic pengecekan kelengkapan yang identik dengan Dashboard
          const basicComplete = !!(
            (data.displayName || "").trim() && 
            data.class && 
            (data.schoolName || "").trim() && 
            (data.phoneNumber || "").trim() && 
            data.birthDate && 
            data.gender
          );

          const isMan2 = (data.schoolName || "").trim().toLowerCase().includes("man 2");
          const initialClassComplete = isMan2 ? !!(data.initialClass || "").trim() : true;

          if (basicComplete && initialClassComplete) {
            router.replace("/dashboard");
            return;
          }
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setFetchingProfile(false);
      }
    };
    
    fetchProfile();
  }, [user, role, authLoading, db, router]);

  const isMan2 = (schoolName || "").trim().toLowerCase().includes("man 2");

  const handleSave = () => {
    if (!user) return;
    
    const cleanName = name.trim();
    const cleanSchool = schoolName.trim();
    const cleanPhone = phoneNumber.trim();
    const cleanInitial = initialClass.trim();

    if (!cleanName || !studentClass || !cleanSchool || !cleanPhone || !birthDate || !gender) {
      toast({ variant: "destructive", title: "Mohon lengkapi seluruh data profil Anda" });
      return;
    }

    if (isMan2 && !cleanInitial) {
      toast({ variant: "destructive", title: "Khusus siswa MAN 2, mohon isi Inisial Kelas (contoh: F1)" });
      return;
    }

    setSaving(true);
    const profileRef = doc(db, "userProfiles", user.uid);
    const updatedData = {
      displayName: cleanName,
      class: studentClass,
      initialClass: isMan2 ? cleanInitial : "",
      schoolName: cleanSchool,
      phoneNumber: cleanPhone,
      birthDate: birthDate,
      gender: gender,
      updatedAt: new Date().toISOString()
    };

    setDocumentNonBlocking(profileRef, updatedData, { merge: true });
    
    toast({ title: "Profil Disimpan", description: "Terima kasih telah melengkapi data diri Anda." });
    
    setTimeout(() => {
      setSaving(false);
      router.replace("/dashboard");
    }, 1200);
  };

  if (authLoading || (fetchingProfile && role !== 'admin')) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Menyiapkan profil...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl shadow-2xl border-t-8 border-primary bg-white">
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
                <Label className="flex items-center gap-2 font-bold"><User className="h-4 w-4" /> Nama Lengkap</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Lengkap Sesuai Ijazah" className="bg-white h-11" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-bold"><GraduationCap className="h-4 w-4" /> Pilih Jenjang</Label>
                <Select value={studentClass} onValueChange={setStudentClass}>
                  <SelectTrigger className="bg-white h-11">
                    <SelectValue placeholder="Pilih jenjang" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
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
                <Label className="flex items-center gap-2 font-bold"><CalendarIcon className="h-4 w-4" /> Tanggal Lahir</Label>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="bg-white h-11" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-bold"><Users className="h-4 w-4" /> Jenis Kelamin</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="bg-white h-11">
                    <SelectValue placeholder="Pilih Jenis Kelamin" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                    <SelectItem value="Perempuan">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4" /> Asal Sekolah</Label>
                <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Contoh: MAN 2 Banda Aceh" className="bg-white h-11" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-bold"><Phone className="h-4 w-4" /> Nomor WhatsApp</Label>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="08123456789" className="bg-white h-11" />
              </div>
              {isMan2 && (
                <div className={cn("space-y-2 md:col-span-2 animate-in fade-in slide-in-from-top-1")}>
                  <Label className="flex items-center gap-2 text-primary font-bold"><LayoutList className="h-4 w-4" /> Inisial Kelas (Khusus MAN 2)</Label>
                  <Input value={initialClass} onChange={(e) => setInitialClass(e.target.value)} placeholder="Contoh: F1, F2, F3..." className="border-primary bg-white h-11 ring-primary/20" />
                  <p className="text-[10px] text-muted-foreground italic">*Penting: Masukkan inisial kelas Anda untuk keperluan data sekolah.</p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-12 text-lg font-bold bg-primary shadow-lg hover:shadow-xl transition-all" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Menyimpan...</> : "Simpan & Masuk ke Dashboard"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
