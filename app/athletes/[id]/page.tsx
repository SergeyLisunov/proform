import { redirect } from 'next/navigation'

export default async function Page({ params }: { params: { id: string } }) {
  redirect(`/profile/${params.id}`)
}
