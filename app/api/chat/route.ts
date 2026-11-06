import {env} from 'cloudflare:workers';
import {chatSchema,CHAT_SYSTEM} from '@/lib/chat';
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length')||0)>300000)return Response.json({error:'Conversation too large.'},{status:413});
  const raw=await request.text();if(raw.length>300000)return Response.json({error:'Conversation too large.'},{status:413});const parsed=chatSchema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message||'Invalid conversation.'},{status:400});
  const config=env as unknown as Record<string,string>;if(!config.OPENROUTER_API_KEY)return Response.json({error:'Connect OPENROUTER_API_KEY in the server environment to generate answers.'},{status:503});
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:AbortSignal.any([request.signal,AbortSignal.timeout(55000)]),headers:{Authorization:`Bearer ${config.OPENROUTER_API_KEY}`,'Content-Type':'application/json','X-Title':'SkullBot Chat'},body:JSON.stringify({model:config.OPENROUTER_MODEL||'openrouter/auto',messages:[{role:'system',content:CHAT_SYSTEM},...parsed.data.messages],temperature:.5,max_tokens:6000})});
  if(!response.ok)return Response.json({error:response.status===402?'OpenRouter credits are exhausted.':response.status===429?'OpenRouter is busy. Try again shortly.':response.status===401?'OpenRouter rejected the server API key.':'The answer provider could not complete this request.'},{status:502});
  const data=await response.json() as {choices?:{message?:{content?:string};finish_reason?:string}[]};const answer=data.choices?.[0]?.message?.content;if(typeof answer!=='string'||!answer.trim())return Response.json({error:'The provider returned no answer. Try again.'},{status:502});return Response.json({answer,incomplete:data.choices?.[0]?.finish_reason==='length',provider:'OpenRouter'});
 }catch(e){return Response.json({error:e instanceof SyntaxError?'Invalid request.':e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError')?'The request stopped or timed out. Try a shorter prompt.':'Unable to generate an answer. Please try again.'},{status:400});}
}
