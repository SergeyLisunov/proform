import { redirect } from 'next/navigation'

export default function Page() {
  redirect('/org/members?role=athlete')
}
