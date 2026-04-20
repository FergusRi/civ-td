const FIRST = [
  'Aldric','Brina','Cedric','Dagna','Edric','Freya','Gunnar','Helga',
  'Ivar','Jora','Knut','Lira','Magnus','Nora','Olaf','Petra','Ragnar',
  'Sigrid','Torben','Ulva','Viktor','Wren','Xander','Yara','Zora',
  'Bjorn','Calla','Dag','Elin','Falk','Greta','Holt','Ingrid','Jorik',
];

const LAST = [
  'Stoneback','Ironwood','Ashfield','Coldwater','Grimwald','Thornbury',
  'Blackfen','Silverdale','Oakveil','Duskmore','Redmoor','Frostholm',
  'Wildmere','Embervast','Stoneholt','Icewatch','Galeford','Ironveil',
];

export function randomName() {
  const f = FIRST[Math.floor(Math.random() * FIRST.length)];
  const l = LAST[Math.floor(Math.random() * LAST.length)];
  return `${f} ${l}`;
}
