import { useState } from "react";
export function PdfReceiptPicker({ onChange,onReadingChange }: { onChange: (file: { name: string; data: string } | undefined) => void; onReadingChange:(reading:boolean)=>void }) {
  const [error,setError]=useState("");
  return <label className="block space-y-2 text-sm"><span>PDF receipt (up to 5 MB)</span><input className="field" type="file" accept="application/pdf" onChange={async e=>{
    const file=e.target.files?.[0];setError("");onChange(undefined);
    if(!file)return;
    if(file.type!=="application/pdf"||file.size>5*1024*1024){setError("Choose a PDF smaller than 5 MB.");return;}
    onReadingChange(true);
    const reader=new FileReader();reader.onload=()=>{onChange({name:file.name.slice(0,120),data:String(reader.result)});onReadingChange(false);};reader.onerror=()=>{setError("The PDF could not be read.");onReadingChange(false);};reader.readAsDataURL(file);
  }}/>{error&&<span role="alert" className="text-red-300">{error}</span>}</label>;
}
