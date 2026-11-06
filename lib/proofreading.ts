export type WritingIssue={start:number;end:number;kind:'spelling'|'grammar';message:string;suggestions:string[]};
type SpellChecker={correct:(word:string)=>boolean;suggest:(word:string)=>string[]};
export function findWritingIssues(text:string,spell?:SpellChecker,ignored:ReadonlySet<string>=new Set()):WritingIssue[]{
 const issues:WritingIssue[]=[];const protect=[...text.matchAll(/```[^]*?```|`[^`\r\n]+`|https?:\/\/\S+|\$[^$\r\n]+\$|\\[a-zA-Z]+(?:\{[^}]*\})?/g)].map(m=>[m.index!,m.index!+m[0].length]);
 const add=(issue:WritingIssue)=>{if(!ignored.has(text.slice(issue.start,issue.end).toLowerCase())&&!protect.some(([a,b])=>issue.start<b&&issue.end>a)&&!issues.some(i=>issue.start<i.end&&issue.end>i.start))issues.push(issue);};
 const grammar:[RegExp,(m:RegExpMatchArray)=>string,string][]=[[/\b(i)\b/g,()=> 'I','Capitalize the pronoun I.'],[/\b(\w+)([ \t]+\1)\b/gi,m=>m[1],'Repeated word.'],[/\bI has\b/gi,()=> 'I have','Use “have” with “I”.'],[/\b(?:he|she|it) have\b/gi,m=>m[0].replace(/have/i,'has'),'Check subject–verb agreement.'],[/\b(?:they|we|you) is\b/gi,m=>m[0].replace(/is/i,'are'),'Check subject–verb agreement.'],[/\b(?:researcher|student|leader) have\b/gi,m=>m[0].replace(/have/i,'has'),'Check subject–verb agreement.'],[/\b(?:researchers|students|leaders) has\b/gi,m=>m[0].replace(/has/i,'have'),'Check subject–verb agreement.']];
 for(const[rule,replacement,message]of grammar)for(const m of text.matchAll(rule))add({start:m.index!,end:m.index!+m[0].length,kind:'grammar',message,suggestions:[replacement(m)]});
 const typos:Record<string,string>={teh:'the',recieve:'receive',recieved:'received',seperate:'separate',definately:'definitely',grammer:'grammar',writting:'writing',architype:'archetype',becuase:'because',thier:'their',occured:'occurred',accomodate:'accommodate'};
 for(const m of text.matchAll(/\b[A-Za-z]+(?:'[A-Za-z]+)?\b/g)){
  if(issues.length>=80)break;
  const word=m[0],lower=word.toLowerCase();if(ignored.has(lower)||word.length<3||/^[A-Z]{2,}$/.test(word))continue;
  const known=typos[lower];if(!known&&(!spell||spell.correct(word)||spell.correct(lower)))continue;
  const suggestions=known?[(/^[A-Z]/.test(word)?known[0].toUpperCase()+known.slice(1):known)]:spell!.suggest(word).slice(0,3);
  add({start:m.index!,end:m.index!+word.length,kind:'spelling',message:`Check spelling of “${word}”.`,suggestions});
 }
 return issues.sort((a,b)=>a.start-b.start).slice(0,80);
}
