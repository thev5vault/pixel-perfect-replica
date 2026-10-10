import { useId, useState } from "react";
import { FileText, Upload } from "lucide-react";
export function PdfReceiptPicker({ onChange,onReadingChange }: { onChange: (file: { name: string; data: string } | undefined) => void; onReadingChange:(reading:boolean)=>void }) {
  const [error,setError]=useState("");
  const inputId = useId();
  const [fileName,setFileName]=useState("");
  return <div className="space-y-2 text-sm">
    <label htmlFor={inputId} className="relative flex min-h-24 cursor-pointer items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-slate-700/80 bg-slate-900/60 p-4 text-slate-300 transition-colors hover:border-cyan-500/50 hover:bg-slate-800/60 focus-within:ring-2 focus-within:ring-cyan-500/50">
      {fileName ? <FileText aria-hidden="true" className="h-5 w-5 shrink-0 text-cyan-400" /> : <Upload aria-hidden="true" className="h-5 w-5 shrink-0 text-cyan-400" />}
      <span className="min-w-0 break-words text-center">{fileName || "Choose a PDF receipt (up to 5 MB)"}</span>
    </label>
    <input id={inputId} className="sr-only" type="file" accept="application/pdf,.pdf" aria-describedby={error ? `${inputId}-error` : undefined} onChange={async e=>{
    const file=e.target.files?.[0];setError("");onChange(undefined);
    if(!file)return;
    if(file.type!=="application/pdf"||file.size>5*1024*1024){setFileName("");setError("Choose a PDF smaller than 5 MB.");return;}
    setFileName(file.name);
    onReadingChange(true);
    const reader=new FileReader();reader.onload=()=>{onChange({name:file.name.slice(0,120),data:String(reader.result)});onReadingChange(false);};reader.onerror=()=>{setFileName("");setError("The PDF could not be read.");onReadingChange(false);};reader.readAsDataURL(file);
  }}/>
  {error&&<span id={`${inputId}-error`} role="alert" className="block text-red-300">{error}</span>}</div>;
}
