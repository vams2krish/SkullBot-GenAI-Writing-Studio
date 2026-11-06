import catalog from './rules.json' with {type:'json'};
export type Rule={id:string;from:string;to:string;stage:'concision'|'lexical'|'discourse';alignment:number;relation?:string};
export type Options={fidelity:number;zeroExpansion:boolean;discourse:boolean;concision:boolean;protectedTerms:string[];customRules?:Rule[];commentPersona?:'Beginner'|'Intermediate'|'Architect'};
export type Change={rule:string;from:string;to:string;count:number};
export type TransformResult={text:string;changes:Change[];audit:{protectedSpans:number;protectedIntact:boolean;numbersIntact:boolean;lineBreaksIntact:boolean;wordCountBefore:number;wordCountAfter:number;ruleVersion:string;ruleCount:number};warnings:string[]};
export const defaultOptions:Options={fidelity:95,zeroExpansion:true,discourse:true,concision:true,protectedTerms:[]};
export const ruleCatalog=catalog;
export const countWords=(s:string)=>s.trim()?s.trim().split(/\s+/).length:0;
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function loadRules(value:unknown):Rule[]{
 if(!Array.isArray(value)||value.length>500)throw Error('Provide a JSON array of at most 500 literal rules.');
 const ids=new Set<string>();return value.map((v,i)=>{if(!v||typeof v!=='object')throw Error(`Invalid rule ${i+1}.`);const r=v as Rule;if(typeof r.id!=='string'||!r.id.trim()||ids.has(r.id)||typeof r.from!=='string'||!r.from.trim()||r.from.length>120||typeof r.to!=='string'||!r.to.trim()||r.to.length>120||/[\r\n⟦⟧]/.test(r.from+r.to)||!['concision','lexical','discourse'].includes(r.stage)||!Number.isFinite(r.alignment)||r.alignment<0||r.alignment>100)throw Error(`Invalid or duplicate rule ${i+1}. Use literal, single-line phrases and an alignment from 0 to 100.`);ids.add(r.id);return {id:r.id,from:r.from,to:r.to,stage:r.stage,alignment:r.alignment};});
}
export function loadProtectedTerms(value:string):string[]{
 const trimmed=value.trim();if(!trimmed)return [];const terms:unknown=trimmed.startsWith('[')?JSON.parse(trimmed):trimmed.split(/\r?\n|,/);if(!Array.isArray(terms)||terms.length>500||terms.some(t=>typeof t!=='string'||t.length>200))throw Error('Use a list or JSON array of up to 500 protected terms (200 characters each).');return [...new Set((terms as string[]).map(t=>t.trim()).filter(Boolean))];
}
export function transformText(input:string,options:Options=defaultOptions):TransformResult{
 if(input.length>500000)throw Error('Use a document with at most 500,000 characters.');
 if(/[⟦⟧]/.test(input))throw Error('Remove reserved masking characters ⟦ and ⟧ before transforming.');
 const custom=loadRules(options.customRules??[]);if(custom.some(r=>catalog.rules.some(b=>b.id===r.id)))throw Error('Custom rule IDs must not duplicate bundled rule IDs.');
 const rules=[...catalog.rules as Rule[],...custom];const protectedValues:string[]=[];const mask=(s:string)=>{const key=`⟦SB${protectedValues.length}⟧`;protectedValues.push(s);return key;};let work=input;
 const outside=(s:string,fn:(part:string)=>string)=>s.split(/(⟦SB\d+⟧)/g).map(part=>/^⟦SB\d+⟧$/.test(part)?part:fn(part)).join('');
 // Conservatively protect entire structured regions. Nothing inside them is rewritten.
 const patterns=[/```[^]*?```|~~~[^]*?~~~/g,/`[^`\r\n]+`/g,/\\begin\{(equation\*?|align\*?|gather\*?|verbatim|lstlisting|minted|tikzpicture|table\*?|figure\*?)\}[^]*?\\end\{\1\}/g,/\$\$[^]*?\$\$|\\\[[^]*?\\\]|\\\([^]*?\\\)|(?<!\\)\$[^$\r\n]+\$/g,/\\[a-zA-Z@]+\*?(?:\[[^\]\r\n]*\])?(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*/g,/!?\[[^\]\r\n]*\]\([^\)\r\n]*\)/g,/\[\[cite:[^\]\r\n]+\]\]|\[@[^\]]+\]|\[(?:\d+[ ,;–-]*)+\]|\([^\)\r\n]*\b(?:18|19|20)\d{2}[a-z]?[^\)\r\n]*\)|\([^\)\r\n]*n\.d\.[^\)\r\n]*\)/g,/https?:\/\/[^\s<>)]+|\b10\.\d{4,9}\/[^\s<>)]+/g,/[“"][^“”"\r\n]+[”"]/g,/\b\d+(?:[.,:/–-]\d+)*(?:\s?%|\s?(?:kg|mg|mL|km|Hz|kW|cm|mm))?\b/g];
 for(const pattern of patterns)work=outside(work,part=>part.replace(pattern,s=>mask(s)));
 for(const term of options.protectedTerms.slice().sort((a,b)=>b.length-a.length)){if(term.trim())work=outside(work,part=>part.replace(new RegExp(escape(term),'gi'),s=>mask(s)));}
 // The source of every protected value remains byte-exact, including nested tokens.
 const changes:Change[]=[];const min=Math.max(0,Math.min(100,options.fidelity));
 for(const rule of rules){if(rule.alignment<min||(!options.discourse&&rule.stage==='discourse')||(!options.concision&&rule.stage==='concision')||(options.zeroExpansion&&countWords(rule.to)>countWords(rule.from)))continue;const pattern=new RegExp(`(?<![\\p{L}\\p{N}_])${escape(rule.from)}(?![\\p{L}\\p{N}_])`,'giu');let count=0;work=outside(work,part=>part.replace(pattern,matched=>{count++;if(matched===matched.toUpperCase())return rule.to.toUpperCase();if(/^[A-Z]/.test(matched))return rule.to[0].toUpperCase()+rule.to.slice(1);return rule.to;}));if(count)changes.push({rule:rule.id,from:rule.from,to:rule.to,count});}
 let protectedIntact=true;for(let i=protectedValues.length-1;i>=0;i--){const token=`⟦SB${i}⟧`;if(work.split(token).length-1!==1)protectedIntact=false;work=work.replace(token,()=>protectedValues[i]);}
 const nums=(s:string)=>s.match(/\d+(?:[.,:/–-]\d+)*/g)||[];const numbersIntact=JSON.stringify(nums(input))===JSON.stringify(nums(work));const lineBreaksIntact=JSON.stringify(input.match(/\r\n|\r|\n/g)||[])===JSON.stringify(work.match(/\r\n|\r|\n/g)||[]);const before=countWords(input),after=countWords(work);
 if(!protectedIntact||!numbersIntact||!lineBreaksIntact||(options.zeroExpansion&&after>before))throw Error('Post-audit failed. The original document has been retained.');
 return {text:work,changes,audit:{protectedSpans:protectedValues.length,protectedIntact,numbersIntact,lineBreaksIntact,wordCountBefore:before,wordCountAfter:after,ruleVersion:catalog.version,ruleCount:rules.length},warnings:['Rule alignment is an authored threshold, not a learned probability. Review every change for meaning.','No detector bypass, plagiarism reduction, watermark removal, or authorship conclusion is established by these edits.']};
}
export function textMetrics(text:string){const bytes=new TextEncoder().encode(text);const freq=new Map<number,number>();for(const b of bytes)freq.set(b,(freq.get(b)||0)+1);let entropy=0;for(const n of freq.values()){const p=n/(bytes.length||1);entropy-=p*Math.log2(p);}const lengths=Array.from(new Intl.Segmenter('en',{granularity:'sentence'}).segment(text),s=>countWords(s.segment)).filter(Boolean);const mean=lengths.reduce((a,b)=>a+b,0)/(lengths.length||1);const deviation=Math.sqrt(lengths.reduce((n,x)=>n+(x-mean)**2,0)/(lengths.length||1));return {bytes:bytes.length,words:countWords(text),sentences:lengths.length,entropyBitsPerByte:entropy,sentenceMean:mean,sentenceDeviation:deviation,burstiness:mean?deviation/mean:0};}
export function ngramOverlap(before:string,after:string,n=5){const a=before.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];const b=after.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];const grams=(tokens:string[])=>new Set(Array.from({length:Math.max(0,tokens.length-n+1)},(_,i)=>tokens.slice(i,i+n).join(' ')));const first=grams(a),second=grams(b);if(!first.size&&!second.size)return null;const shared=[...first].filter(g=>second.has(g)).length;return shared/(new Set([...first,...second]).size||1);}

