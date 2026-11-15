import { PortaDoOnboarding } from '@/features/onboarding';
import { AbasDoApp } from '@/shared/components/BarraDeAbas';

export default function AbasLayout() {
  return (
    <>
      <PortaDoOnboarding />
      <AbasDoApp />
    </>
  );
}
