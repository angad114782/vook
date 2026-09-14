import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { caApi } from '../../api/companyAdmin';
export default function CALandingPage() {
  const query = useQuery({ queryKey: ['ca', 'onboarding'], queryFn: () => caApi.getOnboarding().then((response) => response.data) });
  if (query.isLoading) return <div className="empty-state">Loading company workspace…</div>;
  return <Navigate to={['READY', 'COMPLETED'].includes(query.data?.onboarding.status ?? '') ? '/company-admin/dashboard' : '/company-admin/onboarding'} replace />;
}
