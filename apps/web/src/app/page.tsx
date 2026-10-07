import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Home() {
  const cookieStore = await cookies();
  const hasToken = Boolean(
    cookieStore.get('storing_token')?.value
    || cookieStore.get('storing_session')?.value,
  );
  redirect(hasToken ? '/inbox' : '/published');
}
