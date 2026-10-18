import { WorldPreview } from '@cfgcn/ui';
import { world } from './world';

export default function World(props: Omit<Parameters<typeof WorldPreview>[0], 'world'>) {
  return <WorldPreview world={world} {...props} />;
}
