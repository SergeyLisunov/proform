'use client'
import { useState } from 'react'
const CAL_EV:{[k:number]:{t:string,l:string,ld:number}}={
  3:{t:'train',l:'Running',ld:95},5:{t:'train',l:'Strength',ld:80},
  7:{t:'train',l:'Cycling',ld:120},9:{t:'train',l:'Intervals',ld:135},
  11:{t:'train',l:'Cycling',ld:120},13:{t:'train',l:'Long Run',ld:180},
  14:{t:'train',l:'Strength',ld:95},15:{t:'comp',l:'5K Race',ld:160},
  16:{t:'train',l:'Tempo Run',ld:145},18:{t:'train',l:'Easy Run',ld:60},
  20:{t:'train',l:'Strength',ld:85},21:{t:'train',l:'Cycling',ld:110},
  23:{t:'train',l:'Intervals',ld:140},25:{t:'train',l:'Long Run',ld:175},
  26:{t:'train',l:'Strength',ld:90},27:{t:'comp',l:'Regional 10K',ld:185},
}
const MICRO=[{s:1,e:7,lbl:'Micro 1 — Base',bg:'#EFF6FF',border:'#BFDBFE'},{s:8,e:14,lbl:'Micro 2 — Base',bg:'#EFF6FF',border:'#BFDBFE'},{s:15,e:21,lbl:'Micro 3 — Load',bg:'#FFF7ED',border:'#FED7AA'},{s:22,e:28,lbl:'Micro 4 — Load',bg:'#FFF7ED',border:'#FED7AA'},{s:29,e:31,lbl:'Micro 5 — Rest',bg:'#F0FDF4',border:'#BBF7D0'}]
export default function CalendarPage(){
  const [layer,setLayer]=useState('micro')
  const today=16,wdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const firstDay=new Date(2026,2,1).getDay()
  const cells:(number|null)[]=[]
  for(let i=0;i<firstDay;i++)cells.push(null)
  for(let d=1;d<=31;d++)cells.push(d)
  function getMicro(d:number){return MICRO.find(b=>d>=b.s&&d<=b.e)}
  function cellBg(d:number){
    if(layer==='micro'){const b=getMicro(d);return b?b.bg:'#fff'}
    if(layer==='meso')return d<=15?'#EFF6FF':'#FFF7ED'
    if(layer==='macro')return '#F0FDF4'
    return '#fff'
  }
  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Spring Base Block · 2026</p>
          <h2 className="pf-num text-3xl text-slate-900">March 2026</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{background:'#F97316'}}><i className="ki-filled ki-plus text-sm"/>Add Event</button>
          {['Month','Week','Day'].map(v=><button key={v} className="px-3.5 py-2.5 rounded-xl text-sm border border-[#E2E8F0] bg-white text-slate-500 hover:border-slate-300 transition">{v}</button>)}
        </div>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3 flex-wrap">
          {[{col:'#2563EB',lbl:'Training'},{col:'#F97316',lbl:'Competition'},{col:'#BFDBFE',brd:'#93C5FD',lbl:'Base Micro'},{col:'#FED7AA',brd:'#FDBA74',lbl:'Load Micro'},{col:'#BBF7D0',brd:'#6EE7B7',lbl:'Rest Micro'}].map(({col,lbl,brd})=>(
            <div key={lbl} className="flex items-center gap-1.5 text-xs text-slate-500"><div className="w-3 h-3 rounded-sm" style={{background:col,border:brd?`1.5px solid ${brd}`:'none'}}/>{lbl}</div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Cycles:</span>
          {['none','micro','meso','macro'].map(l=>(
            <button key={l} onClick={()=>setLayer(l)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${layer===l?'text-[#F97316] bg-orange-50 border border-orange-200':'text-slate-400 hover:text-slate-600'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="card rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-[#E2E8F0]">
          {wdays.map(d=><div key={d} className="py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day,i)=>{
            if(!day)return <div key={'e'+i} className="min-h-[88px] border-r border-b border-[#F1F5F9] bg-slate-50/50"/>
            const ev=CAL_EV[day],mb=getMicro(day),bg=cellBg(day),isTd=day===today
            return (
              <div key={day} className="min-h-[88px] p-2 border-r border-b border-[#F1F5F9] cursor-pointer hover:brightness-95 transition relative" style={{background:isTd?'#FFFBF5':bg}}>
                {mb&&layer==='micro'&&<div className="absolute top-0 left-0 right-0 h-0.5" style={{background:mb.border}}/>}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 ${isTd?'text-white':'text-slate-700'}`} style={isTd?{background:'#F97316'}:{}}>{day}</div>
                {ev&&<>
                  <div className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white mb-1 truncate" style={{background:ev.t==='comp'?'#F97316':'#2563EB'}}>{ev.l}</div>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1 rounded bg-slate-200"><div className="h-full rounded" style={{width:`${Math.min(ev.ld/2.1,100)}%`,background:ev.t==='comp'?'#F97316':'#2563EB'}}/></div>
                    <span className="text-[8px] text-slate-400 shrink-0">{ev.ld}</span>
                  </div>
                </>}
              </div>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {MICRO.map(b=>(
          <div key={b.lbl} className="rounded-xl p-3 border" style={{background:b.bg,borderColor:b.border}}>
            <div className="text-[10px] font-bold text-slate-600 mb-1">{b.lbl}</div>
            <div className="text-xs text-slate-500">Mar {b.s}–{b.e} · {b.e-b.s+1} days</div>
          </div>
        ))}
      </div>
    </div>
  )
}
