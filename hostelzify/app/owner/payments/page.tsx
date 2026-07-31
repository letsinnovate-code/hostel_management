'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OwnerPaymentsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/owner/fee-structure');
  }, [router]);
  return null;
}
