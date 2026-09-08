'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SignupRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    const destination = params ? `/register?${params}` : '/register';
    router.replace(destination);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Redirecting to registration...</p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupRedirectContent />
    </Suspense>
  );
}
