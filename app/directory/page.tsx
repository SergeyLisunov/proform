import { redirect } from 'next/navigation'

export default function Page() {
  redirect('/network?tab=find&type=coach')
}
