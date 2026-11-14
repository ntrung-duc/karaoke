export const motionSources = {
  idle: 'Idles/HumanM@Idle01',
  jump: 'Movement/Jump/HumanM@Jump01 - Begin',
  fall: 'Movement/Jump/HumanM@Fall01',
  land: 'Movement/Jump/HumanM@Jump01 - Land',
};
for (const gait of ['walk', 'run']) {
  const label = gait === 'walk' ? 'Walk' : 'Run';
  for (const direction of ['Forward', 'Backward', 'Left', 'Right', 'ForwardLeft', 'ForwardRight', 'BackwardLeft', 'BackwardRight']) {
    motionSources[gait + direction] = `Movement/${label}/HumanM@${label}01_${direction}`;
  }
}
