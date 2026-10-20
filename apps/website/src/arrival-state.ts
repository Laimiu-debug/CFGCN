export type ArrivalStatus = {
  ready: boolean;
  playing: boolean;
  error: boolean;
  stage: 'download' | 'compile' | 'models';
  progress: number | null;
};
export const initialArrival: ArrivalStatus = {
  ready: false,
  playing: false,
  error: false,
  stage: 'download',
  progress: null,
};
