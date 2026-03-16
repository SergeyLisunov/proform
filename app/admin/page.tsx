'use client'
import { useState } from 'react'
const ROLE_S={athlete:{bg:'#DBEAFE',c:'#2563EB'},coach:{bg:'#FFEDD5',c:'#F97316'},admin:{bg:'#EDE9FE',c:'#7C3AED'}}
const users=[
  {id:1,name:'Sara Kowalski',email:'sara@athlete.com',role:'athlete',status:'active',joined:'Jan 2026'},
  {id:2,name:'Marcus Weiden',email:'marcus@athlete.com',role:'athlete',status:'active',joined:'Dec 2025'},
  {id:3,name:'James Thornton',email:'james@athlete.com',role:'athlete',status:'active',joined:'Feb 2026'},
  {id:4,name:'Linh Nguyen',email:'linh@athlete.com',role:'athlete',status:'active',joined:'Jan 2026'},
  {id:5,name:'David Clarke',email:'david@coach.com',role:'coach',status:'active',joined:'Oct 2025'},
  {id:6,name:'Sarah Mitchell',email:'sarah@coach.com',role:'coach',status:'active',joined:'Nov 2025'},
  {id:7,name:'Admin User',email:'admin@proform.io',role:'admin',status:'active',joined:'Sep 2025'},
]
export default function AdminPage() {
  const [roleFilter,setRoleFilter]=useState('all')
  const fu=roleFilter==='all'?users:users.filter(u=>u.role===roleFilter)
  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Supabase atlet-pro · eu-central-1</p>
          <h2 className="pf-num text-3xl text-slate-900">Admin Panel</h2>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{background:'#2563EB'}}>
          <i className="ki-filled ki-plus text-sm"/>Invite User
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{v:'127',l:'Total Users',c:'#2563EB'},{v:'98',l:'Athletes',c:'#F97316'},{v:'22',l:'Coaches',c:'#16A34A'},{v:'287',l:'Sessions / Week',c:'#7C3AED'}].map(({v,l,c})=>(
          <div key={l} className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{l}</div>
            <div className="pf-num text-4xl" style={{color:c}}>{v}</div>
          </div>
        ))}
      </div>
      <div className="card rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User Management</p>
          <div className="flex gap-2">
            {['all','athlete','coach','admin'].map(r=>(
              <button key={r} onClick={()=>setRoleFilter(r)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${roleFilter===r?'text-white bg-[#2563EB]':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {r==='all'?'All':r.charAt(0).toUpperCase()+r.slice(1)+'s'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{['Name','Email','Role','Status','Joined','Actions'].map(h=>(
              <th key={h} className="text-left py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#F1F5F9]">{h}</th>
            ))}</tr></thead>
            <tbody>{fu.map((u,i)=>{
              const rs=(ROLE_S as any)[u.role]||{bg:'#F1F5F9',c:'#64748B'}
              return <tr key={u.id} className={i%2===1?'bg-slate-50/50':''}>
                <td className="py-2.5 px-3 font-semibold text-slate-800 border-b border-[#F1F5F9]">{u.name}</td>
                <td className="py-2.5 px-3 text-slate-500 border-b border-[#F1F5F9]">{u.email}</td>
                <td className="py-2.5 px-3 border-b border-[#F1F5F9]"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:rs.bg,color:rs.c}}>{u.role}</span></td>
                <td className="py-2.5 px-3 border-b border-[#F1F5F9]"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A]"><i className="ki-filled ki-check text-[8px] mr-0.5"/>active</span></td>
                <td className="py-2.5 px-3 text-slate-400 text-xs border-b border-[#F1F5F9]">{u.joined}</td>
                <td className="py-2.5 px-3 border-b border-[#F1F5F9]">
                  <div className="flex gap-2">
                    <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"><i className="ki-filled ki-pencil text-xs"/></button>
                    <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition"><i className="ki-filled ki-trash text-xs"/></button>
                  </div>
                </td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
