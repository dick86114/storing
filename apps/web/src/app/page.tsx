import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Home() {
  const cookieStore = await cookies();
  const hasToken = Boolean(cookieStore.get('token')?.value || cookieStore.get('auth_token')?.value);
  redirect(hasToken ? '/inbox' : '/published');
}
