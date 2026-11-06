import {citationParts,type Citation} from '../writing.ts';
export type SourceRecord=Citation&{subject?:string;topic?:string};
const latexEscape=(s:string)=>s.replace(/[\\{}%$#_&~^]/g,c=>({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','%':'\\%','$':'\\$','#':'\\#','_':'\\_','&':'\\&','~':'\\textasciitilde{}','^':'\\textasciicircum{}'}[c]!));
export function sourceKey(id:string){return 'src_'+id.replace(/[^a-zA-Z0-9_-]/g,'_');}
export function insertCitations(text:string,sources:SourceRecord[],style:'APA'|'IEEE'|'LaTeX'){
 const used:string[]=[];const missing:string[]=[];const next=text.replace(/\[\[cite:([^\]\r\n]+)\]\]/g,(marker,id)=>{const index=sources.findIndex(s=>s.id===id);if(index<0){missing.push(id);return marker;}if(!used.includes(id))used.push(id);return style==='APA'?citationParts(sources[index]).inText:style==='IEEE'?`[${index+1}]`:`\\cite{${sourceKey(id)}}`;});return {text:next,used,missing};
}
export function bibliography(sources:SourceRecord[],format:'JSON'|'BibTeX'|'LaTeX'|'APA'|'IEEE'){
 if(format==='JSON')return JSON.stringify(sources,null,2);
 if(format==='APA')return sources.slice().sort((a,b)=>citationParts(a).author.localeCompare(citationParts(b).author)).map(s=>citationParts(s).reference).join('\n\n');
 if(format==='IEEE')return sources.map((s,i)=>`[${i+1}] ${s.authors||s.title}, ${s.authors?'“'+s.title+'”, ':''}${s.publisher? s.publisher+', ':''}${s.year||'n.d.'}${s.url?'. [Online]. Available: '+s.url:''}.`).join('\n\n');
 if(format==='LaTeX')return '\\begin{thebibliography}{99}\n'+sources.map(s=>`\\bibitem{${sourceKey(s.id)}} ${latexEscape(citationParts(s).reference)}`).join('\n')+'\n\\end{thebibliography}';
 return sources.map(s=>`@${s.kind==='Book'?'book':s.kind==='Journal article'?'article':'misc'}{${sourceKey(s.id)},\n  title = {${latexEscape(s.title)}},\n${s.authors?'  author = {'+latexEscape(s.authors.split(';').map(a=>a.trim()).join(' and '))+'},\n':''}${s.year?'  year = {'+s.year+'},\n':''}${s.publisher?'  '+(s.kind==='Journal article'?'journal':'publisher')+' = {'+latexEscape(s.publisher)+'},\n':''}${s.volume?'  volume = {'+latexEscape(s.volume)+'},\n':''}${s.issue?'  number = {'+latexEscape(s.issue)+'},\n':''}${s.pages?'  pages = {'+latexEscape(s.pages)+'},\n':''}${s.url?'  url = {'+latexEscape(s.url)+'},\n':''}}`).join('\n\n');
}
