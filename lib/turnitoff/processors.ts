import {unzipSync,zipSync,strFromU8,strToU8,gzipSync} from 'fflate';
import {XMLValidator} from 'fast-xml-parser';
import {parse} from '@babel/parser';
import {parser as python} from '@lezer/python';
import {transformText,defaultOptions,type Options,type TransformResult,type Change} from './engine.ts';
export type FileReport={name:string;status:'changed'|'unchanged'|'preserved';changes:number;details:string[]};
export type ProcessedFile={data:Uint8Array;name:string;reports:FileReport[]};
const ext=(name:string)=>name.toLowerCase().split('.').pop()||'';
const sourceExtensions=['js','jsx','ts','tsx','mjs','cjs','py'];
function codeRanges(text:string,extension:string){
 const ranges:{start:number;end:number}[]=[];
 if(extension==='py'){
  const tree=python.parse(text);let error=false;tree.iterate({enter(node){if(node.type.isError)error=true;if(node.name==='Comment')ranges.push({start:node.from,end:node.to});}});if(error)throw Error('Python syntax could not be verified. File retained unchanged.');
 }else{
  const ast=parse(text,{sourceType:'unambiguous',plugins:[...(extension==='ts'||extension==='tsx'?['typescript' as const]:[]),...(extension==='jsx'||extension==='tsx'?['jsx' as const]:[])],attachComment:true});for(const c of ast.comments||[])if(c.start!=null&&c.end!=null)ranges.push({start:c.start,end:c.end});
 }
 return ranges;
}
export function transformCode(text:string,extension:string,options:Options=defaultOptions){
 options={...options,fidelity:Math.max(options.fidelity,options.commentPersona==='Architect'?99:options.commentPersona==='Intermediate'?97:95)};
 const ranges=codeRanges(text,extension);const changes:Change[]=[];let result=text;
 for(const range of ranges.slice().reverse()){
  const comment=text.slice(range.start,range.end);
  // Tool directives, pragmas, shebangs, documentation annotations and type comments are executable-adjacent contracts.
  if(/eslint|prettier|@ts-|istanbul|c8 ignore|sourceMappingURL|sourceURL|coding[:=]|type:|noqa|fmt:|@param|@return|@license|copyright|^#!/i.test(comment))continue;
  const t=transformText(comment,options);changes.push(...t.changes);result=result.slice(0,range.start)+t.text+result.slice(range.end);
 }
 const afterRanges=codeRanges(result,extension);const without=(s:string,rs:typeof ranges)=>{let out='',cursor=0;for(const r of rs){out+=s.slice(cursor,r.start);cursor=r.end;}return out+s.slice(cursor);};
 if(without(text,ranges)!==without(result,afterRanges))throw Error('Executable code audit failed. Original retained.');
 return {text:result,changes,commentCount:ranges.length,details:['Only parser-identified comments were eligible. Executable text and docstrings were preserved byte-for-byte.','Compiler/tool directives were excluded. AST parsing was checked before and after.']};
}
const decode=(s:string)=>s.replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi,(_,hex,dec,entity)=>hex?String.fromCodePoint(parseInt(hex,16)):dec?String.fromCodePoint(Number(dec)):(({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[String(entity).toLowerCase()]||_));
const encode=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export function transformDocxXml(xml:string,options:Options=defaultOptions){
 if(XMLValidator.validate(xml)!==true)throw Error('Invalid Word XML. Original retained.');let count=0,skipped=0;
 const result=xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g,paragraph=>{
  const runs=[...paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)];const plain=runs.map(r=>decode(r[1])).join('');
  // Run boundaries can bisect a quote/citation. Leave those whole paragraphs untouched rather than guessing a mapping.
  if(options.protectedTerms.some(term=>term.trim()&&plain.toLowerCase().includes(term.toLowerCase()))||/[\\$\[\]“”"(){}]/.test(plain)||/<(?:m:|w:(?:instrText|fldChar|fldSimple|hyperlink|del|ins|drawing|object))\b/.test(paragraph)){skipped++;return paragraph;}
  return paragraph.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,(whole,start,body,end)=>{const original=decode(body);const t=transformText(original,options);if(t.text===original)return whole;count+=t.changes.reduce((n,c)=>n+c.count,0);return start+encode(t.text)+end;});
 });
 if(XMLValidator.validate(result)!==true)throw Error('Word XML audit failed. Original retained.');
 // Every tag and attribute must be identical; only w:t text contents may differ.
 const skeleton=(s:string)=>s.replace(/(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/g,'$1$2');if(skeleton(xml)!==skeleton(result))throw Error('Word formatting audit failed.');
 return {xml:result,count,skipped};
}
function unpack(data:Uint8Array){let total=0,count=0;const files=unzipSync(data,{filter:file=>{count++;total+=file.originalSize;if(count>500||file.originalSize>20*1024*1024||total>50*1024*1024)throw Error('Archive exceeds the 500-entry / 20 MB per-entry / 50 MB expanded limit.');if(/(^[\/\\]|^[a-z]:|(?:^|[\/\\])\.\.(?:[\/\\]|$))/i.test(file.name))throw Error('Archive contains an unsafe path.');return true;}});return files;}
function docx(data:Uint8Array,name:string,options:Options):ProcessedFile{
 const files=unpack(data);if(!files['[Content_Types].xml']||!files['word/document.xml'])throw Error('Not a valid DOCX package.');let changed=0,skipped=0;for(const key of Object.keys(files)){if(/^word\/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(key)){const result=transformDocxXml(strFromU8(files[key]),options);changed+=result.count;skipped+=result.skipped;if(result.count)files[key]=strToU8(result.xml);}}
 return {data:changed?zipSync(files,{level:6}):data,name,reports:[{name,status:changed?'changed':'unchanged',changes:changed,details:[`Run-level text edits only. ${skipped} paragraphs containing structured/protected content were conservatively skipped.`,'All XML tags/attributes, media, document properties, styles, tables, headers and other package entries were retained. Metadata was not stripped.']} ]};
}
export function processFile(data:Uint8Array,name:string,options:Options=defaultOptions,insideZip=false):ProcessedFile{
 if(data.length>10*1024*1024)throw Error('Choose a file of 10 MB or less.');const extension=ext(name);
 if(extension==='docx')return docx(data,name,options);
 if(extension==='zip'&&!insideZip){const files=unpack(data);const reports:FileReport[]=[];let changed=false;for(const key of Object.keys(files)){if(key.endsWith('/'))continue;const fileExt=ext(key);if(fileExt==='zip'||!['docx','tex','md','txt',...sourceExtensions].includes(fileExt)){reports.push({name:key,status:'preserved',changes:0,details:['Unsupported/binary/nested archive entry retained byte-for-byte.']});continue;}try{const result=processFile(files[key],key,options,true);files[key]=new Uint8Array(result.data);reports.push(...result.reports);if(result.reports.some(r=>r.status==='changed'))changed=true;}catch(e){reports.push({name:key,status:'preserved',changes:0,details:[e instanceof Error?e.message:'Unable to verify file. Original retained.']});}}return {data:changed?zipSync(files,{level:6}):data,name,reports};}
 if(!['txt','md','tex',...sourceExtensions].includes(extension))throw Error('Use TXT, Markdown, LaTeX, DOCX, ZIP, JavaScript, TypeScript or Python. Other code languages are preserved in ZIPs.');
 let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{throw Error('Use UTF-8 text. Other encodings are retained unchanged.');}
 const bom=data[0]===239&&data[1]===187&&data[2]===191?'\uFEFF':'';
 if(sourceExtensions.includes(extension)){const result=transformCode(text,extension,options);return {data:strToU8(bom+result.text),name,reports:[{name,status:result.text===text?'unchanged':'changed',changes:result.changes.reduce((n,c)=>n+c.count,0),details:result.details}]};}
 const result=transformText(text,options);return {data:result.text===text?data:strToU8(bom+result.text),name,reports:[{name,status:result.text===text?'unchanged':'changed',changes:result.changes.reduce((n,c)=>n+c.count,0),details:[`${result.audit.protectedSpans} protected spans audited. Numbers and line breaks preserved.`,...result.warnings]}]};
}
export function gzipMetrics(text:string){const raw=strToU8(text);return {compressedBytes:gzipSync(raw,{level:9}).length,originalBytes:raw.length};}
